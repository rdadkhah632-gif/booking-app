-- Stage 9 Batch 3 draft: booking requests, notifications and support RLS.
--
-- IMPORTANT:
-- Review and test this in staging/Supabase SQL editor before production.
-- This draft assumes the helper functions from
-- sources/sql/09_rls_bookings_boundary_draft.sql are installed first:
--
-- - public.mirebook_is_admin()
-- - public.mirebook_owns_business(uuid)
-- - public.mirebook_is_assigned_staff(uuid)
--
-- It is intentionally separate from the bookings draft so each boundary can be
-- applied and QA'd independently.

create or replace function public.mirebook_can_access_support_message(
  target_support_message_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_messages
    where support_messages.id = target_support_message_id
      and (
        support_messages.user_id = (select auth.uid())
        or public.mirebook_is_admin()
      )
  );
$$;

create index if not exists booking_requests_customer_status_idx
  on public.booking_requests (customer_user_id, status, created_at desc);

create index if not exists booking_requests_business_status_idx
  on public.booking_requests (business_id, status, created_at desc);

create index if not exists booking_requests_booking_status_idx
  on public.booking_requests (booking_id, status);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read_at, created_at desc);

create index if not exists notifications_business_audience_read_idx
  on public.notifications (business_id, audience, read_at, created_at desc);

create index if not exists support_messages_user_created_idx
  on public.support_messages (user_id, created_at desc);

create index if not exists support_messages_business_created_idx
  on public.support_messages (business_id, created_at desc);

create index if not exists support_replies_message_created_idx
  on public.support_replies (support_message_id, created_at);

alter table public.booking_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_replies enable row level security;

revoke all on table public.booking_requests from anon;
revoke all on table public.notifications from anon;
revoke all on table public.support_messages from anon;
revoke all on table public.support_replies from anon;

revoke all on table public.booking_requests from authenticated;
revoke all on table public.notifications from authenticated;
revoke all on table public.support_messages from authenticated;
revoke all on table public.support_replies from authenticated;

grant select, insert, update on table public.booking_requests to authenticated;
grant select, insert, update on table public.notifications to authenticated;
grant select, insert, update on table public.support_messages to authenticated;
grant select, insert on table public.support_replies to authenticated;

drop policy if exists "booking_requests_select_by_role"
  on public.booking_requests;

create policy "booking_requests_select_by_role"
on public.booking_requests
for select
to authenticated
using (
  customer_user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "booking_requests_customer_insert_reschedule"
  on public.booking_requests;

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

drop policy if exists "booking_requests_customer_update_pending"
  on public.booking_requests;

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

drop policy if exists "booking_requests_business_update_owned"
  on public.booking_requests;

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

drop policy if exists "notifications_select_by_role"
  on public.notifications;

create policy "notifications_select_by_role"
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "notifications_update_read_by_role"
  on public.notifications;

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

drop policy if exists "notifications_insert_by_related_actor"
  on public.notifications;

create policy "notifications_insert_by_related_actor"
on public.notifications
for insert
to authenticated
with check (
  public.mirebook_is_admin()
  or user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or exists (
    select 1
    from public.bookings
    where bookings.id = notifications.booking_id
      and bookings.business_id = notifications.business_id
      and (
        bookings.customer_user_id = (select auth.uid())
        or public.mirebook_owns_business(bookings.business_id)
        or public.mirebook_is_assigned_staff(bookings.staff_member_id)
      )
  )
  or exists (
    select 1
    from public.booking_requests
    where booking_requests.id = notifications.booking_request_id
      and booking_requests.business_id = notifications.business_id
      and (
        booking_requests.customer_user_id = (select auth.uid())
        or public.mirebook_owns_business(booking_requests.business_id)
      )
  )
);

drop policy if exists "support_messages_select_by_role"
  on public.support_messages;

create policy "support_messages_select_by_role"
on public.support_messages
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
);

drop policy if exists "support_messages_insert_own"
  on public.support_messages;

create policy "support_messages_insert_own"
on public.support_messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    business_id is null
    or public.mirebook_owns_business(business_id)
    or exists (
      select 1
      from public.staff_members
      where staff_members.business_id = support_messages.business_id
        and staff_members.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "support_messages_update_by_role"
  on public.support_messages;

create policy "support_messages_update_by_role"
on public.support_messages
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
)
with check (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
);

drop policy if exists "support_replies_select_by_role"
  on public.support_replies;

create policy "support_replies_select_by_role"
on public.support_replies
for select
to authenticated
using (
  public.mirebook_can_access_support_message(support_message_id)
);

drop policy if exists "support_replies_insert_by_role"
  on public.support_replies;

create policy "support_replies_insert_by_role"
on public.support_replies
for insert
to authenticated
with check (
  (
    sender_id = (select auth.uid())
    and sender_role = 'user'
    and exists (
      select 1
      from public.support_messages
      where support_messages.id = support_replies.support_message_id
        and support_messages.user_id = (select auth.uid())
    )
  )
  or (
    sender_id = (select auth.uid())
    and sender_role = 'admin'
    and public.mirebook_is_admin()
  )
);

-- Known follow-up before production:
-- support_messages_update_by_role currently allows the ticket owner to update
-- their own support message row because the support thread marks the ticket
-- open when a user replies. A later API-only support reply flow can narrow this
-- further so normal users do not need direct support_messages update rights.
