-- Stage 12: bind prepared owner handoffs to one verified email address.
--
-- Run after SQL 43. Existing prepared links remain private but cannot be
-- adopted through the email-bound API until an operator issues a new link.

begin;

do $$
begin
  if to_regclass('public.business_onboarding_profile_drafts') is null
    or to_regclass('public.business_onboarding_cases') is null
  then
    raise exception 'SQL 44 requires SQL 43 prepared owner handoffs.';
  end if;
end;
$$;

alter table public.business_onboarding_profile_drafts
  add column if not exists intended_owner_email text,
  add column if not exists owner_email_bound_by uuid
    references auth.users(id) on delete set null,
  add column if not exists owner_email_bound_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_profile_drafts_owner_email_shape'
      and conrelid = 'public.business_onboarding_profile_drafts'::regclass
  ) then
    alter table public.business_onboarding_profile_drafts
      add constraint onboarding_profile_drafts_owner_email_shape
      check (
        (
          intended_owner_email is null
          and owner_email_bound_by is null
          and owner_email_bound_at is null
        )
        or
        (
          intended_owner_email is not null
          and owner_email_bound_by is not null
          and owner_email_bound_at is not null
          and intended_owner_email = lower(btrim(intended_owner_email))
          and length(intended_owner_email) between 5 and 320
          and intended_owner_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        )
      );
  end if;
end;
$$;

create or replace function public.mirebook_bind_onboarding_owner_email(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_owner_email text
)
returns setof public.business_onboarding_profile_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_record public.business_onboarding_profile_drafts%rowtype;
  clean_email text;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_actor_user_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin operator is required.' using errcode = '42501';
  end if;

  clean_email := lower(btrim(coalesce(p_owner_email, '')));
  if length(clean_email) not between 5 and 320
    or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Add a valid owner email before creating the secure link.'
      using errcode = '22023';
  end if;

  update public.business_onboarding_profile_drafts
  set
    intended_owner_email = clean_email,
    owner_email_bound_by = p_actor_user_id,
    owner_email_bound_at = now(),
    updated_by = p_actor_user_id,
    updated_at = now()
  where case_id = p_case_id
    and adopted_at is null
  returning * into saved_record;

  if not found then
    raise exception 'Save an unclaimed prepared profile before binding its owner email.'
      using errcode = 'P0002';
  end if;

  update public.business_onboarding_cases
  set
    owner_email = clean_email,
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
    'owner_email_bound',
    jsonb_build_object('emailBound', true)
  from public.business_onboarding_cases onboarding
  where onboarding.id = p_case_id;

  return next saved_record;
end;
$$;

create or replace function public.mirebook_issue_email_bound_onboarding_handoff(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_owner_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns setof public.business_onboarding_profile_drafts
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform *
  from public.mirebook_bind_onboarding_owner_email(
    p_actor_user_id,
    p_case_id,
    p_owner_email
  );

  return query
  select issued.*
  from public.mirebook_issue_onboarding_handoff(
    p_actor_user_id,
    p_case_id,
    p_token_hash,
    p_expires_at
  ) issued;
end;
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
  clean_email text;
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

  return query
  select adopted.*
  from public.mirebook_adopt_onboarding_profile(
    p_user_id,
    p_token_hash
  ) adopted;
end;
$$;

revoke all on function public.mirebook_bind_onboarding_owner_email(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.mirebook_issue_email_bound_onboarding_handoff(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.mirebook_adopt_onboarding_profile_for_email(
  uuid, text
) from public, anon, authenticated, service_role;

-- Force every new API path through the email-bound wrappers.
revoke execute on function public.mirebook_issue_onboarding_handoff(
  uuid, uuid, text, timestamptz
) from service_role;
revoke execute on function public.mirebook_adopt_onboarding_profile(
  uuid, text
) from service_role;

grant execute on function public.mirebook_issue_email_bound_onboarding_handoff(
  uuid, uuid, text, text, timestamptz
) to service_role;
grant execute on function public.mirebook_adopt_onboarding_profile_for_email(
  uuid, text
) to service_role;

comment on column public.business_onboarding_profile_drafts.intended_owner_email is
  'Private normalized email that must exactly match the verified Business account adopting this prepared profile.';

comment on function public.mirebook_issue_email_bound_onboarding_handoff(
  uuid, uuid, text, text, timestamptz
) is
  'Atomically binds a prepared profile to one owner email and issues a new hashed one-time handoff token.';

comment on function public.mirebook_adopt_onboarding_profile_for_email(uuid, text) is
  'Checks the verified account email against the private handoff binding before importing a hidden prepared profile.';

commit;
