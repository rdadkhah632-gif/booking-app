-- Stage 12 Batch 17: legacy public catalogue quality pass.
--
-- This enriches the eight original approved directory places that predate the
-- reviewed-facts and editorial-content workflow. Facts were checked against
-- current first-party sources on 27 July 2026. Only Bunk'Art 2 and Experience
-- Gjirokastra receive images because reusable rights were verified explicitly.
--
-- Safety:
-- - every target must still be an active public directory place
-- - imported source fields remain unchanged
-- - listing_status and claim_status remain unchanged
-- - ownership, business publication and booking behavior remain unchanged
-- - private evidence and image-rights notes remain private
-- - no owner consent, Mirëbook membership or endorsement is implied

begin;

do $$
declare
  expected_ids uuid[] := array[
    '599e1d5f-8ecb-4319-ba8d-60971681487c'::uuid,
    'b1f56c31-6c2d-4a1e-9de9-526c0d08884f'::uuid,
    'a3d6d6bd-0699-4f93-9be5-a837fbe184fa'::uuid,
    'ebf64910-1ce1-4bb4-98eb-ac0a763a6307'::uuid,
    '215e05b6-58ee-47bd-a9e8-96ce99226efa'::uuid,
    '2f8ec7e2-86da-4e70-a8fe-70a4a8aeda93'::uuid,
    'c34cd003-55da-47f1-974a-b85e49d2a838'::uuid,
    'f081e07c-094a-4716-b1e7-9c77d107f695'::uuid
  ];
  matched_count integer;
  active_count integer;
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 34 requires the directory foundation from SQL 19.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directory_places'
      and column_name = 'public_facts_reviewed'
  ) then
    raise exception 'SQL 34 requires reviewed public facts from SQL 30.';
  end if;

  select
    count(*),
    count(*) filter (where listing_status = 'active')
  into matched_count, active_count
  from public.directory_places
  where id = any(expected_ids);

  if matched_count <> cardinality(expected_ids) then
    raise exception
      'SQL 34 expected % legacy records but found %.',
      cardinality(expected_ids),
      matched_count;
  end if;

  if active_count <> cardinality(expected_ids) then
    raise exception
      'SQL 34 stopped because only % of % legacy records are active.',
      active_count,
      cardinality(expected_ids);
  end if;
end;
$$;

with catalogue (
  id,
  public_name,
  public_category_key,
  public_address,
  public_postcode,
  public_phone,
  public_website,
  public_facts_source_url,
  public_facts_note,
  editorial_description_en,
  editorial_description_sq,
  image_url,
  image_alt_en,
  image_alt_sq,
  image_attribution_label,
  image_attribution_url,
  image_rights_note
) as (
  values
    (
      '599e1d5f-8ecb-4319-ba8d-60971681487c'::uuid,
      'Bunk''Art 2',
      'attractions',
      'Rruga Abdi Toptani, përballë Bashkisë',
      '1001',
      '+355 67 207 2905',
      'https://www.bunkart.al/',
      'https://bunkart.al/2/slider/a-small-introduction-about-our-museumbunkart-2',
      'Reviewed 27 July 2026 against the current official Bunk''Art website. Confirmed the central Tirana identity, Abdi Toptani location, reservation telephone number and museum focus on the Interior Ministry, communist-era state security and political persecution.',
      'Museum in central Tirana inside a former Interior Ministry nuclear shelter, presenting the history of Albania''s communist-era police, state security and political persecution. Check the official site for current visiting information.',
      'Muze në qendër të Tiranës, brenda një ish-strehimi bërthamor të Ministrisë së Brendshme, që paraqet historinë e policisë, Sigurimit të Shtetit dhe përndjekjes politike gjatë diktaturës komuniste. Shikoni faqen zyrtare për informacionin aktual të vizitës.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bunk%27Art_2%2C_Tirana%2C_Albania_%2849601710003%29.jpg',
      'The exterior bunker entrance of Bunk''Art 2 in central Tirana',
      'Hyrja e jashtme e bunkerit Bunk''Art 2 në qendër të Tiranës',
      'Andrew Milligan sumo · CC BY 2.0',
      'https://commons.wikimedia.org/wiki/File:Bunk%27Art_2%2C_Tirana%2C_Albania_%2849601710003%29.jpg',
      'Wikimedia Commons photograph of the Bunk''Art 2 exterior by Andrew Milligan sumo, licensed CC BY 2.0. The file page records Flickr licence review; attribution and licence must remain visible.'
    ),
    (
      'b1f56c31-6c2d-4a1e-9de9-526c0d08884f'::uuid,
      'Geraldina Sposa',
      'events',
      'Pallatet Shallvare, shkalla 6, apartamentet 74-75, Rruga Ibrahim Rugova',
      '1001',
      '+355 68 603 0733',
      'https://geraldinasposa.com/',
      'https://geraldinasposa.com/rreth-nesh/',
      'Reviewed 27 July 2026 against the current official about and contact pages. Confirmed the Tirana studio identity, Ibrahim Rugova address, primary telephone number, bridal and evening collections, celebration decor and event services.',
      'Bridal and event studio in central Tirana offering wedding and evening dresses, bridal styling, wedding and birthday decor, and event planning. Contact the studio directly for consultations.',
      'Studio nusërie dhe eventesh në qendër të Tiranës që ofron fustane nusërie dhe mbrëmjeje, stilim për nuse, dekor dasmash e ditëlindjesh dhe organizim eventesh. Kontaktoni studion drejtpërdrejt për konsultime.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'a3d6d6bd-0699-4f93-9be5-a837fbe184fa'::uuid,
      'Çimi Stil Unik',
      'beauty_grooming',
      'Rruga Kalasë',
      null,
      '+355 69 225 9880',
      'https://cimi.al/',
      'https://cimi.al/cimi-stil-unik1/',
      'Reviewed 27 July 2026 against the current official service and contact page. Confirmed the Durrës identity, Rruga Kalasë location, telephone number and current haircut, styling, beard-care, colouring and face-treatment offer.',
      'Barber and grooming studio in Durrës offering adult and children''s haircuts, washing and styling, beard care, colouring and face treatments. Contact the studio for current availability.',
      'Studio berberie dhe kujdesi në Durrës që ofron prerje flokësh për të rritur dhe fëmijë, larje e stilim, kujdes për mjekrën, ngjyrosje dhe trajtime fytyre. Kontaktoni studion për oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'ebf64910-1ce1-4bb4-98eb-ac0a763a6307'::uuid,
      'City Dental Clinic',
      'dental_health',
      'Rruga Siri Kodra, ndërtesa nr. 13, hyrja nr. 1',
      null,
      '+355 68 510 7070',
      'https://cdc.com.al/',
      'https://cdc.com.al/en/the-clinic/',
      'Reviewed 27 July 2026 against the current official clinic page. Confirmed the Tirana identity, Siri Kodra address, primary telephone number and services spanning general dentistry, dental aesthetics, oral and maxillofacial surgery, implantology and orthodontics.',
      'Dental clinic near central Tirana offering general dentistry, dental aesthetics, oral and maxillofacial surgery, implantology and orthodontics. Contact the clinic directly for consultations.',
      'Klinikë dentare pranë qendrës së Tiranës që ofron stomatologji të përgjithshme, estetikë dentare, kirurgji orale dhe maksilofaciale, implantologji dhe ortodonci. Kontaktoni klinikën drejtpërdrejt për konsultime.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '215e05b6-58ee-47bd-a9e8-96ce99226efa'::uuid,
      'Helen Doron English Vlorë',
      'learning_lessons',
      'Lagjja Pavarësia, Rruga Hasan Kushta, ish Albano & Romina, kati 2',
      null,
      '+355 69 651 3532',
      'https://www.helendoron.al/helen-doron-vlore/',
      'https://www.helendoron.al/helen-doron-vlore/',
      'Reviewed 27 July 2026 against the current official Vlorë centre page. Confirmed the centre identity, Pavarësia and Hasan Kushta address, telephone number, age-based English programmes, small-group approach and positive-reinforcement method.',
      'English learning centre in Vlorë for children and teenagers, using age-based programmes, small groups and positive reinforcement. Contact the centre for current enrolment and schedules.',
      'Qendër e mësimit të anglishtes në Vlorë për fëmijë dhe adoleshentë, me programe sipas moshës, grupe të vogla dhe përforcim pozitiv. Kontaktoni qendrën për regjistrimet dhe oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '2f8ec7e2-86da-4e70-a8fe-70a4a8aeda93'::uuid,
      'Balikçi Dental',
      'dental_health',
      'Rruga Sadik Zotaj, Kompleksi Conad, kati 3',
      '9401',
      '+355 69 207 4123',
      'https://balikcidental.com/',
      'https://balikcidental.com/services/',
      'Reviewed 27 July 2026 against the current official clinic and services pages. Confirmed the Vlorë identity, Sadik Zotaj address, telephone number and preventive, cosmetic, restorative, implant, orthodontic, prosthetic and maxillofacial dental services.',
      'Dental clinic in Vlorë offering preventive, cosmetic and restorative dentistry, implants, orthodontics, prosthetics and maxillofacial surgery. Contact the clinic directly for a consultation.',
      'Klinikë dentare në Vlorë që ofron stomatologji parandaluese, estetike dhe restauruese, implante, ortodonci, protetikë dhe kirurgji maksilofaciale. Kontaktoni klinikën drejtpërdrejt për një konsultim.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'c34cd003-55da-47f1-974a-b85e49d2a838'::uuid,
      'Kopliku Travel',
      'tours_activities',
      'Pranë Teatrit Migjeni, pallati i ri i Fushajve',
      null,
      '+355 68 203 1124',
      'https://www.koplikutravel.com/en',
      'https://www.koplikutravel.com/en/pages/history',
      'Reviewed 27 July 2026 against the current official agency history and contact page. Confirmed the Shkodër identity, location near Migjeni Theatre, telephone contacts and services covering excursions, domestic and international transport, road tickets and hotel reservations.',
      'Travel and transport agency in Shkodër offering guided excursions, domestic and international transport, road tickets and hotel-reservation support. Contact the agency for current itineraries and departures.',
      'Agjenci udhëtimi dhe transporti në Shkodër që ofron ekskursione të udhëhequra, transport brenda dhe jashtë vendit, bileta rrugore dhe ndihmë për rezervime hotelesh. Kontaktoni agjencinë për itineraret dhe nisjet aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'f081e07c-094a-4716-b1e7-9c77d107f695'::uuid,
      'Experience Gjirokastra',
      'tours_activities',
      'Sheshi Çerçiz Topulli 5',
      null,
      '+355 69 225 1589',
      'https://experiencegjirokastra.com/',
      'https://experiencegjirokastra.com/page-list-tours/',
      'Reviewed 27 July 2026 against the current official agency and tour pages. Confirmed the Gjirokastër identity, Çerçiz Topulli meeting point, telephone number and current walking-tour, craft, cooking, rafting and day-trip activities.',
      'Local Gjirokastër activity agency offering walking tours, craft and cooking experiences, rafting and day trips around southern Albania. Check the official site for current activities and availability.',
      'Agjenci lokale aktivitetesh në Gjirokastër që ofron ture në këmbë, përvoja artizanale dhe gatimi, rafting dhe udhëtime ditore në Shqipërinë e jugut. Shikoni faqen zyrtare për aktivitetet dhe oraret aktuale.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Rruga_Gjin_Zenebisi_-_Gjirokast%C3%ABr_old_town.jpg',
      'Rruga Gjin Zenebisi in Gjirokastër old town beneath the castle',
      'Rruga Gjin Zenebisi në qytetin e vjetër të Gjirokastrës, poshtë kalasë',
      'Radosław Botev · CC BY 3.0 PL',
      'https://commons.wikimedia.org/wiki/File:Rruga_Gjin_Zenebisi_-_Gjirokast%C3%ABr_old_town.jpg',
      'Wikimedia Commons destination photograph by Radosław Botev, licensed CC BY 3.0 Poland. It depicts Rruga Gjin Zenebisi and the old town, not the agency premises; attribution and licence must remain visible.'
    )
)
update public.directory_places as place
set
  public_facts_reviewed = true,
  public_name = catalogue.public_name,
  public_category_key = catalogue.public_category_key,
  public_address = catalogue.public_address,
  public_postcode = catalogue.public_postcode,
  public_phone = catalogue.public_phone,
  public_website = catalogue.public_website,
  public_facts_source_url = catalogue.public_facts_source_url,
  public_facts_note = catalogue.public_facts_note,
  public_facts_updated_by = null,
  public_facts_updated_at = now(),
  editorial_description_en = catalogue.editorial_description_en,
  editorial_description_sq = catalogue.editorial_description_sq,
  image_url = catalogue.image_url,
  image_alt_en = catalogue.image_alt_en,
  image_alt_sq = catalogue.image_alt_sq,
  image_attribution_label = catalogue.image_attribution_label,
  image_attribution_url = catalogue.image_attribution_url,
  image_rights_note = catalogue.image_rights_note,
  content_updated_by = null,
  content_updated_at = now()
from catalogue
where place.id = catalogue.id;

do $$
declare
  expected_ids uuid[] := array[
    '599e1d5f-8ecb-4319-ba8d-60971681487c'::uuid,
    'b1f56c31-6c2d-4a1e-9de9-526c0d08884f'::uuid,
    'a3d6d6bd-0699-4f93-9be5-a837fbe184fa'::uuid,
    'ebf64910-1ce1-4bb4-98eb-ac0a763a6307'::uuid,
    '215e05b6-58ee-47bd-a9e8-96ce99226efa'::uuid,
    '2f8ec7e2-86da-4e70-a8fe-70a4a8aeda93'::uuid,
    'c34cd003-55da-47f1-974a-b85e49d2a838'::uuid,
    'f081e07c-094a-4716-b1e7-9c77d107f695'::uuid
  ];
  curated_count integer;
  active_count integer;
  image_count integer;
begin
  select
    count(*) filter (
      where public_facts_reviewed = true
        and nullif(btrim(public_name), '') is not null
        and nullif(btrim(editorial_description_en), '') is not null
        and nullif(btrim(editorial_description_sq), '') is not null
    ),
    count(*) filter (where listing_status = 'active'),
    count(*) filter (where image_url is not null)
  into curated_count, active_count, image_count
  from public.directory_places
  where id = any(expected_ids);

  if curated_count <> cardinality(expected_ids) then
    raise exception
      'SQL 34 expected % fully curated records but verified %.',
      cardinality(expected_ids),
      curated_count;
  end if;

  if active_count <> cardinality(expected_ids) then
    raise exception
      'SQL 34 changed or encountered an unexpected listing status.';
  end if;

  if image_count <> 2 then
    raise exception
      'SQL 34 expected exactly 2 licensed images but verified %.',
      image_count;
  end if;
end;
$$;

commit;

select
  id,
  public_name,
  city,
  public_category_key,
  listing_status,
  public_facts_reviewed,
  image_url is not null as has_reviewed_image
from public.directory_places
where id = any(
  array[
    '599e1d5f-8ecb-4319-ba8d-60971681487c'::uuid,
    'b1f56c31-6c2d-4a1e-9de9-526c0d08884f'::uuid,
    'a3d6d6bd-0699-4f93-9be5-a837fbe184fa'::uuid,
    'ebf64910-1ce1-4bb4-98eb-ac0a763a6307'::uuid,
    '215e05b6-58ee-47bd-a9e8-96ce99226efa'::uuid,
    '2f8ec7e2-86da-4e70-a8fe-70a4a8aeda93'::uuid,
    'c34cd003-55da-47f1-974a-b85e49d2a838'::uuid,
    'f081e07c-094a-4716-b1e7-9c77d107f695'::uuid
  ]
)
order by city, public_name;
