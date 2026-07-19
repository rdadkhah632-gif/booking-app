-- Stage 12 Batch 4: audited directory ownership claim workflow.
--
-- Run manually after SQL 19 and SQL 20. This file adds an immutable claim
-- event trail plus service-only submit/review functions. It does not approve
-- existing claims, publish businesses or change booking readiness.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null
    or to_regclass('public.business_claims') is null
  then
    raise exception 'SQL 24 requires SQL 19 directory and claim tables.';
  end if;
end;
$$;

create table if not exists public.business_claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null
    references public.business_claims(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text not null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    event_type in (
      'submitted',
      'resubmitted',
      'approved',
      'needs_more_info',
      'rejected',
      'competing_claim_rejected'
    )
  ),
  check (
    from_status is null
    or from_status in (
      'pending',
      'needs_more_info',
      'approved',
      'rejected',
      'withdrawn'
    )
  ),
  check (
    to_status in (
      'pending',
      'needs_more_info',
      'approved',
      'rejected',
      'withdrawn'
    )
  )
);

create index if not exists business_claim_events_claim_created_idx
  on public.business_claim_events (claim_id, created_at desc);

alter table public.business_claim_events enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_claim_events'
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

revoke all on table public.business_claim_events from public;
revoke all on table public.business_claim_events from anon;
revoke all on table public.business_claim_events from authenticated;
revoke all on table public.business_claim_events from service_role;
grant select, insert on table public.business_claim_events to service_role;

create or replace function public.mirebook_submit_business_claim(
  p_place_id uuid,
  p_business_id uuid,
  p_claimant_user_id uuid,
  p_evidence_type text,
  p_evidence_value_masked text default null,
  p_claimant_message text default null
)
returns table (
  claim_id uuid,
  claim_status text,
  was_resubmitted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  place_record public.directory_places%rowtype;
  claim_record public.business_claims%rowtype;
  clean_evidence_type text;
  clean_evidence_value text;
  clean_message text;
begin
  clean_evidence_type := lower(btrim(p_evidence_type));
  clean_evidence_value := nullif(btrim(p_evidence_value_masked), '');
  clean_message := nullif(btrim(p_claimant_message), '');

  if clean_evidence_type is null or clean_evidence_type not in (
    'domain_email',
    'business_phone',
    'business_document',
    'other'
  ) then
    raise exception 'Choose a valid ownership evidence type.'
      using errcode = '22023';
  end if;

  if clean_message is null or length(clean_message) < 20 then
    raise exception 'Add a short explanation of how you are connected to this business.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.businesses business
    where business.id = p_business_id
      and business.user_id = p_claimant_user_id
  ) then
    raise exception 'You can only claim a place for a business you own.'
      using errcode = '42501';
  end if;

  select place.*
  into place_record
  from public.directory_places place
  where place.id = p_place_id
  for update;

  if not found or place_record.listing_status <> 'active' then
    raise exception 'This directory place is not available for claiming.'
      using errcode = 'P0002';
  end if;

  if place_record.claim_status <> 'unclaimed'
    or place_record.linked_business_id is not null
  then
    raise exception 'This directory place has already been claimed.'
      using errcode = '23505';
  end if;

  select claim.*
  into claim_record
  from public.business_claims claim
  where claim.directory_place_id = p_place_id
    and claim.business_id = p_business_id
    and claim.claimant_user_id = p_claimant_user_id
    and claim.status in ('pending', 'needs_more_info')
  order by claim.created_at desc
  limit 1
  for update;

  if found then
    if claim_record.status = 'pending' then
      return query
      select claim_record.id, claim_record.status, false;
      return;
    end if;

    update public.business_claims claim
    set
      status = 'pending',
      evidence_type = clean_evidence_type,
      evidence_value_masked = clean_evidence_value,
      claimant_message = clean_message,
      reviewed_by = null,
      reviewed_at = null,
      review_notes = null
    where claim.id = claim_record.id;

    insert into public.business_claim_events (
      claim_id,
      actor_user_id,
      event_type,
      from_status,
      to_status
    )
    values (
      claim_record.id,
      p_claimant_user_id,
      'resubmitted',
      claim_record.status,
      'pending'
    );

    return query
    select claim_record.id, 'pending'::text, true;
    return;
  end if;

  insert into public.business_claims (
    directory_place_id,
    business_id,
    claimant_user_id,
    status,
    evidence_type,
    evidence_value_masked,
    claimant_message
  )
  values (
    p_place_id,
    p_business_id,
    p_claimant_user_id,
    'pending',
    clean_evidence_type,
    clean_evidence_value,
    clean_message
  )
  returning * into claim_record;

  insert into public.business_claim_events (
    claim_id,
    actor_user_id,
    event_type,
    from_status,
    to_status
  )
  values (
    claim_record.id,
    p_claimant_user_id,
    'submitted',
    null,
    'pending'
  );

  return query
  select claim_record.id, claim_record.status, false;
end;
$$;

revoke all on function public.mirebook_submit_business_claim(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) from public;
revoke all on function public.mirebook_submit_business_claim(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) from anon;
revoke all on function public.mirebook_submit_business_claim(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) from authenticated;
grant execute on function public.mirebook_submit_business_claim(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

create or replace function public.mirebook_review_business_claim(
  p_claim_id uuid,
  p_action text,
  p_reviewer_id uuid,
  p_notes text default null
)
returns table (
  claim_id uuid,
  claim_status text,
  directory_place_id uuid,
  business_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_record public.business_claims%rowtype;
  clean_action text;
  clean_notes text;
  next_status text;
  competing_claim record;
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
    when 'approve' then 'approved'
    when 'request_more_info' then 'needs_more_info'
    when 'reject' then 'rejected'
    else null
  end;

  if clean_action is null or next_status is null then
    raise exception 'Business claim review action is invalid.'
      using errcode = '22023';
  end if;

  if clean_action in ('request_more_info', 'reject') and clean_notes is null then
    raise exception 'Add a review note for this decision.'
      using errcode = '22023';
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
    raise exception 'Only an open business claim can be reviewed.'
      using errcode = '22023';
  end if;

  if clean_action = 'approve' then
    if not exists (
      select 1
      from public.businesses business
      where business.id = claim_record.business_id
        and business.user_id = claim_record.claimant_user_id
    ) then
      raise exception 'The claimant no longer owns the selected business.'
        using errcode = '42501';
    end if;

    update public.directory_places place
    set
      linked_business_id = claim_record.business_id,
      claim_status = 'claimed'
    where place.id = claim_record.directory_place_id
      and place.listing_status = 'active'
      and place.claim_status = 'unclaimed'
      and place.linked_business_id is null;

    if not found then
      raise exception 'This directory place is no longer available to claim.'
        using errcode = '23505';
    end if;
  end if;

  update public.business_claims claim
  set
    status = next_status,
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = clean_notes
  where claim.id = claim_record.id;

  insert into public.business_claim_events (
    claim_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    notes
  )
  values (
    claim_record.id,
    p_reviewer_id,
    case clean_action
      when 'request_more_info' then 'needs_more_info'
      else clean_action
    end,
    claim_record.status,
    next_status,
    clean_notes
  );

  if clean_action = 'approve' then
    for competing_claim in
      select claim.id, claim.status
      from public.business_claims claim
      where claim.directory_place_id = claim_record.directory_place_id
        and claim.id <> claim_record.id
        and claim.status in ('pending', 'needs_more_info')
      for update
    loop
      update public.business_claims claim
      set
        status = 'rejected',
        reviewed_by = p_reviewer_id,
        reviewed_at = now(),
        review_notes = 'Another ownership claim for this place was approved.'
      where claim.id = competing_claim.id;

      insert into public.business_claim_events (
        claim_id,
        actor_user_id,
        event_type,
        from_status,
        to_status,
        notes
      )
      values (
        competing_claim.id,
        p_reviewer_id,
        'competing_claim_rejected',
        competing_claim.status,
        'rejected',
        'Another ownership claim for this place was approved.'
      );
    end loop;
  end if;

  return query
  select
    claim_record.id,
    next_status,
    claim_record.directory_place_id,
    claim_record.business_id;
end;
$$;

revoke all on function public.mirebook_review_business_claim(
  uuid,
  text,
  uuid,
  text
) from public;
revoke all on function public.mirebook_review_business_claim(
  uuid,
  text,
  uuid,
  text
) from anon;
revoke all on function public.mirebook_review_business_claim(
  uuid,
  text,
  uuid,
  text
) from authenticated;
grant execute on function public.mirebook_review_business_claim(
  uuid,
  text,
  uuid,
  text
) to service_role;

-- Keep the SQL 19 approval entry point compatible while routing every future
-- approval through the audited Batch 4 review function.
create or replace function public.mirebook_approve_business_claim(
  p_claim_id uuid,
  p_reviewer_id uuid
)
returns table (
  claim_id uuid,
  directory_place_id uuid,
  business_id uuid
)
language sql
security definer
set search_path = ''
as $$
  select
    reviewed.claim_id,
    reviewed.directory_place_id,
    reviewed.business_id
  from public.mirebook_review_business_claim(
    p_claim_id,
    'approve',
    p_reviewer_id,
    null
  ) reviewed;
$$;

revoke all on function public.mirebook_approve_business_claim(uuid, uuid)
  from public;
revoke all on function public.mirebook_approve_business_claim(uuid, uuid)
  from anon;
revoke all on function public.mirebook_approve_business_claim(uuid, uuid)
  from authenticated;
grant execute on function public.mirebook_approve_business_claim(uuid, uuid)
  to service_role;

comment on table public.business_claim_events is
  'Private append-only audit trail for directory ownership claim decisions.';

comment on function public.mirebook_submit_business_claim(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) is
  'Service-only claim submission. It verifies exact Mirëbook business ownership and never approves automatically.';

comment on function public.mirebook_review_business_claim(
  uuid,
  text,
  uuid,
  text
) is
  'Service-only admin review. Approval links the directory record but does not publish or alter booking readiness.';

commit;
