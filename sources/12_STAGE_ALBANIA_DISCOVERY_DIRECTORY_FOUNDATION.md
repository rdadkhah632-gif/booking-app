# Stage 12 - Albania Discovery Directory Foundation

Status: Batches 1 through 4 are deployed to the repository. SQL 19, SQL 20,
SQL 22 and SQL 24 were applied manually to production Supabase on 19 July
2026. Batch 5 is implemented locally and requires deployment QA. SQL 21 and
SQL 23 belong to the separate customer-app work and are not discovery
dependencies.

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

### 3. Validate without writing

```bash
npm run directory:import -- \
  --input /tmp/mirebook-albania-directory-2026-06-17.jsonl
```

Dry run is the default. It validates every record, refuses mixed releases and
duplicate source IDs, and reports category/city counts. It does not read
Supabase credentials or create an import run.

### 4. Apply only after SQL and sample review

First run `sources/sql/19_albania_discovery_directory_foundation.sql` in the
Supabase SQL editor. Then inspect a representative sample from every category
and major city. Only then run:

```bash
npm run directory:import -- \
  --input /tmp/mirebook-albania-directory-2026-06-17.jsonl \
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
exact PostGIS values and service credentials. Location values are rounded to
four decimals and every result includes durable source attribution.

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
8. Confirm the public API returns that record once with `bookable: false`,
   rounded coordinates and Overture attribution, without source IDs,
   confidence, raw geometry or tokens.
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
to four decimal places before they are sent to the two public server endpoints
for the active request, and those responses use `private, no-store` caching.

SQL 22 adds service-only RPCs for:

- rounded map points for already-published, verified business locations
- reviewed directory search with optional PostGIS distance ordering

Public responses round place/business points to four decimal places. Exact
PostGIS values, Mapbox server credentials, source IDs and confidence values
remain private. If location is declined or unavailable, city/category search
continues to work normally.

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

### Later

- reviews only with moderation, eligibility and anti-abuse controls
- saved places and customer collections
- editorial Albania guides and seasonal categories
- demand insights using aggregate, privacy-safe data
