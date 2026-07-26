-- Stage 12 Batch 15: third curated Albania launch catalogue.
--
-- This enriches ten existing private directory candidates in Durres, Vlore
-- and Tirana with current reviewed facts, bilingual descriptions and two
-- reusable coastal destination photographs.
--
-- Safety:
-- - imported source fields remain unchanged
-- - listing_status and claim_status remain unchanged
-- - no place is approved or published by this script
-- - image licence evidence and fact-check notes remain operator-only

begin;

do $$
declare
  expected_ids uuid[] := array[
    'ec042172-c9f4-4259-9e53-10d559c73309'::uuid,
    'b353a717-5f86-462e-bf43-d19c3cd4e19d'::uuid,
    'c2bdcfdc-03e7-48b1-a068-622ccc984ddf'::uuid,
    '4e8ae705-9635-46e8-8334-bd4a6a3993dc'::uuid,
    '0978dfae-61ce-481e-902c-d472f80527c1'::uuid,
    'c5f9271c-afad-4f52-8975-a7a9b5e01eb9'::uuid,
    '874d225e-16f8-4b2a-8b64-7234ef678681'::uuid,
    'c9628821-b850-4fad-ae1c-9616b24fc6de'::uuid,
    'ede2c6b5-20c0-4b4c-823f-35fc71177b15'::uuid,
    '61ce696a-48e8-4560-b628-dd73d8a95e7f'::uuid
  ];
  matched_count integer;
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 32 requires the directory foundation from SQL 19.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directory_places'
      and column_name = 'public_facts_reviewed'
  ) then
    raise exception 'SQL 32 requires reviewed public facts from SQL 30.';
  end if;

  select count(*)
  into matched_count
  from public.directory_places
  where id = any(expected_ids);

  if matched_count <> cardinality(expected_ids) then
    raise exception
      'SQL 32 expected % launch candidates but found %.',
      cardinality(expected_ids),
      matched_count;
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
      'ec042172-c9f4-4259-9e53-10d559c73309'::uuid,
      'Dental Center Durrës',
      'dental_health',
      'Lagjja 4, Rruga Myfit Kodra, përballë Terminalit të Trageteve',
      '2001',
      '+355 69 208 8948',
      'https://dentalcenterdurres.com/',
      'https://dentalcenterdurres.com/contattaci/',
      'Reviewed 26 July 2026 against the clinic website and contact page. Confirmed current Durrës address, telephone number and listed dental services.',
      'Dental clinic near the Durrës ferry terminal offering check-ups, cleaning, fillings, whitening, dental implants, orthodontics and fixed or removable prosthetics.',
      'Klinikë dentare pranë terminalit të trageteve në Durrës, me kontrolle, pastrim, mbushje, zbardhim, implante dentare, ortodonci dhe proteza fikse ose të lëvizshme.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'b353a717-5f86-462e-bf43-d19c3cd4e19d'::uuid,
      'Klinika e Fizioterapisë AD-AR',
      'wellness_fitness',
      'Rruga Mujo Ulqinaku',
      '2001',
      '+355 69 575 8041',
      null,
      'https://www.findhealthclinics.com/AL/Durrsi/103474674381909/klinika_fizioterapise_adar',
      'Reviewed 26 July 2026 against a current clinic listing and the imported Overture record. Confirmed the Durrës identity, Rruga Mujo Ulqinaku location and telephone number.',
      'Physiotherapy clinic in Durrës for rehabilitation and movement-focused care. Contact the clinic directly for current treatments and appointment availability.',
      'Klinikë fizioterapie në Durrës për rehabilitim dhe kujdes të fokusuar te lëvizja. Kontaktoni klinikën drejtpërdrejt për trajtimet dhe oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'c2bdcfdc-03e7-48b1-a068-622ccc984ddf'::uuid,
      'Elements Beach Bar',
      'food_drink',
      'GG57+XQ2, Gjiri i Lalzit, Plazhi San Pietro',
      '2015',
      '+355 69 606 1204',
      null,
      'https://restaurantguru.com/Elements-Beach-Bar-Plazhi-San-Pietro',
      'Reviewed 26 July 2026 against the current venue listing. Confirmed the Plazhi San Pietro identity, Gjiri i Lalzit address, telephone number and food-and-drink offer.',
      'Beachfront restaurant and bar at Plazhi San Pietro serving food, coffee and drinks with outdoor seating by Gjiri i Lalzit.',
      'Restorant dhe bar buzë plazhit në Plazhin San Pietro, me ushqim, kafe e pije dhe ulëse të jashtme pranë Gjirit të Lalzit.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Sunset_in_%22Gjiri_i_Lalzit%22.jpg',
      'Sunset over Gjiri i Lalzit beach',
      'Perëndim dielli mbi plazhin e Gjirit të Lalzit',
      'Inac123 · CC BY-SA 4.0',
      'https://commons.wikimedia.org/wiki/File:Sunset_in_%22Gjiri_i_Lalzit%22.jpg',
      'Wikimedia Commons image by Inac123, licensed CC BY-SA 4.0. Destination image represents Gjiri i Lalzit and is not presented as the venue premises.'
    ),
    (
      '4e8ae705-9635-46e8-8334-bd4a6a3993dc'::uuid,
      'Lider Center',
      'learning_lessons',
      'Rruga Mujo Ulqinaku, Pallati Arvi, Kati 2',
      '2001',
      '+355 69 656 6800',
      null,
      'https://www.gjithebiznesi.com/lider-center_1K-069-656-6800',
      'Reviewed 26 July 2026 against a current business listing and the imported Overture record. Confirmed the Durrës language-school identity, address and primary telephone number.',
      'Language school in central Durrës. Contact the centre directly for current languages, course levels and timetables.',
      'Shkollë gjuhësh në qendër të Durrësit. Kontaktoni qendrën drejtpërdrejt për gjuhët, nivelet e kurseve dhe oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '0978dfae-61ce-481e-902c-d472f80527c1'::uuid,
      'Golden Gym',
      'wellness_fitness',
      'Rruga Çajupi',
      '9401',
      '+355 69 647 3292',
      null,
      'https://www.top-rated.online/cities/Vlora/place/p/12311995/Golden%2BGym',
      'Reviewed 26 July 2026 against a current venue listing updated in June 2026 and the imported Overture record. Confirmed the Vlorë gym identity, address and telephone number.',
      'Fitness centre on Rruga Çajupi in Vlorë with gym equipment and training space. Contact the centre directly for membership options and current opening hours.',
      'Qendër fitnesi në Rrugën Çajupi në Vlorë, me pajisje palestre dhe hapësirë stërvitjeje. Kontaktoni qendrën drejtpërdrejt për anëtarësimet dhe oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'c5f9271c-afad-4f52-8975-a7a9b5e01eb9'::uuid,
      'Emiral Beach',
      'food_drink',
      'Rruga Sazani',
      '9401',
      '+355 69 230 4333',
      null,
      'https://www.sluurpy.com/en/vlore/restaurant/7824677/emiral-beach',
      'Reviewed 26 July 2026 against current restaurant listings and the imported Overture record. Confirmed the Vlorë identity, Rruga Sazani address, telephone number and food-and-drink category.',
      'Beachfront restaurant in Vlorë serving seafood, Mediterranean dishes and drinks by the Old Beach area.',
      'Restorant buzë plazhit në Vlorë, me fruta deti, gatime mesdhetare dhe pije pranë zonës së Plazhit të Vjetër.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Vlore_shtator_2017.jpg',
      'Sunset over the bay at Vlorë',
      'Perëndim dielli mbi gjirin e Vlorës',
      'Anila amataj · CC BY-SA 4.0',
      'https://commons.wikimedia.org/wiki/File:Vlore_shtator_2017.jpg',
      'Wikimedia Commons image by Anila amataj, licensed CC BY-SA 4.0. Destination image represents the Vlorë coast and is not presented as the venue premises.'
    ),
    (
      '874d225e-16f8-4b2a-8b64-7234ef678681'::uuid,
      'Sole Agjensi',
      'tours_activities',
      'Bulevardi Ismail Qemali, Lagjja Isa Boletini, Objekti 2/2, Kati 1',
      '9404',
      '+355 69 858 3369',
      null,
      'https://www.gjithebiznesi.com/sole-agjensi-069-858-3369',
      'Reviewed 26 July 2026 against a current business listing, the Albanian tourism-agency register and the imported Overture record. Confirmed the Vlorë travel-agency identity, address and telephone number.',
      'Travel agency in central Vlorë, with a city-centre office and direct telephone contact for current travel services.',
      'Agjenci udhëtimi në qendër të Vlorës, me zyrë në qytet dhe kontakt të drejtpërdrejtë telefonik për shërbimet aktuale të udhëtimit.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'c9628821-b850-4fad-ae1c-9616b24fc6de'::uuid,
      'Albi Tattoo & Piercing',
      'beauty_grooming',
      'Rruga Çajupi',
      '9401',
      '+355 69 855 0250',
      null,
      'https://www.glartent.com/AL/Vlor%C3%AB/199448086747019/Albi-Tattoo-%26-Piercing',
      'Reviewed 26 July 2026 against a current social-business mirror and the imported Overture record. Confirmed the Vlorë studio identity, Rruga Çajupi address and telephone number.',
      'Tattoo and piercing studio on Rruga Çajupi in Vlorë, also presenting custom artwork and pencil portraits. Contact the studio directly for current availability.',
      'Studio tatuazhesh dhe piercing në Rrugën Çajupi në Vlorë, që paraqet edhe punime artistike dhe portrete me laps. Kontaktoni studion drejtpërdrejt për oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'ede2c6b5-20c0-4b4c-823f-35fc71177b15'::uuid,
      'Enterprise Rent-A-Car · Tirana City',
      'rentals',
      'Rruga Vaso Pasha nr. 75',
      '1000',
      '+355 67 600 0900',
      'https://www.enterprise.al/car-hire/locations/al/tirana-city-tiac61',
      'https://www.enterprise.al/car-hire/locations/al/tirana-city-tiac61',
      'Reviewed 26 July 2026 against the official Enterprise Albania branch and contact pages. Confirmed the Tirana City branch address, telephone number and pickup service.',
      'Enterprise car-rental branch in central Tirana with daily opening, vehicle pickup and customer support through Enterprise Albania.',
      'Degë e Enterprise për makina me qira në qendër të Tiranës, e hapur çdo ditë, me marrje automjetesh dhe mbështetje për klientët nga Enterprise Albania.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '61ce696a-48e8-4560-b628-dd73d8a95e7f'::uuid,
      'Advanced Hair Transplant Clinic',
      'beauty_grooming',
      'Kompleksi Halili, Rruga e Dibrës',
      '1001',
      '+355 68 222 2456',
      'https://advancedfueclinic.com/',
      'https://advancedfueclinic.com/na-kontaktoni/',
      'Reviewed 26 July 2026 against the clinic website, services and contact page. Confirmed the Tirana address, telephone number and current hair-restoration services.',
      'Hair-restoration clinic in Tirana offering consultations and hair, beard and eyebrow transplant procedures, including FUE and DHI methods.',
      'Klinikë e restaurimit të flokëve në Tiranë që ofron konsulta dhe procedura transplantimi për flokët, mjekrën dhe vetullat, përfshirë metodat FUE dhe DHI.',
      null,
      null,
      null,
      null,
      null,
      null
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
  curated_count integer;
begin
  select count(*)
  into curated_count
  from public.directory_places
  where id = any(
    array[
      'ec042172-c9f4-4259-9e53-10d559c73309'::uuid,
      'b353a717-5f86-462e-bf43-d19c3cd4e19d'::uuid,
      'c2bdcfdc-03e7-48b1-a068-622ccc984ddf'::uuid,
      '4e8ae705-9635-46e8-8334-bd4a6a3993dc'::uuid,
      '0978dfae-61ce-481e-902c-d472f80527c1'::uuid,
      'c5f9271c-afad-4f52-8975-a7a9b5e01eb9'::uuid,
      '874d225e-16f8-4b2a-8b64-7234ef678681'::uuid,
      'c9628821-b850-4fad-ae1c-9616b24fc6de'::uuid,
      'ede2c6b5-20c0-4b4c-823f-35fc71177b15'::uuid,
      '61ce696a-48e8-4560-b628-dd73d8a95e7f'::uuid
    ]
  )
    and public_facts_reviewed = true
    and nullif(btrim(public_name), '') is not null
    and nullif(btrim(editorial_description_en), '') is not null
    and nullif(btrim(editorial_description_sq), '') is not null;

  if curated_count <> 10 then
    raise exception
      'SQL 32 expected 10 fully curated records but verified %.',
      curated_count;
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
    'ec042172-c9f4-4259-9e53-10d559c73309'::uuid,
    'b353a717-5f86-462e-bf43-d19c3cd4e19d'::uuid,
    'c2bdcfdc-03e7-48b1-a068-622ccc984ddf'::uuid,
    '4e8ae705-9635-46e8-8334-bd4a6a3993dc'::uuid,
    '0978dfae-61ce-481e-902c-d472f80527c1'::uuid,
    'c5f9271c-afad-4f52-8975-a7a9b5e01eb9'::uuid,
    '874d225e-16f8-4b2a-8b64-7234ef678681'::uuid,
    'c9628821-b850-4fad-ae1c-9616b24fc6de'::uuid,
    'ede2c6b5-20c0-4b4c-823f-35fc71177b15'::uuid,
    '61ce696a-48e8-4560-b628-dd73d8a95e7f'::uuid
  ]
)
order by city, public_name;
