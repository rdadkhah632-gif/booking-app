-- Stage 12 Batch 14: reviewed public facts for imported directory places.
--
-- Imported source fields remain immutable. Operators can record a current
-- public name, category, address and contact set with private verification
-- evidence. Public discovery uses those reviewed values only while the flag is
-- enabled; listing approval remains a separate audited action.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 30 requires the directory foundation from SQL 19.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directory_places'
      and column_name = 'editorial_description_en'
  ) then
    raise exception 'SQL 30 requires reviewed content from SQL 29.';
  end if;
end;
$$;

alter table public.directory_places
  add column if not exists public_facts_reviewed boolean not null default false,
  add column if not exists public_name text,
  add column if not exists public_category_key text,
  add column if not exists public_address text,
  add column if not exists public_postcode text,
  add column if not exists public_phone text,
  add column if not exists public_website text,
  add column if not exists public_facts_source_url text,
  add column if not exists public_facts_note text,
  add column if not exists public_facts_updated_by uuid
    references auth.users(id) on delete set null,
  add column if not exists public_facts_updated_at timestamptz;

alter table public.directory_places
  drop constraint if exists directory_places_public_name_length,
  drop constraint if exists directory_places_public_category_key_valid,
  drop constraint if exists directory_places_public_address_length,
  drop constraint if exists directory_places_public_postcode_length,
  drop constraint if exists directory_places_public_phone_length,
  drop constraint if exists directory_places_public_website_https,
  drop constraint if exists directory_places_public_facts_source_url_https,
  drop constraint if exists directory_places_public_facts_note_length,
  drop constraint if exists directory_places_public_facts_complete;

alter table public.directory_places
  add constraint directory_places_public_name_length
    check (public_name is null or char_length(public_name) <= 180),
  add constraint directory_places_public_category_key_valid
    check (
      public_category_key is null
      or public_category_key = any (
        array[
          'beauty_grooming',
          'dental_health',
          'wellness_fitness',
          'events',
          'learning_lessons',
          'tours_activities',
          'rentals',
          'attractions',
          'food_drink',
          'lodging'
        ]
      )
    ),
  add constraint directory_places_public_address_length
    check (public_address is null or char_length(public_address) <= 500),
  add constraint directory_places_public_postcode_length
    check (public_postcode is null or char_length(public_postcode) <= 40),
  add constraint directory_places_public_phone_length
    check (public_phone is null or char_length(public_phone) <= 80),
  add constraint directory_places_public_website_https
    check (
      public_website is null
      or (
        char_length(public_website) <= 1200
        and public_website ~* '^https://'
      )
    ),
  add constraint directory_places_public_facts_source_url_https
    check (
      public_facts_source_url is null
      or (
        char_length(public_facts_source_url) <= 1200
        and public_facts_source_url ~* '^https://'
      )
    ),
  add constraint directory_places_public_facts_note_length
    check (
      public_facts_note is null
      or char_length(public_facts_note) <= 1000
    ),
  add constraint directory_places_public_facts_complete
    check (
      public_facts_reviewed = false
      or (
        nullif(btrim(public_name), '') is not null
        and nullif(btrim(public_category_key), '') is not null
        and nullif(btrim(public_facts_source_url), '') is not null
        and nullif(btrim(public_facts_note), '') is not null
      )
    );

comment on column public.directory_places.public_facts_reviewed is
  'When true, public discovery uses the reviewed public_* fields instead of imported source facts.';
comment on column public.directory_places.public_name is
  'Operator-reviewed public place name; imported name remains unchanged.';
comment on column public.directory_places.public_category_key is
  'Operator-reviewed public category; imported category remains unchanged.';
comment on column public.directory_places.public_facts_source_url is
  'Private operator evidence URL used to verify current public facts.';
comment on column public.directory_places.public_facts_note is
  'Private operator note describing the verification performed.';
comment on column public.directory_places.public_facts_updated_by is
  'Admin user who last changed reviewed public facts.';

create or replace function public.mirebook_public_directory_places(
  p_query text default null,
  p_category text default null,
  p_city text default null,
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
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    place.id,
    case
      when place.public_facts_reviewed then place.public_name
      else place.name
    end,
    case
      when place.public_facts_reviewed then place.public_category_key
      else place.category_key
    end,
    place.description,
    case
      when place.public_facts_reviewed then place.public_address
      else place.address
    end,
    place.city,
    place.region,
    place.country_code,
    case
      when place.public_facts_reviewed then place.public_postcode
      else place.postcode
    end,
    case
      when place.public_facts_reviewed then place.public_phone
      else place.phone
    end,
    case
      when place.public_facts_reviewed then place.public_website
      else place.website
    end,
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
    count(*) over() as total_count
  from public.directory_places place
  where place.listing_status = 'active'
    and place.duplicate_of_place_id is null
    and (
      nullif(btrim(p_query), '') is null
      or (
        case
          when place.public_facts_reviewed then place.public_name
          else place.name
        end
      ) ilike '%' || btrim(p_query) || '%'
      or coalesce(
        place.editorial_description_en,
        place.editorial_description_sq,
        place.description,
        ''
      ) ilike '%' || btrim(p_query) || '%'
      or coalesce(place.city, '') ilike '%' || btrim(p_query) || '%'
      or coalesce(
        case
          when place.public_facts_reviewed then place.public_address
          else place.address
        end,
        ''
      ) ilike '%' || btrim(p_query) || '%'
    )
    and (
      nullif(btrim(p_category), '') is null
      or (
        case
          when place.public_facts_reviewed then place.public_category_key
          else place.category_key
        end
      ) = btrim(p_category)
    )
    and (
      nullif(btrim(p_city), '') is null
      or lower(coalesce(place.city, '')) = lower(btrim(p_city))
    )
  order by
    place.source_confidence desc nulls last,
    case
      when place.public_facts_reviewed then place.public_name
      else place.name
    end asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.mirebook_public_directory_places(
  text,
  text,
  text,
  integer,
  integer
) from public;
revoke all on function public.mirebook_public_directory_places(
  text,
  text,
  text,
  integer,
  integer
) from anon;
revoke all on function public.mirebook_public_directory_places(
  text,
  text,
  text,
  integer,
  integer
) from authenticated;
grant execute on function public.mirebook_public_directory_places(
  text,
  text,
  text,
  integer,
  integer
) to service_role;

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
      case
        when place.public_facts_reviewed then place.public_name
        else place.name
      end as public_name,
      case
        when place.public_facts_reviewed then place.public_category_key
        else place.category_key
      end as public_category_key,
      place.description,
      case
        when place.public_facts_reviewed then place.public_address
        else place.address
      end as public_address,
      place.city,
      place.region,
      place.country_code,
      case
        when place.public_facts_reviewed then place.public_postcode
        else place.postcode
      end as public_postcode,
      case
        when place.public_facts_reviewed then place.public_phone
        else place.phone
      end as public_phone,
      case
        when place.public_facts_reviewed then place.public_website
        else place.website
      end as public_website,
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
        or (
          case
            when place.public_facts_reviewed then place.public_name
            else place.name
          end
        ) ilike '%' || btrim(p_query) || '%'
        or coalesce(
          place.editorial_description_en,
          place.editorial_description_sq,
          place.description,
          ''
        ) ilike '%' || btrim(p_query) || '%'
        or coalesce(place.city, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(
          case
            when place.public_facts_reviewed then place.public_address
            else place.address
          end,
          ''
        ) ilike '%' || btrim(p_query) || '%'
      )
      and (
        nullif(btrim(p_category), '') is null
        or (
          case
            when place.public_facts_reviewed then place.public_category_key
            else place.category_key
          end
        ) = btrim(p_category)
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
    candidate.public_name,
    candidate.public_category_key,
    candidate.description,
    candidate.public_address,
    candidate.city,
    candidate.region,
    candidate.country_code,
    candidate.public_postcode,
    candidate.public_phone,
    candidate.public_website,
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
    candidate.public_name asc
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

comment on function public.mirebook_public_directory_places(
  text,
  text,
  text,
  integer,
  integer
) is
  'Service-only public-safe directory results using verified public overrides when enabled.';
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
  'Service-only reviewed directory discovery using verified public overrides and rounded map points.';

commit;
