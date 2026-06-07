-- Stage 4 Batch 2: manual business billing foundation.
-- Run this script manually in the Supabase SQL editor.
-- price_amount is stored in minor currency units (for example 1900 = GBP 19.00).

create table if not exists public.business_billing (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  billing_status text not null default 'not_configured'
    check (
      billing_status in (
        'not_configured',
        'free_trial',
        'founding_free',
        'active',
        'manual_comped',
        'past_due',
        'cancelled',
        'paused'
      )
    ),
  plan_name text not null default 'Mirëbook Launch',
  price_amount integer check (price_amount is null or price_amount >= 0),
  currency text not null default 'GBP'
    check (currency ~ '^[A-Z]{3}$'),
  trial_start timestamptz,
  trial_end timestamptz,
  founding_business boolean not null default false,
  second_month_free_eligible boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_end is null or trial_start is null or trial_end >= trial_start)
);

create unique index if not exists business_billing_stripe_customer_id_key
  on public.business_billing (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists business_billing_stripe_subscription_id_key
  on public.business_billing (stripe_subscription_id)
  where stripe_subscription_id is not null;

create or replace function public.set_business_billing_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_business_billing_updated_at
  on public.business_billing;

create trigger set_business_billing_updated_at
before update on public.business_billing
for each row
execute function public.set_business_billing_updated_at();

create or replace function public.create_business_billing_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_billing (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_business_billing_record
  on public.businesses;

create trigger create_business_billing_record
after insert on public.businesses
for each row
execute function public.create_business_billing_record();

insert into public.business_billing (business_id)
select id
from public.businesses
on conflict (business_id) do nothing;

alter table public.business_billing enable row level security;

drop policy if exists "Business owners can read billing state"
  on public.business_billing;

create policy "Business owners can read billing state"
on public.business_billing
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = business_billing.business_id
      and businesses.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage billing state"
  on public.business_billing;

create policy "Admins can manage billing state"
on public.business_billing
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

revoke all on table public.business_billing from anon;
revoke all on table public.business_billing from authenticated;

grant select (
  id,
  business_id,
  billing_status,
  plan_name,
  price_amount,
  currency,
  trial_start,
  trial_end,
  founding_business,
  second_month_free_eligible,
  current_period_end,
  created_at,
  updated_at
) on table public.business_billing to authenticated;

grant insert, update, delete
on table public.business_billing
to authenticated;

comment on column public.business_billing.price_amount is
  'Agreed monthly price in minor currency units. No payment is processed by this table.';

comment on column public.business_billing.notes is
  'Internal billing notes. Not granted for authenticated client reads.';
