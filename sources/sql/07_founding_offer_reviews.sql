-- Stage 6 Batch 7 - optional founding-business offer review records.
-- Run manually in the Supabase SQL editor.
-- This table records an admin review decision only. It does not change Stripe,
-- billing periods, product access, bookings or public listing.

create table if not exists public.founding_offer_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  review_status text not null default 'pending'
    check (
      review_status in (
        'pending',
        'needs_review',
        'potentially_eligible',
        'approved',
        'declined'
      )
    ),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_founding_offer_review_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_founding_offer_review_updated_at
  on public.founding_offer_reviews;

create trigger set_founding_offer_review_updated_at
before update on public.founding_offer_reviews
for each row
execute function public.set_founding_offer_review_updated_at();

alter table public.founding_offer_reviews enable row level security;

revoke all on table public.founding_offer_reviews from anon;
revoke all on table public.founding_offer_reviews from authenticated;

comment on table public.founding_offer_reviews is
  'Server-only admin review records for the founding-business second-free-month offer. No automatic billing action.';

comment on column public.founding_offer_reviews.review_status is
  'Decision-support status only. Approved does not change Stripe or business_billing automatically.';
