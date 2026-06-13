-- Stage 6 Batch 7A/7B: server-only staff invite token storage.
-- Run this script manually in the Supabase SQL editor before enabling emailed
-- staff invite links. Existing exact-email staff linking remains available.

create table if not exists public.staff_invite_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  invited_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists staff_invite_tokens_staff_member_idx
  on public.staff_invite_tokens (staff_member_id, created_at desc);

create index if not exists staff_invite_tokens_business_idx
  on public.staff_invite_tokens (business_id, created_at desc);

alter table public.staff_invite_tokens enable row level security;

revoke all on table public.staff_invite_tokens from anon;
revoke all on table public.staff_invite_tokens from authenticated;

comment on table public.staff_invite_tokens is
  'Server-only hashed tokens for emailed staff invite deep links.';
