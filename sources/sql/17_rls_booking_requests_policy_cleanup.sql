-- Stage 9 Batch 10: booking request policy cleanup after broad-read QA.
--
-- Run this after SQL 16.
--
-- Why this exists:
-- SQL 16 fixed related business notification inserts. The follow-up QA showed
-- staff can still read customer reschedule request rows for assigned bookings.
-- The intended Stage 9 policy keeps booking request rows visible only to the
-- requesting customer, the owning business and admins. Staff can still see
-- assigned bookings, but approval/request management remains business-owned.
--
-- This script drops every policy on public.booking_requests only, then
-- recreates the intended scoped policies. It does not change request data,
-- booking lifecycle logic, notification policies, staff assignment logic or any
-- other table policy.

begin;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_requests'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

alter table public.booking_requests enable row level security;

revoke all on table public.booking_requests from anon;
revoke all on table public.booking_requests from authenticated;

grant select, insert, update on table public.booking_requests to authenticated;

create policy "booking_requests_select_by_role"
on public.booking_requests
for select
to authenticated
using (
  customer_user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

create policy "booking_requests_customer_insert_reschedule"
on public.booking_requests
for insert
to authenticated
with check (
  customer_user_id = (select auth.uid())
  and requested_by = 'customer'
  and request_type = 'reschedule'
  and status = 'pending'
  and exists (
    select 1
    from public.bookings
    where bookings.id = booking_requests.booking_id
      and bookings.business_id = booking_requests.business_id
      and bookings.customer_user_id = (select auth.uid())
      and bookings.status = 'confirmed'
  )
);

create policy "booking_requests_customer_update_pending"
on public.booking_requests
for update
to authenticated
using (
  customer_user_id = (select auth.uid())
  and requested_by = 'customer'
  and status = 'pending'
)
with check (
  customer_user_id = (select auth.uid())
  and requested_by = 'customer'
  and status = 'pending'
);

create policy "booking_requests_business_update_owned"
on public.booking_requests
for update
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
)
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

commit;
