-- Stage 13 Batch 13F.1: authenticated native account-deletion request queue.
--
-- This queue records an in-app deletion request for controlled completion. It
-- does not delete auth users, businesses, staff links, bookings or legally
-- retained records automatically. The service-owned completion process must
-- apply those rules and send the promised completion confirmation.

begin;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_app text not null default 'ios_native'
    check (source_app in ('ios_native', 'web', 'support')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  confirmation_method text not null default 'exact_email'
    check (confirmation_method in ('exact_email', 'reauthenticated')),
  account_context jsonb not null default '{}'::jsonb,
  target_completion_at timestamptz not null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  confirmation_sent_at timestamptz,
  resolution_note text
);

create unique index if not exists account_deletion_requests_active_user_idx
  on public.account_deletion_requests (user_id)
  where user_id is not null and status in ('pending', 'processing');

create index if not exists account_deletion_requests_operations_idx
  on public.account_deletion_requests (status, target_completion_at, requested_at);

create or replace function public.set_account_deletion_requests_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_account_deletion_requests_updated_at
  on public.account_deletion_requests;

create trigger set_account_deletion_requests_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_account_deletion_requests_updated_at();

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from authenticated;

comment on table public.account_deletion_requests is
  'Service-managed queue for authenticated account-deletion requests and completion confirmation.';
comment on column public.account_deletion_requests.account_context is
  'Non-PII capability snapshot used to route business, staff and admin deletion review safely.';
comment on column public.account_deletion_requests.resolution_note is
  'Private operator note; never expose through customer or browser APIs.';

commit;
