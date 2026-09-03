-- Stage 12: carry permissioned prepared-profile media into hidden owner drafts.
--
-- Run after SQL 43 and SQL 44. This migration does not publish a business,
-- activate a service or grant media permission. It only imports HTTPS image
-- URLs when the private onboarding case already records profile-media consent.

begin;

do $$
begin
  if to_regclass('public.business_onboarding_profile_drafts') is null
    or to_regclass('public.business_onboarding_cases') is null
    or to_regclass('public.businesses') is null
    or to_regclass('public.services') is null
    or to_regclass('public.business_onboarding_case_events') is null
  then
    raise exception 'SQL 46 requires SQL 38, SQL 43 and SQL 44.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'image_url'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'image_url'
  ) then
    raise exception 'SQL 46 requires business and service image support.';
  end if;
end;
$$;

create or replace function public.mirebook_prepared_media_handoff_version()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1;
$$;

create or replace function public.mirebook_adopt_onboarding_profile_for_email(
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
  adoption_result record;
  service_item jsonb;
  clean_email text;
  profile_image_url text;
  service_image_url text;
  imported_profile_image boolean := false;
  imported_service_images integer := 0;
  updated_rows integer := 0;
begin
  select lower(btrim(coalesce(account.email, '')))
  into clean_email
  from auth.users account
  where account.id = p_user_id
    and account.email_confirmed_at is not null;

  if clean_email is null or clean_email = '' then
    raise exception 'A verified Mirëbook account is required.' using errcode = '42501';
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

  if draft_record.intended_owner_email is null
    or clean_email <> draft_record.intended_owner_email
  then
    raise exception 'Sign in with the verified email address this invitation was sent to.'
      using errcode = '42501';
  end if;

  select onboarding.*
  into case_record
  from public.business_onboarding_cases onboarding
  where onboarding.id = draft_record.case_id;

  if not found then
    raise exception 'The prepared onboarding case was not found.' using errcode = 'P0002';
  end if;

  profile_image_url := btrim(coalesce(draft_record.profile->>'imageUrl', ''));

  if (
    profile_image_url <> ''
    or exists (
      select 1
      from jsonb_array_elements(draft_record.services) item
      where btrim(coalesce(item->>'imageUrl', '')) <> ''
    )
  ) and not coalesce(case_record.profile_media_permission, false) then
    raise exception 'Profile-media permission is required before importing prepared photos.'
      using errcode = '42501';
  end if;

  if profile_image_url <> '' and (
    length(profile_image_url) > 1200
    or profile_image_url !~* '^https://'
  ) then
    raise exception 'The prepared business photo must use a valid HTTPS URL.'
      using errcode = '22023';
  end if;

  for service_item in select value from jsonb_array_elements(draft_record.services)
  loop
    service_image_url := btrim(coalesce(service_item->>'imageUrl', ''));
    if service_image_url <> '' and (
      length(service_image_url) > 1200
      or service_image_url !~* '^https://'
    ) then
      raise exception 'Every prepared service photo must use a valid HTTPS URL.'
        using errcode = '22023';
    end if;
  end loop;

  select adopted.*
  into adoption_result
  from public.mirebook_adopt_onboarding_profile(
    p_user_id,
    p_token_hash
  ) adopted
  limit 1;

  if adoption_result.case_id is null or adoption_result.business_id is null then
    raise exception 'The prepared profile could not be connected.' using errcode = 'P0002';
  end if;

  if coalesce(case_record.profile_media_permission, false) then
    if profile_image_url <> '' then
      update public.businesses
      set image_url = profile_image_url
      where id = adoption_result.business_id
        and published = false;
      imported_profile_image := found;
    end if;

    for service_item in select value from jsonb_array_elements(draft_record.services)
    loop
      service_image_url := btrim(coalesce(service_item->>'imageUrl', ''));
      if service_image_url <> '' then
        update public.services
        set image_url = service_image_url
        where business_id = adoption_result.business_id
          and assisted_onboarding_case_id = draft_record.case_id
          and lower(btrim(name)) = lower(btrim(service_item->>'name'));
        get diagnostics updated_rows = row_count;
        imported_service_images := imported_service_images + updated_rows;
      end if;
    end loop;
  end if;

  if imported_profile_image or imported_service_images > 0 then
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
      'claimed',
      'claimed',
      'prepared_media_imported',
      jsonb_build_object(
        'businessImage', imported_profile_image,
        'serviceImages', imported_service_images,
        'profileMediaPermission', true,
        'marketingMediaPermission', coalesce(case_record.marketing_media_permission, false),
        'published', false
      )
    );
  end if;

  return query
  select
    adoption_result.case_id::uuid,
    adoption_result.business_id::uuid,
    adoption_result.claim_id::uuid,
    adoption_result.imported_services::integer,
    adoption_result.already_adopted::boolean;
end;
$$;

revoke all on function public.mirebook_adopt_onboarding_profile_for_email(
  uuid, text
) from public, anon, authenticated, service_role;

revoke all on function public.mirebook_prepared_media_handoff_version()
from public, anon, authenticated, service_role;

grant execute on function public.mirebook_adopt_onboarding_profile_for_email(
  uuid, text
) to service_role;

grant execute on function public.mirebook_prepared_media_handoff_version()
to service_role;

comment on function public.mirebook_adopt_onboarding_profile_for_email(uuid, text) is
  'Checks the verified owner email, connects a hidden prepared profile and imports only profile-permissioned HTTPS business/service photos.';

commit;
