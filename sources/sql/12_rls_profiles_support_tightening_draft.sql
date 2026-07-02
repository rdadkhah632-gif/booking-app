-- Stage 9 Batch 5 draft: profiles boundary and support reply tightening.
--
-- IMPORTANT:
-- Apply only after the code containing these server routes is deployed:
--
-- - src/pages/api/admin/profile.ts
-- - src/pages/api/support/reply.ts
--
-- This draft assumes helper function public.mirebook_is_admin() from
-- sources/sql/09_rls_bookings_boundary_draft.sql is already installed.

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create index if not exists profiles_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select (
  id,
  email,
  role,
  full_name,
  phone,
  preferred_language,
  is_admin,
  created_at
) on table public.profiles to authenticated;

grant insert (
  id,
  email,
  role,
  full_name,
  phone,
  preferred_language
) on table public.profiles to authenticated;

grant update (
  full_name,
  phone,
  preferred_language
) on table public.profiles to authenticated;

drop policy if exists "profiles_select_self_or_admin"
  on public.profiles;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.mirebook_is_admin()
);

drop policy if exists "profiles_insert_self"
  on public.profiles;

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
);

drop policy if exists "profiles_update_self_safe_fields"
  on public.profiles;

create policy "profiles_update_self_safe_fields"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

-- Admin profile updates now go through src/pages/api/admin/profile.ts using
-- service-role access and an explicit admin check. Authenticated browser
-- clients intentionally do not get direct update privileges for role or
-- is_admin.

drop policy if exists "support_messages_update_by_role"
  on public.support_messages;

drop policy if exists "support_messages_update_admin_only"
  on public.support_messages;

create policy "support_messages_update_admin_only"
on public.support_messages
for update
to authenticated
using (
  public.mirebook_is_admin()
)
with check (
  public.mirebook_is_admin()
);

drop policy if exists "support_replies_insert_by_role"
  on public.support_replies;

drop policy if exists "support_replies_insert_admin_only"
  on public.support_replies;

create policy "support_replies_insert_admin_only"
on public.support_replies
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_role = 'admin'
  and public.mirebook_is_admin()
);

-- Customer/business/staff support thread replies now go through
-- src/pages/api/support/reply.ts, which verifies ticket ownership before
-- inserting the reply and reopening the ticket with service-role access.
