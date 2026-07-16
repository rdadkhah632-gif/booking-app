-- Location Batch 1: private business coordinates and service-only distance
-- matching.
--
-- Run this file manually in the Supabase SQL editor. It is idempotent.
-- It does not geocode addresses, request customer location, alter marketplace
-- readiness, or expose exact coordinates to public/customer/staff clients.

begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $$
declare
  installed_schema text;
begin
  select namespace.nspname
  into installed_schema
  from pg_extension extension
  join pg_namespace namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'postgis';

  if installed_schema is distinct from 'extensions' then
    raise exception
      'PostGIS is installed in schema %, but Mirëbook Location Batch 1 expects the extensions schema.',
      coalesce(installed_schema, 'unknown');
  end if;
end;
$$;

create table if not exists public.business_locations (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  formatted_address text not null,
  provider text not null,
  provider_place_id text,
  location_precision text not null default 'approximate'
    check (
      location_precision in (
        'exact',
        'street',
        'postcode',
        'city',
        'approximate'
      )
    ),
  verification_status text not null default 'needs_review'
    check (
      verification_status in ('verified', 'stale', 'needs_review')
    ),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(formatted_address)) > 0),
  check (length(btrim(provider)) > 0),
  check (
    verification_status <> 'verified'
    or verified_at is not null
  )
);

create index if not exists business_locations_verified_location_gix
  on public.business_locations
  using gist (location)
  where verification_status = 'verified';

create or replace function public.set_business_location_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_business_location_updated_at
  on public.business_locations;

create trigger set_business_location_updated_at
before update on public.business_locations
for each row
execute function public.set_business_location_updated_at();

revoke all on function public.set_business_location_updated_at() from public;
revoke all on function public.set_business_location_updated_at() from anon;
revoke all on function public.set_business_location_updated_at()
  from authenticated;

create or replace function public.mirebook_mark_business_location_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.address is distinct from old.address
    or new.city is distinct from old.city
    or new.country is distinct from old.country
  then
    update public.business_locations
    set
      verification_status = 'stale',
      verified_at = null
    where business_id = new.id
      and verification_status = 'verified';
  end if;

  return new;
end;
$$;

drop trigger if exists mark_business_location_stale_after_address_change
  on public.businesses;

create trigger mark_business_location_stale_after_address_change
after update of address, city, country on public.businesses
for each row
execute function public.mirebook_mark_business_location_stale();

revoke all on function public.mirebook_mark_business_location_stale()
  from public;
revoke all on function public.mirebook_mark_business_location_stale()
  from anon;
revoke all on function public.mirebook_mark_business_location_stale()
  from authenticated;

alter table public.business_locations enable row level security;

drop policy if exists business_locations_select_owner_admin
  on public.business_locations;

create policy business_locations_select_owner_admin
on public.business_locations
for select
to authenticated
using (
  (select public.mirebook_owns_business(business_id))
  or (select public.mirebook_is_admin())
);

revoke all on table public.business_locations from public;
revoke all on table public.business_locations from anon;
revoke all on table public.business_locations from authenticated;

grant select on table public.business_locations to authenticated;
grant select, insert, update, delete
  on table public.business_locations
  to service_role;

create or replace function public.mirebook_business_distances(
  p_business_ids uuid[],
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default null,
  p_limit integer default 200
)
returns table (
  business_id uuid,
  distance_meters double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  query_location extensions.geography;
  safe_limit integer;
begin
  if p_business_ids is null or cardinality(p_business_ids) = 0 then
    return;
  end if;

  if p_latitude is null
    or p_latitude < -90
    or p_latitude > 90
  then
    raise exception 'Latitude must be between -90 and 90.'
      using errcode = '22023';
  end if;

  if p_longitude is null
    or p_longitude < -180
    or p_longitude > 180
  then
    raise exception 'Longitude must be between -180 and 180.'
      using errcode = '22023';
  end if;

  if p_radius_meters is not null
    and (p_radius_meters <= 0 or p_radius_meters > 1000000)
  then
    raise exception 'Radius must be greater than 0 and no more than 1000000 metres.'
      using errcode = '22023';
  end if;

  safe_limit := least(greatest(coalesce(p_limit, 200), 1), 200);
  query_location := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;

  return query
  select
    business_location.business_id,
    extensions.st_distance(
      business_location.location,
      query_location
    )::double precision as distance_meters
  from public.business_locations business_location
  join public.businesses business
    on business.id = business_location.business_id
  where business_location.business_id = any(p_business_ids)
    and business.published = true
    and business_location.verification_status = 'verified'
    and (
      p_radius_meters is null
      or extensions.st_dwithin(
        business_location.location,
        query_location,
        p_radius_meters
      )
    )
  order by
    business_location.location
      operator(extensions.<->) query_location
  limit safe_limit;
end;
$$;

revoke all on function public.mirebook_business_distances(
  uuid[],
  double precision,
  double precision,
  double precision,
  integer
) from public;

revoke all on function public.mirebook_business_distances(
  uuid[],
  double precision,
  double precision,
  double precision,
  integer
) from anon;

revoke all on function public.mirebook_business_distances(
  uuid[],
  double precision,
  double precision,
  double precision,
  integer
) from authenticated;

grant execute on function public.mirebook_business_distances(
  uuid[],
  double precision,
  double precision,
  double precision,
  integer
) to service_role;

comment on table public.business_locations is
  'Private, server-managed business coordinates used for optional distance matching.';

comment on column public.business_locations.location is
  'Exact business point. Never expose directly through public marketplace responses.';

comment on column public.business_locations.verification_status is
  'Only verified rows may be used for distance matching. Address edits mark rows stale.';

comment on function public.mirebook_business_distances(
  uuid[],
  double precision,
  double precision,
  double precision,
  integer
) is
  'Service-only distance lookup for business IDs that already passed existing marketplace readiness checks.';

commit;
