-- Stage 9 Batch 2 draft: bookings data-boundary hardening.
--
-- IMPORTANT:
-- This file is a draft for review/staging first. Do not apply directly to
-- production until the public booking occupancy API has been deployed and QA
-- has confirmed public booking, customer My Bookings, business Calendar/Inbox
-- and staff Calendar still work.
--
-- This draft focuses on public.bookings only. Other high-risk tables still need
-- their own staged RLS passes.

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

create or replace function public.mirebook_owns_business(target_business_id uuid)
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

create index if not exists bookings_customer_user_id_idx
  on public.bookings (customer_user_id);

create index if not exists bookings_business_status_start_idx
  on public.bookings (business_id, status, start_at);

create index if not exists bookings_staff_status_start_idx
  on public.bookings (staff_member_id, status, start_at);

alter table public.bookings enable row level security;

revoke all on table public.bookings from anon;
revoke all on table public.bookings from authenticated;

grant select, insert, update on table public.bookings to authenticated;

drop policy if exists "bookings_select_by_role" on public.bookings;

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

drop policy if exists "bookings_customer_insert_own_public_booking"
  on public.bookings;

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

drop policy if exists "bookings_customer_cancel_own_booking"
  on public.bookings;

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

drop policy if exists "bookings_business_manage_owned_bookings"
  on public.bookings;

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

drop policy if exists "bookings_staff_complete_assigned_booking"
  on public.bookings;

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

-- Service-role API routes continue to bypass RLS by design. Keep the server
-- ownership/admin checks in:
--
-- - src/pages/api/dashboard/manual-booking.ts
-- - src/pages/api/stripe/webhook.ts
-- - src/pages/api/email/reminders.ts
-- - src/pages/api/email/transactional.ts
-- - src/pages/api/admin/*
