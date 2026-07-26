-- Stage 12 Batch 14: second curated Albania launch catalogue.
--
-- This enriches twelve existing private directory candidates with current,
-- source-checked public facts, bilingual editorial descriptions and licensed
-- imagery where a suitable reusable photograph was available.
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
    'b3930f64-75f1-4643-aea0-7ade1ac0365c'::uuid,
    '7583fb2a-42e3-4967-a4ed-d404ef1d72e3'::uuid,
    'd01b11fd-64ed-4238-b70f-0e995763f2e8'::uuid,
    'ad42a5aa-31f2-4cd3-a833-4e9c74aca116'::uuid,
    'c497a41a-9b49-4c32-98c9-84a17ee3209d'::uuid,
    '2a4b76c6-c105-4dc5-9ba8-6ad15b196e18'::uuid,
    '892a4df5-b6cf-4ae3-a86b-efaba1a3be2c'::uuid,
    'a92f7d11-365e-4d7d-8c35-5b63f9833617'::uuid,
    'fdfdee67-b95f-4a11-aa06-50f466b4e4b6'::uuid,
    '0aee7adf-4f11-4255-9fc8-b2895568509c'::uuid,
    'e2f43e8e-4eb7-4439-a5fb-df12dcf30498'::uuid,
    '89e81767-02d6-4062-8c44-bc05412ff8f6'::uuid
  ];
  matched_count integer;
begin
  if to_regclass('public.directory_places') is null then
    raise exception 'SQL 31 requires the directory foundation from SQL 19.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directory_places'
      and column_name = 'public_facts_reviewed'
  ) then
    raise exception 'SQL 31 requires reviewed public facts from SQL 30.';
  end if;

  select count(*)
  into matched_count
  from public.directory_places
  where id = any(expected_ids);

  if matched_count <> cardinality(expected_ids) then
    raise exception
      'SQL 31 expected % launch candidates but found %.',
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
      'b3930f64-75f1-4643-aea0-7ade1ac0365c'::uuid,
      'Nomad Camper Hire',
      'rentals',
      null,
      null,
      '+355 69 348 9332',
      'https://nomadcamperhire.com/',
      'https://nomadcamperhire.com/faq-help/',
      'Reviewed 26 July 2026 against the operator website and FAQ. Confirmed Berat pickup, current telephone number and campervan-hire offer.',
      'Berat-based campervan hire for road trips around Albania, with equipped campers, flexible pickup options and support during the journey.',
      'Kamperë me qira me bazë në Berat për udhëtime nëpër Shqipëri, me mjete të pajisura, mundësi fleksibël marrjeje dhe mbështetje gjatë udhëtimit.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '7583fb2a-42e3-4967-a4ed-d404ef1d72e3'::uuid,
      'VATO',
      'tours_activities',
      'Rruga Mihal Komnena',
      '5001',
      '+355 69 689 8232',
      'https://vato.al/',
      'https://vato.al/contact-us/',
      'Reviewed 26 July 2026 against the operator website and contact page. Confirmed Berat address, telephone number and current tour categories.',
      'Berat tour operator offering city walks, canyon and waterfall trips, wine experiences, rafting, hiking, transfers and multi-day journeys across Albania.',
      'Operator turistik në Berat që ofron shëtitje në qytet, udhëtime në kanione e ujëvara, eksperienca vere, rafting, ecje, transferta dhe ture disaditore në Shqipëri.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Berat_Albania_15.jpg',
      'A church and stone walls within Berat Castle',
      'Kishë dhe mure guri brenda Kalasë së Beratit',
      'Photo: Jason Rogers · CC BY 2.0',
      'https://commons.wikimedia.org/wiki/File:Berat_Albania_15.jpg',
      'Wikimedia Commons image by Jason Rogers, licensed CC BY 2.0. Destination image represents Berat and is not presented as the operator premises.'
    ),
    (
      'd01b11fd-64ed-4238-b70f-0e995763f2e8'::uuid,
      'Ethnographic Museum of Gjirokastër',
      'attractions',
      'Gjirokastër Old Town',
      '6001',
      null,
      'https://akt.gov.al/en/attractions/ethnographic-museum/',
      'https://akt.gov.al/en/attractions/ethnographic-museum/',
      'Reviewed 26 July 2026 against Albania''s National Tourism Agency listing. Confirmed attraction identity, old-town setting and collection description.',
      'A traditional Gjirokastër house in the old town presenting regional furniture, clothing, tools and everyday objects alongside the city''s characteristic stone-and-wood architecture.',
      'Një shtëpi tradicionale gjirokastrite në qytetin e vjetër, ku paraqiten mobilie, veshje, vegla dhe objekte të jetës së përditshme, së bashku me arkitekturën karakteristike prej guri e druri.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Ethnographic_Museum_of_Gjirokaster_02.jpg',
      'Interior of the Ethnographic Museum of Gjirokastër',
      'Brendësia e Muzeut Etnografik të Gjirokastrës',
      'Photo: JoraKasapi · CC BY-SA 4.0',
      'https://commons.wikimedia.org/wiki/File:Ethnographic_Museum_of_Gjirokaster_02.jpg',
      'Wikimedia Commons image by JoraKasapi, licensed CC BY-SA 4.0.'
    ),
    (
      'ad42a5aa-31f2-4cd3-a833-4e9c74aca116'::uuid,
      'Himara Nautica One',
      'tours_activities',
      null,
      null,
      '+355 69 695 6176',
      'https://himaranauticaone.com/',
      'https://himaranauticaone.com/',
      'Reviewed 26 July 2026 against the operator website. Confirmed Himarë boat-tour offer, current telephone number and coastal itineraries.',
      'Himarë boat-tour operator running coastal trips to sea caves, secluded bays and beaches, with private and longer itineraries along the Albanian Riviera.',
      'Operator turesh me varkë në Himarë, me udhëtime drejt shpellave detare, gjireve dhe plazheve të izoluara, si edhe itinerare private e më të gjata përgjatë Rivierës Shqiptare.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Potami_beach_in_Himara.jpg',
      'Potami Beach and the coast at Himarë',
      'Plazhi i Potamit dhe bregdeti i Himarës',
      'Photo: Leeturtle · CC BY-SA 4.0',
      'https://commons.wikimedia.org/wiki/File:Potami_beach_in_Himara.jpg',
      'Wikimedia Commons image by Leeturtle, licensed CC BY-SA 4.0. Destination image represents the Himarë coast and is not presented as an operator-owned vessel.'
    ),
    (
      'c497a41a-9b49-4c32-98c9-84a17ee3209d'::uuid,
      'Bratko Museum of Oriental Art',
      'attractions',
      'Bulevardi Fan Noli 57',
      '7001',
      null,
      'https://bashkiakorce.gov.al/2008/12/15/muzeu-i-artit-oriental-bratko-2/',
      'https://bashkiakorce.gov.al/2008/12/15/muzeu-i-artit-oriental-bratko-2/',
      'Reviewed 26 July 2026 against the Municipality of Korçë museum page. Confirmed address, collection history and museum identity.',
      'Korçë museum opened in 2003 around the collection of George Dimitër Boria, with Asian art, antiques, clothing, photographs and objects gathered during his travels and work.',
      'Muze në Korçë, i hapur më 2003 rreth koleksionit të George Dimitër Borisë, me art aziatik, antikitete, veshje, fotografi dhe objekte të mbledhura gjatë udhëtimeve dhe punës së tij.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '2a4b76c6-c105-4dc5-9ba8-6ad15b196e18'::uuid,
      'Butrint National Park',
      'attractions',
      'Butrint',
      '9701',
      null,
      'https://akt.gov.al/en/archaeological-site/butrint/',
      'https://akt.gov.al/en/archaeological-site/butrint/',
      'Reviewed 26 July 2026 against Albania''s National Tourism Agency archaeological-site page. Confirmed place identity, protected context and historical scope.',
      'UNESCO-listed archaeological park near Sarandë, where Greek, Roman, Byzantine and Venetian layers meet a landscape between Lake Butrint and the Vivari Channel.',
      'Park arkeologjik i UNESCO-s pranë Sarandës, ku shtresat greke, romake, bizantine dhe veneciane ndërthuren me peizazhin mes Liqenit të Butrintit dhe Kanalit të Vivarit.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Butrint_-_Ancient_amphitheatre_(by_Pudelek).JPG',
      'The ancient theatre at Butrint National Park',
      'Teatri antik në Parkun Kombëtar të Butrintit',
      'Photo: Pudelek · CC BY-SA 4.0',
      'https://commons.wikimedia.org/wiki/File:Butrint_-_Ancient_amphitheatre_(by_Pudelek).JPG',
      'Wikimedia Commons image by Pudelek, licensed CC BY-SA 4.0.'
    ),
    (
      '892a4df5-b6cf-4ae3-a86b-efaba1a3be2c'::uuid,
      'Enterprise Rent-A-Car · Sarandë Port',
      'rentals',
      'Rruga Abedin Dino 148',
      '9701',
      '+355 67 600 0900',
      'https://www.enterprise.al/car-hire/locations/al/sarande-port-terminal-tias61',
      'https://www.enterprise.al/car-hire/locations/al/sarande-port-terminal-tias61',
      'Reviewed 26 July 2026 against the official Enterprise Albania branch page. Confirmed Sarandë Port branch address, telephone number and service notes.',
      'Car-rental branch at Sarandë Port Terminal with daily pickup service and after-hours collection or return available by advance arrangement.',
      'Degë makinash me qira në Terminalin e Portit të Sarandës, me marrje ditore dhe dorëzim ose kthim jashtë orarit me marrëveshje paraprake.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'a92f7d11-365e-4d7d-8c35-5b63f9833617'::uuid,
      'Marin Yacht Agency',
      'tours_activities',
      'Sarandë Port',
      '9701',
      '+355 68 604 0901',
      'https://www.marinyachtagency.com/',
      'https://www.marinyachtagency.com/',
      'Reviewed 26 July 2026 against the operator website. Confirmed Sarandë operation, telephone number and yacht, port, charter and transfer services.',
      'Sarandë maritime agency providing yacht and port assistance, berthing, charter trips, transfers and local support for visiting vessels.',
      'Agjenci detare në Sarandë që ofron asistencë për jahte dhe portin, ankorim, udhëtime me charter, transferta dhe mbështetje lokale për mjetet lundruese.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'fdfdee67-b95f-4a11-aa06-50f466b4e4b6'::uuid,
      'Lake Koman',
      'attractions',
      'Koman',
      '4001',
      null,
      'https://akt.gov.al/en/tourist_areas/koman-lake/',
      'https://akt.gov.al/en/tourist_areas/koman-lake/',
      'Reviewed 26 July 2026 against Albania''s National Tourism Agency destination page. Confirmed place identity and visitor description.',
      'A canyon-framed reservoir in northwestern Albania known for dramatic ferry journeys through steep mountain scenery and the Drin hydropower landscape.',
      'Liqen i rrethuar nga kanione në veriperëndim të Shqipërisë, i njohur për udhëtimet mbresëlënëse me traget mes maleve dhe peizazhit të sistemit hidroenergjetik të Drinit.',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Lake_Koman_Albania_2016.jpg',
      'Small boats on turquoise water among the cliffs of Lake Koman',
      'Varka të vogla në ujërat e kaltra mes shkëmbinjve të Liqenit të Komanit',
      'Photo: Colin Skidmore · CC BY-SA 2.0',
      'https://commons.wikimedia.org/wiki/File:Lake_Koman_Albania_2016.jpg',
      'Wikimedia Commons image by Colin Skidmore, licensed CC BY-SA 2.0.'
    ),
    (
      '0aee7adf-4f11-4255-9fc8-b2895568509c'::uuid,
      'Marubi Dental Center',
      'dental_health',
      'Rruga 28 Nëntori, Nr. 08',
      '4001',
      '+355 68 225 8847',
      'https://marubidentalcenter.com/',
      'https://marubidentalcenter.com/index.php/kontakt/',
      'Reviewed 26 July 2026 against the clinic website and contact page. Confirmed Shkodër address, telephone number and current treatment areas.',
      'Shkodër dental clinic established in 1996, offering general and aesthetic dentistry, oral surgery, orthodontics, implantology, laser treatment and radiological diagnosis.',
      'Klinikë dentare në Shkodër, e themeluar më 1996, me stomatologji të përgjithshme e estetike, kirurgji orale, ortodonci, implantologji, trajtim me lazer dhe diagnostikim radiologjik.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      'e2f43e8e-4eb7-4439-a5fb-df12dcf30498'::uuid,
      'Cuni Auto',
      'rentals',
      'Bahçallëk, Shkodër–Tiranë km 1',
      '4001',
      '+355 67 666 6060',
      'https://www.cuniauto.com/',
      'https://www.cuniauto.com/',
      'Reviewed 26 July 2026 against the operator website. Confirmed Shkodër operation, telephone number and vehicle-rental offer.',
      'Shkodër car-rental provider with manual, automatic and off-road vehicles, plus pickup options and support for travel in Albania.',
      'Ofrues makinash me qira në Shkodër, me mjete manuale, automatike dhe 4x4, si edhe mundësi marrjeje dhe mbështetje për udhëtime në Shqipëri.',
      null,
      null,
      null,
      null,
      null,
      null
    ),
    (
      '89e81767-02d6-4062-8c44-bc05412ff8f6'::uuid,
      'FuturA+ Education Academy',
      'learning_lessons',
      'Rruga e Barrikadave, përballë shkollës Lidhja e Prizrenit',
      null,
      '+355 69 364 7710',
      'https://www.futura-edu.com/',
      'https://www.futura-edu.com/kontakt/',
      'Reviewed 26 July 2026 against the academy website and contact page. Confirmed Tiranë address, telephone number and current learning programmes.',
      'Tiranë learning centre for children and teenagers, with after-school support, foreign languages, coding, art and summer programmes.',
      'Qendër mësimore në Tiranë për fëmijë dhe të rinj, me mbështetje pas shkolle, gjuhë të huaja, kodim, art dhe programe verore.',
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
      'b3930f64-75f1-4643-aea0-7ade1ac0365c'::uuid,
      '7583fb2a-42e3-4967-a4ed-d404ef1d72e3'::uuid,
      'd01b11fd-64ed-4238-b70f-0e995763f2e8'::uuid,
      'ad42a5aa-31f2-4cd3-a833-4e9c74aca116'::uuid,
      'c497a41a-9b49-4c32-98c9-84a17ee3209d'::uuid,
      '2a4b76c6-c105-4dc5-9ba8-6ad15b196e18'::uuid,
      '892a4df5-b6cf-4ae3-a86b-efaba1a3be2c'::uuid,
      'a92f7d11-365e-4d7d-8c35-5b63f9833617'::uuid,
      'fdfdee67-b95f-4a11-aa06-50f466b4e4b6'::uuid,
      '0aee7adf-4f11-4255-9fc8-b2895568509c'::uuid,
      'e2f43e8e-4eb7-4439-a5fb-df12dcf30498'::uuid,
      '89e81767-02d6-4062-8c44-bc05412ff8f6'::uuid
    ]
  )
    and public_facts_reviewed = true
    and nullif(btrim(public_name), '') is not null
    and nullif(btrim(editorial_description_en), '') is not null
    and nullif(btrim(editorial_description_sq), '') is not null;

  if curated_count <> 12 then
    raise exception
      'SQL 31 expected 12 fully curated records but verified %.',
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
    'b3930f64-75f1-4643-aea0-7ade1ac0365c'::uuid,
    '7583fb2a-42e3-4967-a4ed-d404ef1d72e3'::uuid,
    'd01b11fd-64ed-4238-b70f-0e995763f2e8'::uuid,
    'ad42a5aa-31f2-4cd3-a833-4e9c74aca116'::uuid,
    'c497a41a-9b49-4c32-98c9-84a17ee3209d'::uuid,
    '2a4b76c6-c105-4dc5-9ba8-6ad15b196e18'::uuid,
    '892a4df5-b6cf-4ae3-a86b-efaba1a3be2c'::uuid,
    'a92f7d11-365e-4d7d-8c35-5b63f9833617'::uuid,
    'fdfdee67-b95f-4a11-aa06-50f466b4e4b6'::uuid,
    '0aee7adf-4f11-4255-9fc8-b2895568509c'::uuid,
    'e2f43e8e-4eb7-4439-a5fb-df12dcf30498'::uuid,
    '89e81767-02d6-4062-8c44-bc05412ff8f6'::uuid
  ]
)
order by city, public_name;
