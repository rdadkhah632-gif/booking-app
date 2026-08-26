begin;

-- Legacy appointment exclusion constraints must not treat separate seat
-- reservations on one scheduled departure as overlapping appointments.
-- Preserve each existing exclusion rule exactly and scope it to ordinary
-- appointment rows only.
do $$
declare
  selected_constraint record;
  definition_parts text[];
  replacement_definition text;
begin
  for selected_constraint in
    select
      constraints.conname,
      pg_get_constraintdef(constraints.oid, true) as constraint_definition
    from pg_constraint as constraints
    where constraints.conrelid = 'public.bookings'::regclass
      and constraints.contype = 'x'
      and pg_get_constraintdef(constraints.oid, true) ~* '\mstart_at\M'
      and pg_get_constraintdef(constraints.oid, true) !~* '\mdeparture_id\M'
  loop
    definition_parts := regexp_match(
      selected_constraint.constraint_definition,
      '^(.*)[[:space:]]+WHERE[[:space:]]+\((.*)\)([[:space:]]+DEFERRABLE.*)?$',
      'i'
    );

    if definition_parts is not null then
      replacement_definition :=
        definition_parts[1]
        || ' WHERE (departure_id IS NULL AND ('
        || definition_parts[2]
        || '))'
        || coalesce(definition_parts[3], '');
    else
      definition_parts := regexp_match(
        selected_constraint.constraint_definition,
        '^(.*)([[:space:]]+DEFERRABLE.*)$',
        'i'
      );

      if definition_parts is not null then
        replacement_definition :=
          definition_parts[1]
          || ' WHERE (departure_id IS NULL)'
          || definition_parts[2];
      else
        replacement_definition :=
          selected_constraint.constraint_definition
          || ' WHERE (departure_id IS NULL)';
      end if;
    end if;

    execute format(
      'alter table public.bookings drop constraint %I',
      selected_constraint.conname
    );
    execute format(
      'alter table public.bookings add constraint %I %s',
      selected_constraint.conname,
      replacement_definition
    );
  end loop;

  if exists (
    select 1
    from pg_constraint as constraints
    where constraints.conrelid = 'public.bookings'::regclass
      and constraints.contype = 'x'
      and pg_get_constraintdef(constraints.oid, true) ~* '\mstart_at\M'
      and pg_get_constraintdef(constraints.oid, true) !~* '\mdeparture_id\M'
  ) then
    raise exception 'capacity_booking_exclusion_compatibility_incomplete';
  end if;
end;
$$;

commit;
