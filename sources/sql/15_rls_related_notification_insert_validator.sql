-- Stage 9 Batch 8: related notification insert validator after policy cleanup.
--
-- Run this after SQL 14.
--
-- Why this exists:
-- SQL 13 correctly removed older broad-read policies, and SQL 14 restored
-- customer booking creation with a narrow public-booking validator. The next
-- QA pass confirmed customer-created business notifications can still fail
-- because the notification insert policy validates booking/request relation
-- through direct subqueries.
--
-- This keeps notification reads scoped, keeps raw booking/setup tables private,
-- and moves only the related-actor insert validation into a SECURITY DEFINER
-- helper used by the notification insert policy.

begin;

create or replace function public.mirebook_can_insert_related_notification(
  target_user_id uuid,
  target_business_id uuid,
  target_booking_id uuid,
  target_booking_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.mirebook_is_admin()
    or target_user_id = (select auth.uid())
    or public.mirebook_owns_business(target_business_id)
    or exists (
      select 1
      from public.bookings
      where bookings.id = target_booking_id
        and (
          target_business_id is null
          or bookings.business_id = target_business_id
        )
        and (
          bookings.customer_user_id = (select auth.uid())
          or public.mirebook_owns_business(bookings.business_id)
          or public.mirebook_is_assigned_staff(bookings.staff_member_id)
        )
    )
    or exists (
      select 1
      from public.booking_requests
      where booking_requests.id = target_booking_request_id
        and (
          target_business_id is null
          or booking_requests.business_id = target_business_id
        )
        and (
          target_booking_id is null
          or booking_requests.booking_id = target_booking_id
        )
        and (
          booking_requests.customer_user_id = (select auth.uid())
          or public.mirebook_owns_business(booking_requests.business_id)
        )
    );
$$;

revoke all on function public.mirebook_can_insert_related_notification(
  uuid,
  uuid,
  uuid,
  uuid
) from public;

grant execute on function public.mirebook_can_insert_related_notification(
  uuid,
  uuid,
  uuid,
  uuid
) to authenticated;

drop policy if exists "notifications_insert_by_related_actor"
  on public.notifications;

create policy "notifications_insert_by_related_actor"
on public.notifications
for insert
to authenticated
with check (
  public.mirebook_can_insert_related_notification(
    user_id,
    business_id,
    booking_id,
    booking_request_id
  )
);

commit;
