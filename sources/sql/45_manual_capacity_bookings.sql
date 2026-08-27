begin;

create or replace function public.mirebook_create_manual_capacity_booking(
  p_owner_user_id uuid,
  p_customer_user_id uuid,
  p_departure_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_notes text,
  p_party_size integer,
  p_booking_option text,
  p_customer_notification_title text,
  p_customer_notification_message text,
  p_staff_notification_title text,
  p_staff_notification_message text
)
returns table (
  booking_id uuid,
  booking_status text,
  seats_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_departure public.service_departures%rowtype;
  selected_service public.services%rowtype;
  business_owner_id uuid;
  reserved_seats integer := 0;
  requested_seats integer;
  created_booking_id uuid;
  assigned_staff_user_id uuid;
  selected_unit_price numeric;
  selected_total_price numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'manual_capacity_booking_service_role_required';
  end if;

  if p_booking_option not in ('shared', 'private') then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_option_invalid';
  end if;

  if p_party_size is null or p_party_size < 1 or p_party_size > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_party_size_invalid';
  end if;

  select departures.*
  into selected_departure
  from public.service_departures as departures
  where departures.id = p_departure_id
  for update;

  if not found
    or selected_departure.status <> 'scheduled'
    or selected_departure.start_at <= now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_departure_unavailable';
  end if;

  select businesses.user_id
  into business_owner_id
  from public.businesses as businesses
  where businesses.id = selected_departure.business_id;

  if business_owner_id is distinct from p_owner_user_id then
    raise exception using
      errcode = '42501',
      message = 'manual_capacity_booking_owner_required';
  end if;

  select services.*
  into selected_service
  from public.services as services
  where services.id = selected_departure.service_id
    and services.business_id = selected_departure.business_id
    and services.active = true
    and services.booking_type = 'group';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_service_unavailable';
  end if;

  if p_party_size > selected_departure.capacity then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_party_size_invalid';
  end if;

  if p_booking_option = 'private'
    and coalesce(selected_service.private_booking_enabled, false) = false
  then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_private_unavailable';
  end if;

  select coalesce(sum(
    case
      when bookings.booking_option = 'private' then selected_departure.capacity
      else bookings.party_size
    end
  ), 0)::integer
  into reserved_seats
  from public.bookings
  where bookings.departure_id = selected_departure.id
    and bookings.status in ('pending', 'confirmed');

  requested_seats := case
    when p_booking_option = 'private' then selected_departure.capacity
    else p_party_size
  end;

  if requested_seats > selected_departure.capacity - reserved_seats then
    raise exception using
      errcode = 'P0001',
      message = 'manual_capacity_booking_not_enough_seats';
  end if;

  selected_unit_price := case
    when p_booking_option = 'private'
      then coalesce(selected_service.private_price, selected_service.price)
    else selected_service.price
  end;
  selected_total_price := case
    when p_booking_option = 'private' then selected_unit_price
    else selected_unit_price * p_party_size
  end;

  insert into public.bookings (
    business_id,
    service_id,
    staff_member_id,
    customer_user_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_notes,
    start_at,
    duration_minutes,
    status,
    departure_id,
    party_size,
    booking_option,
    unit_price,
    total_price
  )
  values (
    selected_departure.business_id,
    selected_departure.service_id,
    null,
    p_customer_user_id,
    coalesce(nullif(trim(p_customer_name), ''), 'Customer'),
    lower(nullif(trim(p_customer_email), '')),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_customer_notes), ''),
    selected_departure.start_at,
    selected_departure.duration_minutes,
    'confirmed',
    selected_departure.id,
    p_party_size,
    p_booking_option,
    selected_unit_price,
    selected_total_price
  )
  returning id into created_booking_id;

  if p_customer_user_id is not null then
    insert into public.notifications (
      user_id,
      business_id,
      booking_id,
      audience,
      type,
      title,
      message,
      action_url
    )
    values (
      p_customer_user_id,
      selected_departure.business_id,
      created_booking_id,
      'customer',
      'booking_accepted',
      p_customer_notification_title,
      p_customer_notification_message,
      '/booking-confirmation?id=' || created_booking_id::text
    );
  end if;

  if selected_departure.staff_member_id is not null then
    select staff_members.user_id
    into assigned_staff_user_id
    from public.staff_members
    where staff_members.id = selected_departure.staff_member_id
      and staff_members.business_id = selected_departure.business_id
      and staff_members.active = true;

    if assigned_staff_user_id is not null then
      insert into public.notifications (
        user_id,
        business_id,
        booking_id,
        audience,
        type,
        title,
        message,
        action_url
      )
      values (
        assigned_staff_user_id,
        selected_departure.business_id,
        created_booking_id,
        'staff',
        'booking_accepted',
        p_staff_notification_title,
        p_staff_notification_message,
        '/staff/calendar?departureId=' || selected_departure.id::text
      );
    end if;
  end if;

  return query
  select
    created_booking_id,
    'confirmed'::text,
    greatest(
      selected_departure.capacity - reserved_seats - requested_seats,
      0
    );
end;
$$;

revoke all on function public.mirebook_create_manual_capacity_booking(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.mirebook_create_manual_capacity_booking(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text
) to service_role;

commit;
