begin;

-- Legacy appointment overlap indexes must not make separate seat reservations
-- on one scheduled departure mutually exclusive. Preserve every existing
-- start-time uniqueness rule for appointment rows and exclude only bookings
-- that belong to a departure.
do $$
declare
  selected_index record;
  replacement_definition text;
begin
  for selected_index in
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'bookings'
      and indexdef ~* '^create unique index'
      and indexdef ~* '\mstart_at\M'
      and indexdef !~* '\mdeparture_id\M'
  loop
    if position(' WHERE ' in upper(selected_index.indexdef)) > 0 then
      replacement_definition := regexp_replace(
        selected_index.indexdef,
        '\s+WHERE\s+',
        ' WHERE departure_id IS NULL AND (',
        'i'
      ) || ')';
    else
      replacement_definition :=
        selected_index.indexdef || ' WHERE departure_id IS NULL';
    end if;

    execute format('drop index public.%I', selected_index.indexname);
    execute replacement_definition;
  end loop;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'bookings'
      and indexdef ~* '^create unique index'
      and indexdef ~* '\mstart_at\M'
      and indexdef !~* '\mdeparture_id\M'
  ) then
    raise exception 'capacity_booking_overlap_compatibility_incomplete';
  end if;
end;
$$;

commit;
