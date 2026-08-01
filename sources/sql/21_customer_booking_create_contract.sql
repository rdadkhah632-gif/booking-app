-- Stage 13 Batch 13C: atomic customer booking creation contract.
--
-- Apply after the Stage 9 booking and notification RLS migrations.
-- This function is intentionally callable only by the service role. The
-- authenticated API route verifies the customer and performs the final
-- timezone, notice, availability, interval and occupancy checks before calling
-- this function. Booking and required in-app notifications then commit as one
-- database action.

begin;

create or replace function public.mirebook_create_customer_booking(
  p_customer_user_id uuid,
  p_business_id uuid,
  p_service_id uuid,
  p_staff_member_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_notes text,
  p_start_at timestamptz,
  p_duration_minutes integer,
  p_booking_status text,
  p_customer_notification_title text,
  p_customer_notification_message text,
  p_business_notification_title text,
  p_business_notification_message text,
  p_staff_notification_title text,
  p_staff_notification_message text,
  p_business_action_url text,
  p_staff_action_url text
)
returns table (
  booking_id uuid,
  booking_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_booking_id uuid;
  assigned_staff_user_id uuid;
  booking_buffer_before integer;
  booking_buffer_after integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'customer_booking_service_role_required';
  end if;

  -- Serialize customer booking creation for one staff member so two requests
  -- cannot both pass an availability read and then insert the same slot.
  perform pg_advisory_xact_lock(
    hashtextextended(p_staff_member_id::text, 0)
  );

  if not exists (
    select 1
    from public.businesses
    where businesses.id = p_business_id
      and businesses.published = true
      and (
        (
          p_booking_status = 'pending'
          and businesses.auto_accept_bookings = false
        )
        or (
          p_booking_status = 'confirmed'
          and coalesce(businesses.auto_accept_bookings, true) = true
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_business_unavailable';
  end if;

  if not exists (
    select 1
    from public.services
    where services.id = p_service_id
      and services.business_id = p_business_id
      and services.active = true
      and services.duration_minutes = p_duration_minutes
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_service_unavailable';
  end if;

  select staff_members.user_id
  into assigned_staff_user_id
  from public.staff_members
  where staff_members.id = p_staff_member_id
    and staff_members.business_id = p_business_id
    and staff_members.active = true;

  if not found or not exists (
    select 1
    from public.staff_services
    where staff_services.staff_member_id = p_staff_member_id
      and staff_services.service_id = p_service_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_staff_unavailable';
  end if;

  select
    greatest(coalesce(businesses.buffer_before_minutes, 0), 0),
    greatest(coalesce(businesses.buffer_after_minutes, 0), 0)
  into booking_buffer_before, booking_buffer_after
  from public.businesses
  where businesses.id = p_business_id;

  if exists (
    select 1
    from public.bookings
    where bookings.staff_member_id = p_staff_member_id
      and bookings.status in ('pending', 'confirmed')
      and (
        p_start_at - make_interval(mins => booking_buffer_before)
      ) < coalesce(
        bookings.end_at,
        bookings.start_at + make_interval(mins => bookings.duration_minutes)
      )
      and (
        p_start_at
        + make_interval(mins => p_duration_minutes + booking_buffer_after)
      ) > bookings.start_at
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_slot_unavailable';
  end if;

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
    status
  )
  values (
    p_business_id,
    p_service_id,
    p_staff_member_id,
    p_customer_user_id,
    nullif(trim(p_customer_name), ''),
    lower(nullif(trim(p_customer_email), '')),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_customer_notes), ''),
    p_start_at,
    p_duration_minutes,
    p_booking_status
  )
  returning id into created_booking_id;

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
  values
    (
      p_customer_user_id,
      p_business_id,
      created_booking_id,
      'customer',
      case
        when p_booking_status = 'pending' then 'booking_requested'
        else 'booking_accepted'
      end,
      p_customer_notification_title,
      p_customer_notification_message,
      '/booking-confirmation?id=' || created_booking_id::text
    ),
    (
      null,
      p_business_id,
      created_booking_id,
      'business',
      case
        when p_booking_status = 'pending' then 'booking_needs_approval'
        else 'booking_created'
      end,
      p_business_notification_title,
      p_business_notification_message,
      p_business_action_url
    );

  if assigned_staff_user_id is not null and p_booking_status = 'confirmed' then
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
      p_business_id,
      created_booking_id,
      'staff',
      'booking_accepted',
      p_staff_notification_title,
      p_staff_notification_message,
      case
        when nullif(trim(p_staff_action_url), '') is null
          then '/staff/calendar?bookingId=' || created_booking_id::text
        when position('?' in p_staff_action_url) > 0
          then p_staff_action_url || '&bookingId=' || created_booking_id::text
        else p_staff_action_url || '?bookingId=' || created_booking_id::text
      end
    );
  end if;

  return query select created_booking_id, p_booking_status;
end;
$$;

revoke all on function public.mirebook_create_customer_booking(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.mirebook_create_customer_booking(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

commit;
