-- Stage 9 Batch 6: policy cleanup after broad-read audit.
--
-- Run this only after SQL 09, 10, 11 and 12 have been applied and the current
-- app code is deployed.
--
-- Why this exists:
-- The Stage 9 broad-read audit confirmed anonymous reads are blocked, but
-- non-admin authenticated users can still broad-read marketplace and booking
-- tables. That means older permissive policies are still present in Supabase
-- alongside the newer Stage 9 policies.
--
-- This script deliberately drops every policy on the affected tables and then
-- recreates the intended Stage 9 policies. It does not change table structure,
-- booking lifecycle logic, auth, staff linking, billing writes or app code.

begin;

create or replace function public.mirebook_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_admin = true
  );
$$;

create or replace function public.mirebook_owns_business(
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
    from public.businesses
    where businesses.id = target_business_id
      and businesses.user_id = (select auth.uid())
  );
$$;

create or replace function public.mirebook_is_assigned_staff(
  target_staff_member_id uuid
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
    where staff_members.id = target_staff_member_id
      and staff_members.user_id = (select auth.uid())
      and staff_members.active = true
  );
$$;

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

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'bookings',
        'businesses',
        'services',
        'staff_members',
        'staff_services',
        'availability',
        'staff_availability'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

alter table public.bookings enable row level security;
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.staff_members enable row level security;
alter table public.staff_services enable row level security;
alter table public.availability enable row level security;
alter table public.staff_availability enable row level security;

revoke all on table public.bookings from anon;
revoke all on table public.businesses from anon;
revoke all on table public.services from anon;
revoke all on table public.staff_members from anon;
revoke all on table public.staff_services from anon;
revoke all on table public.availability from anon;
revoke all on table public.staff_availability from anon;

revoke all on table public.bookings from authenticated;
revoke all on table public.businesses from authenticated;
revoke all on table public.services from authenticated;
revoke all on table public.staff_members from authenticated;
revoke all on table public.staff_services from authenticated;
revoke all on table public.availability from authenticated;
revoke all on table public.staff_availability from authenticated;

grant select, insert, update on table public.bookings to authenticated;
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

create policy "bookings_select_by_role"
on public.bookings
for select
to authenticated
using (
  customer_user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_assigned_staff(staff_member_id)
  or public.mirebook_is_admin()
);

create policy "bookings_customer_insert_own_public_booking"
on public.bookings
for insert
to authenticated
with check (
  customer_user_id = (select auth.uid())
  and (
    (
      status = 'pending'
      and exists (
        select 1
        from public.businesses
        where businesses.id = bookings.business_id
          and businesses.auto_accept_bookings = false
      )
    )
    or (
      status = 'confirmed'
      and exists (
        select 1
        from public.businesses
        where businesses.id = bookings.business_id
          and coalesce(businesses.auto_accept_bookings, true) = true
      )
    )
  )
  and exists (
    select 1
    from public.businesses
    where businesses.id = bookings.business_id
      and businesses.published = true
  )
  and exists (
    select 1
    from public.services
    where services.id = bookings.service_id
      and services.business_id = bookings.business_id
      and services.active = true
  )
  and exists (
    select 1
    from public.staff_members
    where staff_members.id = bookings.staff_member_id
      and staff_members.business_id = bookings.business_id
      and staff_members.active = true
  )
  and exists (
    select 1
    from public.staff_services
    where staff_services.staff_member_id = bookings.staff_member_id
      and staff_services.service_id = bookings.service_id
  )
);

create policy "bookings_customer_cancel_own_booking"
on public.bookings
for update
to authenticated
using (
  customer_user_id = (select auth.uid())
  and status in ('pending', 'confirmed')
)
with check (
  customer_user_id = (select auth.uid())
  and status = 'cancelled'
);

create policy "bookings_business_manage_owned_bookings"
on public.bookings
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

create policy "bookings_staff_complete_assigned_booking"
on public.bookings
for update
to authenticated
using (
  public.mirebook_is_assigned_staff(staff_member_id)
  and status = 'confirmed'
)
with check (
  public.mirebook_is_assigned_staff(staff_member_id)
  and status = 'completed'
);

create policy "businesses_select_by_role"
on public.businesses
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_is_staff_for_business(id)
  or public.mirebook_is_admin()
);

create policy "businesses_insert_owner"
on public.businesses
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
);

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

create policy "businesses_delete_owner"
on public.businesses
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_is_admin()
);

create policy "services_select_by_role"
on public.services
for select
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_staff_for_business(business_id)
  or public.mirebook_is_admin()
);

create policy "services_insert_owner"
on public.services
for insert
to authenticated
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

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

create policy "services_delete_owner"
on public.services
for delete
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

create policy "staff_members_select_by_role"
on public.staff_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

create policy "staff_members_insert_owner"
on public.staff_members
for insert
to authenticated
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

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

create policy "staff_members_delete_owner"
on public.staff_members
for delete
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

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

create policy "availability_select_by_role"
on public.availability
for select
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_staff_for_business(business_id)
  or public.mirebook_is_admin()
);

create policy "availability_insert_owner"
on public.availability
for insert
to authenticated
with check (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

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

create policy "availability_delete_owner"
on public.availability
for delete
to authenticated
using (
  public.mirebook_owns_business(business_id)
  or public.mirebook_is_admin()
);

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

commit;
