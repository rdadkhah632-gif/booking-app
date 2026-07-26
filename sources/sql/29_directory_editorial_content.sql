-- Stage 12 Batch 13: operator-curated descriptions and imagery for reviewed
-- directory places.
--
-- Imported source content remains untouched. These fields are edited only
-- through the authenticated admin API and become public only while the parent
-- directory place is active. Existing RLS and service-role boundaries remain
-- unchanged.

begin;

do $$
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 29 requires the directory foundation from SQL 19.';
  end if;
end;
$$;

alter table public.directory_places
  add column if not exists editorial_description_en text,
  add column if not exists editorial_description_sq text,
  add column if not exists image_url text,
  add column if not exists image_alt_en text,
  add column if not exists image_alt_sq text,
  add column if not exists image_attribution_label text,
  add column if not exists image_attribution_url text,
  add column if not exists image_rights_note text,
  add column if not exists content_updated_by uuid
    references auth.users(id) on delete set null,
  add column if not exists content_updated_at timestamptz;

alter table public.directory_places
  drop constraint if exists directory_places_editorial_description_en_length,
  drop constraint if exists directory_places_editorial_description_sq_length,
  drop constraint if exists directory_places_image_url_https,
  drop constraint if exists directory_places_image_alt_en_length,
  drop constraint if exists directory_places_image_alt_sq_length,
  drop constraint if exists directory_places_image_attribution_label_length,
  drop constraint if exists directory_places_image_attribution_url_https,
  drop constraint if exists directory_places_image_rights_note_length,
  drop constraint if exists directory_places_image_metadata_complete;

alter table public.directory_places
  add constraint directory_places_editorial_description_en_length
    check (
      editorial_description_en is null
      or char_length(editorial_description_en) <= 600
    ),
  add constraint directory_places_editorial_description_sq_length
    check (
      editorial_description_sq is null
      or char_length(editorial_description_sq) <= 600
    ),
  add constraint directory_places_image_url_https
    check (
      image_url is null
      or (
        char_length(image_url) <= 1200
        and image_url ~* '^https://'
      )
    ),
  add constraint directory_places_image_alt_en_length
    check (
      image_alt_en is null
      or char_length(image_alt_en) <= 180
    ),
  add constraint directory_places_image_alt_sq_length
    check (
      image_alt_sq is null
      or char_length(image_alt_sq) <= 180
    ),
  add constraint directory_places_image_attribution_label_length
    check (
      image_attribution_label is null
      or char_length(image_attribution_label) <= 180
    ),
  add constraint directory_places_image_attribution_url_https
    check (
      image_attribution_url is null
      or (
        char_length(image_attribution_url) <= 1200
        and image_attribution_url ~* '^https://'
      )
    ),
  add constraint directory_places_image_rights_note_length
    check (
      image_rights_note is null
      or char_length(image_rights_note) <= 500
    ),
  add constraint directory_places_image_metadata_complete
    check (
      (
        image_url is null
        and image_alt_en is null
        and image_alt_sq is null
        and image_attribution_label is null
        and image_attribution_url is null
        and image_rights_note is null
      )
      or (
        image_url is not null
        and coalesce(
          nullif(btrim(image_alt_en), ''),
          nullif(btrim(image_alt_sq), '')
        ) is not null
        and nullif(btrim(image_attribution_label), '') is not null
        and nullif(btrim(image_rights_note), '') is not null
      )
    );

comment on column public.directory_places.editorial_description_en is
  'Operator-reviewed English description; source description remains unchanged.';
comment on column public.directory_places.editorial_description_sq is
  'Operator-reviewed Albanian description; source description remains unchanged.';
comment on column public.directory_places.image_url is
  'HTTPS URL for an operator-reviewed public place image.';
comment on column public.directory_places.image_attribution_label is
  'Public credit or source label shown with the reviewed image.';
comment on column public.directory_places.image_rights_note is
  'Private operator note recording permission, licence or ownership basis.';
comment on column public.directory_places.content_updated_by is
  'Admin user who last changed editorial directory content.';

commit;
