# Mirëbook Data Sources and Attribution

This file records external directory-data provenance and launch obligations. It
is an engineering runbook, not legal advice. Recheck provider terms before each
new source or release is shipped.

## Overture Maps Places

Current planned source:

- Provider: Overture Maps Foundation
- Theme: Places
- Release used by Batch 1 tooling: `2026-06-17.0`
- Guide: <https://docs.overturemaps.org/guides/places/>
- Attribution and licensing: <https://docs.overturemaps.org/attribution/>

Overture combines place records from multiple upstream datasets with different
permissive licenses. The public attribution page lists Meta, Microsoft,
PinMeTo, Krick, RenderSEO, DAC, BrightQuery, Foursquare and AllThePlaces for the
June 2026 Places theme.

Mirëbook must:

- retain the Overture release and row-level upstream `sources` metadata during
  import
- keep source attribution available from the customer product
- reproduce any attribution/notice required by an upstream source
- recheck the attribution page when changing Overture releases
- never imply Overture or its upstream providers endorse Mirëbook

Suggested product attribution:

> Place data from Overture Maps Foundation and its listed data providers.

The linked attribution page must remain available alongside that statement.

## Foursquare-Derived Overture Records

Overture's Places attribution identifies Foursquare-derived data as Apache 2.0
and links a required notice:

- License: <https://www.apache.org/licenses/LICENSE-2.0>
- Foursquare OS Places notice:
  <https://opensource.foursquare.com/places-notice-txt/>
- Current Foursquare access documentation:
  <https://docs.foursquare.com/data-products/docs/access-fsq-os-places>

When Mirëbook distributes Foursquare-derived fields, the applicable copyright
and full NOTICE content must be preserved as required by Apache 2.0. Do not
replace the notice with only a Mirëbook credit.

## Google Places

Google Places is not an approved bulk directory source for Mirëbook. Google
Places content has storage, caching and attribution restrictions and must not be
copied into the permanent directory without a separate terms review.

- Policies: <https://developers.google.com/maps/documentation/places/web-service/policies>

Google may be considered later for an interactive lookup experience that
follows its display, caching and attribution rules. It must not be blended into
the Overture import pipeline by default.

## Mapbox

Mapbox currently supports owner-confirmed location verification. It is not the
bulk directory source in Stage 12 Batch 1.

- Search Box API: <https://docs.mapbox.com/api/search/search-box/>

The server-only Mapbox token must remain private. Map tiles/previews must retain
the required Mapbox and OpenStreetMap attribution. Any use of geocoded results
must follow the selected Mapbox endpoint's temporary/permanent storage terms.

## Operator Checklist

Before publishing any imported source:

1. Record source name, release date and access date.
2. Preserve source/upstream attribution metadata per row.
3. Confirm the intended commercial use is permitted.
4. Add required product attribution and NOTICE links.
5. Review a sample for stale, closed, duplicate and miscategorised places.
6. Keep unreviewed rows private.
7. Provide a correction/reporting path.
8. Re-run this review when provider terms or data releases change.

