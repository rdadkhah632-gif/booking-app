-- Stage 12: prepared business profile and verified-owner handoff.
--
-- This migration lets an admin prepare a private business profile and hidden
-- service drafts, then issue a one-time capability link. The link never stores
-- the raw token, never publishes a business and never activates a service.
-- Adoption is available only to a verified Mirëbook Business account.

begin;

do $$
begin
  if to_regclass('public.business_onboarding_cases') is null
    or to_regclass('public.business_onboarding_case_events') is null
    or to_regclass('public.businesses') is null
    or to_regclass('public.services') is null
    or to_regclass('public.business_claims') is null
  then
    raise exception
      'SQL 43 requires SQL 24, SQL 38 and the existing business/service foundation.';
  end if;
end;
$$;

alter table public.services
  add column if not exists assisted_onboarding_case_id uuid
    references public.business_onboarding_cases(id) on delete set null,
  add column if not exists owner_review_required boolean not null default false;

create unique index if not exists services_assisted_case_name_unique
  on public.services (
    business_id,
    assisted_onboarding_case_id,
    lower(name)
  )
  where assisted_onboarding_case_id is not null;

create table if not exists public.business_onboarding_profile_drafts (
  case_id uuid primary key
    references public.business_onboarding_cases(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  services jsonb not null default '[]'::jsonb,
  handoff_token_hash text unique,
  handoff_expires_at timestamptz,
  handoff_issued_by uuid references auth.users(id) on delete set null,
  handoff_issued_at timestamptz,
  adopted_by uuid references auth.users(id) on delete set null,
  adopted_business_id uuid references public.businesses(id) on delete set null,
  adopted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_profile_drafts_profile_object
    check (jsonb_typeof(profile) = 'object'),
  constraint onboarding_profile_drafts_services_array
    check (jsonb_typeof(services) = 'array'),
  constraint onboarding_profile_drafts_token_shape
    check (
      handoff_token_hash is null
      or handoff_token_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint onboarding_profile_drafts_handoff_shape
    check (
      (handoff_token_hash is null and handoff_expires_at is null)
      or
      (handoff_token_hash is not null and handoff_expires_at is not null)
    ),
  constraint onboarding_profile_drafts_adoption_shape
    check (
      (adopted_at is null and adopted_by is null and adopted_business_id is null)
      or
      (adopted_at is not null and adopted_by is not null and adopted_business_id is not null)
    )
);

create index if not exists onboarding_profile_drafts_token_idx
  on public.business_onboarding_profile_drafts (handoff_token_hash)
  where handoff_token_hash is not null;

alter table public.business_onboarding_profile_drafts enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_onboarding_profile_drafts'
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

revoke all on table public.business_onboarding_profile_drafts from public;
revoke all on table public.business_onboarding_profile_drafts from anon;
revoke all on table public.business_onboarding_profile_drafts from authenticated;
revoke all on table public.business_onboarding_profile_drafts from service_role;
grant select on table public.business_onboarding_profile_drafts to service_role;

create or replace function public.mirebook_save_onboarding_profile_draft(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_profile jsonb,
  p_services jsonb
)
returns setof public.business_onboarding_profile_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_record public.business_onboarding_profile_drafts%rowtype;
  service_item jsonb;
  service_type text;
  service_capacity integer;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_actor_user_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin operator is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.business_onboarding_cases onboarding
    where onboarding.id = p_case_id
  ) then
    raise exception 'The onboarding case was not found.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_profile) <> 'object'
    or length(btrim(coalesce(p_profile->>'name', ''))) < 2
    or length(btrim(coalesce(p_profile->>'city', ''))) < 2
    or length(btrim(coalesce(p_profile->>'category', ''))) < 2
  then
    raise exception 'Add the prepared business name, category and city.'
      using errcode = '22023';
  end if;

  if upper(coalesce(p_profile->>'currency', '')) not in ('ALL', 'EUR', 'GBP', 'USD') then
    raise exception 'Choose a supported prepared currency.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_services) <> 'array'
    or jsonb_array_length(p_services) > 50
  then
    raise exception 'Prepared services must be a list of no more than 50 items.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.business_onboarding_profile_drafts draft
    where draft.case_id = p_case_id
      and draft.adopted_at is not null
  ) then
    raise exception 'A connected prepared profile can no longer be replaced.'
      using errcode = '22023';
  end if;

  for service_item in select value from jsonb_array_elements(p_services)
  loop
    if jsonb_typeof(service_item) <> 'object'
      or length(btrim(coalesce(service_item->>'name', ''))) < 2
    then
      raise exception 'Every prepared service needs a name.' using errcode = '22023';
    end if;

    if coalesce((service_item->>'durationMinutes')::integer, 0) not between 5 and 10080 then
      raise exception 'Prepared service duration must be between 5 and 10080 minutes.'
        using errcode = '22023';
    end if;

    if coalesce((service_item->>'price')::numeric, 0) < 0 then
      raise exception 'Prepared service prices cannot be negative.' using errcode = '22023';
    end if;

    service_type := lower(coalesce(service_item->>'bookingType', 'appointment'));
    if service_type not in ('appointment', 'group') then
      raise exception 'Choose a valid prepared booking type.' using errcode = '22023';
    end if;

    if service_type = 'group' then
      service_capacity := coalesce((service_item->>'groupCapacity')::integer, 0);
      if service_capacity not between 1 and 200 then
        raise exception 'Prepared group capacity must be between 1 and 200.'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  insert into public.business_onboarding_profile_drafts (
    case_id,
    profile,
    services,
    created_by,
    updated_by
  )
  values (
    p_case_id,
    p_profile,
    p_services,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (case_id) do update
  set
    profile = excluded.profile,
    services = excluded.services,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into saved_record;

  update public.business_onboarding_cases
  set
    status = case
      when status in ('new', 'contacted', 'interested', 'assets_requested', 'assets_received')
        then 'draft_prepared'
      else status
    end,
    booking_interest = true,
    business_app_interest = true,
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_case_id;

  insert into public.business_onboarding_case_events (
    case_id,
    actor_user_id,
    from_status,
    to_status,
    action,
    snapshot
  )
  select
    onboarding.id,
    p_actor_user_id,
    onboarding.status,
    onboarding.status,
    'prepared_profile_saved',
    jsonb_build_object(
      'serviceCount', jsonb_array_length(p_services),
      'currency', upper(p_profile->>'currency'),
      'ownerTakesBookings', coalesce((p_profile->>'ownerTakesBookings')::boolean, false)
    )
  from public.business_onboarding_cases onboarding
  where onboarding.id = p_case_id;

  return next saved_record;
end;
$$;

create or replace function public.mirebook_issue_onboarding_handoff(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns setof public.business_onboarding_profile_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_record public.business_onboarding_profile_drafts%rowtype;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_actor_user_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin operator is required.' using errcode = '42501';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'The secure handoff token is invalid.' using errcode = '22023';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '90 days' then
    raise exception 'Choose a handoff expiry within the next 90 days.'
      using errcode = '22023';
  end if;

  update public.business_onboarding_profile_drafts
  set
    handoff_token_hash = p_token_hash,
    handoff_expires_at = p_expires_at,
    handoff_issued_by = p_actor_user_id,
    handoff_issued_at = now(),
    updated_by = p_actor_user_id,
    updated_at = now()
  where case_id = p_case_id
    and adopted_at is null
  returning * into saved_record;

  if not found then
    raise exception 'Save an unclaimed prepared profile before creating its handoff link.'
      using errcode = 'P0002';
  end if;

  insert into public.business_onboarding_case_events (
    case_id,
    actor_user_id,
    from_status,
    to_status,
    action,
    snapshot
  )
  select
    onboarding.id,
    p_actor_user_id,
    onboarding.status,
    onboarding.status,
    'handoff_link_created',
    jsonb_build_object('expiresAt', p_expires_at)
  from public.business_onboarding_cases onboarding
  where onboarding.id = p_case_id;

  return next saved_record;
end;
$$;

create or replace function public.mirebook_adopt_onboarding_profile(
  p_user_id uuid,
  p_token_hash text
)
returns table (
  case_id uuid,
  business_id uuid,
  claim_id uuid,
  imported_services integer,
  already_adopted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_record public.business_onboarding_profile_drafts%rowtype;
  case_record public.business_onboarding_cases%rowtype;
  selected_business public.businesses%rowtype;
  service_item jsonb;
  selected_staff_id uuid;
  selected_claim_id uuid;
  service_id uuid;
  owner_business_count integer := 0;
  inserted_count integer := 0;
  clean_email text;
  clean_name text;
  service_type text;
  owner_takes_bookings boolean;
begin
  select lower(coalesce(account.email, ''))
  into clean_email
  from auth.users account
  where account.id = p_user_id
    and account.email_confirmed_at is not null;

  if clean_email is null or clean_email = '' then
    raise exception 'A verified Mirëbook account is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
      and profile.role = 'business'
  ) then
    raise exception 'Use a Mirëbook Business account to connect this profile.'
      using errcode = '42501';
  end if;

  select draft.*
  into draft_record
  from public.business_onboarding_profile_drafts draft
  where draft.handoff_token_hash = p_token_hash
  for update;

  if not found
    or draft_record.handoff_expires_at is null
    or draft_record.handoff_expires_at <= now()
  then
    raise exception 'This prepared-profile link is invalid or expired.'
      using errcode = 'P0002';
  end if;

  if draft_record.adopted_at is not null then
    if draft_record.adopted_by <> p_user_id then
      raise exception 'This prepared profile is already connected.'
        using errcode = '23505';
    end if;

    return query
    select
      draft_record.case_id,
      draft_record.adopted_business_id,
      null::uuid,
      0,
      true;
    return;
  end if;

  select onboarding.*
  into case_record
  from public.business_onboarding_cases onboarding
  where onboarding.id = draft_record.case_id
  for update;

  if not found then
    raise exception 'The prepared onboarding case was not found.' using errcode = 'P0002';
  end if;

  clean_name := btrim(draft_record.profile->>'name');
  owner_takes_bookings := coalesce(
    (draft_record.profile->>'ownerTakesBookings')::boolean,
    false
  );

  if case_record.business_id is not null then
    select business.*
    into selected_business
    from public.businesses business
    where business.id = case_record.business_id
      and business.user_id = p_user_id
    for update;

    if not found then
      raise exception 'This profile is linked to a different business owner.'
        using errcode = '42501';
    end if;
  else
    select business.*
    into selected_business
    from public.businesses business
    where business.user_id = p_user_id
      and lower(btrim(business.name)) = lower(clean_name)
    order by business.created_at asc
    limit 1
    for update;

    if not found then
      select count(*)
      into owner_business_count
      from public.businesses business
      where business.user_id = p_user_id;

      if owner_business_count = 0 then
        insert into public.businesses (
          user_id,
          name,
          description,
          phone,
          address,
          city,
          country,
          category,
          timezone,
          currency,
          published
        ) values (
          p_user_id,
          clean_name,
          nullif(btrim(draft_record.profile->>'description'), ''),
          nullif(btrim(draft_record.profile->>'phone'), ''),
          nullif(btrim(draft_record.profile->>'address'), ''),
          btrim(draft_record.profile->>'city'),
          coalesce(nullif(btrim(draft_record.profile->>'country'), ''), 'Albania'),
          btrim(draft_record.profile->>'category'),
          coalesce(nullif(btrim(draft_record.profile->>'timezone'), ''), 'Europe/Tirane'),
          upper(coalesce(nullif(btrim(draft_record.profile->>'currency'), ''), 'ALL')),
          false
        )
        returning * into selected_business;
      elsif owner_business_count = 1 then
        select business.*
        into selected_business
        from public.businesses business
        where business.user_id = p_user_id
        for update;

        if selected_business.published then
          raise exception 'Use a new Business account or contact Mirëbook before replacing a live profile.'
            using errcode = '22023';
        end if;
      else
        raise exception 'Choose the matching business before connecting this prepared profile.'
          using errcode = '22023';
      end if;
    end if;
  end if;

  if selected_business.published then
    raise exception 'Hide the current business before applying a prepared profile.'
      using errcode = '22023';
  end if;

  update public.businesses
  set
    name = clean_name,
    description = nullif(btrim(draft_record.profile->>'description'), ''),
    phone = coalesce(
      nullif(btrim(draft_record.profile->>'phone'), ''),
      selected_business.phone
    ),
    address = coalesce(
      nullif(btrim(draft_record.profile->>'address'), ''),
      selected_business.address
    ),
    city = btrim(draft_record.profile->>'city'),
    country = coalesce(nullif(btrim(draft_record.profile->>'country'), ''), 'Albania'),
    category = btrim(draft_record.profile->>'category'),
    timezone = coalesce(nullif(btrim(draft_record.profile->>'timezone'), ''), 'Europe/Tirane'),
    currency = upper(coalesce(nullif(btrim(draft_record.profile->>'currency'), ''), 'ALL')),
    published = false
  where id = selected_business.id
  returning * into selected_business;

  if owner_takes_bookings then
    select staff.id
    into selected_staff_id
    from public.staff_members staff
    where staff.business_id = selected_business.id
      and staff.user_id = p_user_id
    order by staff.created_at asc
    limit 1;

    if selected_staff_id is null then
      insert into public.staff_members (
        business_id,
        user_id,
        name,
        email,
        phone,
        role_title,
        permission_role,
        invite_status,
        active
      )
      select
        selected_business.id,
        p_user_id,
        coalesce(nullif(btrim(profile.full_name), ''), split_part(clean_email, '@', 1)),
        clean_email,
        coalesce(nullif(btrim(profile.phone), ''), selected_business.phone),
        case when profile.preferred_language = 'sq' then 'Pronar' else 'Owner' end,
        'staff',
        'linked',
        true
      from public.profiles profile
      where profile.id = p_user_id
      returning id into selected_staff_id;
    end if;
  end if;

  for service_item in select value from jsonb_array_elements(draft_record.services)
  loop
    service_type := lower(coalesce(service_item->>'bookingType', 'appointment'));

    insert into public.services (
      business_id,
      name,
      description,
      duration_minutes,
      price,
      active,
      booking_type,
      group_capacity,
      private_booking_enabled,
      private_price,
      assisted_onboarding_case_id,
      owner_review_required
    )
    values (
      selected_business.id,
      btrim(service_item->>'name'),
      nullif(btrim(service_item->>'description'), ''),
      (service_item->>'durationMinutes')::integer,
      coalesce((service_item->>'price')::numeric, 0),
      false,
      service_type,
      case
        when service_type = 'group'
          then (service_item->>'groupCapacity')::integer
        else null
      end,
      service_type = 'group'
        and coalesce((service_item->>'privateBookingEnabled')::boolean, false),
      case
        when service_type = 'group'
          and coalesce((service_item->>'privateBookingEnabled')::boolean, false)
          then coalesce((service_item->>'privatePrice')::numeric, 0)
        else null
      end,
      draft_record.case_id,
      true
    )
    on conflict do nothing
    returning id into service_id;

    if service_id is not null then
      inserted_count := inserted_count + 1;
      if selected_staff_id is not null and service_type = 'appointment' then
        insert into public.staff_services (staff_member_id, service_id)
        values (selected_staff_id, service_id)
        on conflict do nothing;
      end if;
    end if;
    service_id := null;
  end loop;

  if case_record.directory_place_id is not null
    and exists (
      select 1
      from public.directory_places place
      where place.id = case_record.directory_place_id
        and place.listing_status = 'active'
        and place.claim_status = 'unclaimed'
        and place.linked_business_id is null
    )
  then
    select claim_result.claim_id
    into selected_claim_id
    from public.mirebook_submit_business_claim(
      case_record.directory_place_id,
      selected_business.id,
      p_user_id,
      'other',
      'Secure Mirëbook handoff',
      'I connected the prepared Mirëbook profile shared directly with this business and request ownership review.'
    ) claim_result
    limit 1;
  end if;

  update public.business_onboarding_profile_drafts
  set
    adopted_by = p_user_id,
    adopted_business_id = selected_business.id,
    adopted_at = now(),
    handoff_token_hash = null,
    handoff_expires_at = null,
    updated_by = p_user_id,
    updated_at = now()
  where case_id = draft_record.case_id;

  update public.business_onboarding_cases
  set
    business_id = selected_business.id,
    owner_email = clean_email,
    status = 'claimed',
    booking_interest = true,
    business_app_interest = true,
    updated_by = p_user_id,
    updated_at = now()
  where id = draft_record.case_id;

  insert into public.business_onboarding_case_events (
    case_id,
    actor_user_id,
    from_status,
    to_status,
    action,
    snapshot
  ) values (
    draft_record.case_id,
    p_user_id,
    case_record.status,
    'claimed',
    'owner_connected',
    jsonb_build_object(
      'businessId', selected_business.id,
      'claimId', selected_claim_id,
      'importedServices', inserted_count,
      'published', false
    )
  );

  return query
  select
    draft_record.case_id,
    selected_business.id,
    selected_claim_id,
    inserted_count,
    false;
end;
$$;

revoke all on function public.mirebook_save_onboarding_profile_draft(
  uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.mirebook_issue_onboarding_handoff(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.mirebook_adopt_onboarding_profile(
  uuid, text
) from public, anon, authenticated;

grant execute on function public.mirebook_save_onboarding_profile_draft(
  uuid, uuid, jsonb, jsonb
) to service_role;
grant execute on function public.mirebook_issue_onboarding_handoff(
  uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.mirebook_adopt_onboarding_profile(
  uuid, text
) to service_role;

comment on table public.business_onboarding_profile_drafts is
  'Private prepared business/service content and hashed one-time owner handoff state. Never public and never bookable by itself.';

comment on column public.services.owner_review_required is
  'True for inactive assisted-onboarding services until the verified owner reviews and saves the service.';

comment on function public.mirebook_adopt_onboarding_profile(uuid, text) is
  'Connects a prepared profile to a verified Business owner, imports hidden review-required services and optionally submits a pending directory ownership claim. Never publishes.';

commit;
