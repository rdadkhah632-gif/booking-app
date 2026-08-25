# Stage 12 - Albania Discovery Directory Foundation

Status: Batches 1 through 4 are deployed to the repository. SQL 19, SQL 20,
SQL 22 and SQL 24 were applied manually to production Supabase on 19 July 2026.
Batch 5 is deployed and passed production QA on 19 July 2026. Batch 6 is
deployed and passed production QA on 25 July 2026. Its deterministic shortlist,
SQL 26 boundary, exact coverage matrix, mobile Operator navigation, localized
access denial and public non-exposure checks all passed. Batch 7 imported the
first controlled 57-place launch seed into the private review queue on 25 July 2026. Batch 8 individually verified and approved the first eight public places
on 25 July 2026. Public List, Map, detail, EN/SQ, mobile and non-bookable
boundary checks passed; 49 candidates remain private. Batches 9 through 12
closed the map privacy, ownership claim, claimed-business handoff and cache
boundaries in deployed QA. Batch 13 adds reviewed descriptions and licensed
imagery. Batch 14 prepares reviewed public-fact corrections and a second
12-place private launch catalogue; SQL 29, SQL 30 and SQL 31 must be applied in
that order before its operator review. SQL 21, SQL 23 and SQL 25 belong to the
separate customer-app work and are not discovery dependencies.

## Product Direction

Mirëbook can launch customer-first as a useful way to discover services,
activities and places around Albania while retaining the complete Business and
Staff booking product.

This does not turn imported internet data into Mirëbook businesses. It creates
two clearly different marketplace records:

- **Mirëbook businesses** are owner-managed, published and bookable through the
  existing `businesses` workflow.
- **Directory places** are source-attributed discovery records. They are not
  bookable, verified, partnered or owner-managed unless a later claim is
  explicitly approved.

The distinction must remain visible in every future API, card, map marker and
claim flow.

## Albania Data Audit

The July 2026 audit compared current public place data and provider terms.

- Overture release `2026-06-17.0` contains approximately 35,986 Albania-coded
  place records.
- A conservative product-aligned classification found approximately 6,267
  appointment, activity, rental and attraction candidates.
- Approximately 4,682 of those candidates had confidence of at least `0.50`;
  approximately 2,435 had confidence of at least `0.75`.
- The aligned pool included substantial coverage in Tiranë, Durrës, Vlorë,
  Sarandë, Shkodër, Korçë, Himarë, Berat and Gjirokastër.
- A 2024 public Foursquare OS Places snapshot contained approximately 13,528
  Albania records, but current Foursquare access now requires its Places Portal.

These counts prove useful discovery density is possible. They do not prove that
every record is current, categorised correctly or suitable for publication.
Overture records can contain stale businesses, duplicates and semantic category
errors. Human review remains mandatory.

The narrower audit counts are directional rather than an import target. The
Batch 1 exporter uses an explicit, versioned category map and must report its
own totals on every run. A count change is a review signal, never permission to
publish more rows automatically.

## Batch 1 Architecture

SQL 19 creates three private, service-managed tables:

### `directory_places`

- stores source ID, source release, source categories and source attribution
- stores private point geometry for future nearby/map discovery
- defaults every import to `listing_status = 'needs_review'`
- tracks `unclaimed`, `claimed` and `disputed` ownership state separately
- can link to one existing Mirëbook business only after claim approval
- cannot be read or written by `anon` or `authenticated` clients

### `directory_import_runs`

- records source release and import counts
- records completion or failure without exposing service credentials
- gives future admin tooling an audit history

### `business_claims`

- records ownership evidence and review state
- requires the claimant to own the selected Mirëbook business
- has no automatic name/address approval path
- uses a service-only admin approval function
- prevents two approved businesses from owning one directory place

SQL 19 does not add browser RLS policies. All browser grants are explicitly
revoked. Future public reads must use a purpose-built server API that returns a
small public-safe shape.

## Import Tooling

### 1. Install the local export dependency

```bash
python3 -m pip install --user duckdb
```

DuckDB is an operator dependency only. It is not included in the Next.js
runtime or Vercel build.

### 2. Export a review queue

```bash
npm run directory:export:albania -- \
  --release 2026-06-17.0 \
  --min-confidence 0.75 \
  --output /tmp/mirebook-albania-directory-2026-06-17.jsonl
```

The default launch set focuses on beauty/grooming, dental, wellness/fitness,
events, lessons, tours, activities, rentals and attractions. Food and lodging
are deliberately optional:

```bash
npm run directory:export:albania -- \
  --include-food-lodging \
  --output /tmp/mirebook-albania-directory-expanded.jsonl
```

The exporter:

- reads Overture's public GeoParquet release directly
- requires an Albania country address and Albania bounding box
- excludes permanently closed places
- defaults to confidence `0.75`
- excludes obvious QA/sample names
- normalises common Albanian city spellings
- preserves source datasets and release attribution
- writes a stable fingerprint for refresh comparison
- never connects to Supabase

### 3. Curate a balanced launch shortlist

Do not import the full Albania export merely because it is available. Produce
a deterministic review-sized shortlist first:

```bash
npm run directory:shortlist -- \
  --input /tmp/mirebook-albania-directory-2026-06-17.jsonl \
  --output /tmp/mirebook-albania-launch-shortlist.jsonl \
  --summary-output /tmp/mirebook-albania-launch-shortlist-summary.json
```

The default selects at most three high-confidence, information-complete records
for each supported category in Tiranë, Durrës, Vlorë, Sarandë, Shkodër, Korçë,
Himarë, Berat and Gjirokastër. It reports empty city/category combinations so
the launch set can be improved deliberately.

The command is local and deterministic. It does not read environment secrets,
connect to Supabase, alter source records or publish anything. The output is
still only an importer input and every imported row remains `needs_review`.

### 4. Validate without writing

```bash
npm run directory:import -- \
  --input /tmp/mirebook-albania-launch-shortlist.jsonl
```

Dry run is the default. It validates every record, refuses mixed releases and
duplicate source IDs, and reports category/city counts. It does not read
Supabase credentials or create an import run.

### 5. Apply only after SQL and sample review

First run `sources/sql/19_albania_discovery_directory_foundation.sql` in the
Supabase SQL editor. Then inspect a representative sample from every category
and major city. Only then run:

```bash
npm run directory:import -- \
  --input /tmp/mirebook-albania-launch-shortlist.jsonl \
  --apply \
  --confirm-review-only-import
```

Apply mode uses the existing local-only/server-only values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

It does not need a new Vercel environment variable. It never prints secret
values. A malformed non-env line in `.env.local` is ignored rather than sourced
as shell code.

Each imported row still remains `needs_review`. Applying an import does not
change Explore, create a public page, enable booking or notify a business.

## SQL 19 Application Checklist

1. Confirm SQL 18 has already installed PostGIS in the `extensions` schema.
2. Run SQL 19 once in the Supabase SQL editor.
3. Confirm the three tables have RLS enabled and no browser policies.
4. Confirm `anon` and `authenticated` have no grants on the new tables or RPCs.
5. Run a small export and importer dry run.
6. Apply no more than a small controlled sample first.
7. Confirm every imported row is `needs_review` and `unclaimed`.
8. Confirm existing `/api/public/explore-businesses` output is unchanged.
9. Confirm anonymous REST reads of all three new tables are denied.
10. Do not set any directory place to `active` until the admin review and
    public-safe API batch is complete.

The SQL file is safe to rerun in the same schema version. It does not delete or
publish records. It must still be treated as a production migration and run
only after a backup/checkpoint.

## Batch 2 - Audited Review and Public-Safe API

SQL 20 adds the visibility gate required before any imported place can be used
by customer discovery.

### Review states and audit

- `needs_review` remains the default and is never public.
- `active` means an admin has reviewed and approved the directory record.
- `hidden` keeps a record private without marking the source business closed.
- `closed` records a reviewed closure decision.
- `duplicate` links the record to a different canonical directory place.
- `directory_place_reviews` stores the reviewer, decision, prior/new state,
  note, source fingerprint and source snapshot for every manual transition.
- Hide, close and duplicate decisions require an operator note.
- A permanently closed source record cannot be approved.
- If a later import changes the source fingerprint of an approved record, the
  record automatically returns to `needs_review` before it can remain public.

The review table remains private. Browser roles receive no table grants or RPC
execution. The admin API verifies the signed-in user and `profiles.is_admin`
before using the existing server service-role client.

### Operator workspace

`/admin/directory` provides a compact review queue with:

- status, name, category and city filters
- source contact, attribution, confidence and update context
- a server-rendered map preview that does not return coordinates or the Mapbox
  token to the browser
- explicit approve, return-to-review, hide, close and duplicate decisions
- an inline confirmation panel instead of native browser prompts
- English and Albanian operator copy

The operator entry point is also linked from the existing admin navigation and
operator dashboard. Before SQL 19 and SQL 20 are applied, it fails safely with
a migration-required message rather than attempting alternate storage.

### Public-safe server API

`GET /api/public/directory-places` is a server boundary for a later discovery
UI. It returns only reviewed `active` records and deliberately identifies every
row as:

- `resultType: "directory_place"`
- `bookable: false`
- claimable only while the ownership state is `unclaimed`

The response omits source place IDs, source confidence, raw attribution JSON,
exact PostGIS values and service credentials. Public directory markers use a
separate `mapPosition` contract snapped to an approximately one-kilometre grid;
the ordinary `location` field and exact source coordinates are not returned.
Every result includes durable source attribution.

This endpoint is **not connected to `/explore` in Batch 2**. Existing bookable
business results, readiness rules and the polished empty marketplace state are
unchanged until the customer discovery batch is explicitly implemented and
QA-approved.

### Environment requirements

No new Vercel variable is introduced. The server paths reuse:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAPBOX_ACCESS_TOKEN` for the optional admin map preview

The Mapbox token remains server-only. Directory review still works if map
preview configuration is unavailable; only the preview action returns a safe
unavailable response.

## SQL 20 Application and QA Checklist

1. Take a Supabase backup/checkpoint and confirm SQL 18/PostGIS is present.
2. Run SQL 19, then run SQL 20 in the Supabase SQL editor.
3. Confirm `directory_places`, `directory_import_runs`, `business_claims` and
   `directory_place_reviews` have RLS enabled and no browser policies/grants.
4. Confirm anonymous and normal authenticated reads of all directory tables
   are denied.
5. Confirm a non-admin session receives `403` from
   `/api/admin/directory-places`.
6. Import only a small reviewed QA sample and confirm every row starts as
   `needs_review` and does not appear in the public API.
7. As an admin, inspect source details/map and approve one disposable place.
8. Confirm the public API returns that record once with `bookable: false`, a
   coarse `mapPosition` and Overture attribution, without a `location` field,
   source IDs, confidence, raw geometry or tokens.
9. Confirm `/explore` remains unchanged and does not show the directory row.
10. Hide the disposable place and confirm it disappears from the public API.
11. Exercise close, duplicate and return-to-review on disposable records and
    confirm each decision creates one audit row.
12. Reapprove one disposable record, change its source fingerprint through a
    controlled re-import, and confirm it returns to `needs_review`.
13. Finish QA with all disposable directory records hidden or awaiting review.

SQL 20 is rerunnable for this schema version. It preserves imported places and
review history, recreates its constraints/functions/trigger safely, and does
not approve, delete or publish any record by itself.

## Batch 3 - Customer Discovery and Map

Explore now presents one customer-facing discovery surface for two deliberately
different result types:

- ready, published Mirëbook businesses keep their existing booking page and
  show `Book instantly` or `Request appointment`
- admin-reviewed directory places show as `Local place`, include source
  attribution and clearly state that they are not bookable on Mirëbook yet

The default List view combines both result types without converting directory
records into business records. Map view uses the same active search, category
and city filters. Selecting a bookable marker opens the existing business
booking profile; selecting a directory marker shows discovery information only.

### Nearby discovery and privacy

`Use my location` is an explicit customer action. Mirëbook does not request
location on page load, write customer coordinates to Supabase, put them in the
Explore URL or persist them in browser storage. Browser coordinates are reduced
to four decimal places before they are sent in an ephemeral POST body to the
two public server endpoints for the active request, and those responses use
`private, no-store` caching. Coordinates are not placed in request URLs.

SQL 22 adds service-only RPCs for:

- rounded map points for already-published, verified business locations
- reviewed directory search with optional PostGIS distance ordering

Public business responses retain their existing owner-verified map position.
Directory responses expose only the separate approximately one-kilometre
`mapPosition` grid. Exact PostGIS values, Mapbox server credentials, source
IDs and confidence values remain private. If location is declined or
unavailable, city/category search continues to work normally.

### Customer correction path

Every directory card keeps durable source attribution and has a `Report
details` action. That action opens customer support with the place name and a
record reference prefilled. It does not let a customer edit directory data or
claim ownership directly.

### Environment requirements

The map requires a separate browser-safe Mapbox public token:

- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

Create a public token restricted to the production and preview origins that
need the map. Never copy the server-only `MAPBOX_ACCESS_TOKEN` into this value.
If the public token is absent or Mapbox cannot load, Explore keeps the complete
List view and shows a calm map fallback.

### SQL 22 application and QA checklist

1. Take a Supabase backup/checkpoint.
2. Confirm SQL 18, SQL 19 and SQL 20 have already run successfully.
3. Run `sources/sql/22_customer_discovery_map_foundation.sql`.
4. Confirm both new RPCs are executable only by `service_role`.
5. Confirm anonymous/authenticated direct RPC calls are denied.
6. Add a URL-restricted `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to Vercel Production
   and Preview, then redeploy.
7. Keep all directory records private except a small reviewed QA sample.
8. Confirm an approved directory place appears once as `Local place`, carries
   attribution and has no booking action.
9. Confirm a ready published Mirëbook business appears once and still opens the
   existing booking flow.
10. Confirm List and Map use the same search/category/city result set.
11. Confirm location is requested only after `Use my location` is tapped.
12. Confirm denial leaves city search usable and exposes no raw provider error.
13. Confirm nearby responses use `private, no-store`, return approximate map
    points and do not expose Mapbox tokens, PostGIS values or source IDs.
14. Confirm `Report details` preserves its place context through customer
    login and pre-fills the support message.
15. Verify EN/SQ copy and 390px mobile layout, then hide the QA sample again.

SQL 22 is rerunnable for this schema version. It creates or replaces functions
only; it does not import, approve, publish, link, claim or delete any record.

## Data Presentation Rules

Future directory UI must follow these rules:

- Label imported results as directory places, not Mirëbook partners.
- Never show `Book now` until a place is linked to a published, ready Mirëbook
  business with real services, staff and availability.
- Use `View details`, `Directions` or `Claim this place` for unclaimed records.
- Show source attribution in a durable About/data-sources surface.
- Never expose raw source confidence, source record IDs, exact private geometry
  payloads or service keys to clients.
- Let an owner report wrong/closed/duplicate data.
- Never approve ownership from a similar name or address alone.
- Preserve existing claimed-business publishing/readiness rules after linking.

## Protected Systems Untouched

Batches 1 through 5 do not change:

- existing Explore listing/readiness rules
- booking creation, availability or lifecycle
- business publishing behavior
- role separation, auth, RLS or staff linking
- owner-as-staff behavior
- billing, notifications, email or reminders
- saved customer location or browser permission defaults
- current business location verification
- Business/Staff iOS app behavior

## Next Batches

### Batch 4 - Claim Flow

Implemented:

- `/places/[placeId]` gives each reviewed directory result a public-safe detail
  page with directions, source attribution, reporting and ownership context.
- `Claim this place` crosses into Mirëbook Business without offering customer
  or staff registration as ownership choices.
- Business login, registration, verification and resend flows preserve the
  internal `/claim/[placeId]` return path.
- `/claim/[placeId]` shows only businesses owned by the signed-in claimant.
  Name, city and phone similarities are displayed only as suggestions and
  never select, link or approve ownership automatically.
- Claim evidence is reduced before storage. Email evidence stores the domain,
  phone evidence stores only the final four digits, and document/other evidence
  stores a description rather than a document upload.
- `/admin/directory-claims` provides an operator queue for approve, request
  more information and reject decisions with no native browser prompts.
- Approved claims link the directory record to the existing business, then
  return the owner to the existing Setup workspace. Approval does not publish
  the business or change booking readiness.
- Claimed directory results are removed from the combined Explore list only
  when their linked, ready business is already present, preventing duplicate
  cards without hiding a claimed-but-not-yet-live place.

SQL 24 adds a private append-only claim event trail and service-only submit and
review functions. Browser roles keep no direct access to `business_claims` or
`business_claim_events`. The earlier SQL 19 approval function is replaced with
an audited compatibility wrapper.

### SQL 24 application and QA checklist

1. Confirm SQL 19 and SQL 20 have already run successfully.
2. Run `sources/sql/24_directory_business_claim_workflow.sql` in Supabase.
3. Confirm `business_claim_events` has RLS enabled and no `anon` or
   `authenticated` grants or policies.
4. Confirm the submit/review RPCs are executable only by `service_role`.
5. Approve one disposable directory place and open its public detail page.
6. Start a claim logged out and confirm Business login/register retains the
   exact place ID through email verification.
7. Confirm a customer-only or non-owner account cannot submit a claim for a
   business it does not own.
8. Submit a disposable owner claim and confirm it remains `pending`, while the
   place remains non-bookable and the business publication state is unchanged.
9. Request more information as admin, confirm the owner sees the note, then
   resubmit and confirm a claim event is appended.
10. Approve the claim and confirm the place links to that exact owned business,
    competing open claims are rejected, and the owner is sent to Setup.
11. Confirm approval does not publish the business, create services/staff,
    change readiness or alter any booking rule.
12. Verify EN/SQ and 390px layouts, then leave no disposable active claim or
    published QA business in customer discovery.

SQL 24 is rerunnable for this schema version. It does not create, approve or
reject a claim merely by being applied.

### Later claim follow-ups

- optional secure document upload after a private storage policy is designed
- operator notifications when a new claim arrives
- owner claim-history entry inside Setup if claim volume justifies it

## Batch 5 - Customer-First Launch Surface

The customer homepage now starts with discovery rather than product
explanation. It presents one clear Albania search for services, activities and
places, followed by compact category and city shortcuts. A project-owned hero
image was generated for Mirëbook and stored locally at
`public/mirebook-customer-discovery-hero.jpg`; it does not represent a real
partner business.

Explore now has an explicit result-type control:

- `All` combines ready Mirëbook businesses and reviewed directory places.
- `Bookable` shows only ready Mirëbook businesses with the existing booking
  journey.
- `Places` shows only reviewed directory places with details, directions and
  ownership context.

The selected result type stays in the Explore URL and is preserved when the
customer changes between List and Map. Broad homepage category shortcuts use
stable directory category keys. Existing business categories are matched to
those broad groups with presentation-only keywords; no business record or
category value is rewritten.

Location remains opt-in. The homepage and Explore do not request location on
load, and this batch adds no saved customer coordinates, database schema, SQL,
RLS policy or new booking behavior.

### Batch 5 deployment QA

1. Confirm the homepage image, search and first browse section render at
   1440x900 and 390x844 with a hint of browse content below the hero.
2. Confirm homepage search preserves What and Where values in the Explore URL.
3. Confirm each category and city shortcut opens a filtered Explore view.
4. Confirm `All`, `Bookable` and `Places` update the URL and visible result
   types without changing any underlying record.
5. Confirm `Bookable` contains no directory-place card and `Places` contains no
   Mirëbook booking card.
6. Confirm the result-type selection survives List/Map switching and Clear
   returns to `All`.
7. Confirm location is requested only after `Use my location` is selected.
8. Verify EN/SQ copy, keyboard focus, selected control states and no horizontal
   overflow on mobile.
9. Confirm no unpublished business or unreviewed directory record appears.
10. Confirm business registration links stay on Mirëbook Business and existing
    customer booking routes still work unchanged.

Production QA passed in English and Albanian at 1440x900 and 390x844. It
confirmed homepage-to-Explore search transfer, category and city shortcuts,
the `All` / `Bookable` / `Places` URL state, List/Map state preservation, Clear
returning to `All`, and opt-in-only location handling with a graceful city
fallback when location was unavailable. No horizontal overflow, clipped text,
raw translation keys, console errors or visible unpublished/unreviewed records
were found.

One assertion remains data-blocked rather than failed: production had no live
business or directory cards, so QA could not visually prove mixed-result type
separation. Before a populated marketplace launch, rerun item 5 with one
controlled ready published business and one controlled approved directory
place, then return both records to their prior safe state.

## Batch 6 - Launch Curation and Coverage

Batch 6 turns the existing private directory pipeline into a controlled launch
workflow without adding a bulk-publish path.

### Deterministic shortlist

`scripts/directory/curate-launch-shortlist.mjs` takes the full validated
Overture export and produces a smaller, balanced JSONL file for operator
review. Selection is deterministic and favours source confidence, contact
completeness and recent source updates. It caps each city/category combination,
removes obvious same-place candidates within a combination and reports
coverage gaps.

The shortlist command:

- never connects to Supabase
- never changes source records
- never sets a listing status
- never approves or publishes a place
- preserves the normal importer as the only write path

### Exact admin coverage

SQL 26 adds `mirebook_admin_directory_launch_coverage()`, a read-only aggregate
that is executable only by `service_role`. It returns counts grouped by city,
category and existing listing status. It has no write statement and cannot
import, review, publish, claim or edit a place.

`/admin/directory` uses that aggregate to show compact launch coverage for the
nine priority cities and supported categories. Each row opens the existing
private review queue, preferring records awaiting review and falling back to
already approved records. The existing one-place-at-a-time audited decision
flow remains the only approval control.

If SQL 26 has not been run, the review queue continues to work and the page
shows a migration note instead of guessing at coverage.

### Batch 6 application and QA

1. Run `sources/sql/26_directory_launch_coverage.sql` after SQL 19 and SQL 20.
2. Confirm the new RPC executes with `service_role` and is denied to `anon` and
   `authenticated`.
3. Run the shortlist command twice against the same export and confirm the
   JSONL and summary outputs are identical.
4. Validate the shortlist through `directory:import` without `--apply` first.
5. Confirm the summary identifies empty city/category combinations and the
   selected count never exceeds the configured per-combination cap.
6. Import only the controlled shortlist with the explicit review-only
   confirmation flag.
7. Confirm all imported rows remain private `needs_review` records and Explore
   is unchanged.
8. Open `/admin/directory` and compare the city/category totals with direct
   read-only SQL counts.
9. Use a coverage row to open its queue, review one disposable record and
   confirm only that record changes status with one audit row.
10. Confirm no bulk approval control exists, EN/SQ copy is complete and the
    coverage section has no horizontal overflow at 390px.

SQL 26 is idempotent for this schema version and performs no data mutation.
It also requests a PostgREST schema-cache refresh after the function is
created.

Production QA confirmed the shortlist is deterministic, respects the configured
city/category cap, skips duplicate candidates and leaves importer output at
private `needs_review` in dry-run mode. Admin and public role boundaries passed,
and Explore remained unchanged. Initial exact-coverage QA was blocked because
the production database returned `PGRST202` for the missing SQL 26 function.
After SQL 26 was applied, the service-role RPC succeeded and anonymous
execution was denied with `42501`. No directory records are currently imported,
so the aggregate correctly returns no source rows while the admin UI presents
the defined city/category matrix with zero totals. The follow-up also replaces
the overflowing mobile Operator link row with a compact menu and keeps the
admin-denial message fully localized.

The deployed follow-up retest passed with no findings. It rendered all nine
priority cities and ten categories, kept the desktop document at 1440px and the
mobile document at 390px with the Operator menu both closed and open, denied
anonymous/customer/business/staff access, and left anonymous Explore unchanged
with no directory records exposed.

## Batch 7 - Controlled Private Launch Seed

Batch 7 creates a manageable operator review queue without changing the public
marketplace.

### Source and shortlist

- Source: Overture Maps Foundation Places release `2026-06-17.0`
- Source confidence floor: `0.75`
- Exported product-aligned Albania candidates: `2,386`
- Launch cities: Tiranë, Durrës, Vlorë, Sarandë, Shkodër, Korçë, Himarë,
  Berat and Gjirokastër
- Included categories: beauty and grooming, dental health, wellness and
  fitness, events, learning and lessons, tours and activities, rentals and
  attractions
- Food and accommodation: deliberately excluded from this first seed
- Shortlist cap: one record per city/category
- Shortlisted records: `57`
- Shortlist SHA-256:
  `1d1da600c5b5397538e25cc660e0359e4f8cd1334abab9453c60b8b29c376a18`

The shortlist was generated twice. Both JSONL outputs had the same hash. All 57
records had unique source IDs and fingerprints, an address and an Albania
location. Fifty-three included a phone, 37 a website, 40 an email and 55 at
least one social URL. No record was marked permanently closed.

The shortlist is candidate data, not a recommendation or verification. Some
source categories are adjacent rather than exact, and source contact details
can be stale. Every record therefore requires individual operator inspection.

### Production import

The importer dry run validated all 57 records before apply mode was used with
the explicit review-only confirmation.

- Import run: `4cb75b56-6b03-4b9b-b90d-90accbec2ee7`
- Processed: `57`
- Inserted: `57`
- Updated: `0`
- Skipped: `0`
- Failed: `0`
- Resulting status: `57 needs_review`
- Claim status: `57 unclaimed`
- Public listings created: `0`

Read-only production verification matched the importer output and the SQL 26
coverage aggregate. Direct anonymous table reads remained denied with `42501`.
The public directory API returned zero records, the existing business API
returned zero published businesses and anonymous Explore kept its polished
launch empty state.

The Admin Directory UI loaded all 57 candidates, showed exact per-city and
per-category review totals, and exposed source/contact/provenance context for
individual review. It showed `0 Approved`.

Independent deployed QA passed with no P0, P1 or P2 findings. It confirmed the
exact nine-city and eight-category totals, filtering, pagination through
records 51-57, private source detail, one-record-at-a-time controls and the
absence of bulk approval. Anonymous Explore remained empty in EN and SQ across
All, Bookable and Places in List and Map views. Anonymous direct table access
was denied with `401 / 42501`, non-admin roles received localized denial copy,
and the directory workspace had no clipping or horizontal overflow at
1440x900 or 390x844. No record or setting was changed during QA.

### Review protocol

1. Review one place at a time in `/admin/directory`.
2. Verify name, category, address, current operation, contact details and map
   position from reliable sources before approval.
3. Correct or reject category-adjacent records rather than approving them for
   the sake of filling a coverage gap.
4. Use `duplicate`, `closed` or `hidden` with a clear operator note when
   appropriate.
5. Approve only a small launch-quality set for each city/category.
6. After each review session, confirm public totals match the exact approved
   count and that no `needs_review` row appears through the public API.
7. Keep imported directory places visibly non-bookable and distinct from
   owner-managed Mirëbook businesses.

## Batch 8 - First Reviewed Public Set

Batch 8 moves only a small, evidence-backed set through the existing audited
one-place-at-a-time approval flow. Category coverage was not treated as a
reason to approve weak data.

### Approved places

| Place                     | City        | Category             | Current source checked                             |
| ------------------------- | ----------- | -------------------- | -------------------------------------------------- |
| City Dental Clinic        | Tiranë      | Dental health        | Official clinic website                            |
| Bunk'Art 2                | Tiranë      | Attractions          | Tirana Municipality and current museum information |
| Geraldina Sposa           | Tiranë      | Events               | Official business website                          |
| Cimi Stil Unik            | Durrës      | Beauty and grooming  | Official business website                          |
| Balikci Dental            | Vlorë       | Dental health        | Official clinic website                            |
| Helen Doron English Vlorë | Vlorë       | Learning and lessons | Official Helen Doron Albania centre page           |
| Kopliku Travel            | Shkodër     | Tours and activities | Official agency website                            |
| Experience Gjirokaster    | Gjirokastër | Tours and activities | Official agency website                            |

For each approval, the operator compared the imported name, category, current
operation, address, contact details and map context with the current source,
then saved a dated review note. The review audit remains visible in Admin
Directory.

Candidates with material uncertainty remained private. Examples include a
wellness website now redirecting to an unrelated business, stale or conflicting
addresses for rental and learning records, changed phone/email details for
marine operators, a guide record that did not represent Butrint itself, an
Osum Canyon point located in Berat rather than near the canyon, and a museum
record without sufficiently strong current evidence. None was approved merely
to fill a city or category gap.

### Production result

- Admin status: `8 active`, `49 needs_review`, `0 hidden`, `0 closed`,
  `0 duplicate`
- Claim status: all eight remain `unclaimed`
- Public directory API: exactly eight records
- Public cards: labelled `Local place` / `Vend lokal`
- Booking boundary: every directory record reports `bookable: false`; the
  Bookable result type returns no directory cards
- Public payload: no source ID, source confidence, provenance payload or
  operator review fields
- Details: phone/website/directions/report and moderated claim route work
- List and Map: all eight records render in EN and SQ on desktop and 390px
- Direct anonymous table access: denied with `401 / 42501`
- Browser logs: no warnings or errors during the closure pass

Production Map initially showed its safe unavailable state because only the
server-side Mapbox variable existed. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` was
added to the Vercel Preview and Production environments using the existing
public Mapbox token, then the previous clean production deployment was rebuilt.
The public map subsequently loaded all eight markers with Mapbox/OpenStreetMap
attribution and no horizontal overflow.

Rollback remains one-place-at-a-time: use Admin Directory to hide any record
whose operation, identity, category or location can no longer be confirmed.
Hiding a directory record does not affect Mirëbook businesses, booking logic
or claim ownership.

## Batch 9 - Reviewed Discovery Polish

Batch 9 closes the non-blocking issues found during the first reviewed public
set QA without changing directory records, approval state or discovery
boundaries.

- Admin Directory no longer renders initialized zero totals or SQL migration
  guidance while its first authenticated response is still loading. Stable
  summary and coverage placeholders hold the layout until real data arrives.
- Public map markers that project onto the same small screen area are spread
  around their source point and recalculated after map movement or resizing.
  Each reviewed place therefore remains independently clickable at the default
  Albania overview while returning to its exact map position as the user zooms.
- Mapbox controls, accessibility labels and cooperative-gesture guidance now
  follow the selected EN/SQ language. The underlying provider attribution
  remains visible.

This is presentation-only work. It does not alter source coordinates, public
payloads, approval workflow, booking behavior, claims, auth, RLS or database
schema.

## Batch 10 - Public Directory Map Boundary

Batch 10 closes the public payload issue found during Batch 9 deployed QA.

- Exact directory geometry remains server-only for PostGIS filtering and
  distance ordering.
- Public directory rows no longer contain `location.latitude`,
  `location.longitude` or an approximately-ten-metre precision claim.
- The map receives only `mapPosition`, deterministically snapped to a
  0.01-degree grid (approximately one kilometre in Albania).
- Customer-facing distance is rounded to 250-metre steps so the response
  cannot be combined with a precise customer point to infer the source point.
- Nearby discovery sends the already-rounded customer point in a POST body
  rather than exposing it in an API request URL.
- Both nearby endpoints return `private, no-store` even when the marketplace
  currently has no matching businesses or places.
- Address, directions and place details continue to provide the useful public
  destination context, while map pins deliberately indicate an approximate
  area.

No source row, approval, claim, booking, auth, RLS, billing or schema behavior
changes in this batch.

## Batch 11 - Claim-to-Business Conversion Closure

Batch 11 turns the existing audited ownership workflow into a visible
end-to-end conversion loop without weakening its approval boundary.

- A genuinely new claim or a resubmission creates one owner update and one
  operator update. Repeating a pending submission does not create duplicate
  notifications or emails.
- The operator receives an in-app notice with a deep link to the exact claim
  in the existing admin notice feed and, when configured, an email at
  `SUPPORT_ADMIN_EMAIL`.
- The owner receives a localized EN/SQ in-app update and branded email when a
  claim is received, needs more information, is approved or is rejected.
- If approval closes competing open claims, each affected owner receives the
  same localized rejected-state update without exposing the approved claimant.
- Business Setup shows the latest ownership state as one compact row. Only the
  relevant action is offered: view the request, add information, review the
  decision or view the linked place.
- The owner claim API enriches private owner-scoped claims with the safe place
  name/address context needed by Setup. It does not expose claim records to
  public or unrelated accounts.
- Approval still only links the reviewed directory place to the exact
  owner-managed business selected in the claim. It does not publish the
  business, create services or staff, change availability, or bypass Setup
  readiness.
- Existing Explore de-duplication remains authoritative: a linked directory
  card is suppressed only when the corresponding ready published business is
  already present.

This batch reuses SQL 24 and requires no new SQL, table, policy or RLS change.
Email failures are logged but never roll back or misrepresent the authoritative
claim transition.

### Batch 11 approval follow-up

Deployed lifecycle QA exposed an audit-vocabulary mismatch in the original SQL
24 review function: the actions `approve` and `reject` were written directly as
event types, while the immutable event table accepts `approved` and `rejected`.
SQL 28 replaces only that function and normalizes both action names before the
event insert. It changes no claim eligibility, approval result, publication
state, role boundary, schema or RLS policy.

Focused approval QA then exposed stale direct-place details after an operator
hid the disposable fixture. The database query already required an active
listing; the stale response came from the direct detail endpoint's CDN window.
Direct place details now use `private, no-store`, and the public page explicitly
bypasses browser caching so a hidden or closed record becomes unavailable
immediately. List and map cache behavior is unchanged.

## Batch 12 - Claimed Place Handoff

An approved ownership claim remains only a link until the existing business
passes the same public readiness checks used by Explore. Once that linked
business is both published and bookable, an old directory-place URL hands the
customer to the live business profile instead of continuing to describe the
place as non-bookable.

The handoff fails closed. Hidden, unpublished or incomplete businesses leave
the reviewed directory place as the non-bookable fallback. Claim approval
still does not publish a business, modify Setup, create availability or bypass
any booking-readiness rule. Explore's existing place/business de-duplication
continues to show one result when the linked business is live.

If the live business has not yet verified its own map location, the Map view
uses the linked directory place's already-public approximate map position as a
temporary fallback. The marker still opens the live business profile, exact
directory coordinates remain private, and a subsequently verified business
location takes precedence automatically.

Focused handoff QA exposed a shared-cache race: an old directory response could
omit the newly activated claimed place during publication, then retain it after
the operator hid it again. Public directory and bookable-business collections
now use `private, no-store`, and Explore explicitly bypasses browser caching.
Publication and directory visibility therefore come from current database
state rather than a stale CDN window. No record, readiness rule or public
payload field changed.

The first cache-free retest then exposed a client ordering issue: Explore
removed the linked directory record before the Map could use its approximate
position. Explore now retains the raw active directory result as internal map
context and applies de-duplication only when building visible cards and place
markers. Public result totals continue to count the live business once and do
not count its suppressed directory identity.

### Batch 12 closure QA

Deployed production QA passed the complete controlled handoff:

- the active claimed place remained a non-bookable directory result while its
  linked business was hidden
- publishing the ready linked business produced one business card, one
  business marker and no duplicate place identity
- All showed nine results/markers, Bookable showed the one linked business and
  Places retained only the eight genuine reviewed places
- selecting the fallback marker opened the exact live business booking profile
- public geometry remained limited to the approximately-one-kilometre
  `mapPosition`
- hiding the business restored the directory fallback immediately
- hiding the disposable fixture removed it immediately from collection and
  detail APIs

Final production cleanup left the QA business in draft, the fixture hidden,
Admin Directory at `8 approved / 1 hidden`, and anonymous discovery at the
eight genuine reviewed places. No genuine record or protected booking,
readiness, billing, auth or role behavior changed.

## Batch 13 - Reviewed Catalogue Content

Batch 13 adds a controlled content-quality layer for Albania discovery.
Owner-managed businesses continue to use their existing profile description
and uploaded business cover image. Reviewed directory places can now receive:

- concise English and Albanian editorial descriptions
- one Mirëbook-hosted public photo
- localized image alt text
- a visible photographer, owner or source credit
- an optional public licence/source link
- a private operator note recording the permission or licence basis

SQL 29 adds only optional editorial columns to `directory_places`. It does not
change imported source fields, listing status, approval, ownership claims,
business publication, booking readiness or RLS. The admin editor is
single-place only and requires an explicit image-rights confirmation before a
photo can be saved.

Public list and detail APIs fail closed: only active reviewed places can expose
the selected localized description and sanitized HTTPS photo metadata. The
private rights note, editor identity, source IDs, confidence, provenance and
exact coordinates are never returned. If SQL 29 has not yet run, existing
directory discovery continues without editorial imagery and Admin Directory
shows the migration requirement.

Explore uses the reviewed image when available and retains its compact category
fallback otherwise. Descriptions are line-clamped on cards and shown in full on
the place page; photo attribution is visible on both surfaces.

## Batch 14 - Reviewed Facts And Catalogue Expansion

Batch 14 separates imported source data from the current facts Mirëbook has
personally checked. SQL 30 adds optional public overrides for name, category,
address, postcode, phone and website. Enabling those fields requires:

- a secure private evidence URL
- a private dated review note
- a valid public name and supported category
- an authenticated operator action

Imported facts remain unchanged for provenance and refresh comparison. Private
evidence, operator notes and editor identity never enter public payloads.
Disabling the override returns the place to its imported facts without changing
approval or ownership state.

SQL 31 then prepares twelve existing private candidates for individual
operator review:

- Nomad Camper Hire and VATO in Berat
- Ethnographic Museum of Gjirokastër
- Himara Nautica One
- Bratko Museum of Oriental Art in Korçë
- Butrint National Park, Enterprise Sarandë Port and Marin Yacht Agency
- Lake Koman, Marubi Dental Center and Cuni Auto in Shkodër
- FuturA+ Education Academy in Tiranë

Each candidate receives a concise English and Albanian description plus
current reviewed public facts. Five receive reusable Wikimedia Commons
photographs with visible attribution and private licence notes. Generic
destination photographs are labelled honestly and are never presented as
business premises or owner-supplied media. Records without a strong,
clearly-reusable photograph retain the existing category fallback.

Primary review sources include the operators' own current websites, Albania's
National Tourism Agency, the Municipality of Korçë and the corresponding
Wikimedia Commons file pages. SQL 31 is deterministic and does not alter
`listing_status`, `claim_status`, imported source fields, ownership, business
publication or booking behavior. Every record therefore remains private until
an operator inspects and approves it one at a time in Admin Directory.

### Batch 14 operator sequence

1. Finish any QA that depends on the current `8 approved / 1 hidden` baseline.
2. Apply SQL 29, SQL 30 and SQL 31 in numerical order.
3. Open each of the twelve records in Admin Directory and check the reviewed
   facts, bilingual copy, source evidence, map location and image attribution.
4. Approve only records that still match their current source and map context.
5. Check EN/SQ List, Map and direct detail after each small approval group.
6. Hide an individual record immediately if its identity, operation, category,
   location or image rights become uncertain.

### Batch 14 closure QA

Production QA approved all twelve records individually and left the catalogue
at `20 approved / 37 needs review / 1 hidden`. Public List and Map both showed
twenty non-bookable places, all five licensed photographs loaded with visible
attribution, and the remaining records retained clean category fallbacks.
EN/SQ, desktop/mobile, private evidence, coarse-map-position and anonymous
table-access boundaries passed.

The only follow-up was a duplicated photo prefix when an attribution label
already contained `Photo:`. Public rendering now removes a stored English or
Albanian photo prefix before adding the selected language's single localized
label. Stored attribution and licence evidence remain unchanged. Focused
production QA then passed Lake Koman and VATO cards/details in EN and SQ at
desktop and 390px, with one localized credit, working Wikimedia links, loaded
images and no remaining P0/P1/P2 finding.

## Batch 15 - Durres And Vlore Catalogue Depth

Batch 15 strengthens the launch catalogue where customer discovery was still
thin rather than adding another marketplace feature. SQL 32 prepares ten
existing private candidates for individual operator review:

- Dental Center Durres, Klinika e Fizioterapise AD-AR, Elements Beach Bar and
  Lider Center in Durres
- Golden Gym, Emiral Beach, Sole Agjensi and Albi Tattoo & Piercing in Vlore
- Enterprise Rent-A-Car Tirana City and Advanced Hair Transplant Clinic in
  Tirana

The group adds dental, wellness, learning, tours, rentals and beauty coverage.
Elements Beach Bar and Emiral Beach also become the first reviewed
food-and-drink candidates in the launch catalogue. Each record receives
concise English and Albanian copy plus current reviewed contact facts.

Elements Beach Bar and Emiral Beach receive reusable Wikimedia Commons
destination photographs with visible attribution and private licence notes.
The images represent Gjiri i Lalzit and the Vlore coast respectively; neither
is described as a photograph of the business premises. The other eight
records retain the category fallback because no sufficiently clear reusable
business photograph was found.

Source review used current operator pages where available, current local or
claimed venue listings for businesses without an active website, the Albanian
tourism-agency register as a secondary identity check, and the corresponding
Wikimedia Commons file pages. The review deliberately excluded candidates
whose domains no longer resolve, redirect to unrelated property content,
present unfinished sites, have mismatched contact details, or cannot be
classified confidently. In particular, Nobis, Hera Holiday, Bbelva Motors,
Cobo Center, Silhouette Sports Center and the weakly classified Himare lodging
record were not promoted into this batch.

SQL 32 is deterministic and does not alter `listing_status`, `claim_status`,
imported source facts, ownership, business publication, booking behavior or
RLS. All ten records therefore remain private until an operator reviews and
approves them one at a time.

### Batch 15 operator sequence

1. Apply SQL 32 after SQL 29, SQL 30 and SQL 31.
2. Confirm the result lists exactly ten reviewed records and leaves every one
   in `needs_review`.
3. In Admin Directory, inspect each record's current source, map position,
   reviewed facts and bilingual description before taking any action.
4. For Elements Beach Bar and Emiral Beach, verify the photograph, alt text,
   single localized credit, Commons source page and licence.
5. Approve records individually. Do not use a bulk action and stop on any
   identity, location, contact, category, content or image-rights mismatch.
6. After each city group, inspect EN/SQ Places List, Map and one direct detail
   at desktop and 390px.
7. Confirm Bookable contains no directory records, private evidence remains
   absent from public APIs, and the hidden ownership fixture stays hidden.

### Batch 15 closure QA

Production QA passed with no P0, P1 or P2 finding. All ten prepared records
were reviewed and approved individually, moving the catalogue from 20 approved
and 37 awaiting review to 30 approved and 27 awaiting review. The hidden QA
fixture remained hidden.

EN/SQ Places List and Map showed 30 matching, individually selectable places
at 1440x900 and 390x844. Bookable contained no directory result. The Elements
Beach Bar and Emiral Beach destination images loaded with one localized credit
and working Commons licence links; the other eight records used intact
category fallbacks.

Public payload QA found no evidence URLs, operator notes, updater identity,
provenance, confidence, source IDs, exact geometry or exact coordinates. Map
positions remained at `approximately_1km`, anonymous table access was denied,
the hidden fixture API returned a no-store 404, and no business became
published or bookable.

## Batch 16 - Claim-Ready Local Business Catalogue

Batch 16 adds an outreach-first layer to catalogue curation. SQL 33 prepares
ten existing private candidates that are practical prospects for Mirëbook
onboarding:

- Xhardo Dental Center and Suela Beauty Salon in Berat
- Klinika Dentare Hashoti and La Barberia Vrako in Gjirokastër
- Klinika Orkiderma, Commando Arena and 3H House of Horses near Korçë
- Emilio's Barber Shop in Sarandë
- Reni Barbershop and Autoshkolla EDBI in Shkodër

These candidates were selected because their services naturally involve an
appointment, lesson, session or reservation; they have a direct owner contact
path; they appear independently operated; and their current public presence
does not offer a clear modern end-to-end booking experience. This makes them
more practical launch conversations than a large chain or an attraction that
cannot become bookable.

Selection is not consent. Mirëbook must not describe a candidate as wanting
promotion, agreeing to join or endorsing the platform until the owner has
explicitly agreed. Source-reviewed directory approval, business ownership
claiming and promotional treatment remain three separate decisions.

The review rejected candidates with dead domains, mismatched websites,
uncertain identity or stronger existing booking-platform dependence even when
their imported confidence score was high. No unlicensed business photographs
are attached. Category fallbacks remain until an owner provides authentic
media or a clearly reusable image is independently verified.

SQL 33 is deterministic and does not alter `listing_status`, `claim_status`,
ownership, business publication, booking behavior or RLS. All ten records
remain private until an operator reviews and approves them individually.

### Batch 16 operator sequence

1. Complete the SQL 32 review before starting SQL 33 so catalogue totals stay
   easy to reconcile.
2. Apply SQL 33 after SQL 29 and SQL 30.
3. Confirm exactly ten rows are returned, every row remains `needs_review` and
   no image is attached.
4. Review the current identity, address, contact route, category, bilingual
   description and private evidence for each candidate.
5. Approve records individually only when the public listing is factually
   supportable. Approval does not claim that the owner has joined Mirëbook.
6. For outreach, record owner consent outside the public description before
   offering feature placement, onboarding help or promotional copy.
7. After each city group, inspect EN/SQ Places List, Map and one detail page at
   desktop and 390px.
8. Confirm Bookable contains no unclaimed directory records, private evidence
   remains absent from public APIs and the hidden ownership fixture remains
   hidden.

### Batch 16 approval QA and map follow-up

Production review approved all ten prepared records individually. Catalogue
totals moved from 30 approved and 27 awaiting review to 40 approved and 17
awaiting review; the hidden ownership fixture remained hidden. Places List,
public API boundaries, EN/SQ rendering, direct details and the 390px list all
passed without exposing review evidence, source IDs, exact geometry or exact
coordinates.

The first Map pass found one interaction defect: after selecting Emilio's
Barber Shop, selecting Autoshkolla EDBI could leave Emilio's summary active.
The marker itself was valid. Selecting a place automatically recentred the
whole Albania map, which moved distant markers outside the clipped map while
leaving their Mapbox DOM nodes discoverable to automation.

The follow-up implementation keeps the current map extent when a visible
marker is selected. It also separates Mapbox's positioning element from the
real 44px marker button, preserving button semantics, keyboard focus and an
explicit `aria-pressed` state instead of allowing Mapbox to convert the
interactive element to an image role. Local EN/SQ verification confirmed the
Emilio-to-EDBI sequence updates the exact summary while the map remains at the
Albania overview.

The focused deployed retest passed the exact regression at 1440x900 in SQ:
Places reported 40 results and 40 labelled marker buttons, Emilio selected
correctly, then EDBI immediately replaced it without a reload, and the sole
pressed state moved to EDBI. The public API remained at 40 places, Bookable
remained empty and the hidden fixture remained absent. Reverse-order,
cluster, mobile, keyboard and final console checks were interrupted by the
Browser automation session rather than by a reproduced product fault. Those
are retained as ordinary regression coverage, not as Batch 16 blockers.
Batch 16 is closed.

## Batch 17 - Legacy Catalogue Quality Pass

Batch 17 brings the eight original approved directory records into the same
reviewed-content standard as the later launch catalogue. Before this pass they
were the only active records without reviewed public facts or bilingual
editorial descriptions:

- Bunk'Art 2, Geraldina Sposa and City Dental Clinic in Tirana
- Cimi Stil Unik in Durres
- Helen Doron English Vlore and Balikci Dental in Vlore
- Kopliku Travel in Shkoder
- Experience Gjirokastra in Gjirokaster

SQL 34 replaces only their public presentation fields with current,
source-reviewed names, categories, addresses, contact routes, official
websites and concise English/Albanian descriptions. Current first-party
sources were used throughout: the Bunk'Art museum site, Geraldina Sposa,
Cimi, City Dental Clinic, Helen Doron Albania, Balikci Dental, Kopliku Travel
and Experience Gjirokastra.

Bunk'Art 2 receives a photograph of its actual exterior by Andrew Milligan
sumo under CC BY 2.0. Experience Gjirokastra receives a destination image of
Rruga Gjin Zenebisi by Radoslaw Botev under CC BY 3.0 Poland; the private
rights note and alt text explicitly avoid presenting it as the agency's
premises. The other six records retain category fallbacks because their
operator-owned media does not provide clear reusable rights.

This is a content-quality migration, not a publication or ownership action.
SQL 34 requires all eight target records to still be active, leaves imported
facts intact, and does not alter `listing_status`, `claim_status`, ownership,
business publication, booking behavior, billing, auth or RLS. Reviewed
evidence and image-rights notes remain private. The descriptions do not imply
that an owner has joined, consented to promotion or endorsed Mirëbook.

### Batch 17 operator sequence

1. Apply SQL 34 only after SQL 29 and SQL 30.
2. Confirm the result lists exactly eight active reviewed records and exactly
   two records with reviewed images.
3. Check all eight cards and details in EN and SQ. Confirm names, categories,
   descriptions, contact details and official links match the private source
   evidence.
4. Confirm the Bunk'Art 2 and Experience Gjirokastra images load with one
   localized credit, working Commons source links and the recorded licences.
5. Confirm the other six records use clean category fallbacks with no broken
   or empty image frame.
6. Verify Places List and Map still contain forty records, each map marker
   opens its exact summary, and Bookable still contains no directory record.
7. At 1440x900 and 390x844, check EN/SQ List, Map and sampled direct details
   for overflow, clipped copy, raw keys and console errors.
8. Confirm the public API exposes no private evidence, rights notes, updater
   identity, provenance, source IDs, exact geometry or exact coordinates.
9. Confirm the hidden ownership fixture remains absent from public collection
   and direct APIs, and no listing, business, claim or booking state changes.

### Batch 17 QA and map follow-up

Production data QA passed for all eight records. The public catalogue remained
at forty non-bookable places, the hidden fixture stayed absent with a no-store
404, anonymous table access remained denied, and no private review evidence,
rights notes, source IDs, exact geometry or exact coordinates entered the
public payload. All eight records exposed distinct EN/SQ descriptions and
current public details. Bunk'Art 2 and Experience Gjirokastra exposed their
licensed images and source attribution; the other six retained clean category
fallbacks.

The initial browser session could not complete visual Map coverage. A local
browser follow-up found that several 44px marker targets could overlap at the
Albania overview, allowing one nearby place to intercept another place's
selection. Forcing every marker apart made the hitboxes distinct but displaced
pins too far from their real geography, so that approach was not retained.

The final Map treatment groups nearby places into compact, localized count
markers at country scale. Activating a group zooms into its real geographic
area; remaining nearby records can be expanded into separate 44px targets.
Individual markers retain exact pressed-state and detail-link behavior.
Click, Enter and Space activation were verified locally for the southern
clusters, including Experience Gjirokastra, Himara Nautica One and the
Ethnographic Museum. Desktop and 390px checks found no visible hitbox overlap,
no document overflow and no cross-selection between the previously conflicting
records. A deployed focused regression remains required after release.

## Batch 18 - Owner Outreach And Claim Conversion

Batch 18 adds the private operating layer between a reviewed directory place
and the existing owner claim flow. It gives Mirëbook operators one compact
queue for appointment- or reservation-friendly places, their verified contact
routes, the correct owner-specific Mirëbook Business claim link, and a private
next-step record.

This is deliberately not an email campaign tool or a second claim system:

- no email, SMS, social message or notification is sent automatically
- no bulk-contact action exists
- an outreach status does not imply consent, partnership or endorsement
- a place cannot be claimed, linked, published or made bookable from Outreach
- pending ownership claims leave the Outreach queue and continue through the
  existing audited Claims workspace
- attractions are retained in customer discovery but excluded from the first
  owner-outreach queue so operators can focus on businesses with a practical
  booking, appointment, lesson, rental or reservation path

SQL 35 creates a private current-state table and an append-only event table.
Browser roles receive no table access. The service role can read the private
rows, while updates must use an admin-checked security-definer function. That
function locks the directory place and rejects hidden, unreviewed, claimed,
linked or open-claim records before writing an atomic current state and audit
event.

The operator can record:

- not started, planned, contacted, follow up, interested, declined or
  unreachable
- email, phone, social, website form, in-person or other contact channel
- an optional future follow-up date
- a concise private note without sensitive personal data

The admin API returns only active, reviewed, unclaimed candidates and excludes
places with pending or more-information ownership claims. Public directory
APIs and place pages receive no outreach fields. The responsive workspace
provides EN/SQ filters, due-follow-up visibility, stored contact actions,
public-place context and a selectable claim-link fallback when browser
clipboard access is unavailable. The five latest append-only events are shown
read-only beside the current state so operators can verify what changed
without opening the database.

### Batch 18 operator sequence

1. Apply SQL 35 after SQL 24 and SQL 30. Confirm it creates no rows and changes
   no directory, claim, business or publication state.
2. Deploy the API, Outreach page, admin navigation and translations.
3. Start with one explicitly authorised outreach candidate. Do not send a real
   message during workflow QA.
4. Copy the owner claim link and confirm it opens Mirëbook Business with the
   exact place ID preserved and only Business login/account setup choices.
5. Record a planned channel and future follow-up, refresh, then confirm the
   private state persists and the due count changes only when appropriate.
6. Move the candidate through contacted and interested, checking that each
   save creates one audit event. Restore its agreed private state after QA;
   never change its public listing.
7. Submit no ownership claim unless a fully disposable owner/business is
   available. If a claim is submitted, confirm the place leaves Outreach and
   appears once in Claims.
8. Confirm anonymous, customer, business-owner and staff callers cannot open
   the page, call the admin API or read either outreach table.
9. Confirm public collection/detail APIs expose no outreach status, channel,
   follow-up date, private note, actor ID or event.
10. Verify EN/SQ at 1440x900 and 390x844 with no horizontal overflow, blank
    actions, raw provider errors or automatic outbound messages.

### Batch 18 outreach-write follow-up

The first deployed workflow QA found that Outreach loaded and remained private,
but every save failed. A direct production RPC check isolated PostgreSQL error
`42702`: the function's returned `directory_place_id` output variable made the
original `on conflict (directory_place_id)` target ambiguous at execution time.

SQL 36 replaces only the audited outreach function and targets the named
`directory_place_outreach_pkey` constraint instead. SQL 35 carries the same
correction for clean installs. No table, RLS, grant, candidate, claim,
publication or outbound-message behavior changes. After SQL 36 is applied,
rerun one controlled planned-state save, refresh persistence, due-count and
single-event checks before continuing the outreach lifecycle.

Production RPC closure passed after SQL 36. The controlled `3H House of
Horses` candidate moved from `not_started` to `planned` with its private Other
channel, future follow-up date and explicit no-contact QA note persisted. The
write returned one row and added exactly one audit event. Resetting it to
`not_started` cleared the channel, date and note, returned one row and added
exactly one second event. The place remained active, unclaimed and unlinked.
No email, notification, claim, business link or publication action occurred.
The Browser-only retest could not type into its native date control, but the
production write path and both insert/update branches are now verified.

## Batch 19 - Manual Owner Outreach Conversion

Batch 19 turns the private Outreach queue into a usable manual conversion
workspace without turning Mirëbook into an automated campaign sender. Each
candidate now has editable English and Albanian drafts for email, social,
website forms, phone, in-person and other contact. Drafts include the exact
Business claim URL and current public-place URL, can be reset after editing,
and can be copied independently. Email candidates also expose a normal mail
draft link; Mirëbook still does not send the message.

The operating boundary is explicit:

- every draft is labelled `Manual send only`
- copying or opening a draft does not change outreach status
- contacted, follow-up, interested, declined and unreachable states require
  an explicit confirmation that the operator personally contacted the owner
- the same confirmation is enforced by the admin API, not only by the page
- planned activity does not require false contact confirmation
- quick future-date controls avoid dependence on a browser-native date picker
- interested candidates show the existing Ownership claims handoff; interest
  never claims, links, publishes or makes a place bookable
- no bulk-send action, background sender, provider integration or new public
  payload field is introduced

The page keeps contact routes, public context, editable copy, current private
state and recent audit events in one responsive operator surface. Public APIs,
customer pages and non-admin roles remain unchanged. No SQL migration is
required for Batch 19; it builds on the SQL 35/36 private state and event
boundary.

Local closure passed with all 35 candidates loaded. English email and Albanian
social drafts rendered with the correct place and claim URLs; edited text
copied exactly and reset to the generated draft. The unconfirmed Contacted
save was blocked in the interface, and a direct authenticated API probe
returned `400` with `manual_contact_confirmation_required` without writing a
row. Interested exposed the Claims handoff and the +3 days control produced a
valid future date. Desktop and 390px rendering had no horizontal overflow,
framework overlay or console warning/error. `npm run build` passed.

### Batch 19 deployment QA

Use one explicitly authorised candidate and do not contact its owner during
this QA unless the user separately authorises that exact real-world message.

1. Open `/admin/outreach` and confirm candidates, contact routes, recent
   activity and the Ownership claims shortcut load without raw errors.
2. Switch a draft between EN/SQ and email/social/website/phone/in-person/other.
   Confirm the place name, public URL and exact Business claim URL remain
   correct. Edit, copy and reset one draft; do not open or send it externally.
3. Confirm `Manual send only` remains visible and no status, event, email,
   notification or claim is created by editing or copying a draft.
4. Select Contacted without checking the manual-contact confirmation and press
   Save. Confirm the save is blocked with friendly localized copy and no audit
   event is added.
5. Use Tomorrow, +3 days and +7 days to confirm valid future dates populate
   without relying on the native date control. Do not save the QA state.
6. Select Interested without saving. Confirm the Claims handoff appears and
   points to `/admin/directory-claims`; no claim is created automatically.
7. Confirm anonymous, customer, owner and staff roles remain denied from the
   page/API, and public directory payloads contain no draft or outreach data.
8. Check EN/SQ at 1440x900 and 390x844 for clipped controls, horizontal
   overflow, blank actions, mixed-language copy and console errors.
9. End with the candidate's original private outreach state unchanged and
   confirm no outbound message, listing, claim, business or publication state
   changed.

### Batch 19 deployed follow-up

Deployment QA passed the queue, copy/reset, manual-contact guard, quick dates,
Claims handoff, localization, responsive layout and public/private boundaries.
The first release omitted the public-place URL from Social, Phone and In-person
drafts. Those three EN/SQ templates and their component fallbacks now include
both the secure Business claim URL and current public-place URL, matching the
other formats.

The same QA session logged one invalid-refresh-token warning after an earlier
isolated auth probe had invalidated that admin refresh session. This was a
stale QA-session recovery event rather than an Outreach runtime failure. A
fresh authenticated admin tab loaded Outreach with zero console warnings or
errors, so the shared role/auth foundation was not changed.

The final production closure passed after a cache-bypassing reload on the
deployment for commit `a29252c`. Social, Phone and In-person drafts each
contained the exact Business claim URL and current public-place URL in both EN
and SQ. The fresh admin session produced no refresh-token or auth console
warning. The controlled candidate remained `not_started` with its two existing
audit events, and no outreach event, email, notification, claim or public state
change occurred. Batch 19 is closed.

## Batch 20 - Controlled Founding-Business Conversion

Batch 20 turns the completed Outreach workspace into a focused first-owner
launch pilot without adding bulk contact or changing any owner state. The
private admin API derives a deterministic ten-place shortlist from the current
eligible queue. Existing planned, contacted, follow-up and interested
candidates remain ahead of new candidates; remaining places are ranked by
direct contact routes, reviewed bilingual content, reusable imagery and how
naturally the category converts to appointments, lessons, sessions, rentals or
reservations. New candidates are balanced across cities and categories before
any remaining pilot spaces are filled, so the first outreach set can test more
than one local market without displacing work already in progress.

The pilot is guidance rather than a database decision:

- shortlist membership and rank are derived read-only and write no record
- declined and unreachable candidates are excluded from the pilot
- the full Outreach queue remains available beside the pilot view
- each candidate shows its recommended first contact route and the factual
  readiness signals used by the ranking
- no score or readiness signal is exposed through a public API
- changing outreach status still uses the existing audited manual save
- owner interest still moves through the existing ownership-claim review
- no directory place, business, service, billing flag or publication state is
  changed automatically

Drafts gain an optional early-partner paragraph. It is off by default and is
generated in EN or SQ only when the operator chooses it. The paragraph matches
the current public early-partner position: no customer booking commission
during the early-partner period, optional setup help and no compulsory
participation. It does not promise a price, permanent discount, publication,
customer demand or automatic founding-business eligibility.

### Batch 20 deployment QA

1. Open `/admin/outreach` as an admin and confirm All candidates and Launch
   pilot are separate, keyboard-operable views. The pilot must contain at most
   ten candidates and write no outreach event when opened.
2. Confirm candidates already in planned/contacted/follow-up/interested states
   remain ahead of new candidates. Declined and unreachable candidates must
   not enter the pilot.
3. Sample at least three pilot candidates. Confirm rank, launch-fit label,
   recommended first channel and readiness signals match their private contact
   routes and reviewed profile content.
4. Switch between the full queue, pilot, statuses, search, city and category.
   Confirm counts, selection and pagination remain coherent with no loading
   loop or stale candidate detail.
5. Toggle the early-partner paragraph in EN and SQ for email, social and one
   conversation format. Confirm it is off by default, appends once, resets with
   the selected template and makes no external request.
6. Confirm every draft still retains the exact Business claim URL and public
   place URL. Do not open or send a real message during QA.
7. Confirm the optional offer copy makes no price, permanent-discount,
   publication or customer-demand promise and remains clearly labelled Manual
   send only.
8. Confirm anonymous, customer, owner and staff roles remain denied from the
   page and private API, while public directory payloads contain no pilot
   score, rank, readiness reason or outreach field.
9. Check EN/SQ at 1440x900 and 390x844 for clipped metrics, crowded candidate
   rows, horizontal overflow, raw keys and console errors.
10. Finish with every candidate in its original outreach state and no email,
    notification, claim, business link, billing or publication change.

## Batch 21 - Marketplace Visual Refinement And Catalogue Hold

Batch 21 returns the launch priority to customer discovery. The Outreach
workspace remains available for later owner conversion, but no real contact is
required until the public catalogue, responsive presentation and booking
handoff are considered launch-ready.

The public Places list now uses a denser visual marketplace grid:

- three cards across on wide desktop, two on medium screens and one on phones
- licensed reviewed photos remain the primary media where available
- every image-less record receives category-specific artwork rather than a
  blank or generic database-looking strip
- directory cards expose only the two browsing actions needed in the result
  list: Details and Map
- website, directions, report and ownership actions remain on the full detail
  page, reducing repeated controls across long result sets
- place-detail pages also render category artwork when no licensed image is
  available, keeping every reviewed record visually complete
- bookable business cards use the same vertical media rhythm so All results do
  not split into two unrelated visual systems once businesses publish

No rating, review count, opening status, availability claim or owner
endorsement is invented. Directory records remain non-bookable until the
reviewed claim and business-publication handoff is complete. This batch changes
presentation only and does not approve, import, claim, publish or contact a
place.

Catalogue growth continues as a separate review process. New private
candidates should prioritise customer-useful density, direct owner contact and
categories still thin in each launch city. Food, drink and accommodation may
be imported into `needs_review`, but they must not become public until their
facts, rights-safe imagery and customer value pass the same individual review
gate as the existing 40 records.

### Batch 21 deployment QA

1. Test `/explore?kind=places` with the full reviewed catalogue at 1440x900,
   1280x720, 768x1024 and 390x844. Confirm three/two/one-column transitions,
   equal readable cards and no horizontal overflow.
2. Sample at least four photographed records and four image-less records across
   different categories. Confirm photographs load with credit and fallbacks
   use distinct, relevant category artwork without broken-image gaps.
3. Confirm every result card contains Details and Map, but no repeated Website,
   Report or Claim action. Open the detail page and confirm those relevant
   actions remain available there.
4. Open image-less and photographed detail pages in EN and SQ. Confirm the
   first viewport remains useful, media is correctly framed and photo credit is
   shown exactly once only when a photo exists.
5. Test All, Bookable and Places in List and Map. Confirm directory places never
   become bookable, business/directory identity does not duplicate, and a map
   marker opens the exact matching result.
6. Exercise search, city, category, sort, clear, Near me and browser back/forward.
   Confirm URL state, results and selected controls remain synchronized.
7. Confirm no rating, review count, live availability or owner endorsement is
   displayed without an authoritative source.
8. Check anonymous and signed-in customer navigation, EN/SQ copy, keyboard
   focus, raw keys, console errors and loading/error/zero-result states.
9. Confirm the public APIs still expose only reviewed public fields and coarse
   map positions. No outreach rank, notes, evidence, exact coordinates or
   private contact workflow data may appear.
10. Finish with zero directory approvals, imports, outreach events, emails,
    claims, bookings, business publication or billing changes.

Batch 21 deployment closure passed on 31 July 2026 against production commit
`017df0c`. The Places list rendered three, two, two and one columns at
1440x900, 1280x720, 768x1024 and 390x844 respectively, with document width
matching viewport width at every breakpoint. All 40 reviewed place cards
exposed only Details and Map, while website, directions, report and ownership
actions remained on the full detail page. Nine reviewed photographs and 31
category-artwork fallbacks rendered without broken or poorly framed media.
The compact Operator menu passed at tablet and phone widths and the browser
console remained clean. The QA run changed no record or application state.
Albanian profile-state switching and full keyboard traversal were not repeated
in that final session, but earlier localization checks and the final semantic
DOM inspection found no regression. Batch 21 is closed.

## Batch 22 - Grooming Catalogue Expansion

Batch 22 addresses the launch catalogue's thin barber, hair, beauty and tattoo
coverage while keeping real owner outreach paused. A fresh Overture Maps June
2026 export produced 223 Albania grooming candidates. Twenty-six candidates
were selected for direct contactability, useful geographic coverage and clear
barber, hair-salon, beauty-salon or tattoo/piercing classification.

The importer dry-run validated all 26 records, then the normal service-only
review importer inserted them with run ID
`db4d89af-aefe-4813-9b6b-79715d0f7158`. The import reported 26 processed, 26
inserted, zero updated and zero public listings. Every imported row remains
`needs_review` and therefore private.

SQL 37 prepares the strongest twenty candidates for individual operator review:

- 4 in Tiranë
- 3 in Durrës
- 3 in Vlorë
- 2 each in Sarandë, Korçë and Elbasan
- 1 each in Shkodër, Gjirokastër, Fier and Lezhë

The reviewed set spans tattoo/piercing studios, barbers, hair salons and beauty
studios. Facts and bilingual descriptions are stored separately from the
imported source record. No image is added because reusable rights were not
verified; the category artwork remains the deliberate public fallback. The six
weaker or ambiguous imported candidates remain untouched in the private queue.

SQL 37 does not approve a record. It refuses to run if any target is no longer
private, unclaimed and unlinked, and verifies the same boundary again before
commit. Each place must still be inspected and approved individually through
Admin Directory before it can appear publicly.

### Batch 22 review QA

1. Run SQL 37 and confirm exactly 20 rows return as `needs_review`, `unclaimed`
   and `public_facts_reviewed = true`.
2. Confirm Admin Directory totals increase only in Needs review; public Explore
   must remain at its pre-batch count before any approval.
3. Review every candidate individually. Confirm identity, city, address,
   telephone, evidence link and EN/SQ description agree with the source; reject
   or leave private if any fact is doubtful.
4. Approve no more than 15 in the first wave. Keep city/category balance and do
   not approve two records that appear to represent the same business.
5. Sample tattoo, barber, hair and beauty records in EN/SQ after approval.
   Confirm each is a non-bookable Local place with Details, Map, directions,
   report and Business claim actions, but no invented rating or availability.
6. Confirm records without licensed imagery use the grooming category artwork
   and never show a broken image, copied social photograph or fake storefront.
7. Confirm List and Map counts agree, every approved marker opens its exact
   matching place, Bookable contains no directory records and no identity is
   duplicated.
8. Recheck public payloads for coarse `approximately_1km` map positions only.
   Evidence URLs, review notes, source IDs, exact geometry, email and outreach
   data must remain private.
9. Verify EN/SQ at 1440x900 and 390x844 with no overflow, clipped card copy,
   raw keys, raw database errors or console errors.
10. Record every approval by name and finish with no claim, booking, owner
    contact, email, business publication or billing change.

Batch 22 closed on 1 August 2026 after the twenty SQL 37 records were reviewed
and approved individually. Final Admin Directory totals were 60 Approved, 23
Needs review and 1 Hidden. Public Places List and Map both represented all 60
reviewed places, while Bookable contained zero directory records. The six
deliberately unprepared imports remained private: Number 13 Tattoo Studio,
Royal Esthetic Center, Gabriel's Salon, Beauty Salon Nicol, Tattoo studio klodi
ardi and Parukeri Eneida. The approval run found no P0, P1 or P2 issue and
changed no claim, business, booking, billing or configuration state. Batch 22
is closed.

## Batch 23 - Launch Photo Coverage Workbench

Batch 23 turns marketplace photography into a controlled launch-curation
workflow. A read-only production snapshot on 4 August 2026 found 60 approved
directory places: 9 with reviewed photos and 51 using category artwork. The
largest gaps were beauty and grooming, dental health, wellness, rentals and
several launch cities with no photographed place.

The private Admin Directory now provides:

- exact approved-photo coverage without displaying false totals while loading
- missing-photo breakdowns by city and public category
- a deterministic balanced shortlist that favours thin cities, booking-relevant
  categories, usable contact routes, bilingual editorial copy and stronger
  source confidence
- one-action filtering from a coverage gap or shortlisted place into the
  approved records that still need photography
- a 16:9 public-card crop preview, public-page preview and per-place readiness
  checks for the image, EN/SQ alt text, public credit and private rights note

The shortlist is operational guidance only. It does not contact an owner,
upload an image, approve a place, publish a business or change public ranking.
Social-media photographs must not be copied without permission. Appointment
businesses should preferentially receive owner-supplied premises, team or
service images; destination imagery must be owned, supplied with permission or
published under a compatible licence with complete attribution.

`npm run directory:photo-coverage -- --limit=18` provides the same read-only
coverage and balanced shortlist for launch planning. Its output intentionally
omits private review notes, source IDs and exact coordinates, and performs no
database write.

### Batch 23 deployment QA

1. Open `/admin/directory` as an admin and confirm Marketplace photos settles
   to the real approved total, photographed total and missing-photo total. No
   false zero state or migration guidance should flash while data loads.
2. Confirm city and category coverage rows show accurate photographed/total
   values. Select at least one of each and verify the queue changes to Approved
   plus Photos needed with the matching city or category filter.
3. Confirm the balanced shortlist contains distinct places across more than
   one city and category. Select three rows and verify each opens the exact
   approved missing-photo record rather than changing any record.
4. Run the photo-coverage command twice. Ignore `generatedAt`; coverage totals,
   ordering, scores, reasons and asset guidance must match between runs.
5. Open one photographed and one fallback-artwork place. Confirm the photo
   status, 16:9 crop preview, public-page action and readiness checks are clear.
6. Confirm incomplete photo metadata remains visibly incomplete and cannot be
   presented as ready. Do not upload or save an image during this read-only QA.
7. Verify EN and SQ at 1440x900 and 390x844. Controls must be labelled, at least
   44px high where tapped, readable without clipping and free of horizontal
   document overflow.
8. As anonymous, customer, owner and staff users, confirm Admin Directory and
   its API remain admin-only with clean localized denial and `no-store` cache
   behavior.
9. Recheck `/api/public/directory-places` and public Explore. Coverage totals,
   priority scores, reasons, rights notes and other operator fields must not be
   exposed; public counts and listing states must remain unchanged.
10. Finish with zero image uploads, directory edits, approvals, contacts,
    claims, bookings, business publication, billing or environment changes.

## Batch 24 - Rights-Cleared Photo Acquisition Pilot

Batch 24 turns the private photo shortlist into a practical, rights-safe
acquisition workflow. Approved places that still use category artwork now have
an operator-only photo request kit inside Admin Directory. The first six places
from the deterministic balanced shortlist are clearly marked as the priority
pilot, while the same workflow remains available for later approved photo gaps.

The kit provides:

- editable-by-selection English and Albanian request drafts containing the
  exact public place URL
- a separate owner permission statement covering display, cropping, Mirëbook
  apps, social media and launch marketing
- concise requirements for 2-4 genuine landscape photos, at least 1600x900,
  supplied as JPG, PNG or WEBP
- available private operator contact routes from the reviewed/source record
- copy controls with a visible selectable-text fallback when browser clipboard
  access is unavailable
- explicit safety copy that preparing or copying a kit sends nothing, records
  no outreach state, creates no claim and changes no public listing

The category illustration remains the public fallback until a real image,
public credit and private permission evidence are reviewed and saved through
the existing photo editor. Operators must not copy photographs from social
media or another website merely because they are publicly visible.

### Batch 24 deployment QA

1. Open `/admin/directory` as an admin and select each of the six rows in Next
   balanced photo set. Confirm each opens an approved record with Photo needed
   and shows Priority photo pilot in the request kit.
2. Confirm the six names are Klinika Orkiderma, Commando Arena, Joland Tattoo,
   Adi Barber Shop, Royal Glam Studio and City Dental Clinic, unless the
   deterministic production shortlist has legitimately changed because a
   reviewed photo was added.
3. On at least three pilot records, confirm the displayed email, phone and/or
   website agree with the private record. A missing route must show a clean
   no-contact state rather than inventing contact details.
4. Switch the kit between EN and SQ without changing the operator account
   language. Both drafts must contain the exact place name and
   `https://mirebook.com/places/{id}` URL.
5. Confirm both languages request 2-4 landscape photos, describe the minimum
   size and ask the supplier to own the images or have permission to share
   them. Neither draft may imply ownership, endorsement or bookability.
6. Confirm the separate permission text covers non-exclusive Mirëbook website,
   app, social and launch-marketing use, cropping and the ability to request
   removal.
7. Copy both fields. When clipboard access is allowed, pasted text must match
   exactly. When it is blocked, the matching readonly field must receive focus
   and select its complete text.
8. Confirm preparing and copying the kit causes no API write, outreach event,
   email, notification, claim, approval, publication or image upload. Refresh
   must leave every record and public count unchanged.
9. Verify an approved place with an existing photo does not show the request
   kit. A needs-review or hidden record must not be presented as part of the
   active photo pilot.
10. Verify EN and SQ at 1440x900 and 390x844. Language and copy controls must be
    at least 44px high where tapped, long URLs and Albanian copy must wrap, and
    there must be no horizontal overflow, raw keys or console errors.
11. As anonymous, customer, owner and staff users, confirm Admin Directory and
    its API remain admin-only. Recheck the public directory API contains no
    request drafts, contact email, permission text, priority badge or rights
    evidence.
12. Finish with no contact sent and no production record changed. Record which
    pilot places have a usable contact route so real outreach can be scheduled
    separately and deliberately.

## Batch 25 - Customer Place Sharing

Batch 25 adds a real Share action to reviewed place details. Supported mobile
browsers use the native share sheet; other browsers copy the canonical customer
URL. If clipboard access is unavailable, the exact link remains visible,
focused and selected for manual copying. Sharing creates no Mirëbook record and
does not imply that a directory place is claimed or bookable.

## Batch 26 - Nearby Discovery Continuity

Batch 26 prevents public place details from becoming dead ends. A compact,
image-led related-place rail prefers other reviewed places in the same city and
then fills any remaining positions from the same category. It shows at most
three distinct public records, never repeats the current place, retains photo
credits and deliberate category artwork, and links back to a filtered Places
view. The rail reads only the existing public-safe directory API. Server route
payloads and client locale refreshes are synchronized separately so quick
nearby navigation and Browser Back cannot strand the original place in a
loading state.

## Batch 27 - Server-Rendered Place Presentation

Batch 27 makes shared place links useful before client JavaScript loads. The
approved-only directory read now lives in one server helper used by both the
public API and the place page. Place pages render the reviewed name,
description, canonical URL and licensed image metadata on the server, while
retaining locale refreshes in the browser.

The boundary remains unchanged:

- hidden, closed, duplicate and needs-review records return a real 404
- missing and temporarily unavailable routes are `noindex` and do not publish
  a canonical or Open Graph URL for a non-public place identifier
- a linked ready business redirects to its single bookable profile
- server and API reads remain private/no-store so hide and publish transitions
  are not masked by public page caching
- exact coordinates, evidence, source IDs, confidence, outreach and private
  rights notes remain absent
- provider/configuration failures show a retryable unavailable state rather
  than being mislabelled as a missing place

Generic SEO metadata moved from the static document into the shared Next Head
layer so page-specific metadata can replace it without duplicate generic title
or description tags.

### Batches 25-27 combined deployment QA

1. Inspect a photographed place and a fallback-artwork place by loading their
   direct URLs in a fresh logged-out tab with JavaScript initially disabled or
   by inspecting the first HTML response. The reviewed place name,
   description, canonical URL and localized page metadata must be present.
2. Confirm the canonical URL uses `https://mirebook.com/places/{id}` and that
   title, description, Open Graph and Twitter metadata contain no admin,
   evidence, outreach or rights-note text.
3. On a place with a licensed image, confirm `og:image`, image alt text and
   `summary_large_image` use only the reviewed image. A fallback-artwork place
   must not invent an image URL and should use the normal summary card.
4. Exercise Share on iOS/mobile and desktop. The native share sheet should open
   where supported; otherwise Link copied should appear and pasted text must be
   the exact canonical URL. Simulate blocked clipboard access and confirm the
   visible link field receives focus and selects the full URL.
5. Confirm cancelling the native share sheet produces no error state. Sharing
   or copying must create no API write, notification, support item, claim,
   outreach event or analytics-looking production record.
6. Confirm More in {city} shows no more than three distinct reviewed places,
   excludes the current place, uses real photo or deliberate category artwork,
   and preserves a single localized photo credit when applicable.
7. Open every nearby card by media and title. Browser Back must return to the
   original place. View all must open Places with the correct city filter; a
   sparse city may use same-category records to complete the rail.
8. Switch EN/SQ while remaining on the same place. Main copy, share feedback,
   nearby heading, categories, loading text and photo prefixes must localize
   without a full-page loading flash or stale place identity.
9. Test a hidden fixture direct URL: first response and public API must return
   404 with `private, no-store` and no place name, contact, metadata or nearby
   rail. Test a genuine place as the positive control.
10. If a controlled claimed-place/business handoff is available, publish its
    fully ready hidden QA business and confirm the direct place route redirects
    server-side to the single `/explore/{businessId}` profile, then restore all
    QA state immediately.
11. Verify EN/SQ at 1440x900, 768x1024 and 390x844. Check 44px Share/View-all
    controls, independent mobile rail scrolling, next-card peek, long names,
    photo framing, no horizontal document overflow and no console errors.
12. Recheck the public API payload. It must remain customer-safe and contain no
    new private fields. Finish with no directory, business, claim, booking,
    account, billing or environment change.

### Batch 11 deployment QA

1. Use one disposable active directory place and one disposable Business owner
   account. Keep the business hidden throughout the claim review.
2. Start from the public place detail page while logged out. Confirm only
   Business login/create-account choices appear and the place ID survives
   login, registration and email verification.
3. Submit a claim, then repeat the same pending submit request. Confirm exactly
   one owner update, one operator queue item and no duplicated email/notice.
4. Confirm the owner sees `Ownership under review` in Setup and the directory
   place remains public, non-bookable and unlinked.
5. As admin, open the operator notice and confirm it selects the exact claim.
6. Request more information with a clear note. Confirm the owner receives
   localized in-app/email copy and Setup offers one `Add information` action.
7. Resubmit once and confirm the same claim returns to pending with one new
   claim event and one operator update.
8. Approve the claim. Confirm the directory record links to the selected owned
   business, competing open claims close, and Setup shows `Ownership approved`.
9. Confirm approval leaves the business hidden and does not change services,
   staff, hours, booking mode, readiness or billing.
10. Publish only if a fully controlled ready QA business is available. Confirm
    Explore shows one business result rather than duplicate place/business
    cards, then restore the business and directory record to their agreed QA
    state.
11. Confirm a customer, staff member, unrelated owner and anonymous caller
    cannot read or mutate private claims.
12. Verify EN/SQ at desktop and 390px, email subjects/body/CTA domains, no raw
    provider errors and no horizontal overflow.

## Batch 28 - Customer Mobile Web Shell

Batch 28 treats the customer website as the primary Android experience while
the native apps progress separately. It does not change account capabilities,
booking state, business publication, directory visibility or public API data.

The customer/public mobile experience now includes:

- a persistent five-item discovery dock for Explore, Map, Bookings, Updates
  and Account on anonymous and customer surfaces only
- a compact one-row phone header, with language selection retained and
  business/staff/admin workspace navigation left unchanged
- safe-area clearance for the dock and the selected-place map sheet
- twelve initial List results with a translated progressive Show more control;
  result totals and the complete Map catalogue remain unchanged
- deferred rendering for off-screen result cards to reduce work on long lists
- 16px mobile form controls to prevent disruptive browser zoom
- a customer-first standalone web-app manifest, light browser chrome and
  shortcuts for Explore, Map and My Bookings

The manifest improves add-to-home-screen presentation but does not claim
offline support. Public and customer routes continue to require the network for
live discovery, authentication and booking state.

### Batch 28 deployment QA

1. At 390x844, first prove the session is anonymous by confirming the public
   header shows Login and does not show Operator, Business or Staff navigation.
   Then open Home, Explore List, Explore Map, one public place, Login, My
   Bookings and Account. Confirm the dock appears only for anonymous or
   customer context and each item is at least 44px high.
2. Confirm the active dock item follows List, Map, booking, notification,
   account/auth and public-place routes. Protected anonymous actions must use
   the existing customer login redirect behavior.
3. Confirm mobile headers remain one row while closed. Language controls must
   remain reachable; an authenticated customer Account menu must still provide
   language, Account and Log out.
4. Explore Places must report the complete public total while initially
   rendering twelve cards. Show more must navigate to the URL-backed next page,
   render the next twelve and update the translated visible-count message while
   preserving filters. Browser Back must restore the previous twelve-card
   state. If an automation-layer click does not navigate, repeat once with a
   physical coordinate/touch click before classifying a product defect.
5. Switch List to Map from the dock. The Map must still represent the complete
   filtered catalogue, retain clustering and keep a selected-place sheet fully
   above the customer dock.
6. Check EN and SQ at 390x844 and 430x932. Labels must fit, inputs must not
   trigger browser zoom, document width must match viewport width and no fixed
   control may cover a primary action.
7. At 768x1024 and 1280x720, confirm the mobile dock is hidden, existing
   two-column layouts remain intact and Show more is keyboard accessible.
8. Inspect `/manifest.json`: start URL `/explore`, standalone display, white
   theme/background, 192px and 512px icons, and Explore/Map/Bookings shortcuts.
9. Confirm business, staff and admin routes do not receive the customer dock or
   altered role navigation. No auth, RLS, claim, booking or publication record
   should change during this QA.
10. Finish with no horizontal overflow, framework overlay, raw translation key
    or relevant console warning/error.

## Batch 29 - Assisted Business Onboarding

Batch 29 gives the operator one private workbench for turning a promising
place or direct business conversation into a clean owner handoff. It extends
the existing Directory, Outreach, Claims and Business tools rather than
creating a second business-registration system.

The workbench starts with a smart, keyboard-accessible search across:

- reviewed and private directory-place names, cities, addresses and contacts
- existing Mirëbook businesses and their owner profile name, email or phone
- standalone onboarding prospects and cases already in progress

Suggestions identify their source and current state before the operator can
start a new prospect. Selecting an existing record prefills its public/business
details and attaches one private case, preventing a separate onboarding record
from quietly duplicating the same place or business.

Private cases can track:

- owner or manager contact and preferred EN/SQ language
- interest in discovery, online bookings and the Mirëbook Business app
- a structured progression from first contact through assets, owner handoff,
  publication readiness and live follow-up
- profile-material readiness and the next suggested operator action
- separate permission for business-profile media and Mirëbook promotional
  media, including who granted it, how, when and a private evidence note
- private preparation notes and an append-only status/permission audit snapshot

SQL 38 creates the two private tables and the admin-only audited save RPC. RLS
allows no browser role to read or write either table. The admin API uses the
service role only after verifying the signed-in profile is an administrator.
Saving a case creates no Auth user, directory place, business, claim, message,
email, notification, publication, booking or billing change.

### Batch 29 deployment QA

Use **High effort** for this QA because it spans duplicate prevention, private
data boundaries, keyboard interaction, EN/SQ and responsive operator UI.

1. Run `sources/sql/38_assisted_business_onboarding.sql`, deploy the matching
   web build, then open `/admin/onboarding` as an administrator. Confirm the
   SQL guidance is absent, all totals settle from a neutral loading state and
   Onboarding appears in the desktop and compact mobile operator navigation.
2. Search a known directory place by partial name, city, address and phone.
   Search an existing Mirëbook business by business name and owner email. Each
   result must identify Local place, Mirëbook business or Onboarding case and
   show useful state without exposing a raw UUID as its label.
3. Use Arrow Up/Down, Enter and Escape in the search. Confirm focus remains in
   the combobox, the active option is announced, selection prefills the right
   record and Clear selection returns to a neutral state.
4. Select the same directory place twice and the same business twice. Save
   each only once using controlled QA records. Confirm the second lookup opens
   the existing case rather than creating a duplicate. Verify the unique
   place/business boundary in the private table or API result.
5. Search an intentionally unmatched disposable name and choose Start a new
   prospect. Confirm the visible search text prefills the name, no directory or
   business ID is invented, and saving creates only one private case.
6. Exercise the goals, status, asset state, owner contact and EN/SQ preference.
   Refresh and confirm all values persist. The suggested next action must
   update with status and remain concise on desktop/mobile.
7. Confirm profile-media and Mirëbook-marketing permissions are independent.
   Saving either permission must require source, grantor, date and explicit
   confirmation. Remove both and confirm permission evidence is cleared rather
   than left attached to an unapproved use.
8. Confirm invalid email, non-HTTPS website/social links, zero selected goals
   and incomplete permission evidence show friendly localized validation with
   no raw provider, SQL, RLS or stack-trace text.
9. From an attached case, open Directory record, Public place, Business profile
   and Outreach where applicable. Customer-facing place links must use
   `mirebook.com`; operator/business links must remain on the business origin.
10. Verify anonymous, customer, owner and staff sessions cannot open the page
    or call `/api/admin/onboarding`. Direct browser reads/writes to both SQL 38
    tables must be denied. Admin API responses must use `private, no-store`.
11. Inspect the public directory, public business and customer APIs. They must
    expose no onboarding status, contacts, permissions, notes, actor IDs or
    events, and no public counts or listings should change.
12. Verify EN and SQ at 1440x900, 768x1024 and 390x844. Check combobox wrapping,
    44px controls, queue/editor stacking, permission fields, long Albanian text,
    no horizontal overflow and no console errors.
13. Finish by deleting no real record and sending no contact. Report the exact
    disposable case IDs created, then leave them paused or remove them only
    through an explicitly approved cleanup step.

## Batch 30 - Assisted Owner Handoff Pack

Batch 30 keeps the first owner conversation inside the private onboarding
workbench without turning Mirëbook into an automatic outreach system. A saved
case now produces one compact handoff pack with:

- contact-route, owner-route, profile-material and media-permission readiness
- the exact secure claim path for a linked directory place, or the normal
  Business registration path for a new prospect
- an EN/SQ manual outreach draft using the existing reviewed-place templates
- a concise EN/SQ business introduction when no reviewed place exists yet
- a copyable request checklist derived from discovery, booking and Business app
  interests
- separate visibility for profile-media and Mirëbook-marketing permission

The handoff pack is derived from the private case and adds no database table or
write. Copy and open-link actions do not send a message, create an Auth user,
submit a claim, publish a listing, create a booking or change billing.

### Batch 30 deployment QA

Use **High effort** because this QA covers generated copy, exact cross-domain
links, permission meaning and responsive operator UI.

1. Complete the remaining Batch 29 save-flow proof with one explicitly
   disposable case. Confirm a second lookup opens the same case rather than
   creating a duplicate.
2. Open the saved case and confirm Owner handoff pack appears only after the
   case exists. It must show contact route, owner route, profile materials and
   media permission as separate states.
3. For a linked directory place, confirm Open claim uses
   `business.mirebook.com/claim/{placeId}` and Open public listing uses
   `mirebook.com/places/{placeId}`. Existing linked businesses must open only
   the private admin business route.
4. Switch outreach format and EN/SQ language. Confirm the place name, exact
   claim URL and exact public URL remain in every generated format. Edit, copy
   and reset the draft without any network write or audit event.
5. For a standalone disposable prospect, confirm the concise business
   introduction uses the Business registration origin, contains no claim URL
   or invented directory ID, and explains profile versus promotional media use
   separately.
6. Toggle discovery, booking and Business app goals, save, reopen and inspect
   the request checklist. It must add only the relevant description/photos,
   service/price/duration, staff/hours and owner-account requests.
7. Confirm media readiness never treats profile permission as marketing
   permission. Incomplete evidence must remain visibly incomplete, and no media
   use may be presented as approved when both permissions are off.
8. Simulate unavailable clipboard access. The message or checklist field must
   receive focus and select its complete value as a manual fallback.
9. Verify anonymous, customer, owner and staff users still cannot open the
   workbench or API. Inspect public directory/business payloads for absence of
   onboarding contacts, drafts, checklist, permissions and status.
10. Verify EN/SQ at 1440x900, 768x1024 and 390x844. Check 44px controls, long
    Albanian copy, checklist stacking, no horizontal overflow and no console
    errors.
11. Finish with no message sent, no account created, no claim submitted, no
    listing published and no real case changed. Report the disposable case ID
    and leave it paused pending explicit cleanup approval.

## Batch 31 - Smart Customer Discovery Search

Batch 31 makes the main Explore search more forgiving without changing public
ranking or adding another data source. The search now suggests:

- exact reviewed local places already available to the public page
- live bookable Mirëbook businesses already present in the result catalogue
- translated directory categories, including common EN/SQ search aliases such
  as barber, dentist, gym, tours, rentals and their Albanian equivalents
- launch cities with accent-insensitive matching, so `Tirane`, `Durres` and
  similar keyboard input can resolve to the correct public spelling

Place and business suggestions open their exact customer detail route. City and
category suggestions apply the existing URL-backed filters immediately. The
combobox supports Arrow Up/Down, Enter and Escape, keeps native form submission
when no suggestion is selected and uses only customer-safe catalogue fields
already available to Explore.

This batch does not request location, create search-history records, change
publication, alter ranking or expose private directory/business data. Its QA is
grouped with the next customer-discovery batches rather than run separately.

## Batch 32 - Consistent Homepage Discovery Entry

Batch 32 brings the same assisted search model to the customer homepage so the
first search and the full Explore search no longer teach different behaviour.
The hero search reuses the reviewed-place catalogue already loaded for the
homepage showcase and the existing public bookable-business endpoint. It can
suggest:

- exact reviewed local places and live bookable businesses
- translated categories with the shared EN/SQ aliases
- launch cities with accent-insensitive matching

Selecting a place or business opens its exact public route. Selecting a city or
category opens Explore with that URL-backed filter applied, preserving a city
already entered when a category is chosen. Free-text What and Where submission
continues to open Explore as a fallback, so incomplete or novel searches remain
usable. The shared combobox keeps Arrow Up/Down, Enter and Escape behaviour at
the homepage entry point as well as on Explore.

The homepage does not request location, store search history, alter public
ranking, create records or expose private fields. Directory suggestions are
derived from the homepage's existing customer-safe request; business
suggestions are limited to published businesses that satisfy the same
bookability readiness checks used by Explore.

Batch 32 closes the grouped implementation run. Batches 29-32 should now receive
one combined high-effort QA covering assisted onboarding, owner handoff safety,
Explore suggestions and homepage-to-Explore/direct-detail routing.

## Batch 33 - Privacy-Safe Launch Analytics

Batch 33 gives the operator a practical answer to whether outreach and social
campaigns are bringing people into Mirëbook and whether that interest reaches
registration or booking. It combines two deliberately separate sources:

- Vercel Web Analytics for anonymous visitors, page views, referrers, countries
  and device reporting
- a private Mirëbook event table for a strict allowlist of product actions such
  as search, map selection, place and business views, claim interest,
  registration submission and booking submission

The private `/admin/growth` workbench compares anonymous interactions with
authoritative profile and booking rows. It includes acquisition sources,
campaign labels, device mix, viewed places/businesses, a recent event stream and
a 14-day trend. Tagged outreach links can use normal `utm_source`, `utm_medium`
and `utm_campaign` values; attribution lasts only for the current browser tab
session.

This batch does not store a visitor name, email, phone number, IP address, exact
location, account ID or persistent browser/session identifier. It does not
attempt to identify a particular business owner who visited the site. Mirëbook
events stop when the browser sends Do Not Track or Global Privacy Control. The
public ingestion route accepts only same-origin, allowlisted, non-personal
fields; the analytics table has RLS enabled with no browser policies and is
available only through service-role ingestion and the authenticated admin API.

Run `sources/sql/39_launch_site_analytics.sql`, enable Web Analytics for the
production Vercel project and deploy the matching website build before relying
on `/admin/growth`. Account and booking totals remain usable if the event table
has not yet been installed, while the workbench clearly marks interaction
reporting as inactive.

### Batch 33 deployment QA

Use **High effort** because this touches public interaction reporting, private
admin data and legal disclosure.

1. Run SQL 39 and deploy. Enable Vercel Web Analytics for the production project.
2. Open a fresh anonymous tab with
   `?utm_source=instagram&utm_medium=social&utm_campaign=launch_albania`.
3. Exercise homepage search, Explore list/map, one reviewed place, Website,
   Directions and Claim. Do not submit a claim, booking or account.
4. Confirm public requests never contain names, email addresses, phone numbers,
   account IDs, exact coordinates or persistent browser IDs.
5. Sign in as admin and open `/admin/growth`. Confirm the selected campaign,
   source, device, events and viewed place appear once per deliberate action.
6. Confirm Vercel Analytics receives page views and referrer/device reporting.
7. Confirm anonymous, customer, business and staff users receive a clean denial
   from the Growth page and API.
8. Inspect the analytics table through an anonymous Supabase REST request; it
   must deny reads and writes.
9. Check 7/30/90-day filters, EN/SQ, 1440x900, 768x1024 and 390x844 with no raw
   errors, horizontal overflow or unreadable chart labels.
10. Verify Privacy in EN/SQ states the anonymous analytics purpose, campaign
    labels, excluded identifiers and privacy-signal behaviour.
11. Finish with no business, listing, claim, booking, account or billing record
    changed.

### Later

- reviews only with moderation, eligibility and anti-abuse controls
- saved places and customer collections
- editorial Albania guides and seasonal categories
- demand insights using aggregate, privacy-safe data
