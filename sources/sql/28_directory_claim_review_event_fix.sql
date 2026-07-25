-- Stage 12 Batch 11 follow-up: align ownership review actions with the
-- immutable event types accepted by business_claim_events.
--
-- SQL 24 correctly stores claim statuses as `approved` and `rejected`, but its
-- review event insert used the action verbs `approve` and `reject`. Those
-- values violate the event audit constraint and roll the whole review
-- transaction back. This replacement is idempotent and changes no schema,
-- policy, role boundary, claim eligibility or publication behavior.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null
    or to_regclass('public.business_claims') is null
    or to_regclass('public.business_claim_events') is null
  then
    raise exception
      'SQL 28 requires the directory claim workflow from SQL 24.';
  end if;
end;
$$;

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
      when 'approve' then 'approved'
      when 'request_more_info' then 'needs_more_info'
      when 'reject' then 'rejected'
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

comment on function public.mirebook_review_business_claim(
  uuid,
  text,
  uuid,
  text
) is
  'Admin-only audited ownership review. Review actions are normalized to the approved business_claim_events vocabulary.';

commit;
