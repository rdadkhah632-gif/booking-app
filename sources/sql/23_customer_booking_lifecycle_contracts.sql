-- Stage 13 Batch 13D: atomic customer booking lifecycle contracts.
--
-- Apply after SQL 21 and the Stage 9 booking/request/notification policies.
-- These functions are service-role only. The authenticated customer API
-- verifies identity and schedule rules before calling them. Each function
-- locks the affected lifecycle row and commits its required business/staff
-- notification in the same transaction.

begin;

create or replace function public.mirebook_cancel_customer_booking(
  p_customer_user_id uuid,
  p_booking_id uuid,
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
  target_business_id uuid;
  target_staff_member_id uuid;
  target_staff_user_id uuid;
  target_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'customer_booking_service_role_required';
  end if;

  select
    bookings.business_id,
    bookings.staff_member_id,
    staff_members.user_id,
    bookings.status
  into
    target_business_id,
    target_staff_member_id,
    target_staff_user_id,
    target_status
  from public.bookings
  left join public.staff_members
    on staff_members.id = bookings.staff_member_id
  where bookings.id = p_booking_id
    and bookings.customer_user_id = p_customer_user_id
  for update of bookings;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_not_found';
  end if;

  if target_status not in ('pending', 'confirmed') then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_action_unavailable';
  end if;

  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id;

  insert into public.notifications (
    business_id,
    booking_id,
    audience,
    type,
    title,
    message,
    action_url
  )
  values (
    target_business_id,
    p_booking_id,
    'business',
    'booking_cancelled',
    p_business_notification_title,
    p_business_notification_message,
    p_business_action_url
  );

  if target_staff_user_id is not null then
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
      target_staff_user_id,
      target_business_id,
      p_booking_id,
      'staff',
      'booking_cancelled',
      p_staff_notification_title,
      p_staff_notification_message,
      p_staff_action_url
    );
  end if;

  return query select p_booking_id, 'cancelled'::text;
end;
$$;

create or replace function public.mirebook_submit_customer_reschedule(
  p_customer_user_id uuid,
  p_booking_id uuid,
  p_requested_staff_member_id uuid,
  p_requested_start_at timestamptz,
  p_requested_duration_minutes integer,
  p_request_message text,
  p_business_notification_title text,
  p_business_notification_message text,
  p_business_action_url text
)
returns table (
  request_id uuid,
  request_status text,
  requested_start_at timestamptz,
  requested_staff_member_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_business_id uuid;
  target_service_id uuid;
  current_staff_member_id uuid;
  current_start_at timestamptz;
  current_status text;
  target_request_id uuid;
  booking_buffer_before integer;
  booking_buffer_after integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'customer_booking_service_role_required';
  end if;

  select
    bookings.business_id,
    bookings.service_id,
    bookings.staff_member_id,
    bookings.start_at,
    bookings.status
  into
    target_business_id,
    target_service_id,
    current_staff_member_id,
    current_start_at,
    current_status
  from public.bookings
  where bookings.id = p_booking_id
    and bookings.customer_user_id = p_customer_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_not_found';
  end if;

  if current_status <> 'confirmed' then
    raise exception using
      errcode = 'P0001',
      message = 'customer_booking_action_unavailable';
  end if;

  if p_requested_start_at <= now()
    or p_requested_duration_minutes <= 0
    or (
      p_requested_start_at = current_start_at
      and p_requested_staff_member_id = current_staff_member_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'customer_reschedule_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_requested_staff_member_id::text, 0)
  );

  if not exists (
    select 1
    from public.staff_members
    join public.staff_services
      on staff_services.staff_member_id = staff_members.id
    join public.services
      on services.id = staff_services.service_id
    where staff_members.id = p_requested_staff_member_id
      and staff_members.business_id = target_business_id
      and staff_members.active = true
      and services.id = target_service_id
      and services.business_id = target_business_id
      and services.active = true
      and services.duration_minutes = p_requested_duration_minutes
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_reschedule_staff_unavailable';
  end if;

  select
    greatest(coalesce(businesses.buffer_before_minutes, 0), 0),
    greatest(coalesce(businesses.buffer_after_minutes, 0), 0)
  into booking_buffer_before, booking_buffer_after
  from public.businesses
  where businesses.id = target_business_id;

  if exists (
    select 1
    from public.bookings
    where bookings.id <> p_booking_id
      and bookings.staff_member_id = p_requested_staff_member_id
      and bookings.status in ('pending', 'confirmed')
      and (
        p_requested_start_at - make_interval(mins => booking_buffer_before)
      ) < coalesce(
        bookings.end_at,
        bookings.start_at + make_interval(mins => bookings.duration_minutes)
      )
      and (
        p_requested_start_at
        + make_interval(
          mins => p_requested_duration_minutes + booking_buffer_after
        )
      ) > bookings.start_at
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_reschedule_slot_unavailable';
  end if;

  select booking_requests.id
  into target_request_id
  from public.booking_requests
  where booking_requests.booking_id = p_booking_id
    and booking_requests.customer_user_id = p_customer_user_id
    and booking_requests.requested_by = 'customer'
    and booking_requests.request_type = 'reschedule'
    and booking_requests.status = 'pending'
  order by booking_requests.created_at desc
  limit 1
  for update;

  if target_request_id is null then
    insert into public.booking_requests (
      booking_id,
      business_id,
      customer_user_id,
      requested_by,
      request_type,
      status,
      current_start_at,
      requested_start_at,
      current_staff_member_id,
      requested_staff_member_id,
      requested_duration_minutes,
      message
    )
    values (
      p_booking_id,
      target_business_id,
      p_customer_user_id,
      'customer',
      'reschedule',
      'pending',
      current_start_at,
      p_requested_start_at,
      current_staff_member_id,
      p_requested_staff_member_id,
      p_requested_duration_minutes,
      nullif(trim(p_request_message), '')
    )
    returning id into target_request_id;
  else
    update public.booking_requests
    set
      requested_start_at = p_requested_start_at,
      requested_staff_member_id = p_requested_staff_member_id,
      requested_duration_minutes = p_requested_duration_minutes,
      message = nullif(trim(p_request_message), ''),
      updated_at = now()
    where id = target_request_id;
  end if;

  insert into public.notifications (
    business_id,
    booking_id,
    booking_request_id,
    audience,
    type,
    title,
    message,
    action_url
  )
  values (
    target_business_id,
    p_booking_id,
    target_request_id,
    'business',
    'reschedule_requested',
    p_business_notification_title,
    p_business_notification_message,
    p_business_action_url
  );

  return query
  select
    target_request_id,
    'pending'::text,
    p_requested_start_at,
    p_requested_staff_member_id;
end;
$$;

create or replace function public.mirebook_cancel_customer_reschedule(
  p_customer_user_id uuid,
  p_booking_request_id uuid,
  p_business_notification_title text,
  p_business_notification_message text,
  p_business_action_url text
)
returns table (
  request_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking_id uuid;
  target_business_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'customer_booking_service_role_required';
  end if;

  select
    booking_requests.booking_id,
    booking_requests.business_id
  into target_booking_id, target_business_id
  from public.booking_requests
  where booking_requests.id = p_booking_request_id
    and booking_requests.customer_user_id = p_customer_user_id
    and booking_requests.requested_by = 'customer'
    and booking_requests.request_type = 'reschedule'
    and booking_requests.status = 'pending'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'customer_reschedule_action_unavailable';
  end if;

  update public.booking_requests
  set
    status = 'cancelled',
    response_message = 'Cancelled by customer',
    updated_at = now()
  where id = p_booking_request_id;

  insert into public.notifications (
    business_id,
    booking_id,
    booking_request_id,
    audience,
    type,
    title,
    message,
    action_url
  )
  values (
    target_business_id,
    target_booking_id,
    p_booking_request_id,
    'business',
    'reschedule_cancelled',
    p_business_notification_title,
    p_business_notification_message,
    p_business_action_url
  );

  return query select p_booking_request_id, 'cancelled'::text;
end;
$$;

revoke all on function public.mirebook_cancel_customer_booking(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.mirebook_cancel_customer_booking(
  uuid, uuid, text, text, text, text, text, text
) to service_role;

revoke all on function public.mirebook_submit_customer_reschedule(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.mirebook_submit_customer_reschedule(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, text
) to service_role;

revoke all on function public.mirebook_cancel_customer_reschedule(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.mirebook_cancel_customer_reschedule(
  uuid, uuid, text, text, text
) to service_role;

commit;
