-- Stage 12: scheduled-capacity booking foundation.
--
-- This extends, rather than replaces, Mirëbook's appointment model. Existing
-- services and bookings keep their appointment defaults. Group services use
-- explicit departures and one locked service-role function so concurrent
-- customers cannot oversell the same departure.

begin;

alter table public.services
  add column if not exists booking_type text not null default 'appointment',
  add column if not exists group_capacity integer,
  add column if not exists private_booking_enabled boolean not null default false,
  add column if not exists private_price numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_booking_type_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_booking_type_check
      check (booking_type in ('appointment', 'group'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_group_capacity_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_group_capacity_check
      check (
        (booking_type = 'appointment' and group_capacity is null)
        or
        (booking_type = 'group' and group_capacity between 1 and 200)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_private_price_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_private_price_check
      check (
        private_price is null
        or private_price >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_appointment_group_fields_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_appointment_group_fields_check
      check (
        booking_type = 'group'
        or (
          group_capacity is null
          and private_booking_enabled = false
          and private_price is null
        )
      );
  end if;
end;
$$;

create table if not exists public.service_departures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  start_at timestamptz not null,
  duration_minutes integer not null,
  capacity integer not null,
  meeting_point text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_departures_duration_check
    check (duration_minutes between 5 and 10080),
  constraint service_departures_capacity_check
    check (capacity between 1 and 200),
  constraint service_departures_status_check
    check (status in ('scheduled', 'cancelled', 'completed')),
  constraint service_departures_service_start_unique
    unique (service_id, start_at)
);

create index if not exists service_departures_business_start_idx
  on public.service_departures (business_id, start_at);

create index if not exists service_departures_service_start_idx
  on public.service_departures (service_id, start_at);

create index if not exists service_departures_staff_start_idx
  on public.service_departures (staff_member_id, start_at)
  where staff_member_id is not null;

create or replace function public.mirebook_validate_departure_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.services
    where services.id = new.service_id
      and services.business_id = new.business_id
      and services.booking_type = 'group'
  ) then
    raise exception using
      errcode = '23514',
      message = 'departure_group_service_required';
  end if;

  if new.staff_member_id is not null
    and not exists (
      select 1
      from public.staff_members
      where staff_members.id = new.staff_member_id
        and staff_members.business_id = new.business_id
        and staff_members.active = true
    )
  then
    raise exception using
      errcode = '23514',
      message = 'departure_active_business_staff_required';
  end if;

  return new;
end;
$$;

drop trigger if exists service_departures_validate_links
  on public.service_departures;

create trigger service_departures_validate_links
before insert or update of business_id, service_id, staff_member_id
on public.service_departures
for each row
execute function public.mirebook_validate_departure_links();

create or replace function public.mirebook_lock_service_booking_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.booking_type = 'group'
    and new.booking_type <> 'group'
    and exists (
      select 1
      from public.service_departures
      where service_departures.service_id = old.id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'service_booking_type_locked';
  end if;

  return new;
end;
$$;

drop trigger if exists services_lock_booking_type
  on public.services;

create trigger services_lock_booking_type
before update of booking_type
on public.services
for each row
execute function public.mirebook_lock_service_booking_type();

alter table public.bookings
  add column if not exists departure_id uuid
    references public.service_departures(id) on delete restrict,
  add column if not exists party_size integer not null default 1,
  add column if not exists booking_option text not null default 'appointment',
  add column if not exists unit_price numeric,
  add column if not exists total_price numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_party_size_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_party_size_check
      check (party_size between 1 and 200);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_booking_option_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_booking_option_check
      check (booking_option in ('appointment', 'shared', 'private'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_departure_shape_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_departure_shape_check
      check (
        (departure_id is null and booking_option = 'appointment')
        or
        (departure_id is not null and booking_option in ('shared', 'private'))
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_price_snapshot_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_price_snapshot_check
      check (
        (unit_price is null or unit_price >= 0)
        and (total_price is null or total_price >= 0)
      );
  end if;
end;
$$;

create or replace function public.mirebook_validate_booking_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_service_type text;
  selected_departure public.service_departures%rowtype;
begin
  if new.departure_id is null then
    if new.booking_option <> 'appointment' then
      raise exception using
        errcode = '23514',
        message = 'booking_departure_required';
    end if;

    if new.service_id is not null then
      select booking_type
      into selected_service_type
      from public.services
      where id = new.service_id;

      if selected_service_type = 'group' then
        raise exception using
          errcode = '23514',
          message = 'group_booking_departure_required';
      end if;
    end if;

    return new;
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'capacity_booking_service_role_required';
  end if;

  if tg_op = 'UPDATE' and (
    new.departure_id is distinct from old.departure_id
    or new.business_id is distinct from old.business_id
    or new.service_id is distinct from old.service_id
    or new.staff_member_id is distinct from old.staff_member_id
    or new.start_at is distinct from old.start_at
    or new.duration_minutes is distinct from old.duration_minutes
    or new.party_size is distinct from old.party_size
    or new.booking_option is distinct from old.booking_option
    or new.unit_price is distinct from old.unit_price
    or new.total_price is distinct from old.total_price
  ) then
    raise exception using
      errcode = '23514',
      message = 'capacity_booking_shape_locked';
  end if;

  select *
  into selected_departure
  from public.service_departures
  where id = new.departure_id;

  if not found
    or new.booking_option not in ('shared', 'private')
    or new.business_id is distinct from selected_departure.business_id
    or new.service_id is distinct from selected_departure.service_id
    or new.start_at is distinct from selected_departure.start_at
    or new.duration_minutes is distinct from selected_departure.duration_minutes
    or new.party_size < 1
    or new.party_size > selected_departure.capacity
    or (
      new.staff_member_id is not null
      and new.staff_member_id is distinct from selected_departure.staff_member_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'capacity_booking_shape_invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_validate_mode_on_insert
  on public.bookings;

create trigger bookings_validate_mode_on_insert
before insert on public.bookings
for each row
execute function public.mirebook_validate_booking_mode();

drop trigger if exists bookings_lock_capacity_shape_on_update
  on public.bookings;

create trigger bookings_lock_capacity_shape_on_update
before update of
  departure_id,
  business_id,
  service_id,
  staff_member_id,
  start_at,
  duration_minutes,
  party_size,
  booking_option,
  unit_price,
  total_price
on public.bookings
for each row
execute function public.mirebook_validate_booking_mode();

create index if not exists bookings_departure_status_idx
  on public.bookings (departure_id, status)
  where departure_id is not null;

alter table public.service_departures enable row level security;
revoke all on table public.service_departures from public, anon, authenticated;
grant all on table public.service_departures to service_role;

create or replace function public.mirebook_create_capacity_booking(
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
  p_business_notification_title text,
  p_business_notification_message text,
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
  selected_business public.businesses%rowtype;
  reserved_seats integer := 0;
  requested_seats integer;
  created_booking_id uuid;
  created_status text;
  assigned_staff_user_id uuid;
  selected_unit_price numeric;
  selected_total_price numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'capacity_booking_service_role_required';
  end if;

  if p_booking_option not in ('shared', 'private') then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_option_invalid';
  end if;

  if p_party_size is null or p_party_size < 1 or p_party_size > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_party_size_invalid';
  end if;

  select *
  into selected_departure
  from public.service_departures
  where id = p_departure_id
  for update;

  if not found
    or selected_departure.status <> 'scheduled'
    or selected_departure.start_at <= now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_departure_unavailable';
  end if;

  if p_party_size > selected_departure.capacity then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_party_size_invalid';
  end if;

  select *
  into selected_service
  from public.services
  where id = selected_departure.service_id
    and business_id = selected_departure.business_id
    and active = true
    and booking_type = 'group';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_service_unavailable';
  end if;

  select *
  into selected_business
  from public.businesses
  where id = selected_departure.business_id
    and published = true;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_business_unavailable';
  end if;

  if p_booking_option = 'private'
    and coalesce(selected_service.private_booking_enabled, false) = false
  then
    raise exception using
      errcode = 'P0001',
      message = 'capacity_booking_private_unavailable';
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
      message = 'capacity_booking_not_enough_seats';
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
  created_status := case
    when coalesce(selected_business.auto_accept_bookings, true) then 'confirmed'
    else 'pending'
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
    created_status,
    selected_departure.id,
    p_party_size,
    p_booking_option,
    selected_unit_price,
    selected_total_price
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
      selected_departure.business_id,
      created_booking_id,
      'customer',
      case when created_status = 'pending'
        then 'booking_requested'
        else 'booking_accepted'
      end,
      p_customer_notification_title,
      p_customer_notification_message,
      '/booking-confirmation?id=' || created_booking_id::text
    ),
    (
      null,
      selected_departure.business_id,
      created_booking_id,
      'business',
      case when created_status = 'pending'
        then 'booking_needs_approval'
        else 'booking_created'
      end,
      p_business_notification_title,
      p_business_notification_message,
      '/dashboard/departures?departureId=' || selected_departure.id::text
    );

  if selected_departure.staff_member_id is not null
    and created_status = 'confirmed'
  then
    select user_id
    into assigned_staff_user_id
    from public.staff_members
    where id = selected_departure.staff_member_id
      and business_id = selected_departure.business_id
      and active = true;

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
    created_status,
    greatest(
      selected_departure.capacity - reserved_seats - requested_seats,
      0
    );
end;
$$;

revoke all on function public.mirebook_create_capacity_booking(
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
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.mirebook_create_capacity_booking(
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
  text,
  text,
  text
) to service_role;

create or replace function public.mirebook_change_departure_status(
  p_owner_user_id uuid,
  p_departure_id uuid,
  p_status text
)
returns table (
  booking_id uuid,
  customer_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_departure public.service_departures%rowtype;
  business_owner_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'departure_status_service_role_required';
  end if;

  if p_status not in ('cancelled', 'completed') then
    raise exception using
      errcode = 'P0001',
      message = 'departure_status_invalid';
  end if;

  select departures.*
  into selected_departure
  from public.service_departures as departures
  where departures.id = p_departure_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'departure_not_found';
  end if;

  select businesses.user_id
  into business_owner_id
  from public.businesses as businesses
  where businesses.id = selected_departure.business_id;

  if business_owner_id is distinct from p_owner_user_id then
    raise exception using
      errcode = '42501',
      message = 'departure_owner_required';
  end if;

  if selected_departure.status <> 'scheduled' then
    raise exception using
      errcode = 'P0001',
      message = 'departure_status_already_changed';
  end if;

  if p_status = 'completed'
    and selected_departure.start_at
      + make_interval(mins => selected_departure.duration_minutes) > now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'departure_not_finished';
  end if;

  update public.service_departures
  set
    status = p_status,
    updated_at = now()
  where id = selected_departure.id;

  return query
  update public.bookings
  set status = case
    when p_status = 'cancelled' then 'cancelled'
    else 'completed'
  end
  where departure_id = selected_departure.id
    and status = any(
      case
        when p_status = 'cancelled' then array['pending', 'confirmed']::text[]
        else array['confirmed']::text[]
      end
    )
  returning bookings.id, bookings.customer_user_id;
end;
$$;

revoke all on function public.mirebook_change_departure_status(
  uuid,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.mirebook_change_departure_status(
  uuid,
  uuid,
  text
) to service_role;

commit;
