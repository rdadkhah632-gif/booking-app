-- Stage 13 Batch 13E: private customer iOS push-device registry.
--
-- This table only prepares authenticated APNs device registration. It does not
-- send push notifications, change in-app notifications or alter email delivery.
-- Run manually in Supabase, then verify browser roles have no table access.

begin;

create table if not exists public.customer_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  device_token text not null,
  platform text not null default 'ios' check (platform = 'ios'),
  app_bundle_id text not null
    check (app_bundle_id = 'com.mirebook.ios.customer'),
  apns_environment text not null
    check (apns_environment in ('sandbox', 'production')),
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'sq')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_bundle_id, installation_id)
);

create index if not exists customer_push_devices_user_enabled_idx
  on public.customer_push_devices (user_id, enabled, last_seen_at desc);

create or replace function public.set_customer_push_devices_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_push_devices_updated_at
  on public.customer_push_devices;

create trigger set_customer_push_devices_updated_at
before update on public.customer_push_devices
for each row execute function public.set_customer_push_devices_updated_at();

alter table public.customer_push_devices enable row level security;
revoke all on table public.customer_push_devices from anon;
revoke all on table public.customer_push_devices from authenticated;

comment on table public.customer_push_devices is
  'Server-managed APNs registration records for the customer iOS app; never browser-readable.';
comment on column public.customer_push_devices.device_token is
  'Private APNs routing token. Do not expose through customer or admin browser APIs.';

commit;
