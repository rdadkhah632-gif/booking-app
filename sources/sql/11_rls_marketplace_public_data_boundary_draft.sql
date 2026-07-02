-- Stage 9 Batch 4 draft: marketplace and public profile data-boundary hardening.
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
-- Public marketplace/profile data is now intended to flow through:
--
-- - src/pages/api/public/explore-businesses.ts
-- - src/pages/api/public/business-profile.ts
--
-- Do not apply this draft until those endpoints are deployed and QA confirms
-- Explore, public booking, business setup, business calendar and staff
-- availability still work.

create or replace function public.mirebook_is_staff_for_business(
  target_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members
    where staff_members.business_id = target_business_id
      and staff_members.user_id = (select auth.uid())
      and staff_members.active = true
  );
$$;

create index if not exists businesses_user_created_idx
  on public.businesses (user_id, created_at desc);

create index if not exists businesses_published_created_idx
  on public.businesses (published, created_at desc);

create index if not exists services_business_active_idx
  on public.services (business_id, active);

create index if not exists staff_members_business_active_idx
  on public.staff_members (business_id, active);

create index if not exists staff_members_user_active_idx
  on public.staff_members (user_id, active);

create index if not exists staff_services_staff_service_idx
  on public.staff_services (staff_member_id, service_id);

create index if not exists staff_services_service_staff_idx
  on public.staff_services (service_id, staff_member_id);

create index if not exists availability_business_day_idx
  on public.availability (business_id, day_of_week);

create index if not exists staff_availability_staff_day_idx
  on public.staff_availability (staff_member_id, day_of_week);

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.staff_members enable row level security;
alter table public.staff_services enable row level security;
alter table public.availability enable row level security;
alter table public.staff_availability enable row level security;

revoke all on table public.businesses from anon;
revoke all on table public.services from anon;
revoke all on table public.staff_members from anon;
revoke all on table public.staff_services from anon;
revoke all on table public.availability from anon;
revoke all on table public.staff_availability from anon;

revoke all on table public.businesses from authenticated;
revoke all on table public.services from authenticated;
revoke all on table public.staff_members from authenticated;
revoke all on table public.staff_services from authenticated;
revoke all on table public.availability from authenticated;
revoke all on table public.staff_availability from authenticated;

grant select, insert, update, delete on table public.businesses
  to authenticated;

grant select, insert, update, delete on table public.services
  to authenticated;

grant select, insert, update, delete on table public.staff_members
  to authenticated;

grant select, insert, update, delete on table public.staff_services
  to authenticated;

grant select, insert, update, delete on table public.availability
  to authenticated;

grant select, insert, update, delete on table public.staff_availability
  to authenticated;

drop policy if exists "businesses_select_by_role" on public.businesses;

create policy "businesses_select_by_role"
on public.businesses
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_is_staff_for_business(id)
  or public.mirebook_is_admin()
);

drop policy if exists "businesses_insert_owner" on public.businesses;

create policy "businesses_insert_owner"
on public.businesses
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
);

drop policy if exists "businesses_update_owner" on public.businesses;

create policy "businesses_update_owner"
on public.businesses
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

drop policy if exists "businesses_delete_owner" on public.businesses;

create policy "businesses_delete_owner"
on public.businesses
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
);

drop policy if exists "services_select_by_role" on public.services;

create policy "services_select_by_role"
on public.services
for select
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_staff_for_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "services_insert_owner" on public.services;

create policy "services_insert_owner"
on public.services
for insert
to authenticated
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "services_update_owner" on public.services;

create policy "services_update_owner"
on public.services
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

drop policy if exists "services_delete_owner" on public.services;

create policy "services_delete_owner"
on public.services
for delete
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "staff_members_select_by_role" on public.staff_members;

create policy "staff_members_select_by_role"
on public.staff_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "staff_members_insert_owner" on public.staff_members;

create policy "staff_members_insert_owner"
on public.staff_members
for insert
to authenticated
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "staff_members_update_by_role" on public.staff_members;

create policy "staff_members_update_by_role"
on public.staff_members
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

drop policy if exists "staff_members_delete_owner" on public.staff_members;

create policy "staff_members_delete_owner"
on public.staff_members
for delete
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "staff_services_select_by_role"
  on public.staff_services;

create policy "staff_services_select_by_role"
on public.staff_services
for select
to authenticated
using (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    where staff_members.id = staff_services.staff_member_id
      and (
        staff_members.user_id = (select auth.uid())
        or public.mirebook_owns_business(staff_members.business_id)
      )
  )
);

drop policy if exists "staff_services_insert_owner"
  on public.staff_services;

create policy "staff_services_insert_owner"
on public.staff_services
for insert
to authenticated
with check (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    join public.services
      on services.id = staff_services.service_id
     and services.business_id = staff_members.business_id
    where staff_members.id = staff_services.staff_member_id
      and public.mirebook_owns_business(staff_members.business_id)
  )
);

drop policy if exists "staff_services_delete_owner"
  on public.staff_services;

create policy "staff_services_delete_owner"
on public.staff_services
for delete
to authenticated
using (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    join public.services
      on services.id = staff_services.service_id
     and services.business_id = staff_members.business_id
    where staff_members.id = staff_services.staff_member_id
      and public.mirebook_owns_business(staff_members.business_id)
  )
);

drop policy if exists "availability_select_by_role" on public.availability;

create policy "availability_select_by_role"
on public.availability
for select
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_staff_for_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "availability_insert_owner" on public.availability;

create policy "availability_insert_owner"
on public.availability
for insert
to authenticated
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "availability_update_owner" on public.availability;

create policy "availability_update_owner"
on public.availability
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

drop policy if exists "availability_delete_owner" on public.availability;

create policy "availability_delete_owner"
on public.availability
for delete
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

drop policy if exists "staff_availability_select_by_role"
  on public.staff_availability;

create policy "staff_availability_select_by_role"
on public.staff_availability
for select
to authenticated
using (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    where staff_members.id = staff_availability.staff_member_id
      and (
        staff_members.user_id = (select auth.uid())
        or public.mirebook_owns_business(staff_members.business_id)
      )
  )
);

drop policy if exists "staff_availability_insert_by_role"
  on public.staff_availability;

create policy "staff_availability_insert_by_role"
on public.staff_availability
for insert
to authenticated
with check (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    where staff_members.id = staff_availability.staff_member_id
      and staff_members.business_id = staff_availability.business_id
      and (
        staff_members.user_id = (select auth.uid())
        or public.mirebook_owns_business(staff_members.business_id)
      )
  )
);

drop policy if exists "staff_availability_update_by_role"
  on public.staff_availability;

create policy "staff_availability_update_by_role"
on public.staff_availability
for update
to authenticated
using (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    where staff_members.id = staff_availability.staff_member_id
      and (
        staff_members.user_id = (select auth.uid())
        or public.mirebook_owns_business(staff_members.business_id)
      )
  )
)
with check (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    where staff_members.id = staff_availability.staff_member_id
      and staff_members.business_id = staff_availability.business_id
      and (
        staff_members.user_id = (select auth.uid())
        or public.mirebook_owns_business(staff_members.business_id)
      )
  )
);

drop policy if exists "staff_availability_delete_by_role"
  on public.staff_availability;

create policy "staff_availability_delete_by_role"
on public.staff_availability
for delete
to authenticated
using (
  public.mirebook_is_admin()
  or exists (
    select 1
    from public.staff_members
    where staff_members.id = staff_availability.staff_member_id
      and (
        staff_members.user_id = (select auth.uid())
        or public.mirebook_owns_business(staff_members.business_id)
      )
  )
);

-- Service-role API routes continue to bypass RLS by design. Keep server-side
-- publish/owner checks in:
--
-- - src/pages/api/public/explore-businesses.ts
-- - src/pages/api/public/business-profile.ts
-- - src/pages/api/public/booking-occupancy.ts
--
-- Known QA before applying:
--
-- 1. Anonymous Explore can load bookable businesses.
-- 2. Anonymous public business pages can load safe profile data.
-- 3. Owner preview still works for unpublished businesses.
-- 4. Business setup/services/team/working-hours pages still read and write.
-- 5. Staff dashboard and staff availability still read and write only the
--    linked staff member's rows.
