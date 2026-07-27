-- Stage 12 Batch 16: claim-ready local business catalogue.
--
-- This enriches ten existing private directory candidates selected for
-- practical owner outreach. Each is independently operated, directly
-- contactable and naturally suited to appointments, reservations or lessons.
--
-- Safety:
-- - selection does not imply owner consent or interest in promotion
-- - imported source fields remain unchanged
-- - listing_status and claim_status remain unchanged
-- - no place is approved, published or claimed by this script
-- - authentic owner imagery remains preferred over unlicensed or generic media

begin;

do $$
declare
  expected_ids uuid[] := array[
    '76434f2c-6ab7-4002-981e-69c83d40fc9c'::uuid,
    'f9286149-707e-4cf8-bb16-ab18943d143b'::uuid,
    'edb51d58-a104-44c1-87ee-9d795acb26bc'::uuid,
    '046cb919-b327-46e7-8588-381c4f0f6713'::uuid,
    '3dd61b25-d877-40d4-869c-ff23dc6e45b6'::uuid,
    '1d906833-8e30-4f60-8a52-8e68aae9a529'::uuid,
    '21dc57dc-b4d9-45d1-8b73-90774cb98232'::uuid,
    'e3887ecf-2d4d-48d7-bd40-610aaa03f9cb'::uuid,
    'eff86654-cf4c-444e-8847-d1facb381634'::uuid,
    '9502184b-949f-44e7-aac2-727c7629c196'::uuid
  ];
  matched_count integer;
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 33 requires the directory foundation from SQL 19.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directory_places'
      and column_name = 'public_facts_reviewed'
  ) then
    raise exception 'SQL 33 requires reviewed public facts from SQL 30.';
  end if;

  select count(*)
  into matched_count
  from public.directory_places
  where id = any(expected_ids);

  if matched_count <> cardinality(expected_ids) then
    raise exception
      'SQL 33 expected % claim-ready candidates but found %.',
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
      '76434f2c-6ab7-4002-981e-69c83d40fc9c'::uuid,
      'Xhardo Dental Center',
      'dental_health',
      'Lagjja 10 Korriku, Rruga Antipatrea, pranë Gjykatës së Rrethit',
      null,
      '+355 69 236 9680',
      null,
      'https://www.findhealthclinics.org/AL/Berat/989661164492742/Xhardo-Dental-Center',
      'Reviewed 26 July 2026 against the current clinic profile and imported Overture record. Confirmed the Berat identity, Antipatrea address, primary telephone number and dental category; listed specialties were cross-checked against the clinic business profile.',
      'Dental clinic in Berat offering implantology, orthodontics, endodontics, paediatric care, oral surgery and aesthetic dentistry. Contact the clinic directly for appointments.',
      'Klinikë dentare në Berat që ofron implantologji, ortodonci, endodonci, kujdes për fëmijë, kirurgji orale dhe stomatologji estetike. Kontaktoni klinikën drejtpërdrejt për takime.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'f9286149-707e-4cf8-bb16-ab18943d143b'::uuid,
      'Klinika Dentare Hashoti',
      'dental_health',
      'Rruga Xhorxh Sorros',
      '6002',
      '+355 69 542 6878',
      'https://hashotident.al/',
      'https://hashotident.al/about-us/contact/',
      'Reviewed 26 July 2026 against the clinic contact page and current clinic posts. Confirmed the Gjirokastër address, telephone number, email contact and appointment-led dental service.',
      'Family dental clinic in Gjirokastër offering general dentistry, endodontics, prosthetics and aesthetic dental care. Contact the clinic directly for an appointment.',
      'Klinikë dentare familjare në Gjirokastër që ofron stomatologji të përgjithshme, endodonci, protetikë dhe kujdes estetik dentar. Kontaktoni klinikën drejtpërdrejt për një takim.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'edb51d58-a104-44c1-87ee-9d795acb26bc'::uuid,
      'Klinika Orkiderma',
      'beauty_grooming',
      'Bulevardi Fan Noli 13/2, 100 m mbi Raiffeisen Bank',
      '7001',
      '+355 67 319 9999',
      null,
      'https://www.findhealthclinics.org/AL/Kor%C3%A7%C3%AB/251200432328196/Klinika-Orkiderma',
      'Reviewed 26 July 2026 against current 2026 clinic posts and the imported record. Confirmed the Korçë identity, Fan Noli address, telephone number and skin-focused treatment offer.',
      'Dermo-aesthetic clinic in Korçë offering professional skin care, acne support, regenerative treatments and hair-removal sessions. Contact the clinic for current consultations and availability.',
      'Klinikë dermo-estetike në Korçë që ofron kujdes profesional për lëkurën, mbështetje për aknet, trajtime rigjeneruese dhe seanca epilimi. Kontaktoni klinikën për konsultat dhe oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '046cb919-b327-46e7-8588-381c4f0f6713'::uuid,
      'Commando Arena',
      'wellness_fitness',
      'Rruga Korçë-Drenovë, kilometri i parë',
      null,
      '+355 68 301 3230',
      null,
      'https://www.top-rated.online/cities/Mborje/place/p/16128554/Commando%2BArena%2B-%2BKorce',
      'Reviewed 26 July 2026 against a venue listing updated in October 2025 and the imported Overture record. Confirmed the Drenovë-area identity, laser-tag category and telephone number.',
      'Laser-tag activity venue near Korçë for individual and group sessions. Contact the venue directly for current session times and group reservations.',
      'Qendër laser-tag pranë Korçës për seanca individuale dhe në grup. Kontaktoni qendrën drejtpërdrejt për oraret aktuale dhe rezervimet në grup.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '3dd61b25-d877-40d4-869c-ff23dc6e45b6'::uuid,
      '3H House of Horses',
      'tours_activities',
      'JPFV+69, Turan',
      '7001',
      '+355 69 470 7888',
      null,
      'https://bizz.al/rrethi-korce/accommodations/shtepia-e-kuajve-house-of-horses/',
      'Reviewed 26 July 2026 against a current local listing and the imported Overture record. Confirmed the Korçë-area identity, horseback-riding activity, direct telephone number and email contact.',
      'Horseback-riding centre near Korçë offering riding courses and nature-guided experiences. Contact the centre directly for current sessions and reservations.',
      'Qendër kalërimi pranë Korçës që ofron kurse kalërimi dhe përvoja të udhëhequra në natyrë. Kontaktoni qendrën drejtpërdrejt për seancat dhe rezervimet aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '1d906833-8e30-4f60-8a52-8e68aae9a529'::uuid,
      'Emilio''s Barber Shop',
      'beauty_grooming',
      'Lagjja nr. 3, Rruga Onhezmi',
      '9701',
      '+355 69 996 3838',
      null,
      'https://www.gjithebiznesi.com/emilios-barber-shop-069-996-3838',
      'Reviewed 26 July 2026 against a current business listing and the imported Overture record. Confirmed the Sarandë identity, Onhezmi address, telephone number and barber service.',
      'Local barber shop in central Sarandë offering hair and grooming services with direct telephone contact for current availability.',
      'Berber lokal në qendër të Sarandës që ofron prerje flokësh dhe shërbime kujdesi, me kontakt të drejtpërdrejtë telefonik për oraret aktuale.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '21dc57dc-b4d9-45d1-8b73-90774cb98232'::uuid,
      'Reni Barbershop',
      'beauty_grooming',
      'Rruga Nazmi Kryeziu',
      '4001',
      '+355 67 694 3229',
      null,
      'https://www.beautynailhairsalons.com/AL/Shkod%C3%ABr/101432638287845/Reni%E2%80%99-s-Barbershop',
      'Reviewed 26 July 2026 against current 2026 business posts and the imported Overture record. Confirmed the Shkodër identity, Nazmi Kryeziu address, reservation telephone number and grooming services.',
      'Barber shop in Shkodër offering haircuts, beard grooming and face treatments, with direct telephone reservations.',
      'Berber në Shkodër që ofron prerje flokësh, rregullim mjekre dhe trajtime fytyre, me rezervime të drejtpërdrejta me telefon.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'e3887ecf-2d4d-48d7-bd40-610aaa03f9cb'::uuid,
      'Autoshkolla EDBI',
      'learning_lessons',
      'Rruga Vëllezërit Frashëri, Ndocej',
      '4001',
      '+355 69 988 8900',
      'https://www.instagram.com/autoshkollaedbi/',
      'https://www.autoyas.com/AL/Shkod%C3%ABr/1486820701367920/Autoshkolla-EDBI',
      'Reviewed 26 July 2026 against current 2026 school posts and the imported Overture record. Confirmed the Shkodër identity, Ndocej address, telephone number and active driving-school offer.',
      'Driving school in Shkodër providing learner-driver preparation. Contact the school directly for current theory, practical lesson and enrolment schedules.',
      'Autoshkollë në Shkodër që ofron përgatitje për drejtues të rinj. Kontaktoni shkollën drejtpërdrejt për oraret aktuale të teorisë, praktikës dhe regjistrimit.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'eff86654-cf4c-444e-8847-d1facb381634'::uuid,
      'La Barberia Vrako',
      'beauty_grooming',
      'Te Ura e Lumit, pranë Vodafone',
      null,
      '+355 69 239 9912',
      null,
      'https://www.beautynailhairsalons.com/AL/Gjirokast%C3%ABr/575-2',
      'Reviewed 26 July 2026 against a current Gjirokastër salon listing and the imported Overture record. Confirmed the identity, Ura e Lumit location, barber category and direct telephone number.',
      'Independent barber shop near Ura e Lumit in Gjirokastër. Contact the shop directly for current grooming services and appointment availability.',
      'Berber i pavarur pranë Urës së Lumit në Gjirokastër. Kontaktoni berberin drejtpërdrejt për shërbimet aktuale dhe oraret e takimeve.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '9502184b-949f-44e7-aac2-727c7629c196'::uuid,
      'Suela Beauty Salon',
      'beauty_grooming',
      'Lagjja 22 Tetori, pas Bar Piaca',
      '5001',
      '+355 69 456 3444',
      null,
      'https://www.gjithebiznesi.com/suela-beauty-salon-069-456-3444',
      'Reviewed 26 July 2026 against current business listings and the imported Overture record. Confirmed the Berat identity, 22 Tetori address, telephone number and beauty-salon category.',
      'Beauty and nail salon in Berat with direct telephone contact for current treatments, courses and appointment availability.',
      'Sallon bukurie dhe thonjsh në Berat, me kontakt të drejtpërdrejtë telefonik për trajtimet, kurset dhe oraret aktuale të takimeve.',
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
      '76434f2c-6ab7-4002-981e-69c83d40fc9c'::uuid,
      'f9286149-707e-4cf8-bb16-ab18943d143b'::uuid,
      'edb51d58-a104-44c1-87ee-9d795acb26bc'::uuid,
      '046cb919-b327-46e7-8588-381c4f0f6713'::uuid,
      '3dd61b25-d877-40d4-869c-ff23dc6e45b6'::uuid,
      '1d906833-8e30-4f60-8a52-8e68aae9a529'::uuid,
      '21dc57dc-b4d9-45d1-8b73-90774cb98232'::uuid,
      'e3887ecf-2d4d-48d7-bd40-610aaa03f9cb'::uuid,
      'eff86654-cf4c-444e-8847-d1facb381634'::uuid,
      '9502184b-949f-44e7-aac2-727c7629c196'::uuid
    ]
  )
    and public_facts_reviewed = true
    and nullif(btrim(public_name), '') is not null
    and nullif(btrim(editorial_description_en), '') is not null
    and nullif(btrim(editorial_description_sq), '') is not null;

  if curated_count <> 10 then
    raise exception
      'SQL 33 expected 10 fully curated records but verified %.',
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
    '76434f2c-6ab7-4002-981e-69c83d40fc9c'::uuid,
    'f9286149-707e-4cf8-bb16-ab18943d143b'::uuid,
    'edb51d58-a104-44c1-87ee-9d795acb26bc'::uuid,
    '046cb919-b327-46e7-8588-381c4f0f6713'::uuid,
    '3dd61b25-d877-40d4-869c-ff23dc6e45b6'::uuid,
    '1d906833-8e30-4f60-8a52-8e68aae9a529'::uuid,
    '21dc57dc-b4d9-45d1-8b73-90774cb98232'::uuid,
    'e3887ecf-2d4d-48d7-bd40-610aaa03f9cb'::uuid,
    'eff86654-cf4c-444e-8847-d1facb381634'::uuid,
    '9502184b-949f-44e7-aac2-727c7629c196'::uuid
  ]
)
order by city, public_name;
