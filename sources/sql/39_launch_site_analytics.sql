-- Stage 12 Batch 33: privacy-safe launch interaction analytics.
--
-- This table stores allowlisted aggregate interaction events only. It has no
-- user ID, email, phone, IP address, precise location or persistent browser
-- identifier. Browser roles receive no direct read or write access.

begin;

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  route text not null,
  locale text not null default 'en',
  entity_type text,
  entity_id uuid,
  source text,
  medium text,
  campaign text,
  device_category text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    event_name in (
      'home_search_submitted',
      'home_suggestion_selected',
      'home_map_opened',
      'business_entry_opened',
      'explore_search_submitted',
      'explore_suggestion_selected',
      'explore_view_changed',
      'explore_kind_changed',
      'explore_map_result_selected',
      'explore_more_results',
      'explore_location_requested',
      'explore_location_resolved',
      'place_viewed',
      'place_website_opened',
      'place_directions_opened',
      'place_claim_opened',
      'business_viewed',
      'booking_started',
      'registration_viewed',
      'registration_submitted'
    )
  ),
  check (length(route) between 1 and 180),
  check (locale in ('en', 'sq')),
  check (entity_type is null or entity_type in ('directory_place', 'business')),
  check ((entity_type is null) = (entity_id is null)),
  check (source is null or length(source) <= 80),
  check (medium is null or length(medium) <= 80),
  check (campaign is null or length(campaign) <= 80),
  check (device_category in ('mobile', 'tablet', 'desktop', 'unknown')),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists site_analytics_events_created_idx
  on public.site_analytics_events (created_at desc);
create index if not exists site_analytics_events_name_created_idx
  on public.site_analytics_events (event_name, created_at desc);
create index if not exists site_analytics_events_entity_created_idx
  on public.site_analytics_events (entity_type, entity_id, created_at desc)
  where entity_id is not null;
create index if not exists site_analytics_events_source_created_idx
  on public.site_analytics_events (source, campaign, created_at desc)
  where source is not null;

alter table public.site_analytics_events enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_analytics_events'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

revoke all on table public.site_analytics_events from public;
revoke all on table public.site_analytics_events from anon;
revoke all on table public.site_analytics_events from authenticated;
revoke all on table public.site_analytics_events from service_role;
grant select, insert, delete on table public.site_analytics_events to service_role;

commit;
