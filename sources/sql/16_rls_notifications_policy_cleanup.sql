-- Stage 9 Batch 9: notification policy cleanup after related insert QA.
--
-- Run this after SQL 15.
--
-- Why this exists:
-- SQL 15 installed the related-notification SECURITY DEFINER helper and direct
-- RPC checks confirmed the helper returns true for a valid customer-created
-- business booking notification. The insert still failed, which points to an
-- older restrictive notification insert policy remaining in Supabase.
--
-- This script drops every policy on public.notifications only, then recreates
-- the intended scoped policies. It does not change notification data, booking
-- logic, support logic or any other table policy.

begin;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

alter table public.notifications enable row level security;

revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;

grant select, insert, update on table public.notifications to authenticated;

create policy "notifications_select_by_role"
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

create policy "notifications_update_read_by_role"
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
)
with check (
  user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

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
