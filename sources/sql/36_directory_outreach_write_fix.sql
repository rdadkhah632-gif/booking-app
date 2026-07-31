-- Stage 12 Batch 18 follow-up: repair the owner-outreach upsert conflict
-- target used by SQL 35.
--
-- The RPC returns a column named `directory_place_id`, which is also the
-- outreach table primary-key column. PostgreSQL therefore treated the
-- original `on conflict (directory_place_id)` target as ambiguous when the
-- function executed. Naming the primary-key constraint keeps the atomic
-- upsert unchanged while removing that PL/pgSQL variable/column ambiguity.
--
-- This replacement creates no outreach rows, sends no messages, changes no
-- directory or claim state, and does not alter RLS or table privileges.

begin;

do $$
begin
  if to_regclass('public.directory_place_outreach') is null
    or to_regclass('public.directory_place_outreach_events') is null
    or to_regprocedure(
      'public.mirebook_update_directory_outreach(uuid,uuid,text,text,date,text)'
    ) is null
  then
    raise exception
      'SQL 36 requires the owner-outreach pipeline from SQL 35.';
  end if;
end;
$$;

create or replace function public.mirebook_update_directory_outreach(
  p_place_id uuid,
  p_actor_user_id uuid,
  p_status text,
  p_channel text default null,
  p_follow_up_on date default null,
  p_notes text default null
)
returns table (
  directory_place_id uuid,
  status text,
  channel text,
  follow_up_on date,
  notes text,
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  place_record public.directory_places%rowtype;
  previous_record public.directory_place_outreach%rowtype;
  saved_record public.directory_place_outreach%rowtype;
  clean_status text;
  clean_channel text;
  clean_notes text;
  contact_activity boolean;
  previous_exists boolean := false;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_actor_user_id
      and profile.is_admin = true
  ) then
    raise exception 'An admin operator is required.' using errcode = '42501';
  end if;

  clean_status := lower(btrim(p_status));
  clean_channel := nullif(lower(btrim(p_channel)), '');
  clean_notes := nullif(btrim(p_notes), '');

  if clean_status is null or clean_status not in (
    'not_started',
    'planned',
    'contacted',
    'follow_up',
    'interested',
    'declined',
    'unreachable'
  ) then
    raise exception 'Choose a valid outreach status.' using errcode = '22023';
  end if;

  if clean_channel is not null and clean_channel not in (
    'email',
    'phone',
    'social',
    'website',
    'in_person',
    'other'
  ) then
    raise exception 'Choose a valid outreach channel.' using errcode = '22023';
  end if;

  if length(coalesce(clean_notes, '')) > 2000 then
    raise exception 'Keep the private note under 2000 characters.'
      using errcode = '22023';
  end if;

  if clean_status in (
    'contacted',
    'follow_up',
    'interested',
    'declined',
    'unreachable'
  ) and clean_channel is null then
    raise exception 'Choose how the business was contacted.'
      using errcode = '22023';
  end if;

  if clean_status = 'follow_up' and p_follow_up_on is null then
    raise exception 'Choose a follow-up date.' using errcode = '22023';
  end if;

  if p_follow_up_on is not null and p_follow_up_on < current_date then
    raise exception 'Follow-up date cannot be in the past.'
      using errcode = '22023';
  end if;

  if clean_status in ('declined', 'unreachable') and clean_notes is null then
    raise exception 'Add a short private note for this outcome.'
      using errcode = '22023';
  end if;

  select place.*
  into place_record
  from public.directory_places place
  where place.id = p_place_id
  for update;

  if not found
    or place_record.listing_status <> 'active'
    or coalesce(place_record.public_facts_reviewed, false) <> true
  then
    raise exception 'This reviewed place is not available for outreach.'
      using errcode = 'P0002';
  end if;

  if place_record.claim_status <> 'unclaimed'
    or place_record.linked_business_id is not null
  then
    raise exception 'This place already has an ownership record.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.business_claims claim
    where claim.directory_place_id = p_place_id
      and claim.status in ('pending', 'needs_more_info')
  ) then
    raise exception 'This place already has an open ownership claim.'
      using errcode = '23505';
  end if;

  select outreach.*
  into previous_record
  from public.directory_place_outreach outreach
  where outreach.directory_place_id = p_place_id
  for update;

  previous_exists := found;

  if clean_status = 'not_started' then
    clean_channel := null;
    p_follow_up_on := null;
    clean_notes := null;
  end if;

  contact_activity :=
    clean_status in (
      'contacted',
      'follow_up',
      'interested',
      'declined',
      'unreachable'
    )
    and (
      not previous_exists
      or previous_record.status is distinct from clean_status
      or previous_record.channel is distinct from clean_channel
    );

  insert into public.directory_place_outreach (
    directory_place_id,
    status,
    channel,
    follow_up_on,
    notes,
    first_contacted_at,
    last_contacted_at,
    updated_by,
    created_at,
    updated_at
  )
  values (
    p_place_id,
    clean_status,
    clean_channel,
    p_follow_up_on,
    clean_notes,
    case when contact_activity then now() else null end,
    case when contact_activity then now() else null end,
    p_actor_user_id,
    now(),
    now()
  )
  on conflict on constraint directory_place_outreach_pkey do update
  set
    status = excluded.status,
    channel = excluded.channel,
    follow_up_on = excluded.follow_up_on,
    notes = excluded.notes,
    first_contacted_at = case
      when excluded.status = 'not_started' then null
      when public.directory_place_outreach.first_contacted_at is not null
        then public.directory_place_outreach.first_contacted_at
      when contact_activity then now()
      else null
    end,
    last_contacted_at = case
      when excluded.status = 'not_started' then null
      when contact_activity then now()
      else public.directory_place_outreach.last_contacted_at
    end,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into saved_record;

  insert into public.directory_place_outreach_events (
    directory_place_id,
    actor_user_id,
    from_status,
    to_status,
    channel,
    follow_up_on,
    notes
  )
  values (
    p_place_id,
    p_actor_user_id,
    case
      when previous_record.directory_place_id is null then null
      else previous_record.status
    end,
    clean_status,
    clean_channel,
    p_follow_up_on,
    clean_notes
  );

  return query
  select
    saved_record.directory_place_id,
    saved_record.status,
    saved_record.channel,
    saved_record.follow_up_on,
    saved_record.notes,
    saved_record.first_contacted_at,
    saved_record.last_contacted_at,
    saved_record.updated_by,
    saved_record.created_at,
    saved_record.updated_at;
end;
$$;

revoke all on function public.mirebook_update_directory_outreach(
  uuid,
  uuid,
  text,
  text,
  date,
  text
) from public;
revoke all on function public.mirebook_update_directory_outreach(
  uuid,
  uuid,
  text,
  text,
  date,
  text
) from anon;
revoke all on function public.mirebook_update_directory_outreach(
  uuid,
  uuid,
  text,
  text,
  date,
  text
) from authenticated;
grant execute on function public.mirebook_update_directory_outreach(
  uuid,
  uuid,
  text,
  text,
  date,
  text
) to service_role;

comment on function public.mirebook_update_directory_outreach(
  uuid,
  uuid,
  text,
  text,
  date,
  text
) is
  'Admin-only audited update for owner outreach. It does not send messages, claim a place or publish a business.';

commit;
