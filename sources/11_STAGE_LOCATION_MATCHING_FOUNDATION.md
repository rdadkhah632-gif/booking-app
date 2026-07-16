# Stage 11 - Location Matching Foundation

Status: Batch 1 implemented, applied to Supabase and access-smoke tested.

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

| Role | Exact coordinate access | Distance matching |
| --- | --- | --- |
| Anonymous/customer | No | Future public API only |
| Staff | No | Not required |
| Business owner | Read own verification row | Future owner preview only |
| Admin | Read verification rows | Operational QA |
| Service role | Read/write | Yes |

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

## Next Batches

### Batch 2 - Business Location Verification

- add server-only Mapbox geocoding
- use `MAPBOX_ACCESS_TOKEN` only on the server
- geocode the business's saved address rather than trusting client coordinates
- show the owner the normalised address and map position for confirmation
- save verified coordinates through the service role
- provide clear stale/needs-review states

### Batch 3 - Customer Nearby Search

- add an explicit `Use my location` action to Explore
- request browser permission only after that action
- send coordinates in a POST body rather than a query string
- preserve current marketplace readiness filtering
- sort verified nearby businesses first
- keep businesses without coordinates available after nearby results
- show approximate distance, never raw coordinates
- keep city search as the full fallback

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
