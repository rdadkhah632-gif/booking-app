# Stage 13 - Customer iOS App Foundation

Status: Batches 13A-13G.14 implementation complete. SQL 21, SQL 23, SQL 25,
SQL 27 and SQL 33 deployment were confirmed. Paid-team certificates, signing
selection, the permanent `com.mirebook.ios.customer` identifier and its
production Push-enabled signed export are complete. Builds `1.0.0 (1)` and
`1.0.0 (2)` were uploaded successfully to App Store Connect; Apple completed
build 2 processing and it is assigned to the existing `Internal QA` group. The
production native API routes are deployed and the live TestFlight
authentication/session flow was confirmed functional on July 31, 2026.
Focused physical-device push, nearby, accessibility and localization QA remain
open. Batch 13G.8 reschedule through Batch 13G.14 service-first booking now
pass on the compact customer QA simulator.

### Batch 13F.6 - First TestFlight Upload

- uploaded `com.mirebook.ios.customer` version `1.0.0` build `1`
- App Store Connect package analysis and upload completed successfully
- Apple completed processing and validated the binary
- App Store Connect reports `App Uses Non-Exempt Encryption: No`; no separate
  export-compliance form was required
- saved first-build internal testing instructions
- created the `Internal QA` group with automatic future-build distribution off
- explicitly added build `1.0.0 (1)`; its group status is `Ready to Test`
- invited the Account Holder as the first internal tester
- the earlier `No provider associated with App Store Connect user` store
  configuration warning did not block package analysis or upload
- no customer, booking, business, account, SQL, environment or production
  setting was changed

## Purpose

Create a separate native Mirëbook customer app for discovering businesses,
booking services and managing customer appointments without changing the
business/staff app or reopening the protected web foundations.

This stage is not a mobile wrapper around the website. It establishes a native
customer product with deliberately narrow API contracts and the same server-
owned lifecycle decisions as the current platform.

## Work Reviewed

The review covered:

- Stage 1 identity, role, staff-linking and language foundations
- Stage 9 auth, RLS and customer data-boundary closure
- Stage 10 business/staff iOS architecture, reliability work and App Review
  notes
- Stage 11 private business-location and planned customer-nearby boundaries
- the current public Explore and business-profile server routes
- customer booking list/detail/reschedule context
- website booking creation, cancellation, reschedule, notification and email
  paths
- the uncommitted Business iOS release-candidate work already present in the
  worktree

The existing Business iOS changes are separate user work and were not modified
by Batch 13A.

## Product Boundary

The customer app is guest-first.

Guests can:

- explore published, bookable businesses
- search by business, category and location text
- open business profiles
- review services, staff, location and booking mode

Customer authentication becomes necessary only when a person chooses to book,
view their appointments, cancel or request a reschedule.

The first release must keep these rules:

- customer appointments are not a Mirëbook payment or checkout flow
- business subscription billing remains separate
- booking status remains `pending`, `confirmed`, `declined`, `completed` or
  `cancelled`
- a pending reschedule request does not replace the confirmed appointment
  until the business accepts it
- all visible app text is present in English and Albanian
- public discovery must not expose private setup, owner or staff account data

## Recommended Navigation

The MVP uses three tabs with an independent `NavigationStack` per tab:

1. Explore
2. Bookings
3. Account

Explore remains available while signed out. Bookings presents native customer
authentication when needed. Account presents language and public help/legal
links while signed out, then profile, preferences and deletion when signed in.

Business profile links route into Explore. Universal links should be enabled
only after `apple-app-site-association` is deployed and verified on the
customer domain.

## Architecture

Minimum OS: iOS 17.

The scaffold uses:

- SwiftUI lifecycle and native controls
- one app-owned observable state for tab and language selection
- environment injection for the shared marketplace client
- local view state for load, retry and search behavior
- async/await with `.task` and cancellation-safe reloads
- typed, lightweight navigation destinations
- direct Supabase Auth REST calls using the public project configuration, with
  no third-party SDK and no direct database access
- server-owned customer profile/session shaping behind bearer-authenticated
  Mirëbook routes
- Keychain-backed refresh credentials with recoverable transient-failure state

The customer and Business apps remain separate Xcode projects and bundle IDs:

- customer: `com.mirebook.ios.customer`
- business/staff: `com.mirebook.business`

Shared code should be extracted only after a stable customer need is proven.
The Business app's role-specific session and operational models should not be
copied wholesale into the customer app.

## Existing Contracts Safe To Reuse

### Public, signed-out reads

- `GET /api/public/explore-businesses`
- `GET /api/public/business-profile?businessId=...`
- `GET /api/public/booking-occupancy?businessId=...&from=...&to=...`

These routes already shape public-safe data on the server and preserve
publication and bookability checks.

### Authenticated customer reads

- `GET /api/customer/app/session-context`
- `POST /api/customer/app/profile`
- `GET /api/customer/bookings`
- `GET /api/customer/bookings?id=...`
- `GET /api/customer/bookings?id=...&include=reschedule`

These routes verify the bearer token, scope rows to the customer and return
safe relation labels after Stage 9 RLS hardening.

## Server-Owned Native Write Contracts

The website still performs several customer mutations directly through the
Supabase browser client. The native app must not independently recreate that
multi-step behavior.

Batch 13B added the narrow customer session/profile boundary and reused the
existing server-owned registration completion route. Batch 13C adds booking
creation. Narrow server-owned routes are still required for the remaining
writes:

1. Customer cancellation with status guard
2. Customer reschedule request creation/update/cancellation
3. Related notification generation for those lifecycle changes
4. Transactional email dispatch after accepted lifecycle writes
5. Account deletion initiation and completion

The server must own success/failure as one customer action. A native client
must not report success if a booking row saved but a required related action
silently failed.

## Auth and Session Direction

Customer auth should use the same Supabase project and established email/
password behavior, but with a customer-specific native session state:

- secure refresh-token storage in Keychain
- guest discovery without a token
- transient offline, timeout, decoding and 5xx errors preserve a recoverable
  stored session
- terminal refresh rejection clears the session
- customer capability is resolved by the server rather than inferred locally
- business/staff accounts are directed to Mirëbook Business without exposing
  business operations in the customer app
- EN/SQ preference is applied immediately and persisted through the existing
  safe profile field

Do not change Stage 1 role/capability interpretation to make native routing
easier.

## Booking Direction

Native booking should preserve the website sequence:

1. Load a fresh public business profile.
2. Select an active service.
3. Select any eligible staff or a specific eligible staff member.
4. Generate business-timezone slots from business/staff availability and
   booking interval, notice, advance and buffer rules.
5. Refresh occupied slots immediately before submit.
6. Ask the server to create the booking with the signed-in customer identity.
7. Receive the server-owned pending/confirmed result.
8. Show a native confirmation and refresh My Bookings.

Slot generation should be extracted into one pure, tested Swift module only
after its API inputs and timezone contract are frozen. Server validation remains
authoritative even when Swift computes the same candidate slots.

## Location and Privacy

Batches 13A and 13B request and store no customer location.

When nearby search is implemented:

- `Use my location` must be an explicit customer action
- permission is requested only after that action
- precise coordinates are sent in a POST body to a public-safe route
- coordinates are not persisted by default
- only approximate distance is displayed
- city search remains the full fallback
- businesses without verified coordinates remain discoverable

Do not add `NSLocationWhenInUseUsageDescription` until the feature exists and
its App Store privacy answers are ready.

## App Review Readiness

Current Apple review rules make the following release gates explicit:

- guest discovery should remain available without login
- if native account creation is added, deletion must be initiable inside the
  app
- privacy policy must be easy to reach in the app and in App Store metadata
- App Review needs a working backend and an active demo customer account or a
  fully featured demo mode for account-only behavior
- app metadata and screenshots must represent the native app rather than only
  a login screen

The server-owned account-deletion route recorded during Stage 10 is still the
main cross-app App Review blocker. One route may serve customer, staff and owner
accounts, but the server must own role-specific retention and responsibility
rules and revoke sessions after acceptance.

Before TestFlight/App Review, also complete:

- final customer App Store icon and accent assets
- paid-team signing and registered bundle ID
- privacy manifest and App Store privacy-label reconciliation after auth,
  booking, location and support features are final
- universal-link associated domain deployment and verification
- physical-device QA in EN/SQ, Dynamic Type, VoiceOver, offline and poor-network
  states
- disposable customer registration, booking, reschedule, cancellation and
  deletion QA against production-safe data

## Batch 13A Implemented

- added the isolated `ios/MirebookCustomer` Xcode project
- added an iPhone-only iOS 17 SwiftUI app target and unit-test target
- added live public marketplace and business-profile API models/client
- added guest Explore search, business details, service and team rendering
- added independent Explore, Bookings and Account navigation stacks
- added deep-link routing foundation for business profiles
- added local EN/SQ selection and matched localization files
- added public support, privacy and terms links
- added the initial no-tracking privacy manifest
- added Debug/Release API configuration without Supabase or server secrets
- added contract tests for public endpoint construction and marketplace decode
- did not change web behavior, database schema, RLS, auth, booking lifecycle,
  notifications, email, billing, location behavior or the Business iOS app

## Batch 13B Implemented

- added a server-owned customer session context that exposes only customer
  identity and safe cross-product access flags
- added a customer-scoped profile update route that can change only the signed-
  in user's name, phone and EN/SQ preference
- reused the existing registration-completion route with explicit
  `account_mode: customer` metadata; no role/capability logic was changed
- added native email/password sign-in, customer registration, verification
  resend and password-reset email flows
- added Keychain refresh-token storage using this-device-only accessibility
- added session restore with token rotation persisted before context loading
- preserved recoverable credentials for network and service failures while
  clearing them after terminal refresh or authorization rejection
- kept guest Explore available during signed-out and recovery states
- added authenticated Account profile editing, language persistence, sign-out
  and a safe Mirebook Business handoff for accounts with business/staff access
- added guest, signed-in and recovery states to My Bookings without fabricating
  booking data before the protected list contract is connected
- added a guarded in-app deletion surface that fails safely while the shared
  server-owned deletion route remains unavailable
- updated the privacy manifest for UserDefaults required-reason use and linked
  app-functionality data used by account authentication/profile behavior
- added English and Albanian coverage for every new visible state
- did not modify the Business iOS project, booking lifecycle, database schema,
  RLS, billing, location behavior or customer appointment payment policy

## Batch 13C Implemented

- added a pure Swift business-timezone slot engine using eligible staff,
  business/staff availability, interval, notice, advance, buffer and fresh
  occupancy rules
- added a native service, any/specific staff, date, time, authenticated customer
  detail and optional-note booking flow
- refreshes the public business profile and selected-day occupancy immediately
  before submit; the Swift slot is advisory and the server remains authoritative
- added `POST /api/customer/app/bookings/create`, which derives customer identity
  and pending/confirmed status on the server and revalidates the selected
  business, service, staff, hours, interval, notice, advance and occupancy
- added SQL 21, a service-role-only transaction that serializes creation per
  staff member and commits the booking plus required customer/business and
  confirmed-staff notifications atomically
- made transactional email explicitly non-authoritative: booking success is
  returned after the database action commits, with email request state reported
  separately
- fails safely with `booking_contract_not_installed` until SQL 21 is deployed;
  the native app never fabricates booking success
- added matched English and Albanian booking copy and business-timezone display
- updated the privacy manifest for optional booking-note content linked only to
  app functionality, with no tracking
- added native contract coverage for timezone slots, staff override, notice and
  advance windows, buffers, any-staff merging, authenticated request shape and
  missing-server-contract failure
- did not add customer appointment payments, weaken RLS, change Stage 1 roles or
  modify the separate Business iOS project

### Batch 13C Deployment Gate

`sources/sql/21_customer_booking_create_contract.sql` deployment was confirmed
after implementation. A disposable customer and published QA business are still
required to verify pending and instant-confirm paths, double-submit contention,
all recipient notifications and email outcomes against production-safe data.

## Batch 13D Implemented

- replaced the signed-in Bookings placeholder with native upcoming/history
  lists, pull-to-refresh and low-frequency polling while lifecycle activity is
  pending
- added native booking detail with business, service, professional, timezone,
  customer note, policy and explicit lifecycle status explanations
- added guarded customer cancellation for pending or confirmed bookings
- added reschedule request creation/update and withdrawal without changing the
  confirmed appointment before business acceptance
- refreshes the server-owned reschedule context immediately before submit and
  reuses the pure Swift timezone slot engine for advisory selection
- added `POST /api/customer/app/bookings/actions`, with customer ownership,
  status, service/staff, interval, notice, advance, hours and occupancy checks
- added SQL 23 service-role-only cancellation and reschedule functions that
  lock lifecycle rows and commit required business/staff notifications in the
  same database action
- cancellation requests the existing customer-cancel transactional email only
  after the database action commits; reschedule email remains explicitly not
  requested while the in-app business notification is authoritative
- expanded the protected booking display route only with safe booking-rule and
  policy fields needed by the native reschedule selector
- added matched English and Albanian copy for list, detail, actions, errors,
  policies and pending-reschedule semantics
- added native contract coverage for booking-list decoding, authenticated
  lifecycle request shapes and safe missing-contract failure
- did not add customer appointment payments, change business acceptance,
  weaken RLS, alter Stage 1 roles or modify the separate Business iOS app

### Batch 13D Deployment Gate

`sources/sql/23_customer_booking_lifecycle_contracts.sql` deployment was
confirmed after implementation. Test cancellation, new/updated/withdrawn
reschedule requests, stale status, occupied-slot contention, recipient
notifications and cancellation email outcomes with disposable accounts before
release.

## Batch 13E Implemented

- added explicit one-shot `Use my location` behavior to Explore; permission is
  requested only after the customer action and city/text search remains usable
  after denial or failure
- sends rounded request coordinates only in a POST body, does not place them in
  URLs or local persistence, and reuses the existing publication, readiness and
  service-only distance boundaries
- sorts verified nearby businesses first, retains businesses without verified
  coordinates and shows approximate distance only
- added a customer-scoped server notification route for the latest 30 inbox
  rows, individual/all read actions and the existing customer email preferences
- added native notification inbox navigation from Account, booking-detail
  handoff, pull-to-refresh and matched English/Albanian states
- added native customer booking-update, reminder and support email preference
  management without disabling authoritative in-app notifications
- added explicit notification permission and APNs registration only after the
  customer opts in; the device token is forwarded over the authenticated app
  route and is never persisted by the iOS client
- added SQL 25 for a private service-managed customer push-device registry with
  no anonymous or authenticated browser grants
- added localized location purpose strings, the Push Notifications capability
  and conservative privacy declarations for location and device identifiers
- did not add background location, save customer coordinates, enable customer
  appointment payments, change booking lifecycle/RLS, or modify the separate
  Business iOS app

### Batch 13E Deployment Gate

SQL 25 was manually applied on 19 July 2026. The remaining deployed check is to
verify anonymous and authenticated browser roles cannot read or write
`customer_push_devices`. APNs provider sending is not implemented in this
batch: paid-team signing, the production App ID capability and a server provider
must be configured before device alerts are called live. Test opt-in, token
rotation/reassignment, opt-out, EN/SQ inbox copy, notification-to-booking
navigation and location allow/deny when a compatible physical device is
available.

## Batch 13F.1 Implemented

- added authenticated `DELETE /api/app/account-deletion` using the existing
  bearer-session and role-context boundary
- requires the exact authenticated account email and returns safe non-success
  responses when the request queue is not deployed or the email does not match
- added SQL 27 for a private service-managed deletion-request queue with no
  anonymous or authenticated browser grants
- records only the user reference, request state, target date and a non-PII
  capability snapshot so business ownership, staff links and admin access can
  be handled without weakening Stage 1 role foundations
- makes repeated requests idempotent while one request is pending or processing
- tells the customer before confirmation that deletion will complete within 30
  days and that legally required records may be retained only as required
- keeps the accepted result visible in English or Albanian before the customer
  chooses `Done and sign out`
- does not automatically delete auth users, businesses, staff links, bookings,
  billing history or other retained records

Apple permits a manual deletion process when it takes time, but requires the
app to state the timeframe and requires completion confirmation. The current
first-party guidance is recorded at
`https://developer.apple.com/support/offering-account-deletion-in-your-app`.

### Batch 13F.1 Deployment Gate

1. Apply `sources/sql/27_account_deletion_requests.sql`. Confirmed on 25 July
   2026.
2. Verify anonymous and authenticated browser roles cannot read, insert or
   update the queue.
3. Deploy the server route and submit a disposable pure-customer request from
   the native app.
4. Confirm one pending row is created, a repeat request remains idempotent and
   an incorrect confirmation email creates no row.
5. Before App Review, assign the operator who will complete requests within 30
   days, apply the legally reviewed retention/anonymization procedure and send
   the promised completion email.
6. Run separate disposable owner and linked-staff completion QA before allowing
   automatic or operator deletion of their shared business records.

## Batch 13F.2 Implemented

- added Debug-only deterministic guest and signed-in customer launch fixtures;
  fixture sessions use in-memory credentials and intercept all marketplace,
  booking and notification requests at `URLProtocol`
- fixture traffic is restricted to `.invalid` hosts and fixture code is removed
  from Release compilation by the `DEBUG` condition
- added a dedicated UI-test target and stable identifiers for tabs, screens,
  marketplace rows, bookings, notifications, auth and account deletion
- added six no-network customer journeys covering guest business discovery,
  signed-in booking detail, notification-to-booking navigation, exact-email
  deletion confirmation, Albanian shell localization and accessibility text
  sizing
- restored signed-in Account links to the customer notification inbox and
  preferences after fixture review found they were only reachable while signed
  out
- did not boot a Simulator automatically and did not reopen physical-device QA

## Batch 13F.3 Implemented

- added the established Mirëbook 1024px no-alpha brand icon to the customer
  asset catalog rather than introducing a second competing logo
- added the customer accent color and connected the icon/accent catalog to both
  app build configurations
- advanced the first customer release identity to `1.0.0 (1)` and connected the
  same Apple team already configured for the separate Business target while
  keeping automatic signing and the distinct `com.mirebook.customer` bundle ID
- added a repository-side App Store submission handoff with review-account,
  guest discovery, deletion, location, notification and no-customer-payment
  review notes
- added a proposed App Store privacy questionnaire covering account data,
  booking notes, one-shot location and opt-in APNs device tokens, with explicit
  legal/server-practice decisions still requiring owner confirmation
- added `Scripts/validate-release.sh` to verify icon shape/alpha, release
  identity, team, production origin, plist parsing, EN/SQ parity and known
  server-secret markers before archive
- did not register an external App ID, create provisioning profiles, upload a
  build or change protected auth, role, booking, RLS or payment behavior

## Batch 13F.4 Implemented

- ran the deterministic customer UI suite on a dedicated small-screen
  Simulator and corrected the regressions it exposed without changing auth,
  role, booking lifecycle, RLS or payment behavior
- kept the signed-in Bookings screen identifier on the actual bookings
  `ScrollView` instead of allowing its parent gate identifier to replace it
- made booking-notification navigation deterministic by marking an unread item
  from the booking-detail destination rather than racing the navigation state
  update
- added stable booking-detail status and service identifiers for UI and
  accessibility verification
- hardened tab selection for the iOS 26.5 accessibility service, which
  intermittently exposes semantic tab labels without the app's custom
  identifiers
- reset the preferred content-size fixture between journeys and kept
  small-screen assertions above the tab bar
- visually inspected the guest discovery fixture at 449×800; the layout was
  readable, unclipped and clear of the tab bar
- did not add the fixture capture to App Store screenshot assets because it
  contains deterministic test data and is not release-safe marketing material

## Batch 13F.5 Implemented

- separated local Personal Team development from the future enrolled-team
  distribution path without removing Push Notifications from the release
  candidate
- Debug no longer requests the APNs entitlement or advertises the Push
  capability to Xcode, allowing automatic free-team signing like the separate
  Business app
- Debug hides the unusable Push Notifications preference and prevents remote
  registration calls while keeping the in-app notification inbox and email
  preferences available
- Release keeps the existing APNs entitlement, push preference and device-token
  registration path behind the explicit `MIREBOOK_PUSH_NOTIFICATIONS`
  compilation condition
- extended release validation to require both the APNs entitlement and the
  Release-only Push compilation path
- documented the temporary local-testing configuration and periodic free
  provisioning-profile refresh requirement

## Validation

- Xcode project and shared scheme discovery: pass
- Debug generic iOS Simulator build: pass
- Release generic iOS Simulator build: pass
- production Next.js build with both customer app routes: pass
- native API/session tests: 9 passed, zero failures, zero skips (3 marketplace,
  6 auth/session)
- Info plist, privacy manifest and EN/SQ localization plist validation: pass
- EN/SQ localization key parity: pass at 94 keys
- production public marketplace response-shape smoke: pass; the endpoint
  returned a valid `businesses` array with zero currently visible businesses

The empty production result is not a native decoding failure, but at least one
published, bookable QA business is required before live visual and end-to-end
customer discovery QA can pass.

### Batch 13C Validation

- production Next.js build including the customer booking-create route: pass
- iOS Debug app and test-target compilation: pass
- Release generic iOS Simulator build, both simulator architectures: pass
- isolated booking slot/network contract suite: 8 passed, zero failures
- Swift formatting validation: pass
- Info plist, privacy manifest and EN/SQ localization plist validation: pass
- EN/SQ localization key parity: pass at 126 keys per language
- final full simulator test launch: environment-blocked after compilation;
  Xcode reported `launchd_sim` could not bind to the simulator session, while
  the isolated booking assertions passed outside that broken runtime
- SQL 21 deployment: confirmed; live booking lifecycle QA remains pending
- Batch 13D iOS Debug app build and test-target compilation: pass
- Batch 13D Release generic Simulator build, both architectures: pass
- Batch 13D booking contract suite: 11 passed, zero failures
- full customer iOS unit suite: 20 passed, zero failures
- Batch 13D TypeScript check with unrelated down-level iteration compatibility
  enabled: pass
- full Next.js build: blocked by a pre-existing TypeScript target issue in
  `src/pages/api/admin/directory-claims.ts`; the Batch 13D files type-check
- SQL 23 execution: confirmed; live customer lifecycle QA remains pending

### Batch 13E Validation

- production Next.js build including the customer notification route and public
  discovery POST support: pass
- TypeScript no-emit check with down-level iteration compatibility: pass
- customer iOS Debug generic Simulator build, both architectures: pass
- customer iOS Release generic Simulator build, both architectures: pass
- full customer iOS unit suite: 24 passed, zero failures (11 booking, 6 auth,
  4 marketplace/nearby and 3 notification/push contracts)
- Info plist, entitlements, privacy manifest and EN/SQ localization plist
  validation: pass
- EN/SQ localization key parity: pass at 226 keys per language
- SQL 25 execution: confirmed on 19 July 2026
- physical-device location allow/deny and APNs registration: deferred until a
  compatible device is available

### Batch 13F.1 Validation

- production Next.js build including `/api/app/account-deletion`: pass
- TypeScript no-emit check with down-level iteration compatibility: pass
- customer iOS Debug Simulator compile: pass
- customer iOS Release Simulator compile: pass
- full customer unit-test bundle, including the scheduled-deletion request and
  response contract: compile pass for arm64 and x86_64 Simulator
- full unit runtime and deletion-result visual QA: pending because no Simulator
  was booted; no Simulator was started automatically
- Info plist, privacy manifest and EN/SQ localization plist validation: pass
- EN/SQ localization key parity: pass at 230 keys per language
- SQL 27 execution: confirmed on 25 July 2026
- deployed disposable-account and queue-RLS QA: pending manual gate

### Batch 13F.2 Validation

- Xcode project and shared scheme parsing/discovery with app, unit and UI-test
  targets: pass
- Swift formatting validation for all changed customer files: pass
- Debug Simulator build-for-testing for app, unit-test and UI-test targets:
  pass
- Release Simulator app build with Debug-only fixtures excluded: pass
- UI-test runtime: pending because no Simulator was booted; no Simulator was
  started automatically
- physical-device QA: remains explicitly deferred

### Batch 13F.3 Validation

- automated release validator: pass for `1.0.0 (1)`, team `6ZYFX4767R`,
  `com.mirebook.customer`, production API origin and 230 EN/SQ keys
- source icon: 1024×1024 PNG with no alpha; asset-catalog compilation: pass
- Debug Simulator build-for-testing with app, unit-test and UI-test targets:
  pass
- unsigned Release device archive: pass for arm64 with compiled icon,
  `Assets.car`, privacy manifest, EN/SQ resources and dSYM
- archived app identity/category/encryption/device-family inspection: pass
- archived Release binary scan confirms Debug-only UI fixture hosts, launch
  flags and customer identities are absent
- signed Organizer validation/TestFlight upload: pending customer App ID,
  Push Notifications capability and distribution-profile availability
- non-mutating signed Release check: expected fail because this Mac has no
  installed development profile matching `com.mirebook.customer`; no
  provisioning update or external identifier creation was authorized
- privacy-response publication: pending production logging/third-party and
  privacy/legal owner confirmation

### Batch 13F.4 Validation

- automated release validator: pass for `1.0.0 (1)`, team `6ZYFX4767R`,
  `com.mirebook.customer`, production API origin and 230 EN/SQ keys
- generic iOS Simulator build-for-testing for the app, unit-test and UI-test
  targets: pass for arm64 and x86_64
- full customer unit suite: 25 passed, zero failures (11 booking, 7 auth, 4
  marketplace and 3 notification contracts)
- deterministic customer UI suite on `Mirebook iPhone SE QA`: 6 passed, zero
  failures, covering guest discovery, signed-in booking detail,
  notification-to-booking navigation, exact-email deletion confirmation,
  Albanian shell localization and accessibility XXXL
- the device-thinned iOS 26.5 Simulator asset-catalog helper was intermittently
  rejected by macOS system policy; the generic Simulator build and installed
  test products remained valid, but Xcode/iOS runtime repair or a Mac restart
  is required if the named-device build continues to fail
- a signed Release provisioning attempt with `-allowProvisioningUpdates`
  reached Apple and failed because the selected Personal Team does not support
  the Push Notifications capability; no compatible paid-team profile is
  installed on this Mac
- signed archive, Organizer validation and TestFlight upload remain blocked
  until an enrolled Apple Developer Program team with Push Notifications is
  installed and selected
- physical-device location, APNs, VoiceOver and network-recovery QA remains
  explicitly deferred until a compatible device is available

### Batch 13F.5 Validation

- Debug build, install and launch on the dedicated iPhone SE Simulator: pass
- signed generic arm64 iPhone Debug build with automatic Personal Team
  provisioning: pass for `com.mirebook.customer`
- signed Debug bundle identity: Apple Development team `6ZYFX4767R`; effective
  entitlements contain only the application/team identifiers and
  `get-task-allow`, with no `aps-environment`
- Release generic Simulator compile with
  `MIREBOOK_PUSH_NOTIFICATIONS` and the production APNs entitlement: pass
- full customer unit suite on iPhone SE Simulator: 25 passed, zero failures and
  zero skips
- automated release validator: pass for `1.0.0 (1)`, team `6ZYFX4767R`,
  Release APNs configuration, production API origin and 230 EN/SQ keys
- physical installation was not attempted because a compatible device remains
  unavailable; free-team profiles expire periodically and require a Debug
  rebuild/reinstall
- Simulator accessibility inspection was interrupted by an unrelated
  CoreSimulator SpringBoard crash after the successful build and launch; the
  compiler, signed-device build and unit suite were unaffected

### Batch 13F.6 Validation

- paired, wired iPhone SE (3rd generation) on iOS 26.1 detected with Developer
  Mode and developer disk-image services available
- production-backed Personal Team Debug build installed and launched on the
  physical phone: pass for `com.mirebook.customer`
- physical-device XCTest guest journey: 1 passed, zero failures and zero
  skips, covering Explore, business selection and the matching business-detail
  service/staff content
- Apple free-profile three-app limit initially blocked the disposable customer
  UI-test runner; the stale Business UI-test runner was removed, the test was
  rerun successfully and the temporary customer runner was removed afterward
- the production-backed Debug build was reinstalled after fixture QA and left
  running on the phone; neither production data nor repository environment
  configuration was changed
- Debug remains intentionally push-free under Personal Team signing; APNs,
  location allow/deny, VoiceOver, live authentication/booking and degraded
  network recovery still require manual physical-device QA
- the free provisioning profile expires on 1 August 2026 and will require a
  Debug rebuild/reinstall unless the paid team is selected first

### Batch 13G.1 - Discovery Home Foundation

Implemented:

- Explore now loads ready, published Mirëbook businesses and reviewed public
  directory places concurrently through their existing public-safe APIs
- directory places remain a separate `directory_place` result type, are
  accepted only when `bookable` is false and are deduplicated only when their
  linked ready business is present in the same discovery snapshot
- one source can remain visible with a calm partial-results notice if the other
  public source is temporarily unavailable
- the guest-first discovery home adds a project-owned Albania introduction,
  opt-in nearby ordering, city and category filters, deterministic featured
  local places, bookable-business and local-place sections, and filter-aware
  empty states
- native directory detail loads only the active public-safe place contract and
  exposes directions, phone, website, report, Business claim handoff and
  durable source attribution without a booking action
- the iOS discovery search now consumes the existing safe active-service names,
  making the business/service/city search prompt truthful
- EN/SQ customer localization remains in parity at 276 unique keys per
  language

Validation:

- Debug build, install and fixture launch on `Mirebook iPhone SE QA`: pass
- simulator visual inspection at the SE-sized viewport: pass for search, hero,
  location control and browse-section entry without an automatic permission
  request
- full customer unit suite: 29 passed, zero failures and zero skips, including
  mixed-source loading, linked-result deduplication, search/filter matching,
  partial-source fallback, two-endpoint location POST bodies and rejection of
  any bookable directory payload
- all seven deterministic customer UI scenarios passed across the initial and
  focused reruns, including native reviewed-place details, non-bookable copy,
  source attribution and accessibility XXXL reachability
- one subsequent aggregate UI rerun was stopped after CoreSimulator hung while
  establishing its first automation session; no assertion ran in that attempt
  and the same scenarios had already passed
- production Next.js build with public active-service names: pass
- automated release validator: pass for `1.0.0 (1)`, Personal Team Debug /
  enrolled-team Release signing split, production API origin and 276 EN/SQ keys
- read-only production directory smoke: exactly eight public places, zero
  unsafe/bookable records and no checked private provenance/location fields
- production-backed arm64 Debug build and install on the wired iPhone SE: pass;
  the final automated launch request was denied only because the phone remained
  locked, so opening the installed app is the remaining physical confirmation
- no SQL, directory review state, business publication state, booking, account,
  environment or production setting was changed

## Next Batches

### Batch 13G.2 - Native Discovery Map And Personalisation

Implemented:

- native MapKit discovery is built directly from the shared 13G.1 result
  snapshot, with visually distinct bookable-business and reviewed local-place
  markers
- selecting a marker exposes a matching summary card and routes to the existing
  native business or non-bookable place detail
- map construction accepts only valid public business locations and the coarse
  public directory `mapPosition`; invalid or absent coordinates never create a
  marker
- the List/Map choice is remembered in app preferences, while nearby customer
  coordinates remain one-shot state and are never persisted
- signed-in Book again is derived only from completed or elapsed confirmed
  customer appointments, deduplicated by recent business and intersected with
  businesses that are still published in the current discovery response
- signed-out users, customers without eligible history and booking-history
  request failures see no empty or invented personalisation section
- EN/SQ customer localization remains in parity at 290 unique keys per
  language

Validation:

- Debug simulator compile and deterministic fixture launch: pass
- full customer unit suite: 31 passed, zero failures and zero skips, including
  valid public marker construction, invalid-coordinate rejection and truthful
  Book again eligibility/current-business intersection
- deterministic guest native-map UI journey: pass, including separate
  Bookable and Local place labels with no signed-in history section
- deterministic signed-in Book again UI journey: pass after assigning its
  repeated business card a dedicated stable accessibility identifier
- automated release validator: pass for `Mirëbook Customer 1.0.0 (1)` and 290
  EN/SQ localization keys
- production-backed Personal Team Debug arm64 build: pass using the generic iOS
  destination to avoid the known Xcode 26 device-thinned asset helper stall
- updated app installation on the paired iPhone SE: pass; automatic launch was
  denied only because the device remained locked
- no SQL, booking, account, directory record, environment file or production
  setting was changed

Remaining physical QA:

- unlock and open the installed app, then complete location allow/deny,
  EN/SQ, VoiceOver and degraded-network checks on the physical phone

### Batch 13G.3 - Physical Discovery Closure Foundation

Implemented:

- discovery markers now use a small native `MKMapView` bridge so each
  business/place annotation has an app-owned accessibility identity and a
  reliable native selection delegate
- selecting a marker exposes the matching SwiftUI summary and routes into the
  existing business or non-bookable place detail without adding a booking or
  payment path
- marker appearance remains distinct for bookable businesses and local places,
  while pan, zoom, compass, scale and automatic all-marker framing remain
  native MapKit behavior
- Debug-only UI fixture startup can intentionally preserve the stored List/Map
  choice, allowing relaunch persistence to be verified without weakening the
  normal clean-fixture default

Validation:

- clean simulator compile: pass with zero warnings
- deterministic marker route: pass from Map to Bunk'Art 2 summary and matching
  non-bookable place detail, with no booking action exposed
- deterministic Map preference relaunch: pass
- full customer unit suite: 31 passed, zero failures and zero skips
- automated release validator: pass for `Mirëbook Customer 1.0.0 (1)` and 290
  EN/SQ localization keys
- physical XCTest launch was attempted against the paired iPhone SE but Xcode
  temporarily exposed no physical destination because CoreDevice reported no
  active developer tunnel; reconnect/unlock and physical location,
  localization, VoiceOver and degraded-network QA remain open
- no SQL, booking, account, directory record, environment file or production
  setting was changed

### Batch 13G.4 - Location-Led Discovery Map

Implemented:

- a successful explicit nearby request temporarily presents Map so the customer
  immediately sees the location-led discovery context
- the automatic Map presentation is ephemeral: it does not overwrite the
  customer's remembered manual List/Map preference, and selecting a mode
  manually clears the temporary override
- the customer position appears as a separate blue MapKit marker and localized
  legend entry; it is never counted or routed as a public business/place result
- clearing nearby removes the customer marker and returns to the previously
  remembered manual discovery mode
- customer coordinates remain in-memory only and continue to be sent solely in
  the existing one-shot nearby request body
- Debug-only fixtures can return a deterministic coordinate without invoking a
  real location permission prompt
- EN/SQ customer localization remains in parity at 291 unique keys per language

Validation:

- Debug simulator build and deterministic Albanian nearby fixture: pass with
  zero compiler warnings
- focused UI journey: pass for explicit nearby request, automatic Map
  presentation, distinct customer annotation and visible/accessible
  `Vendndodhja juaj` localization
- exploratory reruns exposed and corrected MapKit annotation collision handling
  plus over-coupled test assumptions about marker interactivity and lazy List
  rendering
- one extended manual-control rerun was invalidated after another local task
  foregrounded Mirëbook Business on the shared simulator; the existing
  dedicated List/Map preference test remains the latest valid persistence
  baseline
- a fresh full unit-suite attempt built its test products successfully but the
  simulator runner then hung before assertions; the latest completed baseline
  remains 31 unit tests passed with zero failures
- no SQL, booking, account, directory record, environment file or production
  setting was changed

### Batch 13G.5 - Production Connection Closure And Customer UX Polish

Implemented:

- deployed the current Next.js production workspace so the protected native
  session, profile, notification, booking and account-deletion routes are
  available on `mirebook.com`
- retained the established bearer-authentication and anonymous `401
  auth_required` boundary on every protected native route
- confirmed the physical TestFlight customer app can sign in, restore its
  session and load production-backed customer content without the previous
  connection-interrupted state
- added shared SwiftUI layout/card/action primitives without changing app
  navigation, authentication state or API ownership
- compressed the Explore hero and nearby-location surface so filters and the
  first discovery section are reachable sooner on small screens
- tightened discovery cards and the map height while retaining native MapKit
  interaction, result counts and List/Map preference behavior
- changed place, booking and service actions to consistent full-width small-
  screen layouts with a clear primary/secondary hierarchy
- corrected dynamic directory-category localization so place details no longer
  expose a raw translation key
- added safe bottom scroll spacing above the floating tab bar on discovery,
  detail and booking surfaces and improved Account form action emphasis
- no SQL, booking, account, directory record or production environment value
  was changed by the polish work

Validation:

- Vercel production deployment: ready; `mirebook.com`, `www.mirebook.com` and
  `business.mirebook.com` aliases respond normally
- anonymous live endpoint smoke: homepage and Explore `200`; all seven tested
  protected native routes return `401 auth_required` rather than `404`
- production runtime-error scan immediately after deployment: zero errors
- physical TestFlight customer authentication/session/content flow: confirmed
  functional by the tester
- Debug build, install and deterministic fixture launch on the isolated
  `Mirebook Customer Temp QA` Simulator: pass
- simulator visual QA at 368×800: pass for compact Explore, reviewed-place
  detail, signed-in booking detail and Account action hierarchy
- full customer unit suite: 31 passed, zero failures and zero skips
- focused customer UI suite: 5 passed, zero failures and zero skips, covering
  guest business discovery, reviewed-place detail, native Map, signed-in
  booking detail and accessibility text sizing
- automated release validator: pass for `Mirëbook Customer 1.0.0 (1)` and 291
  EN/SQ localization keys

### Batch 13G.6 - Booking Flow Polish And TestFlight Build 2

Implemented:

- removed redundant visible picker labels from the service, professional, date
  and time sections while retaining their accessibility labels
- changed the booking submission control to the shared full-width primary
  action treatment and added safe grouped-form keyboard and bottom spacing
- added a stable booking-submit accessibility identifier and a deterministic
  signed-in UI regression that opens the booking sheet and reaches the action
- incremented the customer app to `1.0.0 (2)` without changing its permanent
  bundle identifier, production API origin or booking contracts
- added a reusable App Store Connect upload export configuration for the
  enrolled team
- no customer, booking, business, account, SQL, environment or production
  setting was changed

Validation and release:

- isolated simulator build and visual QA at 368×800: pass for the compact
  booking form and full-width booking action
- full customer unit suite: 31 passed, zero failures and zero skips
- focused six-scenario UI coverage: four passed in the grouped run; the guest
  Explore and new booking-flow checks then passed independently after the new
  test was corrected to scroll to its off-screen action
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 291
  EN/SQ localization keys
- arm64 Release archive: pass for bundle `com.mirebook.ios.customer`, version
  `1.0.0`, build `2`
- final distribution signature and embedded profile: pass with
  `aps-environment=production`, `get-task-allow=false` and strict signature
  verification
- App Store Connect package analysis and upload: success; Apple completed
  processing
- explicitly assigned build `1.0.0 (2)` to `Internal QA`; its TestFlight detail
  reports one internal group with the existing tester

### Batch 13G.7 - Customer Notification Center Polish

Implemented:

- replaced the dense notification list with a custom card feed grouped into
  localized New and Earlier sections with truthful per-section counts
- retained pull-to-refresh, Mark all read, individual read state and the
  existing notification-to-booking-detail route without changing notification
  contracts or server ownership
- made unread cards visually distinct while keeping read updates calm and
  preserving stable accessibility identities for deterministic UI coverage
- aligned email preference save, device-alert enable/disable and Settings
  actions with the shared full-width customer action treatment
- added safe grouped-form bottom spacing and a stable notification-preferences
  screen identity for compact-screen and accessibility QA
- extended the signed-in fixture with one read update so both inbox groups are
  covered without production data
- EN/SQ customer localization remains in parity at 293 unique keys per
  language
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- full customer unit suite: 31 passed, zero failures and zero skips
- focused English UI coverage: 2 passed, covering New/Earlier grouping,
  notification-to-booking navigation and the preference-screen save action
- focused Albanian UI coverage: 1 passed, covering the in-app SQ language path
  and both localized notification group headings
- the first compact-simulator UI attempt exposed a test-only full-swipe
  overscroll before Notifications; the Account navigation helper now uses
  deterministic small drags and all three focused journeys pass on the iPhone
  SE simulator
- Debug build, install and signed-in fixture launch: pass
- Release simulator compile: pass
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 293
  EN/SQ localization keys
- physical push delivery, notification-permission states and VoiceOver remain
  part of the existing physical-device follow-up

### Batch 13G.8 - Customer Reschedule Flow Polish

Implemented:

- aligned the protected reschedule sheet with the initial booking form using a
  grouped layout, hidden duplicate picker labels and safe bottom spacing
- made the reschedule submission a clear full-width primary action with its
  existing disabled/loading behavior preserved
- kept current appointment context, staff preference, date, available-time
  calculation and explanatory pending-request copy in one concise flow
- added stable accessibility identities for the booking-detail handoff,
  reschedule screen, staff/date/time controls and submit action
- extended only the deterministic signed-in UI fixture with a public-safe
  reschedule context; the production API, slot validation and lifecycle action
  contract are unchanged
- added a focused UI journey from My Bookings through Booking details into the
  populated reschedule form
- reused the existing EN/SQ copy, which remains in parity at 293 unique keys
  per language
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting and strict lint: pass
- complete app, unit-test and UI-test build-for-testing compilation: pass
- direct parse validation of all changed Swift sources: pass
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 293
  EN/SQ localization keys
- full customer unit suite: 31 passed, zero failures and zero skips
- focused reschedule UI journey: 1 passed on the compact customer simulator
- the first completed runtime attempt exposed a time-of-day-dependent fixture:
  its synthetic hours ended at 17:00 Tirana, so no time row existed after that
  cutoff; the UI-only fixture now provides full-day test availability and the
  production slot engine and availability contracts remain unchanged

### Batch 13G.9 - Customer Account Entry Polish

Implemented:

- made Create account and Forgot password clear, full-row choices with stable
  icon treatment on the signed-out Account screen
- aligned customer registration and password reset with the shared grouped-form
  background, keyboard dismissal and safe compact-screen bottom spacing
- made registration, verification resend and password-reset actions consistent
  with the customer app's full-width primary/secondary action treatment
- kept the verification email selectable so a customer can check or copy the
  exact address used during registration
- added stable accessibility identities for both sheets, every registration
  field, reset email, submit/resend actions and close controls
- added a deterministic guest UI journey covering Account, Create account,
  registration fields, sheet dismissal and password reset without network or
  production data
- reused the existing EN/SQ copy, which remains in parity at 293 unique keys
  per language
- preserved the existing sign-in, sign-up, verification, reset, profile,
  session, role and language-persistence behavior
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint and direct parse validation: pass
- focused guest account-entry UI journey: 1 passed on the compact customer
  simulator
- focused reschedule UI journey from Batch 13G.8: 1 passed after making its
  deterministic fixture independent of the local time of day
- full customer unit suite: 31 passed, zero failures and zero skips
- Release simulator compile: pass
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 293
  EN/SQ localization keys
- physical keyboard, VoiceOver and real email verification/reset delivery stay
  within the existing physical-device and real-inbox follow-up

### Batch 13G.10 - Signed-In Account And Data-Control Polish

Implemented:

- added a compact signed-in identity header with customer initials, name and a
  selectable account email, removing the duplicate email row from the profile
  editor
- kept full name and phone editing in the existing protected profile section
  while adding stable identities for both fields and the save action
- aligned Sign out and Delete account with the shared full-width Account action
  treatment while preserving the destructive distinction and confirmation
  boundary
- aligned the deletion sheet with the grouped customer form background,
  compact-screen spacing and keyboard dismissal used elsewhere in the app
- made the deletion request a clear full-width destructive action while
  retaining exact-email gating, the final native confirmation alert and the
  scheduled-deletion result
- added stable identities for the signed-in header, profile controls, business
  handoff and deletion screen without exposing account or role internals
- expanded the deterministic deletion journey to cover the signed-in identity
  and profile surface before completing the protected request flow
- reused the existing EN/SQ copy, which remains in parity at 293 unique keys
  per language
- preserved profile persistence, language persistence, role/capability
  interpretation, session behavior and the account-deletion contract
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint and direct parse validation: pass
- focused signed-in Account and deletion UI journey: 1 passed on the compact
  customer simulator, including exact-email gating and the scheduled result
- focused guest registration and password-reset regression journey: 1 passed
- full customer unit suite: 31 passed, zero failures and zero skips
- Release simulator compile: pass
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 293
  EN/SQ localization keys
- physical keyboard, VoiceOver and production account-deletion operator
  completion remain within the existing physical and operational follow-up

### Batch 13G.11 - My Bookings Organization And Card Polish

Implemented:

- separated Upcoming and History into a native segmented view when both groups
  exist, reducing the length and cognitive weight of the default bookings feed
- retained a direct single-section view when only Upcoming or History exists,
  so customers are not shown a redundant filter
- made upcoming appointments deterministic and useful by sorting the nearest
  appointment first while retaining newest-first ordering for history
- added localized section headings with truthful counts and stable identities
  for Upcoming and History
- strengthened booking cards with a status-colored edge, explicit status/date/
  staff identities and an end-of-row navigation affordance
- preserved pull-to-refresh, live polling, booking-detail navigation, pending
  change-request context and every existing lifecycle action
- extended the deterministic English journey to switch Upcoming to History and
  back before opening the confirmed booking detail
- extended the existing Albanian signed-in journey to verify both localized
  booking segments before continuing into localized Notifications
- reused the existing EN/SQ copy, which remains in parity at 293 unique keys
  per language
- no booking status, lifecycle rule, API shape, polling interval or protected
  data boundary was changed
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint and direct parse validation: pass
- focused English booking organization/detail journey and Albanian booking/
  notification localization journey: 2 passed on the compact simulator
- accessibility XXXL text-size booking reachability smoke: 1 passed
- full customer unit suite: 31 passed, zero failures and zero skips
- Release simulator compile: pass
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 293
  EN/SQ localization keys
- physical VoiceOver, real production booking volume and physical-device
  localization remain within the existing release follow-up

### Batch 13G.12 - Customer Journey Completion And Recovery Polish

Implemented:

- replaced the minimal post-submit booking confirmation with a clear localized
  status card, pending/confirmed guidance, appointment summary and full-width
  My Bookings action
- strengthened booking detail hierarchy with status-specific symbols,
  consistently bordered appointment/policy/action cards and stable service,
  time, duration, professional, location, notes and action identities
- grouped confirmed and pending lifecycle controls under a localized Manage
  booking section while preserving every existing confirmation and server
  action boundary
- added a useful next-step card for completed, declined and cancelled bookings
  that returns customers to Explore without attempting to recreate a booking
- introduced one reusable, scroll-safe customer state card for signed-out
  booking/notification gates, booking authentication handoff, empty bookings,
  load failure and protected session recovery
- made retry, sign-in, alternate-account and empty-state actions full-width and
  independently accessible on compact and large Dynamic Type layouts
- added stable Customer support, Privacy policy and Terms of service identities
  without changing their public Mirebook destinations
- added Debug-only deterministic fixtures for confirmed/pending booking
  confirmation, zero bookings and booking-load failure
- expanded UI coverage across English confirmation/detail/reschedule, Albanian
  pending confirmation/detail/notifications, signed-out bookings/help, empty
  bookings, retry behavior and accessibility XXXL detail reachability
- added seven EN/SQ keys with parity at 300 unique keys per language
- preserved auth/session ownership, role/capability interpretation, booking
  creation and lifecycle contracts, polling, RLS and production API behavior
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint and direct parse validation: pass
- Debug compact-simulator build and launch: pass with zero warnings
- ten focused customer UI journeys: pass on the compact simulator, including
  EN/SQ confirmation, active and completed booking detail, reschedule,
  signed-out/help, empty/retry and accessibility XXXL coverage
- full customer unit suite: 31 passed, zero failures and zero skips
- EN/SQ localization parity: 300 unique keys per language with no duplicates
- Release simulator compile: pass with zero warnings
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 300
  EN/SQ localization keys
- physical VoiceOver, real unstable-network session recovery and production
  post-booking confirmation remain within the later review/device follow-up

### Batch 13G.13 - Contextual Location And Explore Friction Reduction

Product benchmark:

- follow Booksy's short discover-service-time-booking path and Airbnb's
  content-first search/map hierarchy rather than reproducing either product's
  visual identity
- keep one obvious primary action per state, remove explanatory controls that
  do not advance the journey and use motion only to preserve context
- request protected capabilities at the moment their value is visible, not as
  an unrelated launch interruption

Implemented:

- removed the large manual Use my location card, its Refresh/Clear controls and
  the promotional Explore hero so useful discovery content starts one screen
  earlier
- moved the native List/Map selector immediately below search, before city and
  category filters, making Map reachable without scrolling
- opening Map now requests When-In-Use location automatically when permission
  has not been decided; Explore launch itself does not prompt while List is the
  active view
- a previously granted location permission is reused automatically for
  nearby-first results without requiring another customer tap
- remembered Map mode requests location on relevance when Explore reopens,
  while denied or unavailable location leaves Map and city search fully usable
- replaced the former location control with a compact non-interactive status
  line shown only while requesting, when nearby ordering is active, or when Map
  needs to explain unavailable access
- nearby discovery refreshes an already-loaded Explore screen in place instead
  of flashing back to the full loading skeleton
- added restrained 180-220ms transitions for List/Map content, filter selection,
  location status and refreshed discovery state; existing marker-summary motion
  remains short and contextual
- updated the EN/SQ system permission explanation to state that location is
  used when Map opens to show nearby places and businesses
- removed three obsolete manual-location translation keys, retaining EN/SQ
  parity at 297 unique keys per language
- added deterministic tests for previously authorized automatic refresh and
  Map-relevant location activation, and updated EN/SQ UI journeys to prove no
  manual location button remains
- coordinates remain rounded, one-shot, absent from persistent storage and
  sent only to the existing shaped public discovery endpoints
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint, direct parse and Info.plist validation: pass
- Debug compact-simulator build and launch: pass with zero warnings
- live simulator interaction: Explore produced no launch prompt; tapping Map
  produced the localized iOS permission dialog; Allow Once exposed the user
  marker and nearby-first status without blocking the map
- seven focused Explore/Map UI journeys: pass, covering list discovery, Map,
  marker detail, remembered Map mode, automatic Albanian location, Albanian
  shell and accessibility XXXL reachability
- full customer unit suite: 33 passed, zero failures and zero skips
- Release simulator compile: pass with zero warnings
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 297
  EN/SQ localization keys
- physical permission wording, reduced-accuracy location and motion/VoiceOver
  quality remain within the later device and full-product interaction review

### Batch 13G.14 - Service-First Business And Booking Entry

Product benchmark:

- apply Booksy and Fresha's short service-to-availability method while using
  Airbnb's content-first detail hierarchy; do not reproduce another product's
  screen, branding or exact visual treatment
- make price, duration and useful service context comparable before the booking
  tap, then keep one persistent primary action through availability selection
- prefer visible one-tap choices over controls that hide the available options
  behind an additional picker

Implemented:

- removed the duplicate business name from the navigation bar and kept one
  content-led business identity beside category, location and description
- changed each service from a card plus a repeated full-width booking button
  into one tappable comparison row with name, duration, description, price and
  a compact booking affordance
- compressed the team from a long vertical card stack into a horizontal people
  strip so services keep priority without hiding professional context
- removed the non-actionable booking-readiness explanation at the bottom of the
  business profile
- retained the selected service on booking entry and exposes a secondary
  Change service menu only when the business has alternatives
- replaced the professional picker with visible one-tap choices and the time
  picker with an adaptive grid of available times
- compressed customer identity into one booking-for card, retained optional
  notes and kept the instant/request booking explanation as a compact status
  line
- anchored the single Book appointment action below the scrollable choices;
  the secondary service/time summary is omitted at accessibility text sizes so
  the primary action remains reachable
- added restrained 180ms selection transitions without changing navigation or
  adding decorative motion
- added deterministic multi-service and next-day availability fixtures plus a
  direct booking-flow fixture that proves a visible time enables the primary
  action
- removed obsolete booking-readiness and old customer-details copy, added the
  new EN/SQ interaction copy and retained parity at 298 unique keys per language
- preserved slot generation, fresh pre-submit profile/occupancy validation,
  customer authentication, booking status rules, API shapes, RLS and every
  existing lifecycle boundary
- no build number was incremented and no customer, booking, business, account,
  SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint, direct parse and localization plist checks:
  pass
- Debug simulator compile and direct visual review: pass with zero warnings;
  the service, professional, date, visible time grid and sticky CTA fit the
  449x800 simulator surface without horizontal overflow
- five focused new UI journeys: pass for English business comparison, signed-in
  booking entry, visible-time CTA enablement, Albanian entry and accessibility
  XXXL reachability
- four booking regression UI journeys: pass for confirmed and pending
  confirmation, booking detail and reschedule
- full customer unit suite: 33 passed, zero failures and zero skips
- Release simulator compile: pass with zero warnings
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 298
  EN/SQ localization keys
- physical VoiceOver ordering, real multi-service businesses and real
  production availability remain within the later device/full-product review

### Batch 13G.15 - Reviewed Place Detail Action Hierarchy

Product benchmark:

- follow Apple's current control hierarchy guidance by giving one
  nondestructive, most-likely action the prominent style and retaining full
  touch targets for secondary actions
- use Airbnb's content-to-location continuity and Booksy's direct local-contact
  method as interaction references without reproducing either product's visual
  design, branding or screen structure

Implemented:

- kept the reviewed place identity, category, description and explicit
  non-bookable status content-first
- grouped the verified address with one prominent Get directions action that
  hands the destination to the native Apple Maps directions surface
- replaced duplicate phone facts and generic buttons with compact one-tap Call
  and Website rows that expose the real phone number and website host
- made the contact rows adapt from side-by-side to stacked layout when width or
  Dynamic Type requires more room
- grouped source attribution and Report into one lower-priority place-data card
  while keeping both visible and directly actionable
- moved ownership/claim content below the customer-facing source and report
  information and kept Claim as a compact secondary action
- added stable accessibility identifiers for location, directions, phone,
  website, attribution, report and claim without merging their VoiceOver
  identities
- added deterministic English, Albanian and accessibility XXXL UI journeys for
  the complete place action hierarchy
- retained the existing 298 EN/SQ localization keys with exact parity
- preserved public directory shaping, non-bookable behavior, external support
  and business claim destinations, booking rules, authentication, RLS and all
  production data boundaries
- no build number was incremented and no directory record, customer, booking,
  business, account, SQL, environment or production setting was changed

Validation:

- Swift formatting, strict lint, direct parse and localization plist checks:
  pass
- Debug compact-simulator build and direct 449x800 visual review: pass; the
  content hierarchy has no horizontal overflow or clipped controls
- three focused place-detail UI journeys: pass for English, Albanian and
  accessibility XXXL reachability
- four surrounding Explore/Map regression UI journeys: pass, including business
  discovery, Map entry, marker-to-place detail and the Albanian guest shell
- full customer unit suite: 33 passed, zero failures and zero skips
- Release simulator compile: pass with no app-source compiler warnings; Xcode's
  metadata processor emitted only the expected App Intents extraction-skipped
  notice because the app does not link AppIntents
- automated release validator: pass for `Mirëbook Customer 1.0.0 (2)` and 298
  EN/SQ localization keys
- physical VoiceOver ordering and real Phone, Website, Directions, Report and
  Claim handoffs remain within the later device/full-product review

### Batch 13F.4 - Paid-Team Signing Activation

Completed:

- created paid-team Apple Development and Apple Distribution identities
- changed only the Customer app target's Debug/Release signing team to enrolled
  team `42V884483P`
- confirmed the full arm64 Release target compiles and creates a store-valid
  unsigned structural archive

Blocked:

- Apple rejected registration and App Store export for
  `com.mirebook.customer` because the identifier is unavailable to the enrolled
  team
- local provisioning evidence shows the former Personal Team previously
  provisioned this exact customer identifier
- no Customer distribution profile or signed IPA was created
- resolving this requires an explicit product identity decision: release/delete
  the old-team identifier if it is safe to do so, or adopt a new permanent
  Customer bundle identifier

No App ID was deleted, no alternative identifier was registered, and no build
was uploaded.

### Batch 13F.5 - Permanent Paid-Team Customer Identity

Completed:

- adopted the approved permanent `com.mirebook.ios.customer` bundle identifier
  for the app, unit tests, UI tests, URL identity and Keychain namespace
- updated the server-owned push registration/filtering contract to the same
  identifier
- updated the clean-install SQL 25 contract and added SQL 33 to migrate the
  already-deployed constraint and preserve any existing private device rows
- updated release validation to require enrolled team `42V884483P` and the
  permanent bundle identifier
- Apple accepted the new App ID and generated an App Store profile whose
  application identifier is
  `42V884483P.com.mirebook.ios.customer`
- the store profile contains `aps-environment=production`
- Release validation passed for `1.0.0 (1)` with 291 EN/SQ localization keys
- the arm64 Release archive compiled successfully and a local distribution IPA
  export was created without uploading
- the final app and embedded profile both contain
  `aps-environment=production`; the executable is signed by
  `Apple Distribution: Reza Dadkhah (42V884483P)`, has
  `get-task-allow=false`, and passes strict signature verification
- the production web build passed after the server bundle-ID update

Remaining:

- register a compatible physical iPhone to enable the ordinary automatic
  Development-profile archive path
- App Store Connect still reports no provider association during local export;
  recheck account activation before the first TestFlight upload

The former Personal Team App ID was not deleted and no build was uploaded.

SQL 33 production verification:

- the private `customer_push_devices` table is reachable server-side
- its `app_bundle_id` schema description matches SQL 33's permanent paid-team
  identifier migration
- the table currently contains zero rows, so no former bundle-ID device record
  remains to migrate

### Batch 13F.6 - TestFlight Build 3 Upload

Prepared:

- incremented only the customer app target from build 2 to build 3 while
  retaining marketing version `1.0.0`
- release validation passed for `Mirëbook Customer 1.0.0 (3)` with 298 matched
  EN/SQ localization keys
- confirmed App Store Connect still exposes processed builds 1 and 2 and build
  2 remains assigned to the `Internal QA` group
- confirmed the paid-team Apple Distribution identity is installed
- confirmed the existing store profile is valid through 26 July 2027, targets
  `42V884483P.com.mirebook.ios.customer`, has `get-task-allow=false` and carries
  `aps-environment=production`
- created and structurally validated a 64-bit arm64 Release archive containing
  bundle `com.mirebook.ios.customer`, version `1.0.0`, build `3` and the privacy
  manifest

Signing note:

- Xcode's ordinary automatic archive path still requests an iOS Development
  profile and is blocked until the team has a registered physical device
- the store distribution profile itself is present and valid; as with the
  earlier successful TestFlight preparation, build 3 therefore uses an
  unsigned structural archive before Xcode's App Store export pipeline signs
  the delivered app

Completed after explicit confirmation:

- Xcode's App Store export pipeline signed and uploaded build 3 successfully
- App Store Connect completed processing with no upload warning or error and
  exposes `1.0.0 (3)` as `Ready to Submit`
- added build 3 to the existing `Internal QA` group with one internal tester
- added focused TestFlight notes covering Explore List/Map, Map-relevant
  location activation, reviewed place handoffs, service-first booking, EN/SQ,
  large text, authentication, booking management and network recovery
- no external testing group, Beta App Review or public App Review submission
  was started

### Batch 13F - Release Candidate

- apply SQL 33, verify the production Push entitlement in the final signed
  executable and upload the first approved build to TestFlight
- capture final App Store screenshots from release-safe production or seeded
  review data and approve metadata/privacy responses
- repair or restart the local iOS 26.5 Simulator runtime if device-thinned asset
  compilation remains blocked by system policy
- complete physical-device accessibility, localization, location permission,
  live authentication/booking and network-recovery QA
- production-safe end-to-end customer lifecycle QA

### Batch 13F.7 - Production API Contract Release Gate

Finding:

- TestFlight build `1.0.0 (3)` authenticated with Supabase, then entered the
  recoverable `Connection interrupted` state because the production web
  deployment returned HTML `404` responses for the native customer session,
  profile, notification, booking-write and account-deletion routes
- the legacy customer bookings route was present, but the missing session
  context route correctly prevented the app from exposing a partially loaded
  signed-in experience
- the saved customer refresh token remained protected and no customer or
  booking data was changed

Permanent release control:

- added `npm run verify:customer-ios-production`, a credential-free production
  contract probe covering all ten native customer public/authenticated routes
- public reads must return JSON `200`; protected routes must return JSON `401`
  to the anonymous probe
- HTML `404`, invalid JSON, redirects, timeouts and accidental anonymous access
  all fail the probe
- the customer `Scripts/validate-release.sh` now runs the live contract probe,
  making backend availability part of the required TestFlight/App Store release
  validation rather than a manual assumption
- the server route sources must be versioned with the web deployment so later
  production deploys cannot silently remove the native API contract

## Pass Standard

Stage 13 is complete only when a customer can discover, register or sign in,
book, see the correct status, cancel or request a reschedule, receive the right
updates and initiate account deletion in the native app without weakening the
existing data boundary or changing customer booking into a Mirëbook payment
flow.
