-- Stage 12 Batch 6 / SQL 26: exact launch coverage for the private admin directory.
--
-- Run manually after SQL 19 and SQL 20. This function is read-only, executable
-- only by service_role and cannot import, review, publish, claim or edit places.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 26 requires SQL 19 directory tables.';
  end if;
end;
$$;

create or replace function public.mirebook_admin_directory_launch_coverage()
returns table (
  city text,
  category_key text,
  listing_status text,
  place_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(nullif(btrim(place.city), ''), 'Unknown') as city,
    place.category_key,
    place.listing_status,
    count(*) as place_count
  from public.directory_places place
  group by
    coalesce(nullif(btrim(place.city), ''), 'Unknown'),
    place.category_key,
    place.listing_status
  order by city, category_key, listing_status;
$$;

revoke all on function public.mirebook_admin_directory_launch_coverage()
  from public;
revoke all on function public.mirebook_admin_directory_launch_coverage()
  from anon;
revoke all on function public.mirebook_admin_directory_launch_coverage()
  from authenticated;
grant execute on function public.mirebook_admin_directory_launch_coverage()
  to service_role;

comment on function public.mirebook_admin_directory_launch_coverage() is
  'Service-only read aggregate for the admin launch coverage view. It performs no directory mutation.';

commit;
