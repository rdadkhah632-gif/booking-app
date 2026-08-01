-- Stage 12 Batch 22: Albania grooming catalogue expansion.
--
-- This enriches twenty private Overture candidates selected to improve the
-- launch catalogue's coverage of barbers, hair salons, beauty studios and
-- tattoo/piercing studios. Public facts were checked against current official
-- sites, social profiles or current business listings on 31 July 2026.
--
-- Safety:
-- - every target must still be needs_review, unclaimed and unlinked
-- - imported source fields and exact private geometry remain unchanged
-- - listing_status and claim_status remain unchanged
-- - no place is approved, published, claimed or made bookable by this script
-- - no image is added without separately verified reuse rights

begin;

do $$
declare
  expected_ids uuid[] := array[
    '948066fc-3c44-43bc-b231-27240c047506'::uuid,
    'ee910acd-e4c4-4680-aa29-c886c1045fb1'::uuid,
    '93e5f07e-b821-4050-b613-d55bd2c88a3d'::uuid,
    '31a01460-5c82-42d9-b1ba-ae775b11bb33'::uuid,
    '83f002d6-17ff-47cd-a936-e4351b182b51'::uuid,
    '4d3be1c6-7d7c-4e43-977b-1d4b7c6bb3ef'::uuid,
    'd2198a78-61b7-4965-8cef-6ba5f3442ff1'::uuid,
    '9ca90f54-2ad7-4ba6-b37e-5add592f6bd6'::uuid,
    '69f120c0-b23e-438f-af31-4fa4931a49a5'::uuid,
    'e55b54a8-224d-4486-9ad5-a0a191d40a41'::uuid,
    '1a64066f-6270-49ae-b738-28c329f67c16'::uuid,
    '934c73f2-7e6f-415d-96ad-3abe74ea1f91'::uuid,
    'fc65ec86-8f4c-4105-8c28-4ba8a1206816'::uuid,
    '9d82a99d-d278-46b9-9e13-e7ae41470147'::uuid,
    'f09a74cd-74ae-4170-86ea-7ab6f30280d0'::uuid,
    '8a55e0a7-9d82-4d71-a805-82878957f3b3'::uuid,
    '8e00b918-8ce8-4de2-89ad-bd2bd458155d'::uuid,
    '0c4d9987-7146-4c91-9774-3560fa443f82'::uuid,
    '1d7a65a8-72ff-4740-9f3d-bedf5a6d7907'::uuid,
    '1482c87f-3aca-44f2-8b8e-69e9e0808c9e'::uuid
  ];
  matched_count integer;
  safe_count integer;
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 37 requires the directory foundation from SQL 19.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directory_places'
      and column_name = 'public_facts_reviewed'
  ) then
    raise exception 'SQL 37 requires reviewed public facts from SQL 30.';
  end if;

  select
    count(*),
    count(*) filter (
      where listing_status = 'needs_review'
        and claim_status = 'unclaimed'
        and linked_business_id is null
    )
  into matched_count, safe_count
  from public.directory_places
  where id = any(expected_ids);

  if matched_count <> cardinality(expected_ids) then
    raise exception
      'SQL 37 expected % grooming candidates but found %.',
      cardinality(expected_ids),
      matched_count;
  end if;

  if safe_count <> cardinality(expected_ids) then
    raise exception
      'SQL 37 stopped because a target is no longer private, unclaimed and unlinked.';
  end if;
end;
$$;

with catalogue (
  id,
  public_name,
  public_address,
  public_postcode,
  public_phone,
  public_website,
  public_facts_source_url,
  public_facts_note,
  editorial_description_en,
  editorial_description_sq
) as (
  values
    (
      '948066fc-3c44-43bc-b231-27240c047506'::uuid,
      'Barber Shop Nardi',
      'Rruga Grigor Durrsaku 2',
      '2001',
      '+355 69 664 1511',
      null,
      'https://barberhead.com/durres/barber-shop-nardi',
      'Reviewed 31 July 2026 against a current Durrës barber listing and the June 2026 Overture record. Confirmed the business identity, Grigor Durrsaku location, telephone number and barber category.',
      'Barber shop in Durrës offering haircuts and men''s grooming. Contact the shop directly for current services and appointment availability.',
      'Berberi në Durrës që ofron prerje flokësh dhe kujdes për meshkuj. Kontaktoni berberin drejtpërdrejt për shërbimet dhe oraret aktuale.'
    ),
    (
      'ee910acd-e4c4-4680-aa29-c886c1045fb1'::uuid,
      'Hair & Beauty by Alma Guri',
      'Rruga Liria, Plazh 13',
      '2021',
      '+355 68 200 2607',
      'https://www.hairandbeauty.al/',
      'https://www.hairandbeauty.al/',
      'Reviewed 31 July 2026 against the current official salon site and recent business updates. Confirmed the Durrës beach-area identity, telephone number and current hair, nail, beauty-treatment and massage offer.',
      'Hair and beauty salon in the Durrës beach area offering cuts, colouring and styling alongside nail, beauty and massage treatments. Contact the salon for current appointments.',
      'Sallon flokësh dhe bukurie në zonën e plazhit të Durrësit që ofron prerje, ngjyrosje dhe stilim, si edhe shërbime për thonjtë, bukurinë dhe masazhe. Kontaktoni sallonin për takimet aktuale.'
    ),
    (
      '93e5f07e-b821-4050-b613-d55bd2c88a3d'::uuid,
      'Salon & Spa Afërdita',
      'Lagjja 9, Rruga Aleksandër Goga, pranë Muzeut të Dëshmorëve',
      '2001',
      '+355 69 791 9166',
      'https://www.aferditaaestheticspa.com/',
      'https://www.aferditaaestheticspa.com/',
      'Reviewed 31 July 2026 against the current salon site, recent public updates and the June 2026 Overture record. Confirmed the Durrës identity, telephone number and consultation-led face, body and beauty-treatment offer.',
      'Beauty and spa studio in Durrës offering consultation-led face, body and beauty treatments. Contact the studio directly for suitable treatments and current availability.',
      'Studio bukurie dhe spa në Durrës që ofron trajtime për fytyrën, trupin dhe bukurinë pas konsultës. Kontaktoni studion drejtpërdrejt për trajtimet e përshtatshme dhe oraret aktuale.'
    ),
    (
      '31a01460-5c82-42d9-b1ba-ae775b11bb33'::uuid,
      'Adi Barber Shop',
      'Shirgjan',
      '3011',
      '+355 67 270 2488',
      null,
      'https://www.facebook.com/1556688191022575',
      'Reviewed 31 July 2026 against the current public business profile and the June 2026 Overture record. Confirmed the Shirgjan identity, telephone number and barber category.',
      'Local barber shop in Shirgjan, Elbasan, with direct telephone contact for current haircuts, grooming services and availability.',
      'Berberi lokal në Shirgjan, Elbasan, me kontakt të drejtpërdrejtë telefonik për prerjet, shërbimet e kujdesit dhe oraret aktuale.'
    ),
    (
      '83f002d6-17ff-47cd-a936-e4351b182b51'::uuid,
      'Joland Tattoo',
      'Rruga Rinia, pranë Optika Biçiku, kati 2, mbi Big Market',
      '3001',
      '+355 69 510 0252',
      null,
      'https://www.gjithebiznesi.com/joland-tattoo-069-510-0252',
      'Reviewed 31 July 2026 against a current Elbasan business listing and the June 2026 Overture record. Confirmed the Rruga Rinia location, direct telephone number and tattoo-studio category.',
      'Tattoo studio in central Elbasan with direct telephone contact for design enquiries and current appointment availability.',
      'Studio tatuazhesh në qendër të Elbasanit, me kontakt të drejtpërdrejtë telefonik për idetë e dizajnit dhe oraret aktuale.'
    ),
    (
      '4d3be1c6-7d7c-4e43-977b-1d4b7c6bb3ef'::uuid,
      'Royal Glam Studio',
      'Rruga Kastriot Muço, përballë Bibliotekës',
      '9301',
      '+355 69 304 7241',
      'https://www.instagram.com/royal_glam_studio/',
      'https://www.instagram.com/royal_glam_studio/',
      'Reviewed 31 July 2026 against recent salon updates and the June 2026 Overture record. Confirmed the Fier identity, Kastriot Muço location, telephone number and beauty-salon category.',
      'Beauty studio in central Fier with direct phone and social contact for current salon services and appointments.',
      'Studio bukurie në qendër të Fierit, me kontakt telefonik dhe në rrjete sociale për shërbimet dhe takimet aktuale.'
    ),
    (
      'd2198a78-61b7-4965-8cef-6ba5f3442ff1'::uuid,
      'The Men''s Room',
      'Bulevardi 18 Shtatori, përballë Bar Rumors',
      '6001',
      '+355 69 311 1252',
      null,
      'https://www.facebook.com/114689146596552',
      'Reviewed 31 July 2026 against the current Gjirokastër salon profile, local salon directory and June 2026 Overture record. Confirmed the 18 Shtatori location, telephone number and men''s hair-salon category.',
      'Men''s hair salon on Bulevardi 18 Shtatori in Gjirokastër. Contact the salon directly for current cuts, grooming services and appointments.',
      'Sallon flokësh për meshkuj në Bulevardin 18 Shtatori në Gjirokastër. Kontaktoni sallonin drejtpërdrejt për prerjet, shërbimet e kujdesit dhe takimet aktuale.'
    ),
    (
      '9ca90f54-2ad7-4ba6-b37e-5add592f6bd6'::uuid,
      'Erion Mano Tattoo',
      'Rruga Aspasi Gjino',
      '7001',
      '+355 69 239 2176',
      null,
      'https://www.cybo.com/AL-biz/mano-ink-tattoo',
      'Reviewed 31 July 2026 against a current Korçë business listing and the June 2026 Overture record. Confirmed the Aspasi Gjino address, direct telephone number and tattoo-and-piercing category.',
      'Tattoo and piercing studio in Korçë with direct telephone contact for design enquiries and current appointments.',
      'Studio tatuazhesh dhe piercing në Korçë, me kontakt të drejtpërdrejtë telefonik për idetë e dizajnit dhe takimet aktuale.'
    ),
    (
      '69f120c0-b23e-438f-af31-4fa4931a49a5'::uuid,
      'Gerando''s Barber Shop',
      'Rruga Thanas Mertiri',
      '7001',
      '+355 69 430 0300',
      null,
      'https://www.facebook.com/102964761621243',
      'Reviewed 31 July 2026 against the current public business profile and the June 2026 Overture record. Confirmed the Korçë identity, Thanas Mertiri address, telephone number and barber category.',
      'Barber shop in Korçë offering haircuts and men''s grooming. Contact the shop directly for current services and availability.',
      'Berberi në Korçë që ofron prerje flokësh dhe kujdes për meshkuj. Kontaktoni berberin drejtpërdrejt për shërbimet dhe oraret aktuale.'
    ),
    (
      'e55b54a8-224d-4486-9ad5-a0a191d40a41'::uuid,
      'Top Beauty Griselda',
      'Rruga Luigj Gurakuqi 51',
      '4501',
      '+355 69 472 8440',
      'https://www.instagram.com/top_beauty_griselda/',
      'https://www.instagram.com/top_beauty_griselda/',
      'Reviewed 31 July 2026 against the current salon profile, current business listings and the June 2026 Overture record. Confirmed the Lezhë identity, Luigj Gurakuqi address, telephone number and nail-and-beauty category.',
      'Nail and beauty salon in central Lezhë with direct telephone and social contact for current treatments and appointments.',
      'Sallon thonjsh dhe bukurie në qendër të Lezhës, me kontakt telefonik dhe në rrjete sociale për trajtimet dhe takimet aktuale.'
    ),
    (
      '1a64066f-6270-49ae-b738-28c329f67c16'::uuid,
      'Kristi BarberShop',
      'Rruga Skënderbeu',
      '9701',
      '+355 69 938 0191',
      null,
      'https://www.facebook.com/348708392321161',
      'Reviewed 31 July 2026 against current Sarandë barber listings, the public business profile and June 2026 Overture record. Confirmed the Skënderbeu location, telephone number and barber category.',
      'Barber shop on Rruga Skënderbeu in Sarandë with direct telephone contact for current haircuts, grooming and availability.',
      'Berberi në Rrugën Skënderbeu në Sarandë, me kontakt të drejtpërdrejtë telefonik për prerjet, kujdesin dhe oraret aktuale.'
    ),
    (
      '934c73f2-7e6f-415d-96ad-3abe74ea1f91'::uuid,
      'Sani Tattoo Artist',
      'Rruga Skënderbeu 67',
      '9701',
      '+355 69 695 4685',
      'https://www.instagram.com/sani_tattoo_artist/',
      'https://www.visitsaranda.net/business/sani-tattoo-artist/',
      'Reviewed 31 July 2026 against the current Sarandë visitor listing, studio social profile and June 2026 Overture record. Confirmed the Skënderbeu address, telephone number and tattoo-studio identity.',
      'Tattoo studio in central Sarandë offering custom tattoo work with direct contact for design enquiries and appointments.',
      'Studio tatuazhesh në qendër të Sarandës që ofron punime të personalizuara, me kontakt të drejtpërdrejtë për idetë e dizajnit dhe takimet.'
    ),
    (
      'fc65ec86-8f4c-4105-8c28-4ba8a1206816'::uuid,
      'Beauty Farm',
      'Rruga Marin Biçikemi',
      '4001',
      '+355 67 200 3717',
      null,
      'https://www.facebook.com/563759620401036',
      'Reviewed 31 July 2026 against the current salon profile, current Shkodër business listing and June 2026 Overture record. Confirmed the Marin Biçikemi location, telephone number and hair-and-beauty category.',
      'Hair and beauty salon on Rruga Marin Biçikemi in Shkodër. Contact the salon directly for current services and appointments.',
      'Sallon flokësh dhe bukurie në Rrugën Marin Biçikemi në Shkodër. Kontaktoni sallonin drejtpërdrejt për shërbimet dhe takimet aktuale.'
    ),
    (
      '9d82a99d-d278-46b9-9e13-e7ae41470147'::uuid,
      'Ardi Borova Salon & Academy',
      'Rruga Vaso Pasha 7',
      '1017',
      '+355 68 202 6118',
      'https://www.ardiborova.com/',
      'https://www.ardiborova.com/',
      'Reviewed 31 July 2026 against the current official salon and academy site, its contact information and June 2026 Overture record. Confirmed the Tirana identity, Vaso Pasha address, telephone number, hair services and professional training offer.',
      'Hair salon and professional academy in Tirana offering cutting, colouring and styling services alongside hairdressing training. Contact the salon for current appointments and courses.',
      'Sallon flokësh dhe akademi profesionale në Tiranë që ofron prerje, ngjyrosje dhe stilim, si edhe formim profesional për parukeri. Kontaktoni sallonin për takimet dhe kurset aktuale.'
    ),
    (
      'f09a74cd-74ae-4170-86ea-7ab6f30280d0'::uuid,
      'InKing Tattoo Crew',
      'Rruga Myslym Shyri',
      '1001',
      '+355 69 367 5115',
      'https://inkingtattoocrew.carrd.co/',
      'https://inkingtattoocrew.carrd.co/',
      'Reviewed 31 July 2026 against the current official studio site and live appointment page. Confirmed the Tirana location, telephone and email contacts, tattoo services and appointment route.',
      'Tattoo studio on Rruga Myslym Shyri in Tirana with multiple artists and appointment sessions for custom tattoo work. Contact the studio for consultation and availability.',
      'Studio tatuazhesh në Rrugën Myslym Shyri në Tiranë, me disa artistë dhe seanca me takim për punime të personalizuara. Kontaktoni studion për konsultë dhe oraret aktuale.'
    ),
    (
      '8a55e0a7-9d82-4d71-a805-82878957f3b3'::uuid,
      'Man''s Room Barber Shop',
      'Bulevardi Bajram Curri, Pallati 12/1, Dyqani 3',
      '1020',
      '+355 67 643 4088',
      null,
      'https://www.top-rated.online/cities/Tirana/place/p/14355594/Man%27s%2BRoom%2BBarber%2BShop',
      'Reviewed 31 July 2026 against a recently updated Tirana barber listing and the June 2026 Overture record. Confirmed the Bajram Curri address, telephone number and barber category.',
      'Barber shop on Bulevardi Bajram Curri in Tirana with direct telephone contact for current haircuts, grooming and appointment availability.',
      'Berberi në Bulevardin Bajram Curri në Tiranë, me kontakt të drejtpërdrejtë telefonik për prerjet, kujdesin dhe oraret e takimeve.'
    ),
    (
      '8e00b918-8ce8-4de2-89ad-bd2bd458155d'::uuid,
      'Sallon Seni',
      'Rruga Bajram Curri',
      '1001',
      '+355 69 611 3093',
      'https://sallonseni.al/',
      'https://sallonseni.setmore.com/',
      'Reviewed 31 July 2026 against the current official salon site, live appointment page and recent business updates. Confirmed the Tirana identity, Bajram Curri location, telephone number and men''s haircut and beard-grooming services.',
      'Men''s salon in Tirana offering haircuts, styling and beard grooming, with a direct appointment route and telephone contact.',
      'Sallon për meshkuj në Tiranë që ofron prerje, stilim dhe kujdes për mjekrën, me rezervim të drejtpërdrejtë dhe kontakt telefonik.'
    ),
    (
      '0c4d9987-7146-4c91-9774-3560fa443f82'::uuid,
      'Barber Shop Çimi',
      'Lagjja Pavarësia',
      '9401',
      '+355 69 217 8623',
      null,
      'https://www.facebook.com/366854170163000',
      'Reviewed 31 July 2026 against the current public business profile, current Vlorë business listings and June 2026 Overture record. Confirmed the Pavarësia location, telephone number and barber category.',
      'Barber shop in Vlorë''s Pavarësia area with direct telephone contact for current haircuts, grooming and availability.',
      'Berberi në zonën Pavarësia të Vlorës, me kontakt të drejtpërdrejtë telefonik për prerjet, kujdesin dhe oraret aktuale.'
    ),
    (
      '1d7a65a8-72ff-4740-9f3d-bedf5a6d7907'::uuid,
      'Endri Tattoo and Piercing',
      'Bulevardi Ismail Qemali',
      '9401',
      '+355 69 616 5242',
      'https://www.endritattoo.com/',
      'https://www.gjithebiznesi.com/endri-tattoo-and-piercing-069-616-5242',
      'Reviewed 31 July 2026 against current Vlorë business listings, the listed studio site and June 2026 Overture record. Confirmed the Ismail Qemali address, telephone number and tattoo-and-piercing category.',
      'Tattoo and piercing studio on Bulevardi Ismail Qemali in Vlorë. Contact the studio directly for design enquiries and current appointments.',
      'Studio tatuazhesh dhe piercing në Bulevardin Ismail Qemali në Vlorë. Kontaktoni studion drejtpërdrejt për idetë e dizajnit dhe takimet aktuale.'
    ),
    (
      '1482c87f-3aca-44f2-8b8e-69e9e0808c9e'::uuid,
      'Leli Hair',
      'Rruga Çamëria, Skelë',
      '9401',
      '+355 69 626 0269',
      null,
      'https://www.facebook.com/1392948287588447',
      'Reviewed 31 July 2026 against recent Vlorë salon listings, the public business profile and June 2026 Overture record. Confirmed the Skelë location, telephone number and hair-salon category.',
      'Hair salon in Vlorë''s Skelë area with direct telephone contact for current cuts, styling and appointment availability.',
      'Sallon flokësh në zonën e Skelës në Vlorë, me kontakt të drejtpërdrejtë telefonik për prerjet, stilimin dhe oraret e takimeve.'
    )
)
update public.directory_places as place
set
  public_facts_reviewed = true,
  public_name = catalogue.public_name,
  public_category_key = 'beauty_grooming',
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
  content_updated_by = null,
  content_updated_at = now()
from catalogue
where place.id = catalogue.id;

do $$
declare
  expected_ids uuid[] := array[
    '948066fc-3c44-43bc-b231-27240c047506'::uuid,
    'ee910acd-e4c4-4680-aa29-c886c1045fb1'::uuid,
    '93e5f07e-b821-4050-b613-d55bd2c88a3d'::uuid,
    '31a01460-5c82-42d9-b1ba-ae775b11bb33'::uuid,
    '83f002d6-17ff-47cd-a936-e4351b182b51'::uuid,
    '4d3be1c6-7d7c-4e43-977b-1d4b7c6bb3ef'::uuid,
    'd2198a78-61b7-4965-8cef-6ba5f3442ff1'::uuid,
    '9ca90f54-2ad7-4ba6-b37e-5add592f6bd6'::uuid,
    '69f120c0-b23e-438f-af31-4fa4931a49a5'::uuid,
    'e55b54a8-224d-4486-9ad5-a0a191d40a41'::uuid,
    '1a64066f-6270-49ae-b738-28c329f67c16'::uuid,
    '934c73f2-7e6f-415d-96ad-3abe74ea1f91'::uuid,
    'fc65ec86-8f4c-4105-8c28-4ba8a1206816'::uuid,
    '9d82a99d-d278-46b9-9e13-e7ae41470147'::uuid,
    'f09a74cd-74ae-4170-86ea-7ab6f30280d0'::uuid,
    '8a55e0a7-9d82-4d71-a805-82878957f3b3'::uuid,
    '8e00b918-8ce8-4de2-89ad-bd2bd458155d'::uuid,
    '0c4d9987-7146-4c91-9774-3560fa443f82'::uuid,
    '1d7a65a8-72ff-4740-9f3d-bedf5a6d7907'::uuid,
    '1482c87f-3aca-44f2-8b8e-69e9e0808c9e'::uuid
  ];
  curated_count integer;
  safe_count integer;
begin
  select
    count(*) filter (
      where public_facts_reviewed = true
        and public_category_key = 'beauty_grooming'
        and nullif(btrim(public_name), '') is not null
        and nullif(btrim(editorial_description_en), '') is not null
        and nullif(btrim(editorial_description_sq), '') is not null
    ),
    count(*) filter (
      where listing_status = 'needs_review'
        and claim_status = 'unclaimed'
        and linked_business_id is null
    )
  into curated_count, safe_count
  from public.directory_places
  where id = any(expected_ids);

  if curated_count <> cardinality(expected_ids) then
    raise exception
      'SQL 37 expected % fully curated candidates but verified %.',
      cardinality(expected_ids),
      curated_count;
  end if;

  if safe_count <> cardinality(expected_ids) then
    raise exception
      'SQL 37 changed or encountered an unsafe listing, claim or link state.';
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
  claim_status,
  public_facts_reviewed,
  image_url is not null as has_reviewed_image
from public.directory_places
where id = any(
  array[
    '948066fc-3c44-43bc-b231-27240c047506'::uuid,
    'ee910acd-e4c4-4680-aa29-c886c1045fb1'::uuid,
    '93e5f07e-b821-4050-b613-d55bd2c88a3d'::uuid,
    '31a01460-5c82-42d9-b1ba-ae775b11bb33'::uuid,
    '83f002d6-17ff-47cd-a936-e4351b182b51'::uuid,
    '4d3be1c6-7d7c-4e43-977b-1d4b7c6bb3ef'::uuid,
    'd2198a78-61b7-4965-8cef-6ba5f3442ff1'::uuid,
    '9ca90f54-2ad7-4ba6-b37e-5add592f6bd6'::uuid,
    '69f120c0-b23e-438f-af31-4fa4931a49a5'::uuid,
    'e55b54a8-224d-4486-9ad5-a0a191d40a41'::uuid,
    '1a64066f-6270-49ae-b738-28c329f67c16'::uuid,
    '934c73f2-7e6f-415d-96ad-3abe74ea1f91'::uuid,
    'fc65ec86-8f4c-4105-8c28-4ba8a1206816'::uuid,
    '9d82a99d-d278-46b9-9e13-e7ae41470147'::uuid,
    'f09a74cd-74ae-4170-86ea-7ab6f30280d0'::uuid,
    '8a55e0a7-9d82-4d71-a805-82878957f3b3'::uuid,
    '8e00b918-8ce8-4de2-89ad-bd2bd458155d'::uuid,
    '0c4d9987-7146-4c91-9774-3560fa443f82'::uuid,
    '1d7a65a8-72ff-4740-9f3d-bedf5a6d7907'::uuid,
    '1482c87f-3aca-44f2-8b8e-69e9e0808c9e'::uuid
  ]
)
order by city, public_name;
