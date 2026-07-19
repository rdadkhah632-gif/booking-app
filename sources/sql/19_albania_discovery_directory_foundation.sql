-- Stage 12 Batch 1: private Albania discovery directory, claim review and
-- import audit foundation.
--
-- Run this file manually in the Supabase SQL editor after SQL 18.
-- It is idempotent and creates no public listings. Imported places default to
-- `needs_review`, remain inaccessible to browser clients and cannot become a
-- Mirëbook business without an explicit admin-reviewed claim.

begin;

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
      'SQL 19 requires PostGIS in the extensions schema. Run SQL 18 first.';
  end if;
end;
$$;

create table if not exists public.directory_places (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_place_id text not null,
  source_version text,
  name text not null,
  normalized_name text not null,
  category_key text not null,
  source_category text,
  source_category_ids text[] not null default '{}',
  description text,
  address text,
  city text,
  region text,
  country_code text not null default 'AL',
  postcode text,
  location extensions.geography(point, 4326) not null,
  phone text,
  website text,
  email text,
  social_urls jsonb not null default '[]'::jsonb,
  source_confidence numeric(5, 4),
  source_operating_status text,
  source_updated_at timestamptz,
  source_attribution jsonb not null default '{}'::jsonb,
  source_fingerprint text,
  listing_status text not null default 'needs_review',
  claim_status text not null default 'unclaimed',
  linked_business_id uuid references public.businesses(id) on delete set null,
  first_imported_at timestamptz not null default now(),
  last_imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_place_id),
  check (source ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  check (length(btrim(source_place_id)) > 0),
  check (length(btrim(name)) > 0),
  check (length(btrim(normalized_name)) > 0),
  check (
    category_key in (
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
    )
  ),
  check (country_code = upper(country_code) and length(country_code) = 2),
  check (
    source_confidence is null
    or (source_confidence >= 0 and source_confidence <= 1)
  ),
  check (jsonb_typeof(social_urls) = 'array'),
  check (jsonb_typeof(source_attribution) = 'object'),
  check (listing_status in ('needs_review', 'active', 'hidden', 'closed')),
  check (claim_status in ('unclaimed', 'claimed', 'disputed')),
  check (claim_status <> 'claimed' or linked_business_id is not null),
  check (
    linked_business_id is null
    or claim_status in ('claimed', 'disputed')
  )
);

create unique index if not exists directory_places_linked_business_unique
  on public.directory_places (linked_business_id)
  where linked_business_id is not null;

create index if not exists directory_places_review_queue_idx
  on public.directory_places (
    listing_status,
    category_key,
    country_code,
    city
  );

create index if not exists directory_places_normalized_name_idx
  on public.directory_places (normalized_name);

create index if not exists directory_places_source_updated_idx
  on public.directory_places (source, source_updated_at desc);

create index if not exists directory_places_active_location_gix
  on public.directory_places
  using gist (location)
  where listing_status = 'active';

create table if not exists public.directory_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_version text,
  status text not null default 'running',
  dry_run boolean not null default false,
  input_count integer not null default 0,
  processed_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  check (source ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  check (status in ('running', 'completed', 'failed')),
  check (input_count >= 0),
  check (processed_count >= 0),
  check (inserted_count >= 0),
  check (updated_count >= 0),
  check (skipped_count >= 0),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists directory_import_runs_source_started_idx
  on public.directory_import_runs (source, started_at desc);

create table if not exists public.business_claims (
  id uuid primary key default gen_random_uuid(),
  directory_place_id uuid not null
    references public.directory_places(id) on delete cascade,
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  claimant_user_id uuid not null
    references auth.users(id) on delete cascade,
  status text not null default 'pending',
  evidence_type text not null,
  evidence_value_masked text,
  claimant_message text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status in (
      'pending',
      'needs_more_info',
      'approved',
      'rejected',
      'withdrawn'
    )
  ),
  check (
    evidence_type in (
      'domain_email',
      'business_phone',
      'business_document',
      'admin_review',
      'other'
    )
  ),
  check (
    status <> 'approved'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index if not exists business_claims_open_request_unique
  on public.business_claims (directory_place_id, business_id)
  where status in ('pending', 'needs_more_info');

create unique index if not exists business_claims_approved_place_unique
  on public.business_claims (directory_place_id)
  where status = 'approved';

create unique index if not exists business_claims_approved_business_unique
  on public.business_claims (business_id)
  where status = 'approved';

create index if not exists business_claims_claimant_created_idx
  on public.business_claims (claimant_user_id, created_at desc);

create index if not exists business_claims_review_queue_idx
  on public.business_claims (status, created_at asc);

create or replace function public.mirebook_set_directory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_directory_place_updated_at
  on public.directory_places;

create trigger set_directory_place_updated_at
before update on public.directory_places
for each row
execute function public.mirebook_set_directory_updated_at();

drop trigger if exists set_business_claim_updated_at
  on public.business_claims;

create trigger set_business_claim_updated_at
before update on public.business_claims
for each row
execute function public.mirebook_set_directory_updated_at();

revoke all on function public.mirebook_set_directory_updated_at() from public;
revoke all on function public.mirebook_set_directory_updated_at() from anon;
revoke all on function public.mirebook_set_directory_updated_at()
  from authenticated;

alter table public.directory_places enable row level security;
alter table public.directory_import_runs enable row level security;
alter table public.business_claims enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'directory_places',
        'directory_import_runs',
        'business_claims'
      )
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

revoke all on table public.directory_places from public;
revoke all on table public.directory_places from anon;
revoke all on table public.directory_places from authenticated;
revoke all on table public.directory_import_runs from public;
revoke all on table public.directory_import_runs from anon;
revoke all on table public.directory_import_runs from authenticated;
revoke all on table public.business_claims from public;
revoke all on table public.business_claims from anon;
revoke all on table public.business_claims from authenticated;

grant select, insert, update, delete
  on table public.directory_places to service_role;
grant select, insert, update, delete
  on table public.directory_import_runs to service_role;
grant select, insert, update, delete
  on table public.business_claims to service_role;

create or replace function public.mirebook_import_albania_directory_places(
  p_places jsonb,
  p_source text,
  p_source_version text default null
)
returns table (
  processed_count integer,
  inserted_count integer,
  updated_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  input_count integer;
  valid_count integer;
  existing_count integer;
  affected_count integer;
begin
  if jsonb_typeof(p_places) is distinct from 'array' then
    raise exception 'Places payload must be a JSON array.'
      using errcode = '22023';
  end if;

  input_count := jsonb_array_length(p_places);

  if input_count < 1 or input_count > 500 then
    raise exception 'Each import batch must contain between 1 and 500 places.'
      using errcode = '22023';
  end if;

  p_source := lower(btrim(p_source));
  p_source_version := nullif(btrim(p_source_version), '');

  if p_source !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then
    raise exception 'Import source is invalid.' using errcode = '22023';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(p_places) as place (
      source_place_id text,
      name text,
      category_key text,
      source_category text,
      source_category_ids text[],
      description text,
      address text,
      city text,
      region text,
      country_code text,
      postcode text,
      latitude double precision,
      longitude double precision,
      phone text,
      website text,
      email text,
      social_urls jsonb,
      source_confidence numeric,
      source_operating_status text,
      source_updated_at timestamptz,
      source_attribution jsonb,
      source_fingerprint text
    )
  )
  select count(*)
  into valid_count
  from incoming
  where nullif(btrim(source_place_id), '') is not null
    and nullif(btrim(name), '') is not null
    and category_key in (
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
    )
    and upper(country_code) = 'AL'
    and latitude between 39.55 and 42.75
    and longitude between 19.00 and 21.20
    and (
      source_confidence is null
      or source_confidence between 0 and 1
    )
    and jsonb_typeof(coalesce(social_urls, '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(source_attribution, '{}'::jsonb)) = 'object';

  if valid_count <> input_count then
    raise exception
      'Import batch contains invalid or non-Albania directory records.'
      using errcode = '22023';
  end if;

  if (
    select count(distinct place ->> 'source_place_id')
    from jsonb_array_elements(p_places) place
  ) <> input_count then
    raise exception 'Import batch contains duplicate source place IDs.'
      using errcode = '22023';
  end if;

  select count(*)
  into existing_count
  from public.directory_places existing_place
  where existing_place.source = p_source
    and existing_place.source_place_id in (
      select place ->> 'source_place_id'
      from jsonb_array_elements(p_places) place
    );

  with incoming as (
    select *
    from jsonb_to_recordset(p_places) as place (
      source_place_id text,
      name text,
      category_key text,
      source_category text,
      source_category_ids text[],
      description text,
      address text,
      city text,
      region text,
      country_code text,
      postcode text,
      latitude double precision,
      longitude double precision,
      phone text,
      website text,
      email text,
      social_urls jsonb,
      source_confidence numeric,
      source_operating_status text,
      source_updated_at timestamptz,
      source_attribution jsonb,
      source_fingerprint text
    )
  ), upserted as (
    insert into public.directory_places (
      source,
      source_place_id,
      source_version,
      name,
      normalized_name,
      category_key,
      source_category,
      source_category_ids,
      description,
      address,
      city,
      region,
      country_code,
      postcode,
      location,
      phone,
      website,
      email,
      social_urls,
      source_confidence,
      source_operating_status,
      source_updated_at,
      source_attribution,
      source_fingerprint,
      last_imported_at
    )
    select
      p_source,
      btrim(incoming.source_place_id),
      p_source_version,
      btrim(incoming.name),
      coalesce(
        nullif(
          lower(regexp_replace(btrim(incoming.name), '[^[:alnum:]]', '', 'g')),
          ''
        ),
        lower(btrim(incoming.name))
      ),
      incoming.category_key,
      nullif(btrim(incoming.source_category), ''),
      coalesce(incoming.source_category_ids, '{}'),
      nullif(btrim(incoming.description), ''),
      nullif(btrim(incoming.address), ''),
      nullif(btrim(incoming.city), ''),
      nullif(btrim(incoming.region), ''),
      'AL',
      nullif(btrim(incoming.postcode), ''),
      extensions.st_setsrid(
        extensions.st_makepoint(incoming.longitude, incoming.latitude),
        4326
      )::extensions.geography,
      nullif(btrim(incoming.phone), ''),
      nullif(btrim(incoming.website), ''),
      nullif(btrim(incoming.email), ''),
      coalesce(incoming.social_urls, '[]'::jsonb),
      incoming.source_confidence,
      nullif(btrim(incoming.source_operating_status), ''),
      incoming.source_updated_at,
      coalesce(incoming.source_attribution, '{}'::jsonb),
      nullif(btrim(incoming.source_fingerprint), ''),
      now()
    from incoming
    on conflict (source, source_place_id) do update
    set
      source_version = excluded.source_version,
      name = excluded.name,
      normalized_name = excluded.normalized_name,
      category_key = excluded.category_key,
      source_category = excluded.source_category,
      source_category_ids = excluded.source_category_ids,
      description = excluded.description,
      address = excluded.address,
      city = excluded.city,
      region = excluded.region,
      country_code = excluded.country_code,
      postcode = excluded.postcode,
      location = excluded.location,
      phone = excluded.phone,
      website = excluded.website,
      email = excluded.email,
      social_urls = excluded.social_urls,
      source_confidence = excluded.source_confidence,
      source_operating_status = excluded.source_operating_status,
      source_updated_at = excluded.source_updated_at,
      source_attribution = excluded.source_attribution,
      source_fingerprint = excluded.source_fingerprint,
      last_imported_at = now()
    returning id
  )
  select count(*)
  into affected_count
  from upserted;

  return query
  select
    affected_count,
    greatest(affected_count - existing_count, 0),
    least(existing_count, affected_count);
end;
$$;

revoke all on function public.mirebook_import_albania_directory_places(
  jsonb,
  text,
  text
) from public;
revoke all on function public.mirebook_import_albania_directory_places(
  jsonb,
  text,
  text
) from anon;
revoke all on function public.mirebook_import_albania_directory_places(
  jsonb,
  text,
  text
) from authenticated;
grant execute on function public.mirebook_import_albania_directory_places(
  jsonb,
  text,
  text
) to service_role;

create or replace function public.mirebook_approve_business_claim(
  p_claim_id uuid,
  p_reviewer_id uuid
)
returns table (
  claim_id uuid,
  directory_place_id uuid,
  business_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_record public.business_claims%rowtype;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_reviewer_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin reviewer is required.' using errcode = '42501';
  end if;

  select claim.*
  into claim_record
  from public.business_claims claim
  where claim.id = p_claim_id
  for update;

  if not found then
    raise exception 'Business claim was not found.' using errcode = 'P0002';
  end if;

  if claim_record.status not in ('pending', 'needs_more_info') then
    raise exception 'Only an open business claim can be approved.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.businesses business
    where business.id = claim_record.business_id
      and business.user_id = claim_record.claimant_user_id
  ) then
    raise exception 'The claimant does not own the selected business.'
      using errcode = '42501';
  end if;

  update public.directory_places place
  set
    linked_business_id = claim_record.business_id,
    claim_status = 'claimed'
  where place.id = claim_record.directory_place_id
    and (
      place.linked_business_id is null
      or place.linked_business_id = claim_record.business_id
    );

  if not found then
    raise exception 'This directory place is already linked to another business.'
      using errcode = '23505';
  end if;

  update public.business_claims claim
  set
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now()
  where claim.id = claim_record.id;

  update public.business_claims claim
  set
    status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = coalesce(
      claim.review_notes,
      'Another ownership claim for this place was approved.'
    )
  where claim.directory_place_id = claim_record.directory_place_id
    and claim.id <> claim_record.id
    and claim.status in ('pending', 'needs_more_info');

  return query
  select
    claim_record.id,
    claim_record.directory_place_id,
    claim_record.business_id;
end;
$$;

revoke all on function public.mirebook_approve_business_claim(uuid, uuid)
  from public;
revoke all on function public.mirebook_approve_business_claim(uuid, uuid)
  from anon;
revoke all on function public.mirebook_approve_business_claim(uuid, uuid)
  from authenticated;
grant execute on function public.mirebook_approve_business_claim(uuid, uuid)
  to service_role;

comment on table public.directory_places is
  'Private imported-place directory. Only reviewed active rows may later be shaped through a public API.';

comment on column public.directory_places.location is
  'Source place coordinate. Stored privately and exposed only through a future public-safe directory API.';

comment on column public.directory_places.listing_status is
  'Imports default to needs_review and never become public automatically.';

comment on table public.business_claims is
  'Server-managed ownership claims. Name or address similarity alone never approves a claim.';

comment on function public.mirebook_import_albania_directory_places(
  jsonb,
  text,
  text
) is
  'Service-only idempotent importer for reviewed Albania directory candidates. It never approves a listing or claim on refresh.';

commit;
