-- Stage 5 Batch 4: optional operator audit trail for manual billing changes.
-- Run this script manually in the Supabase SQL editor.
-- The admin billing control continues to work if this table is not installed,
-- but the API will report that the durable audit record was not stored.

create table if not exists public.business_billing_admin_audit (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null default 'manual_billing_update',
  reason text not null,
  previous_state jsonb,
  next_state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists business_billing_admin_audit_business_created_idx
  on public.business_billing_admin_audit (business_id, created_at desc);

alter table public.business_billing_admin_audit enable row level security;

revoke all on table public.business_billing_admin_audit from anon;
revoke all on table public.business_billing_admin_audit from authenticated;

comment on table public.business_billing_admin_audit is
  'Server-only audit history for manual operator billing changes.';
