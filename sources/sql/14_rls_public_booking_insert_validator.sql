-- Stage 9 Batch 7: public booking insert validator after policy cleanup.
--
-- Run this after SQL 13.
--
-- Why this exists:
-- SQL 13 correctly removes older broad-read policies from marketplace/setup
-- tables, but the existing bookings insert policy validates business, service,
-- staff and staff-service state using direct table subqueries. Once customers
-- can no longer read those setup tables directly, those subqueries no longer
-- pass for customer booking creation.
--
-- This keeps the raw setup tables private and moves the public-booking
-- validation into a narrow SECURITY DEFINER helper used only by the bookings
-- insert policy.

begin;

create or replace function public.mirebook_can_create_public_booking(
  target_business_id uuid,
  target_service_id uuid,
  target_staff_member_id uuid,
  target_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses
    join public.services
      on services.id = target_service_id
     and services.business_id = businesses.id
     and services.active = true
    join public.staff_members
      on staff_members.id = target_staff_member_id
     and staff_members.business_id = businesses.id
     and staff_members.active = true
    join public.staff_services
      on staff_services.staff_member_id = staff_members.id
     and staff_services.service_id = services.id
    where businesses.id = target_business_id
      and businesses.published = true
      and (
        (
          target_status = 'pending'
          and businesses.auto_accept_bookings = false
        )
        or (
          target_status = 'confirmed'
          and coalesce(businesses.auto_accept_bookings, true) = true
        )
      )
  );
$$;

revoke all on function public.mirebook_can_create_public_booking(
  uuid,
  uuid,
  uuid,
  text
) from public;

grant execute on function public.mirebook_can_create_public_booking(
  uuid,
  uuid,
  uuid,
  text
) to authenticated;

drop policy if exists "bookings_customer_insert_own_public_booking"
  on public.bookings;

create policy "bookings_customer_insert_own_public_booking"
on public.bookings
for insert
to authenticated
with check (
  customer_user_id = (select auth.uid())
  and public.mirebook_can_create_public_booking(
    business_id,
    service_id,
    staff_member_id,
    status
  )
);

commit;
