-- Stage 12 Batch 2: audited directory review and public-safe read foundation.
--
-- Run manually after SQL 19. This file does not approve or publish any place.
-- It adds an admin-only review function and a service-only public read RPC that
-- returns only explicitly approved (`active`) directory rows.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 20 requires SQL 19 directory tables.';
  end if;
end;
$$;

alter table public.directory_places
  add column if not exists duplicate_of_place_id uuid
    references public.directory_places(id) on delete restrict;

alter table public.directory_places
  drop constraint if exists directory_places_listing_status_check;

alter table public.directory_places
  add constraint directory_places_listing_status_check
  check (
    listing_status in (
      'needs_review',
      'active',
      'hidden',
      'closed',
      'duplicate'
    )
  );

alter table public.directory_places
  drop constraint if exists directory_places_duplicate_state_check;

alter table public.directory_places
  add constraint directory_places_duplicate_state_check
  check (
    (listing_status = 'duplicate' and duplicate_of_place_id is not null)
    or (listing_status <> 'duplicate' and duplicate_of_place_id is null)
  );

alter table public.directory_places
  drop constraint if exists directory_places_not_self_duplicate_check;

alter table public.directory_places
  add constraint directory_places_not_self_duplicate_check
  check (duplicate_of_place_id is null or duplicate_of_place_id <> id);

create index if not exists directory_places_duplicate_of_idx
  on public.directory_places (duplicate_of_place_id)
  where duplicate_of_place_id is not null;

create table if not exists public.directory_place_reviews (
  id uuid primary key default gen_random_uuid(),
  directory_place_id uuid not null
    references public.directory_places(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  from_status text not null,
  to_status text not null,
  notes text,
  duplicate_of_place_id uuid
    references public.directory_places(id) on delete set null,
  source_fingerprint text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    action in (
      'approve',
      'hide',
      'close',
      'return_to_review',
      'mark_duplicate'
    )
  ),
  check (
    from_status in (
      'needs_review',
      'active',
      'hidden',
      'closed',
      'duplicate'
    )
  ),
  check (
    to_status in (
      'needs_review',
      'active',
      'hidden',
      'closed',
      'duplicate'
    )
  ),
  check (jsonb_typeof(source_snapshot) = 'object')
);

create index if not exists directory_place_reviews_place_created_idx
  on public.directory_place_reviews (directory_place_id, created_at desc);

create index if not exists directory_place_reviews_reviewer_created_idx
  on public.directory_place_reviews (reviewer_id, created_at desc);

alter table public.directory_place_reviews enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'directory_place_reviews'
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

revoke all on table public.directory_place_reviews from public;
revoke all on table public.directory_place_reviews from anon;
revoke all on table public.directory_place_reviews from authenticated;
revoke all on table public.directory_place_reviews from service_role;
grant select, insert on table public.directory_place_reviews to service_role;

create or replace function public.mirebook_directory_source_change_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.source_fingerprint is distinct from new.source_fingerprint
    and old.listing_status = 'active'
  then
    new.listing_status = 'needs_review';
    new.duplicate_of_place_id = null;
  end if;

  return new;
end;
$$;

drop trigger if exists directory_source_change_requires_review
  on public.directory_places;

create trigger directory_source_change_requires_review
before update on public.directory_places
for each row
execute function public.mirebook_directory_source_change_review();

revoke all on function public.mirebook_directory_source_change_review()
  from public;
revoke all on function public.mirebook_directory_source_change_review()
  from anon;
revoke all on function public.mirebook_directory_source_change_review()
  from authenticated;

create or replace function public.mirebook_review_directory_place(
  p_place_id uuid,
  p_action text,
  p_reviewer_id uuid,
  p_notes text default null,
  p_duplicate_of_place_id uuid default null
)
returns table (
  place_id uuid,
  listing_status text,
  review_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  place_record public.directory_places%rowtype;
  duplicate_record public.directory_places%rowtype;
  next_status text;
  clean_action text;
  clean_notes text;
  inserted_review_id uuid;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_reviewer_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin reviewer is required.' using errcode = '42501';
  end if;

  clean_action := lower(btrim(p_action));
  clean_notes := nullif(btrim(p_notes), '');

  next_status := case clean_action
    when 'approve' then 'active'
    when 'hide' then 'hidden'
    when 'close' then 'closed'
    when 'return_to_review' then 'needs_review'
    when 'mark_duplicate' then 'duplicate'
    else null
  end;

  if next_status is null then
    raise exception 'Directory review action is invalid.'
      using errcode = '22023';
  end if;

  if clean_action in ('hide', 'close', 'mark_duplicate')
    and clean_notes is null
  then
    raise exception 'A review note is required for this action.'
      using errcode = '22023';
  end if;

  select place.*
  into place_record
  from public.directory_places place
  where place.id = p_place_id
  for update;

  if not found then
    raise exception 'Directory place was not found.' using errcode = 'P0002';
  end if;

  if clean_action = 'approve'
    and place_record.source_operating_status = 'permanently_closed'
  then
    raise exception 'A permanently closed source record cannot be approved.'
      using errcode = '22023';
  end if;

  if clean_action = 'mark_duplicate' then
    if p_duplicate_of_place_id is null
      or p_duplicate_of_place_id = p_place_id
    then
      raise exception 'A different canonical directory place is required.'
        using errcode = '22023';
    end if;

    select place.*
    into duplicate_record
    from public.directory_places place
    where place.id = p_duplicate_of_place_id
    for update;

    if not found or duplicate_record.listing_status = 'duplicate' then
      raise exception 'The canonical directory place is not available.'
        using errcode = '22023';
    end if;
  end if;

  update public.directory_places place
  set
    listing_status = next_status,
    duplicate_of_place_id = case
      when clean_action = 'mark_duplicate' then p_duplicate_of_place_id
      else null
    end
  where place.id = place_record.id;

  insert into public.directory_place_reviews (
    directory_place_id,
    reviewer_id,
    action,
    from_status,
    to_status,
    notes,
    duplicate_of_place_id,
    source_fingerprint,
    source_snapshot
  )
  values (
    place_record.id,
    p_reviewer_id,
    clean_action,
    place_record.listing_status,
    next_status,
    clean_notes,
    case
      when clean_action = 'mark_duplicate' then p_duplicate_of_place_id
      else null
    end,
    place_record.source_fingerprint,
    jsonb_build_object(
      'source', place_record.source,
      'sourceVersion', place_record.source_version,
      'sourcePlaceId', place_record.source_place_id,
      'name', place_record.name,
      'categoryKey', place_record.category_key,
      'address', place_record.address,
      'city', place_record.city,
      'region', place_record.region,
      'countryCode', place_record.country_code,
      'sourceUpdatedAt', place_record.source_updated_at
    )
  )
  returning id into inserted_review_id;

  return query
  select place_record.id, next_status, inserted_review_id;
end;
$$;

revoke all on function public.mirebook_review_directory_place(
  uuid,
  text,
  uuid,
  text,
  uuid
) from public;
revoke all on function public.mirebook_review_directory_place(
  uuid,
  text,
  uuid,
  text,
  uuid
) from anon;
revoke all on function public.mirebook_review_directory_place(
  uuid,
  text,
  uuid,
  text,
  uuid
) from authenticated;
grant execute on function public.mirebook_review_directory_place(
  uuid,
  text,
  uuid,
  text,
  uuid
) to service_role;

create or replace function public.mirebook_admin_directory_place_location(
  p_place_id uuid
)
returns table (
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    extensions.st_y(place.location::extensions.geometry),
    extensions.st_x(place.location::extensions.geometry)
  from public.directory_places place
  where place.id = p_place_id
  limit 1;
$$;

revoke all on function public.mirebook_admin_directory_place_location(uuid)
  from public;
revoke all on function public.mirebook_admin_directory_place_location(uuid)
  from anon;
revoke all on function public.mirebook_admin_directory_place_location(uuid)
  from authenticated;
grant execute on function public.mirebook_admin_directory_place_location(uuid)
  to service_role;

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
    count(*) over() as total_count
  from public.directory_places place
  where place.listing_status = 'active'
    and place.duplicate_of_place_id is null
    and (
      nullif(btrim(p_query), '') is null
      or place.name ilike '%' || btrim(p_query) || '%'
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
  order by place.source_confidence desc nulls last, place.name asc
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

comment on table public.directory_place_reviews is
  'Append-only operator review audit for imported directory place visibility decisions.';

comment on function public.mirebook_review_directory_place(
  uuid,
  text,
  uuid,
  text,
  uuid
) is
  'Service-only audited review transition. It never creates services, staff, availability or booking capability.';

comment on function public.mirebook_public_directory_places(
  text,
  text,
  text,
  integer,
  integer
) is
  'Service-only public-safe shape for reviewed active directory places. Coordinates are rounded and raw source IDs/confidence are omitted.';

commit;
