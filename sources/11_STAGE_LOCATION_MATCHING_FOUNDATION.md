# Stage 11 - Location Matching Foundation

Status: Batch 1 applied and access-smoke tested. Batch 2 deployed and production
QA passed. The owner-side marketplace rollback follow-up is implemented and
awaiting focused deployed QA.

## Purpose

Give Mirëbook a privacy-conscious location foundation for:

- verified business map positions
- nearest-business ordering
- optional customer `Use my location` search
- distance labels in Explore
- future maps, directions and service-area features

Location must improve discovery without becoming a new publication, readiness
or booking rule.

## Existing State Before Batch 1

Mirëbook currently stores free-text business `address`, `city` and `country`.
Explore loads the existing public-safe marketplace response and filters city
text in the browser.

Before this batch there were no:

- business coordinates
- geospatial indexes
- distance queries
- customer location requests
- customer location records

## Batch 1 Architecture

Batch 1 adds `sources/sql/18_business_location_foundation.sql`.

The SQL creates:

- the Supabase PostGIS extension in the `extensions` schema
- a private `business_locations` table
- one coordinate row per business
- a partial GiST index for verified locations
- owner/admin read-only RLS
- server-only coordinate writes
- automatic stale status when address, city or country changes
- a service-only distance function

Exact coordinates are intentionally separate from `businesses`. Public
marketplace/profile APIs must never return the raw `location` value.

## Data Model

`business_locations` contains:

- `business_id`
- `location` as a PostGIS geography point
- provider-normalised address
- geocoding provider and provider place ID
- location precision
- verification status
- verification, creation and update timestamps

Supported verification states:

- `verified`
- `stale`
- `needs_review`

Changing the saved business address, city or country marks an existing
verified coordinate as stale. Stale coordinates cannot participate in
distance matching until a later server-side geocoding batch verifies them
again.

## Access Boundary

| Role               | Exact coordinate access   | Distance matching         |
| ------------------ | ------------------------- | ------------------------- |
| Anonymous/customer | No                        | Future public API only    |
| Staff              | No                        | Not required              |
| Business owner     | Read own verification row | Future owner preview only |
| Admin              | Read verification rows    | Operational QA            |
| Service role       | Read/write                | Yes                       |

Authenticated browser clients receive no insert, update or delete grant on
`business_locations`. Later geocoding must run through a server route using the
existing service-role pattern.

## Preserving Marketplace Rules

`mirebook_business_distances(...)` accepts a list of business IDs from the
caller. The future public API must first run the current publication and
bookability checks, then pass only those eligible IDs into the distance
function.

The function also checks `businesses.published = true`, but it does not replace
the existing readiness logic. Location must never publish, hide or make a
business bookable.

## Customer Privacy

Batch 1 does not request or store customer location.

The planned customer flow is:

1. Customer taps `Use my location` in Explore.
2. The browser requests permission at that moment.
3. Coordinates are sent in a request body to a public-safe server endpoint.
4. The server returns business IDs and approximate distances.
5. Mirëbook does not persist the customer's precise coordinates by default.

City search remains available when permission is denied or location is
unavailable.

## Applying SQL 18

Run `sources/sql/18_business_location_foundation.sql` once in the Supabase SQL
editor. The file is idempotent and safe to rerun.

The migration expects PostGIS to live in the Supabase `extensions` schema. If
PostGIS was previously installed in another schema, the migration stops with a
clear error instead of moving or dropping the extension.

No Vercel environment variable is required for Batch 1.

## Supabase QA

After applying SQL 18, verify:

1. PostGIS is installed in `extensions`.
2. `business_locations` exists with RLS enabled.
3. The verified-location GiST index exists.
4. Anonymous users cannot read `business_locations`.
5. Customers and staff cannot read location rows.
6. An owner can read only the location row for their own business.
7. An admin can read location rows.
8. Browser clients cannot insert, update or delete coordinates.
9. Anonymous/authenticated clients cannot execute
   `mirebook_business_distances`.
10. The service role can execute the distance function.
11. Updating address, city or country changes an existing verified row to
    `stale` without deleting it.

Do not add real coordinates until the server-side geocoding route is present.

## Batch 1 Application QA

SQL 18 was applied to production Supabase on 16 July 2026. A read-only access
smoke test confirmed:

- the service role can read `business_locations`
- the table initially contains no location rows
- anonymous reads are denied
- the service role can execute `mirebook_business_distances`
- anonymous callers cannot execute the distance function
- an authenticated business owner can read through the owner-scoped policy
- an authenticated owner cannot insert coordinates directly
- authenticated browser callers cannot execute the distance function

The rejected owner insert created no row. No production coordinates, business
details, publication states or customer records were changed during QA.

## Batch 2 - Business Location Verification

Batch 2 adds an owner-controlled address verification flow to Business Setup.
It does not change readiness, publication or booking behavior.

Implementation:

- `src/lib/server/mapboxGeocoding.ts` calls Mapbox Geocoding v6 only from the
  server
- `src/pages/api/dashboard/business-location.ts` authenticates the owner,
  checks business ownership and returns public-safe status/candidate data
- `src/components/dashboard-businesses/BusinessLocationVerification.tsx`
  lets an owner find, preview and confirm the saved business address
- Business Profile refreshes the verification state after profile saves
- English and Albanian location states and errors are included

The owner flow is:

1. Add address, city and country, then save Business Profile.
2. Select `Find location`.
3. Review up to three normalised address candidates and optionally load a
   Mapbox static preview.
4. Select the correct candidate and confirm it.
5. Mirëbook re-runs permanent geocoding on the server and saves that provider
   result through the service role.

The confirmation request contains the Mapbox place ID only. It never accepts
latitude or longitude from the browser. The server re-geocodes the current
saved business address and refuses the confirmation if the selected result is
no longer present.

API responses intentionally omit exact coordinates. The owner receives only:

- verification status
- normalised address
- precision label
- provider-safe place ID during candidate selection
- a short-lived Mapbox static preview image only when the owner requests it

The browser never receives the Mapbox access token or candidate coordinates.
The preview is rendered by the Mapbox Static Images API through the protected
owner route, with Mapbox logo and attribution retained. Temporary candidate
results and preview images are not saved.

### Batch 2 Configuration

Add this server-only value locally and to the Vercel project:

```text
MAPBOX_ACCESS_TOKEN=
```

Do not prefix it with `NEXT_PUBLIC_`. Add it to the environments used for QA
and production, then redeploy. Mapbox permanent geocoding must be enabled for
the Mapbox account because confirmed results are stored in Supabase. The token
must also allow `styles:tiles` so the server can render the owner-only static
preview. Use a dedicated restricted token for production rather than relying
on the account default token.

Batch 2 adds no SQL. It uses the already-applied
`business_locations` table from SQL 18.

### Batch 2 QA

After configuring Mapbox and deploying:

1. Open Business Setup as an owner and expand Business Profile.
2. Confirm an incomplete address cannot start map verification.
3. Save a complete address, city and country.
4. Confirm `Find location` returns readable candidates without raw provider
   errors.
5. Load a candidate map preview and confirm it matches the intended business.
6. Confirm the selected location and refresh the page.
7. Confirm the owner sees `Verified` and the normalised address.
8. Confirm one `business_locations` row exists with `provider = 'mapbox'`, a
   verified status and a verification timestamp.
9. Confirm browser network responses contain no raw latitude/longitude,
   PostGIS `location` field or Mapbox access token.
10. Edit and save the address, then confirm the UI changes to `Verify again`.
11. Confirm a different owner receives `403` for this business ID.
12. Confirm direct browser writes to `business_locations` remain denied.
13. Repeat the compact UI check in English, Albanian and at `390x844`.

Until Batch 3, a verified coordinate is private setup data only. Explore does
not request customer location, display distance, reorder results or hide
businesses based on location verification.

### Batch 2 Production QA

Production QA on 17 July 2026 confirmed:

- Mapbox returned readable Tirana candidates for the saved business address
- the protected static preview rendered with Mapbox/OpenStreetMap attribution
- confirmed location state persisted after refresh
- changing the business address marked the location `stale` and prompted the
  owner to verify it again
- owner-facing responses exposed no token, exact coordinates, geometry or
  PostGIS values
- direct authenticated browser writes to private location storage remained
  denied
- English, Albanian and mobile setup states worked without horizontal overflow

The same QA found that the prominent Setup summary exposed publishing but hid
the reversible owner action inside the collapsed profile editor after a business
went live. The primary business now keeps one visible publishing control in the
Setup summary: it publishes while hidden and changes to `Hide from marketplace`
when live. The duplicate primary toggle was removed from the profile editor;
secondary business profiles retain their own scoped toggle.

## Next Batches

### Batch 3 - Customer Nearby Search

- add an explicit `Use my location` action to Explore
- request browser permission only after that action
- send coordinates in a POST body rather than a query string
- preserve current marketplace readiness filtering
- sort verified nearby businesses first
- keep businesses without coordinates available after nearby results
- show approximate distance, never raw coordinates
- keep city search as the full fallback

Stage 12 expands this future search surface with a separate reviewed directory
place type. Nearby search must merge only `active` directory records through a
public-safe server API. It must never read `directory_places` directly from the
browser or describe an unclaimed record as bookable.

### Later, Not Batch 1

- map view
- directions and travel-time estimates
- mobile-service areas
- saved approximate customer area with explicit consent
- city-targeted promotions and aggregate demand reporting
- multiple business locations

## Protected Systems

Batch 1 does not change:

- Explore listing/readiness logic
- booking creation or lifecycle
- availability or slot generation
- auth, role or staff linking
- customer profiles
- billing or payments
- notifications or email
- iOS app behaviour
