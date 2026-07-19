-- Stage 12 Batch 3: customer discovery map and nearby-search foundation.
--
-- Run manually after SQL 18, SQL 19 and SQL 20. This file does not import,
-- approve, publish or link any place. It exposes only rounded coordinates
-- through service-only RPCs used by public server routes.

begin;

do $$
begin
  if to_regclass('public.business_locations') is null then
    raise exception 'SQL 22 requires SQL 18 business location storage.';
  end if;

  if to_regclass('public.directory_places') is null
    or to_regclass('public.directory_place_reviews') is null
  then
    raise exception 'SQL 22 requires SQL 19 and SQL 20 directory storage.';
  end if;
end;
$$;

create or replace function public.mirebook_public_business_map_locations(
  p_business_ids uuid[]
)
returns table (
  business_id uuid,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    business_location.business_id,
    round(
      extensions.st_y(
        business_location.location::extensions.geometry
      )::numeric,
      4
    )::double precision as latitude,
    round(
      extensions.st_x(
        business_location.location::extensions.geometry
      )::numeric,
      4
    )::double precision as longitude
  from public.business_locations business_location
  join public.businesses business
    on business.id = business_location.business_id
  where p_business_ids is not null
    and business_location.business_id = any(p_business_ids)
    and business.published = true
    and business_location.verification_status = 'verified'
  order by business_location.business_id
  limit 500;
$$;

revoke all on function public.mirebook_public_business_map_locations(uuid[])
  from public;
revoke all on function public.mirebook_public_business_map_locations(uuid[])
  from anon;
revoke all on function public.mirebook_public_business_map_locations(uuid[])
  from authenticated;
grant execute on function public.mirebook_public_business_map_locations(uuid[])
  to service_role;

create or replace function public.mirebook_public_directory_discovery(
  p_query text default null,
  p_category text default null,
  p_city text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_radius_meters double precision default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  category_key text,
  description text,
  address text,
  city text,
  region text,
  country_code text,
  postcode text,
  phone text,
  website text,
  claim_status text,
  linked_business_id uuid,
  source text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  query_point extensions.geography;
  safe_limit integer;
  safe_offset integer;
begin
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Latitude and longitude must be supplied together.'
      using errcode = '22023';
  end if;

  if p_latitude is not null
    and (p_latitude < -90 or p_latitude > 90)
  then
    raise exception 'Latitude must be between -90 and 90.'
      using errcode = '22023';
  end if;

  if p_longitude is not null
    and (p_longitude < -180 or p_longitude > 180)
  then
    raise exception 'Longitude must be between -180 and 180.'
      using errcode = '22023';
  end if;

  if p_radius_meters is not null
    and (
      p_latitude is null
      or p_radius_meters <= 0
      or p_radius_meters > 1000000
    )
  then
    raise exception 'A valid location and radius up to 1000000 metres are required.'
      using errcode = '22023';
  end if;

  if p_latitude is not null then
    query_point := extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography;
  end if;

  safe_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  with candidates as (
    select
      place.id,
      place.name,
      place.category_key,
      place.description,
      place.address,
      place.city,
      place.region,
      place.country_code,
      place.postcode,
      place.phone,
      place.website,
      place.claim_status,
      place.linked_business_id,
      place.source,
      round(
        extensions.st_y(place.location::extensions.geometry)::numeric,
        4
      )::double precision as latitude,
      round(
        extensions.st_x(place.location::extensions.geometry)::numeric,
        4
      )::double precision as longitude,
      case
        when query_point is null then null
        else extensions.st_distance(place.location, query_point)::double precision
      end as distance_meters,
      place.source_confidence
    from public.directory_places place
    where place.listing_status = 'active'
      and place.duplicate_of_place_id is null
      and (
        nullif(btrim(p_query), '') is null
        or place.name ilike '%' || btrim(p_query) || '%'
        or coalesce(place.description, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(place.city, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(place.address, '') ilike '%' || btrim(p_query) || '%'
      )
      and (
        nullif(btrim(p_category), '') is null
        or place.category_key = btrim(p_category)
      )
      and (
        nullif(btrim(p_city), '') is null
        or lower(coalesce(place.city, '')) = lower(btrim(p_city))
      )
      and (
        p_radius_meters is null
        or extensions.st_dwithin(
          place.location,
          query_point,
          p_radius_meters
        )
      )
  )
  select
    candidate.id,
    candidate.name,
    candidate.category_key,
    candidate.description,
    candidate.address,
    candidate.city,
    candidate.region,
    candidate.country_code,
    candidate.postcode,
    candidate.phone,
    candidate.website,
    candidate.claim_status,
    candidate.linked_business_id,
    candidate.source,
    candidate.latitude,
    candidate.longitude,
    candidate.distance_meters,
    count(*) over() as total_count
  from candidates candidate
  order by
    candidate.distance_meters asc nulls last,
    candidate.source_confidence desc nulls last,
    candidate.name asc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.mirebook_public_directory_discovery(
  text,
  text,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  integer
) from public;
revoke all on function public.mirebook_public_directory_discovery(
  text,
  text,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  integer
) from anon;
revoke all on function public.mirebook_public_directory_discovery(
  text,
  text,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  integer
) from authenticated;
grant execute on function public.mirebook_public_directory_discovery(
  text,
  text,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  integer
) to service_role;

comment on function public.mirebook_public_business_map_locations(uuid[]) is
  'Service-only rounded map points for published business IDs that already passed application readiness checks.';

comment on function public.mirebook_public_directory_discovery(
  text,
  text,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  integer
) is
  'Service-only reviewed directory discovery with rounded map points and optional non-persisted distance matching.';

commit;
