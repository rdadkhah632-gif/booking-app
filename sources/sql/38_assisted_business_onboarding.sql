-- Stage 12 Batch 29: private assisted-onboarding cases for launch partners.
--
-- Run manually after SQL 35 and SQL 36. This migration creates no Auth user,
-- directory place, business, claim, message or public listing. It stores only
-- the operator's private preparation state and an append-only audit snapshot.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null
    or to_regclass('public.businesses') is null
    or to_regclass('public.profiles') is null
  then
    raise exception
      'SQL 38 requires the directory, business and profile foundations.';
  end if;
end;
$$;

create table if not exists public.business_onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  directory_place_id uuid
    references public.directory_places(id) on delete set null,
  business_id uuid
    references public.businesses(id) on delete set null,
  prospect_name text not null,
  category_key text,
  city text,
  address text,
  website text,
  social_url text,
  owner_name text,
  owner_email text,
  owner_phone text,
  preferred_language text not null default 'sq',
  status text not null default 'new',
  listing_interest boolean not null default true,
  booking_interest boolean not null default false,
  business_app_interest boolean not null default false,
  assets_status text not null default 'not_requested',
  profile_media_permission boolean not null default false,
  marketing_media_permission boolean not null default false,
  permission_source text,
  permission_granted_by text,
  permission_note text,
  permission_granted_at timestamptz,
  private_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(prospect_name)) between 2 and 180),
  check (category_key is null or length(category_key) <= 60),
  check (city is null or length(city) <= 120),
  check (address is null or length(address) <= 500),
  check (website is null or length(website) <= 1200),
  check (social_url is null or length(social_url) <= 1200),
  check (owner_name is null or length(owner_name) <= 180),
  check (owner_email is null or length(owner_email) <= 320),
  check (owner_phone is null or length(owner_phone) <= 80),
  check (preferred_language in ('en', 'sq')),
  check (
    status in (
      'new',
      'contacted',
      'interested',
      'assets_requested',
      'assets_received',
      'draft_prepared',
      'invite_sent',
      'claimed',
      'ready_to_publish',
      'live',
      'paused',
      'declined'
    )
  ),
  check (
    assets_status in (
      'not_requested',
      'requested',
      'partial',
      'received',
      'reviewed'
    )
  ),
  check (listing_interest or booking_interest or business_app_interest),
  check (
    permission_source is null
    or permission_source in (
      'email',
      'social_message',
      'written_form',
      'phone',
      'in_person',
      'other'
    )
  ),
  check (permission_note is null or length(permission_note) <= 1000),
  check (private_notes is null or length(private_notes) <= 3000),
  check (
    not (profile_media_permission or marketing_media_permission)
    or (
      permission_source is not null
      and permission_granted_by is not null
      and permission_granted_at is not null
    )
  )
);

create unique index if not exists business_onboarding_cases_place_unique
  on public.business_onboarding_cases (directory_place_id)
  where directory_place_id is not null;

create unique index if not exists business_onboarding_cases_business_unique
  on public.business_onboarding_cases (business_id)
  where business_id is not null;

create index if not exists business_onboarding_cases_status_updated_idx
  on public.business_onboarding_cases (status, updated_at desc);

create index if not exists business_onboarding_cases_name_city_idx
  on public.business_onboarding_cases (
    lower(prospect_name),
    lower(coalesce(city, ''))
  );

create table if not exists public.business_onboarding_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.business_onboarding_cases(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  action text not null default 'saved',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(action) <= 80)
);

create index if not exists business_onboarding_case_events_case_created_idx
  on public.business_onboarding_case_events (case_id, created_at desc);

alter table public.business_onboarding_cases enable row level security;
alter table public.business_onboarding_case_events enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'business_onboarding_cases',
        'business_onboarding_case_events'
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

revoke all on table public.business_onboarding_cases from public;
revoke all on table public.business_onboarding_cases from anon;
revoke all on table public.business_onboarding_cases from authenticated;
revoke all on table public.business_onboarding_cases from service_role;
grant select on table public.business_onboarding_cases to service_role;

revoke all on table public.business_onboarding_case_events from public;
revoke all on table public.business_onboarding_case_events from anon;
revoke all on table public.business_onboarding_case_events from authenticated;
revoke all on table public.business_onboarding_case_events from service_role;
grant select on table public.business_onboarding_case_events to service_role;

create or replace function public.mirebook_save_business_onboarding_case(
  p_actor_user_id uuid,
  p_case_id uuid default null,
  p_directory_place_id uuid default null,
  p_business_id uuid default null,
  p_prospect_name text default null,
  p_category_key text default null,
  p_city text default null,
  p_address text default null,
  p_website text default null,
  p_social_url text default null,
  p_owner_name text default null,
  p_owner_email text default null,
  p_owner_phone text default null,
  p_preferred_language text default 'sq',
  p_status text default 'new',
  p_listing_interest boolean default true,
  p_booking_interest boolean default false,
  p_business_app_interest boolean default false,
  p_assets_status text default 'not_requested',
  p_profile_media_permission boolean default false,
  p_marketing_media_permission boolean default false,
  p_permission_source text default null,
  p_permission_granted_by text default null,
  p_permission_note text default null,
  p_permission_granted_at timestamptz default null,
  p_private_notes text default null
)
returns setof public.business_onboarding_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_record public.business_onboarding_cases%rowtype;
  saved_record public.business_onboarding_cases%rowtype;
  clean_name text := nullif(btrim(p_prospect_name), '');
  clean_status text := lower(btrim(coalesce(p_status, '')));
  clean_assets_status text := lower(btrim(coalesce(p_assets_status, '')));
  clean_language text := lower(btrim(coalesce(p_preferred_language, '')));
  clean_permission_source text := nullif(
    lower(btrim(coalesce(p_permission_source, ''))),
    ''
  );
  media_permission boolean :=
    coalesce(p_profile_media_permission, false)
    or coalesce(p_marketing_media_permission, false);
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_actor_user_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin operator is required.' using errcode = '42501';
  end if;

  if clean_name is null or length(clean_name) < 2 then
    raise exception 'Add the business or prospect name.' using errcode = '22023';
  end if;

  if clean_status not in (
    'new', 'contacted', 'interested', 'assets_requested', 'assets_received',
    'draft_prepared', 'invite_sent', 'claimed', 'ready_to_publish', 'live',
    'paused', 'declined'
  ) then
    raise exception 'Choose a valid onboarding status.' using errcode = '22023';
  end if;

  if clean_assets_status not in (
    'not_requested', 'requested', 'partial', 'received', 'reviewed'
  ) then
    raise exception 'Choose a valid asset status.' using errcode = '22023';
  end if;

  if clean_language not in ('en', 'sq') then
    raise exception 'Choose English or Albanian.' using errcode = '22023';
  end if;

  if not (
    coalesce(p_listing_interest, false)
    or coalesce(p_booking_interest, false)
    or coalesce(p_business_app_interest, false)
  ) then
    raise exception 'Choose at least one onboarding goal.' using errcode = '22023';
  end if;

  if p_directory_place_id is not null and not exists (
    select 1 from public.directory_places place
    where place.id = p_directory_place_id
  ) then
    raise exception 'The directory place was not found.' using errcode = 'P0002';
  end if;

  if p_business_id is not null and not exists (
    select 1 from public.businesses business
    where business.id = p_business_id
  ) then
    raise exception 'The business profile was not found.' using errcode = 'P0002';
  end if;

  if media_permission and (
    clean_permission_source is null
    or nullif(btrim(p_permission_granted_by), '') is null
    or p_permission_granted_at is null
  ) then
    raise exception
      'Record who granted media permission, how and when.'
      using errcode = '22023';
  end if;

  if clean_permission_source is not null and clean_permission_source not in (
    'email', 'social_message', 'written_form', 'phone', 'in_person', 'other'
  ) then
    raise exception 'Choose a valid permission source.' using errcode = '22023';
  end if;

  if p_case_id is not null then
    select onboarding.*
    into existing_record
    from public.business_onboarding_cases onboarding
    where onboarding.id = p_case_id
    for update;

    if not found then
      raise exception 'The onboarding case was not found.' using errcode = 'P0002';
    end if;
  else
    if p_directory_place_id is not null then
      select onboarding.*
      into existing_record
      from public.business_onboarding_cases onboarding
      where onboarding.directory_place_id = p_directory_place_id
      for update;
    elsif p_business_id is not null then
      select onboarding.*
      into existing_record
      from public.business_onboarding_cases onboarding
      where onboarding.business_id = p_business_id
      for update;
    end if;
  end if;

  if existing_record.id is null then
    insert into public.business_onboarding_cases (
      directory_place_id, business_id, prospect_name, category_key, city,
      address, website, social_url, owner_name, owner_email, owner_phone,
      preferred_language, status, listing_interest, booking_interest,
      business_app_interest, assets_status, profile_media_permission,
      marketing_media_permission, permission_source, permission_granted_by,
      permission_note, permission_granted_at, private_notes, created_by,
      updated_by
    ) values (
      p_directory_place_id, p_business_id, clean_name,
      nullif(btrim(p_category_key), ''), nullif(btrim(p_city), ''),
      nullif(btrim(p_address), ''), nullif(btrim(p_website), ''),
      nullif(btrim(p_social_url), ''), nullif(btrim(p_owner_name), ''),
      nullif(lower(btrim(p_owner_email)), ''), nullif(btrim(p_owner_phone), ''),
      clean_language, clean_status, coalesce(p_listing_interest, false),
      coalesce(p_booking_interest, false),
      coalesce(p_business_app_interest, false), clean_assets_status,
      coalesce(p_profile_media_permission, false),
      coalesce(p_marketing_media_permission, false),
      case when media_permission then clean_permission_source else null end,
      case when media_permission then nullif(btrim(p_permission_granted_by), '') else null end,
      case when media_permission then nullif(btrim(p_permission_note), '') else null end,
      case when media_permission then p_permission_granted_at else null end,
      nullif(btrim(p_private_notes), ''), p_actor_user_id, p_actor_user_id
    )
    returning * into saved_record;
  else
    update public.business_onboarding_cases
    set
      directory_place_id = p_directory_place_id,
      business_id = p_business_id,
      prospect_name = clean_name,
      category_key = nullif(btrim(p_category_key), ''),
      city = nullif(btrim(p_city), ''),
      address = nullif(btrim(p_address), ''),
      website = nullif(btrim(p_website), ''),
      social_url = nullif(btrim(p_social_url), ''),
      owner_name = nullif(btrim(p_owner_name), ''),
      owner_email = nullif(lower(btrim(p_owner_email)), ''),
      owner_phone = nullif(btrim(p_owner_phone), ''),
      preferred_language = clean_language,
      status = clean_status,
      listing_interest = coalesce(p_listing_interest, false),
      booking_interest = coalesce(p_booking_interest, false),
      business_app_interest = coalesce(p_business_app_interest, false),
      assets_status = clean_assets_status,
      profile_media_permission = coalesce(p_profile_media_permission, false),
      marketing_media_permission = coalesce(p_marketing_media_permission, false),
      permission_source = case when media_permission then clean_permission_source else null end,
      permission_granted_by = case when media_permission then nullif(btrim(p_permission_granted_by), '') else null end,
      permission_note = case when media_permission then nullif(btrim(p_permission_note), '') else null end,
      permission_granted_at = case when media_permission then p_permission_granted_at else null end,
      private_notes = nullif(btrim(p_private_notes), ''),
      updated_by = p_actor_user_id,
      updated_at = now()
    where id = existing_record.id
    returning * into saved_record;
  end if;

  insert into public.business_onboarding_case_events (
    case_id,
    actor_user_id,
    from_status,
    to_status,
    action,
    snapshot
  ) values (
    saved_record.id,
    p_actor_user_id,
    existing_record.status,
    saved_record.status,
    case when existing_record.id is null then 'created' else 'saved' end,
    jsonb_build_object(
      'directoryPlaceId', saved_record.directory_place_id,
      'businessId', saved_record.business_id,
      'assetsStatus', saved_record.assets_status,
      'listingInterest', saved_record.listing_interest,
      'bookingInterest', saved_record.booking_interest,
      'businessAppInterest', saved_record.business_app_interest,
      'profileMediaPermission', saved_record.profile_media_permission,
      'marketingMediaPermission', saved_record.marketing_media_permission,
      'permissionSource', saved_record.permission_source,
      'permissionGrantedBy', saved_record.permission_granted_by,
      'permissionGrantedAt', saved_record.permission_granted_at
    )
  );

  return next saved_record;
end;
$$;

revoke all on function public.mirebook_save_business_onboarding_case(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text,
  text, text, text, boolean, boolean, boolean, text, boolean, boolean, text,
  text, text, timestamptz, text
) from public;
revoke all on function public.mirebook_save_business_onboarding_case(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text,
  text, text, text, boolean, boolean, boolean, text, boolean, boolean, text,
  text, text, timestamptz, text
) from anon;
revoke all on function public.mirebook_save_business_onboarding_case(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text,
  text, text, text, boolean, boolean, boolean, text, boolean, boolean, text,
  text, text, timestamptz, text
) from authenticated;
grant execute on function public.mirebook_save_business_onboarding_case(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text,
  text, text, text, boolean, boolean, boolean, text, boolean, boolean, text,
  text, text, timestamptz, text
) to service_role;

comment on table public.business_onboarding_cases is
  'Private operator preparation state for a directory place, an existing business or a new prospect. It never creates credentials or public state.';

comment on table public.business_onboarding_case_events is
  'Append-only audit snapshots for assisted business onboarding and media permission changes.';

comment on function public.mirebook_save_business_onboarding_case(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text,
  text, text, text, boolean, boolean, boolean, text, boolean, boolean, text,
  text, text, timestamptz, text
) is
  'Admin-only audited save for assisted onboarding. It sends nothing, creates no Auth user and changes no publication, booking or billing state.';

commit;
