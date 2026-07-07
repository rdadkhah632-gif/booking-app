# Stage 10 - Business and Staff iOS App Foundation

Status: Batch 10E.7 calendar viewport polish implemented.

Batch 10E.7 calendar viewport polish status:

- Tightened the web business Calendar and staff Calendar spacing after the
  calendar-first visual rebuild.
- Changed the schedule grids so the calendar workspace fits the viewport and
  the schedule itself owns vertical scrolling instead of making the page scroll
  through the whole time range.
- Made week headers sticky inside the calendar scroll area so the day columns
  stay readable while moving through the time rail.
- Improved calendar toolbar hit areas and control spacing so date, staff scope,
  week navigation and add-appointment controls feel like deliberate controls
  instead of squeezed text.
- Improved manual appointment and selected-appointment drawer spacing.
- Staff appointment details now open as a fixed drawer/bottom sheet instead of
  pushing the calendar down the page.
- No booking creation logic, booking lifecycle logic, availability calculation,
  staff linking, auth/RLS, billing or notification generation logic was changed.

Remaining calendar follow-ups:

- Run a live browser QA pass on desktop and mobile to confirm the internal
  scroll behavior feels right with real long operating hours and multiple staff.
- Continue small spacing sweeps on other menus only where visual QA finds
  obvious loose/tight controls.

Batch 10E.6 calendar staff-scope polish status:

- Used the approved Teams-style calendar concept as the target direction.
- Added a compact staff scope selector to the web business Calendar so owners
  can quickly compare all staff or a single staff member without returning to a
  bookings list.
- The selected staff scope now also preselects that staff member when adding a
  manual appointment for a service they can perform.
- Added a current-time marker to the web business Calendar and staff Calendar
  week grids.
- Improved the manual appointment drawer so the staff picker says who the
  booking is for and labels assigned staff as available/busy for the selected
  time.
- Reworked the selected appointment side panel into a cleaner appointment
  detail sheet with status, when, service, staff, contact and customer actions.
- Added the same current-time marker to the native iOS week calendar grid.
- No booking creation logic, booking lifecycle logic, availability calculation,
  staff linking, auth/RLS, billing or notification generation logic was changed.

Remaining calendar follow-ups:

- Full browser QA should confirm the staff selector, now-line, detail drawer and
  manual appointment staff labels on a live business with multiple staff.
- Native app calendar remains read-only; adding appointments natively is still a
  later app batch.

Batch 10E.5 calendar visual polish status:

- Used the approved Teams-style calendar concept as the target direction.
- Polished the web business Calendar surface with:
  - darker calendar canvas
  - sticky time rail
  - clearer selected-day headers
  - stronger hour grid separation
  - richer duration-sized appointment blocks
  - less list-like mobile behavior
- Polished the web staff Calendar to match the same schedule-board language.
- Tightened the native iOS Calendar screen by removing the duplicated day strip
  and making the week grid itself the primary navigation and schedule surface.
- Native appointment blocks now use stronger calendar-event styling and shadow,
  while preserving the existing read-only detail interaction.
- No booking creation logic, booking lifecycle logic, availability calculation,
  staff linking, auth/RLS, billing or notification generation logic was changed.

Batch 10E.4 calendar-first schedule grid status:

- Revisited the business/staff calendar because the previous calendar still felt
  too much like a list of days rather than an operating calendar.
- Updated the web business Calendar route to keep the week grid visible as the
  primary surface on desktop and mobile instead of falling back to a stacked
  agenda list.
- Updated the web staff Calendar route to match the same week-grid-first model.
- Reworked the native business/staff app Calendar screen into a horizontally
  scrollable week schedule with:
  - seven day columns
  - a time rail
  - appointment blocks sized by duration
  - day selection and appointment detail opening
- This is intentionally closer to a Teams-style calendar model while preserving
  Mirëbook's own dark operations UI.
- No booking creation logic, booking lifecycle logic, availability calculation,
  staff linking, auth/RLS, billing or notification generation logic was changed.

Manual appointment email-claim QA from the prior web batch remains parked for a
dedicated follow-up. This batch only addresses calendar presentation.

Batch 10E.3 business entry UX status:

- Left calendar interpretation unchanged for now; calendar redesign will be
  addressed on the web product before revisiting native calendar.
- Reworked the native business app entry screen so it feels closer to the
  Mirëbook Business site entry point instead of a bare system form.
- Native sign-in remains the primary action.
- Added business web-account actions:
  - create business account via `/register?accountType=business`
  - open web login via `/login?product=business`
  - reset password via `/forgot-password?product=business`
- Added business/staff-only helper copy for invited staff.
- Added English and Albanian localization keys for the new entry UI.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed.

Batch 10E.3 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- XcodeBuildMCP build/run passed on iPhone 17 Pro, iOS 26.5, with
  `CODE_SIGNING_ALLOWED=NO`.
- Simulator UI snapshot confirmed the entry screen exposes:
  - native Sign in
  - Create business account
  - Open web login
  - Reset password
- Entry UX screenshot captured at `/tmp/mirebook-ios-qa/business-entry-ux.jpg`.

Batch 10E.2 real backend sign-in QA status:

- Started the local Next.js backend on `http://localhost:3000`.
- Verified the configured local iOS backend target uses:
  - local Mirëbook API origin
  - public Supabase URL
  - public Supabase anon key
- Used a safe QA business-owner account to verify the same auth path as the
  native app:
  - Supabase password token grant returned 200
  - `/api/app/session-context` returned 200 with business app mode
  - `/api/app/calendar` returned 200 with real appointments
  - `/api/app/inbox` returned 200 with real recent updates
- Native simulator sign-in passed and landed on the owner Today tab.
- Today loaded the real business workspace, summary counts and next appointment.
- Appointment detail opened with real customer, service, staff, date, time,
  duration and status data.
- Calendar loaded real appointments for the selected day.
- Inbox loaded real recent update rows.
- Inbox detail opened for a real update row.
- Account showed the signed-in owner profile.
- Simulator session was logged out after QA so the test account is not left
  signed in.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed.

Batch 10E.2 session-restore fix:

- Initial native sign-in worked, but relaunch returned to the login screen.
- Added a Debug-only `UserDefaults` fallback when an unsigned simulator build
  cannot persist the token through Keychain.
- Keychain remains the preferred token store; the fallback is only compiled for
  Debug builds.
- Relaunch after sign-in now restores into Today with real business data.

Batch 10E.2 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- XcodeBuildMCP build/run passed on iPhone 17 Pro, iOS 26.5, with
  `CODE_SIGNING_ALLOWED=NO`.
- Simulator UI automation verified:
  - login form
  - Today tab
  - appointment detail sheet
  - Calendar tab
  - Inbox tab
  - Inbox detail sheet
  - Account tab
  - session restore after relaunch
  - logout
- Restore screenshot captured at
  `/tmp/mirebook-ios-qa/real-login-restored-after-fallback.png`.

Batch 10E.1 native Inbox detail shell status:

- Expanded the native `InboxItem` model to decode the existing `/api/app/inbox`
  action context returned by the server:
  - booking/request identifiers
  - customer contact fields
  - service/staff labels
  - current and requested appointment times
  - duration, status and available action names
- Inbox rows are now tappable and open a native read-only detail sheet.
- Inbox detail shows summary, customer, appointment timing and available actions
  when returned by the existing API contract.
- Action buttons remain disabled and review-only. No native booking lifecycle
  mutation is wired in this batch.
- Unknown future inbox action names decode safely and fall back to a generic
  review label.
- Added English and Albanian labels for Inbox detail/action placeholders.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed.

Batch 10E.1 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- Full simulator build passed on iPhone 17 Pro, iOS 26.5, with:
  `xcodebuild -project ios/MirebookBusiness/MirebookBusiness.xcodeproj -scheme MirebookBusiness -configuration Debug -destination 'id=EAD57442-2FB7-4B5D-A987-BEF507980482' CODE_SIGNING_ALLOWED=NO build`
- Simulator install and launch passed for bundle `com.mirebook.business`.
- Login shell screenshot after this batch captured at
  `/tmp/mirebook-ios-qa/inbox-detail-shell-login.png`.
- Full Inbox interaction QA still needs a safe business-owner or staff test
  account for the configured backend target.

Batch 10D.4 native auth boundary status:

- Confirmed existing app API routes use `Authorization: Bearer <access token>`
  through `src/lib/server/app-api/context.ts`.
- Added a native session guard so only business-owner or staff-capable accounts
  can persist a signed-in session in the Mirëbook Business app.
- Customer-only or unsupported accounts now receive a localized native error
  after `/api/app/session-context` instead of falling into owner tabs.
- Restore clears unsupported saved sessions instead of keeping them locally.
- Added English and Albanian unsupported-account copy.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed.

Batch 10D.4 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- Full simulator build passed on iPhone 17 Pro, iOS 26.5, with:
  `xcodebuild -project ios/MirebookBusiness/MirebookBusiness.xcodeproj -scheme MirebookBusiness -configuration Debug -destination 'id=EAD57442-2FB7-4B5D-A987-BEF507980482' CODE_SIGNING_ALLOWED=NO build`
- Simulator install and launch passed for bundle `com.mirebook.business`.
- Login screen screenshot captured at
  `/tmp/mirebook-ios-qa/unsupported-guard-login.png`.

Batch 10D.4 remaining authenticated QA need:

- A safe business-owner or staff test account for the configured backend target.
- Once available, validate native sign-in, `/api/app/session-context`,
  `/api/app/calendar` and `/api/app/inbox` in the simulator.

Batch 10D.3 local backend configuration status:

- Added tracked iOS config defaults at `ios/MirebookBusiness/Config`.
- Added ignored local override support through
  `ios/MirebookBusiness/Config/Local.xcconfig`.
- Added `scripts/ios-config-from-env.sh` to generate the ignored local iOS
  config from `.env.local`.
- Moved iOS app configuration into an explicit `Info.plist` with:
  - `MIREBOOK_API_BASE_URL`
  - `MIREBOOK_SUPABASE_URL`
  - `MIREBOOK_SUPABASE_ANON_KEY`
- Added runtime normalization for Xcode-safe URL escaping in `AppConfig`.
- Added local networking allowance for localhost simulator development.
- Generated the local iOS config from the existing `.env.local` without
  committing local values.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed.

Batch 10D.3 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- Full simulator build passed on iPhone 17 Pro, iOS 26.5, with:
  `xcodebuild -project ios/MirebookBusiness/MirebookBusiness.xcodeproj -scheme MirebookBusiness -configuration Debug -destination 'id=EAD57442-2FB7-4B5D-A987-BEF507980482' CODE_SIGNING_ALLOWED=NO build`
- Built app bundle contains runtime-parseable API base URL, Supabase URL and
  Supabase anon key values.
- Simulator install and launch passed for bundle `com.mirebook.business`.
- Configured login screen screenshot captured at
  `/tmp/mirebook-ios-qa/configured-login.png`.

Batch 10D.3 remaining authenticated QA need:

- A safe business-owner or staff test account for the configured backend target.
- Once available, validate native sign-in, `/api/app/session-context`,
  `/api/app/calendar` and `/api/app/inbox` in the simulator.

Batch 10D.2 mobile UX pass status:

- Added reusable native UI components for operational headers, summary strips,
  empty states, disclosure appointment rows and setup checklist rows.
- Today now opens with a clearer workspace header, role badge and compact
  summary strip before the next appointment.
- Calendar now has a workspace header and previous/next day controls around the
  date picker.
- Inbox now has a compact header and clearer empty states for needs-action and
  recent updates.
- Setup now feels like a compact checklist and explicitly keeps heavy editing
  web-first for now.
- Availability now has a staff-context header and read-only note.
- Account now has a clearer profile header, real owner/staff workspace switch
  only when the session supports both, and API contracts tucked under
  diagnostics instead of being front-and-center.
- No customer app, marketplace, booking lifecycle, schema, RLS, billing or web
  production logic was changed.

Batch 10D.2 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- Full simulator build passed on iPhone 17 Pro, iOS 26.5, with:
  `xcodebuild -project ios/MirebookBusiness/MirebookBusiness.xcodeproj -scheme MirebookBusiness -configuration Debug -destination 'id=EAD57442-2FB7-4B5D-A987-BEF507980482' CODE_SIGNING_ALLOWED=NO build`
- Simulator install and launch passed for bundle `com.mirebook.business`.
- Login screen screenshot captured at `/tmp/mirebook-ios-qa/login-after-wait.png`.

Batch 10D.1 read-only appointment detail status:

- Today and Calendar appointments now open a native read-only appointment detail
  sheet.
- The detail sheet shows customer name/contact fields where returned by the
  existing calendar endpoint, service, staff, date, time, duration and status.
- Available booking actions are shown as disabled placeholders only.
- No booking lifecycle action is callable from native yet.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed in this batch.

Batch 10D.1 validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`

Batch 10D read-only operations status:

- Today now loads signed-in app data from existing app API contracts:
  - `/api/app/calendar` for today's appointments
  - `/api/app/inbox` for needs-action counts
- Calendar now loads read-only appointments for the selected day from
  `/api/app/calendar`.
- Inbox now loads read-only needs-action and recent update items from
  `/api/app/inbox`.
- Screens include loading, empty, error and pull-to-refresh states.
- Owner/staff scope is still taken from the signed-in app mode resolved by
  `/api/app/session-context`.
- Manual appointment creation remains disabled.
- Booking lifecycle actions are not wired.
- Staff availability updates are not wired.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed in this batch.

Batch 10D validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- Full simulator build/launch later passed during Batch 10D.2 validation on
  iPhone 17 Pro, iOS 26.5.

Batch 10C auth shell status:

- Added native login, logout, session restore and session-state routing.
- Native login uses Supabase Auth's public password-token endpoint with
  app-side `MIREBOOK_SUPABASE_URL` and `MIREBOOK_SUPABASE_ANON_KEY`
  placeholders. No Supabase service-role key is used in the iOS app.
- Supabase access and refresh tokens are stored in the iOS Keychain.
- On successful login or restore, the app calls the existing
  `/api/app/session-context` route with the bearer access token.
- Owner/staff mode is decided from the server session-context response, not
  duplicated locally.
- `/api/app/calendar` and `/api/app/inbox` client methods now build authenticated
  requests and decode the existing response shapes.
- The app still does not call booking lifecycle actions, manual booking
  creation, or staff availability updates.
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed in this batch.

Batch 10C validation:

- Swift source typecheck passed with:
  `SDKROOT=$(xcrun --sdk iphonesimulator --show-sdk-path) && xcrun swiftc -sdk "$SDKROOT" -target arm64-apple-ios17.0-simulator -typecheck ios/MirebookBusiness/MirebookBusiness/*.swift`
- Full simulator build/launch was later unblocked after installing the iOS 26.5
  Simulator runtime and passed during Batch 10D.2 validation.

Batch 10B scaffold status:

- Added a native SwiftUI project at `ios/MirebookBusiness`.
- App name: Mirëbook Business.
- Initial scaffold was fixture-backed; later batches added the native auth
  shell, Keychain session storage and read-only API loading placeholders.
- Owner tabs are scaffolded as:
  - Today
  - Calendar
  - Inbox
  - Setup
  - Account
- Staff tabs are scaffolded as:
  - Today
  - Calendar
  - Availability
  - Inbox
  - Account
- Native screens exist for Today, Calendar, Inbox, owner Setup, staff
  Availability and Account.
- The Account screen includes an owner/staff workspace switch only when the
  signed-in session context supports both modes.
- API client contract placeholders exist for:
  - `/api/app/session-context`
  - `/api/app/calendar`
  - `/api/app/inbox`
  - `/api/app/today`
  - `/api/app/appointments/actions`
  - `/api/app/staff-availability`
- Existing web app routes already cover session context, calendar and inbox.
- Missing app contracts still needed before live native data:
  - owner/staff Today summary
  - appointment action endpoint for accept, decline, cancel and complete
  - staff working-hours read/update endpoint
  - native login/session persistence contract
- No web production logic, database schema, RLS, auth, billing, staff linking or
  booking lifecycle logic was changed in this scaffold batch.

Tooling/build check:

- Xcode is available locally: Xcode 26.6.
- iOS and iOS Simulator SDK 26.5 are available.
- iOS 26.5 Simulator runtime is installed and an iPhone 17 Pro simulator is
  available.
- SDK-only simulator build passed with:
  `xcodebuild -project ios/MirebookBusiness/MirebookBusiness.xcodeproj -scheme MirebookBusiness -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`
- Destination simulator build passed with:
  `xcodebuild -project ios/MirebookBusiness/MirebookBusiness.xcodeproj -scheme MirebookBusiness -configuration Debug -destination 'id=EAD57442-2FB7-4B5D-A987-BEF507980482' CODE_SIGNING_ALLOWED=NO build`
- Simulator install and launch passed for bundle `com.mirebook.business`.

Web account/contact readiness note:

- registration now collects profile name and phone for all account types
- business registration requires owner name and owner phone
- business registration seeds country, timezone and currency defaults from the
  detected region where possible
- Account shows a compact region summary and remains the source for editing
  personal profile details
- Resend transactional emails now render English or Albanian based on the
  recipient profile language where an account profile exists
- Supabase Auth still owns recovery-email delivery; the recovery email template
  must be branded in Supabase dashboard, while `/reset-password` remains the
  Mirëbook reset completion page
- App-side email verification readiness is in place for staged activation:
  registration shows a verification-required state when Supabase does not
  return a session, login catches unverified-account sign-in attempts with
  friendly copy, and Login/Register/Account can resend verification emails with
  product-aware customer or business redirects.
- Supabase dashboard still needs the branded Auth templates before enforcing
  confirmation broadly: Confirm signup, Magic Link if used later, and Reset
  password should use Mirëbook wording and keep Supabase token/link variables
  unchanged.
- Marketing/promotional email consent should remain a separate future batch.
  Account verification and booking/support/reminder emails are transactional;
  promotional campaigns need explicit preference/consent handling before use.
- Web registration is now split by product surface: customer signup stays on
  the customer site, while business-owner and staff account creation are
  directed through Mirëbook Business. This supports the future split app model
  where the first native app is business/staff operations only.
- The Mirëbook Business landing page now presents the owner/staff product more
  clearly with setup, calendar, inbox, staff workspace and early-partner
  membership context before signup.
- Public Booksy/Fresha onboarding research was used only as product-flow
  inspiration. Mirëbook setup should borrow the rhythm, not the design:
  customer-visible basics, first service, provider/team, working hours, booking
  mode, preview and publish. The web Setup page now follows this broader
  non-salon-specific sequence and keeps advanced settings secondary.
- Customer and business entry points are now clearer: the customer homepage
  keeps booking/search as the primary action, while the Business homepage uses a
  compact tabbed product explanation for how it works, setup, pricing and staff.
  This supports the future split-app direction without turning the customer
  homepage into a business sales page.

This stage is for the first Mirëbook mobile app. The first app should be a
business/staff operations app, similar in purpose to Booksy Biz or Fresha's
provider tools, without copying their interface, assets or branding.

Do not start customer marketplace app work in this stage.

## Product Direction

The app should help business owners and staff run their appointment day from a
phone.

The app should answer:

- What is happening today?
- What needs action?
- Who is booked next?
- Is my working time correct?
- Can I add or manage an appointment quickly?

The app should not feel like a mobile version of every web admin page.

## Target Users

- business owner
- owner-as-staff
- staff member

Customer booking, customer marketplace browsing and customer account features
remain web-first for now.

## Product Principles

- calendar and appointment operations first
- setup and settings secondary
- short labels, compact screens and no repeated explanations
- staff users see work, not owner administration
- owner users can switch between business operations and staff-style work only
  where their role actually supports it
- use existing booking, staff and billing rules rather than inventing parallel
  app logic

## Protected Web Foundations

Do not change or duplicate:

- Supabase auth and RLS policies
- role separation
- staff invite/linking logic
- owner-as-staff logic
- booking creation rules
- booking status lifecycle
- availability calculation
- stale-slot and overlap prevention
- notification generation/read behaviour
- billing write logic
- database schema unless explicitly approved

The app should consume stable server/API contracts or carefully scoped Supabase
reads that respect the same data boundaries as the web product.

## Recommended App Shape

Recommended first implementation: native SwiftUI iOS app.

Reason:

- the first app is operational and likely to benefit from native calendar-like
  speed, account persistence and push notifications later
- a web wrapper would inherit too much of the admin-page structure the product
  has been trying to remove
- native does not have to mean rebuilding logic if server/API contracts are
  used for data and actions

Do not scaffold native code until Stage 9 auth/email/environment closure is
stable and the iOS toolchain is intentionally enabled for app work.

## MVP Navigation

Business owner app tabs:

1. Today
2. Calendar
3. Inbox
4. Setup
5. Account

Staff app tabs:

1. Today
2. Calendar
3. Availability
4. Inbox
5. Account

Setup should be owner-only and should stay compact. It should not reproduce all
web setup pages in full.

## MVP Screens

### Login

- email/password login
- role-aware landing after login
- business owner lands on Today
- staff lands on Staff Today
- reset password link can open the existing web reset route at first

### Today

Business owner:

- current business status
- next appointment
- pending requests
- today schedule summary
- one clear next action

Staff:

- next assigned appointment
- today's assigned appointments
- working-hours status
- recent staff-relevant updates

### Calendar

- week/day schedule view
- appointment blocks sized or grouped by time where practical
- appointment detail sheet
- manual appointment entry for owners when the API is ready
- no separate "Bookings" tab in the mobile app MVP

### Appointment Detail

- customer name and contact details where allowed
- service
- staff
- date/time/duration
- status
- owner actions only where valid: accept, decline, cancel, complete
- staff can view assigned work but should not see owner-only actions

### Inbox

- needs action
- recent updates
- request/reschedule actions for owners
- no raw notification-log feel

### Availability

- staff working hours for the signed-in staff member
- owner editing staff hours can remain web-first at first if native scope is
  too large
- use plain language: Working hours

### Setup

Owner-only compact setup:

- business profile
- services
- team
- working hours
- preview/public status

Setup should guide the owner to the web app for heavy editing if native editing
is not ready.

### Account

- profile identity
- language
- switch to web account/security where needed
- logout

No business readiness cards in Account.

## Out Of Scope For First App

- customer marketplace app
- customer booking app
- Stripe checkout or billing changes
- reviews, ratings or maps
- advanced analytics
- multi-business switching unless already safe in web/API data boundaries
- staff at multiple businesses unless already safe in web/API data boundaries
- push notifications before email/in-app notification behaviour is stable
- offline booking changes
- new database schema

## API/Data Contract Groundwork

Before native implementation, audit or create stable server contracts for:

- current user role and linked business/staff context
- owner Today summary
- staff Today summary
- calendar appointments by date range
- appointment detail
- inbox needs-action items
- accept/decline/reschedule/cancel/complete actions
- manual owner appointment creation
- staff working-hours read/update

The app should not reconstruct booking lifecycle decisions locally. Server
routes should validate role, ownership, status transitions, stale slots and
overlap rules.

## Existing Web Surfaces To Map

- `src/pages/dashboard/index.tsx` - owner Today
- `src/pages/dashboard/bookings.tsx` - owner Calendar/manual appointment
- `src/pages/dashboard/notifications.tsx` - owner Inbox
- `src/pages/dashboard/businesses.tsx` - owner Setup
- `src/pages/dashboard/availability.tsx` - owner working hours
- `src/pages/dashboard/staff-availability.tsx` - owner staff hours
- `src/pages/staff/index.tsx` - staff Today
- `src/pages/staff/calendar.tsx` - staff Calendar
- `src/pages/staff/availability.tsx` - staff Availability
- `src/pages/staff/notifications.tsx` - staff Inbox
- `src/pages/account.tsx` - account/security/language

## Implementation Batches

### Batch 10A - App Contract Audit

- audit current API routes and client-side Supabase usage
- identify which app screens can use existing server routes
- list missing API contracts
- do not create native project yet

### Batch 10B - Native Project Scaffold

- create iOS app workspace only after 10A is approved
- use SwiftUI
- add environment/config placeholders only
- no production secrets in the repo

### Batch 10C - Auth Shell

- Supabase login/logout/session persistence
- role-aware landing
- account boundary tests

### Batch 10D - Read-Only Today And Calendar

- owner Today
- staff Today
- owner/staff Calendar
- appointment detail read-only

### Batch 10E - Inbox Actions

- owner accept/decline request
- owner reschedule accept/decline
- notification read state if safe

### Batch 10F - Manual Appointment

- owner manual appointment creation
- overlap/stale validation through server
- customer email receipt only when transactional email is ready

### Batch 10G - Staff Availability

- staff can update their own working hours
- owner staff-hours editing remains web-first unless clearly safe

### Batch 10H - TestFlight QA

- owner account QA
- staff account QA
- owner-as-staff QA
- account switching/logout QA
- timezone QA
- notification/email link QA

## Risks To Control

- duplicating booking logic between web and native
- bypassing RLS with broad app reads
- creating a second staff/owner role model
- timezone mismatches between web, API and native display
- deep links for invite/reset flows
- push notification timing if added too early
- App Store review expectations for account deletion and support access

## Pass Standard

The first app foundation is ready when:

- the app scope is business/staff-only
- owner and staff screens are clearly separated
- Calendar and Today are the primary operational surfaces
- Setup is compact and owner-only
- native code consumes safe server/API contracts
- no protected web logic is duplicated or weakened
- web Stage 9 auth/email/environment readiness remains stable

## Current Repo Audit Notes

- No existing iOS, Android, React Native, Expo or Capacitor scaffold was found.
- The current repository is a Next.js web app with Supabase and Stripe
  dependencies.
- The safest next step is Batch 10A API contract audit after Stage 9 email and
  environment closure, not native scaffolding.
- The Build iOS Apps plugin is available, but the local Xcode simulator
  toolchain is not ready yet. `xcode-select` currently points to
  `/Library/Developer/CommandLineTools`, and `xcrun` cannot find `simctl`.
  Simulator build/run will need full Xcode selected before native QA.

## Batch 10A - App Contract Audit

Status: initial repo-side audit complete.

This audit is intentionally web-safe. It does not add a native project, change
booking logic or create new API routes yet.

### Existing Server Routes That Can Be Reused Later

These routes already use server-side validation and are good candidates for the
business/staff app once native auth headers are wired correctly:

- `src/pages/api/dashboard/manual-booking.ts`
  - owner-only manual appointment creation
  - validates the bearer token through Supabase Auth
  - verifies business ownership
  - verifies active service, active staff and staff-service assignment
  - checks same-staff booking overlap before insert
  - creates a confirmed booking
- `src/pages/api/dashboard/staff-availability.ts`
  - owner-only staff working-hours update
  - validates the bearer token through Supabase Auth
  - verifies the owner owns the staff member's business
  - normalises 7 day rows and returns saved rows
- `src/pages/api/email/transactional.ts`
  - sends booking/support emails from server-side context
  - should remain a server-triggered companion, not app-owned business logic
- `src/pages/api/staff/invite.ts`
  - supports invite-token validation and acceptance
  - can support app deep-link planning later, but web invite flow should stay
    primary until app links are configured

### Web Logic That Should Become App API Contracts

The following important behaviours are still mostly owned by web pages and
client-side Supabase calls. The native app should not duplicate this logic
locally.

Create dedicated server routes before implementing native write actions for:

- owner/staff session context
  - return profile role, primary business, primary staff profile and allowed
    app tabs
  - suggested route: `/api/app/session-context`
- owner Today summary
  - business status, next appointment, pending requests, today count and setup
    gaps
  - suggested route: `/api/app/business/today`
- staff Today summary
  - linked business, next assigned appointment, today assigned appointments and
    staff availability status
  - suggested route: `/api/app/staff/today`
- owner/staff calendar
  - appointments by date range with service, staff, customer-safe details and
    status labels
  - suggested route: `/api/app/calendar`
- appointment detail
  - role-aware details and available actions
  - suggested route: `/api/app/appointments/[id]`
- booking lifecycle actions
  - accept, decline, cancel and complete
  - currently these are mostly implemented inside
    `src/pages/dashboard/bookings.tsx`,
    `src/pages/dashboard/notifications.tsx` and
    `src/pages/staff/calendar.tsx`
  - suggested route: `/api/app/appointments/action`
- business Inbox/action centre
  - needs-action booking requests, reschedule requests and recent updates
  - suggested route: `/api/app/inbox`
- reschedule request actions
  - accept/decline with optional decline message
  - currently implemented inside `src/pages/dashboard/notifications.tsx`
  - suggested route: `/api/app/reschedule-requests/action`
- staff self availability
  - web staff availability currently writes directly from
    `src/pages/staff/availability.tsx`
  - suggested route: `/api/app/staff/availability`

### Direct Supabase Reads To Avoid In Native MVP

The native app should avoid broad client reconstruction of:

- `bookings`
- `booking_requests`
- `notifications`
- `businesses`
- `services`
- `staff_members`
- `staff_services`
- `availability`
- `staff_availability`

Direct reads may be technically possible under RLS, but app UX should consume
compact role-aware responses so native screens do not become database-shaped.

### First Native Screen Contracts

Before building SwiftUI screens, define response shapes for:

```text
AppSessionContext
BusinessTodaySummary
StaffTodaySummary
CalendarAppointment
AppointmentDetail
InboxAction
StaffAvailabilityWeek
```

Each response should include display-ready labels where possible, but the server
must remain the authority for action permissions and status transitions.

### Native Scaffold Readiness

Do not start Batch 10B until:

- full Xcode is selected and `xcrun simctl list devices` works
- Stage 9 auth/email environment is stable
- the app API route list above is approved
- a bundle identifier is chosen, for example `com.mirebook.business`
- non-secret app config strategy is agreed

### Recommended Next Batch

Batch 10A.2 should add API contract documentation or TypeScript route stubs for:

1. `/api/app/session-context`
2. `/api/app/calendar`
3. `/api/app/inbox`

Those three unlock the native app shell without touching booking creation or
dangerous write flows first.

## Batch 10A.2 - Read-Only App API Contracts

Status: implemented.

Created read-only app-facing API contracts:

- `src/pages/api/app/session-context.ts`
- `src/pages/api/app/calendar.ts`
- `src/pages/api/app/inbox.ts`

Shared server context:

- `src/lib/server/app-api/context.ts`

### Auth Pattern

Each app route expects a Supabase access token in:

```text
Authorization: Bearer <access_token>
```

The route validates the token server-side with Supabase Auth, then loads only
the signed-in user's owned businesses and linked staff profiles. Native clients
should not call core tables directly for these first app screens.

### `/api/app/session-context`

Purpose:

- identify whether the signed-in account should land in business or staff mode
- return compact user, primary business and primary staff context
- return app tab names for the first business/staff app

This route does not create accounts, link staff or change role logic.

### `/api/app/calendar`

Purpose:

- return role-scoped calendar appointments for a date range
- business scope returns appointments for an owned business
- staff scope returns appointments assigned to the signed-in staff profile
- includes display-ready service, staff, customer, status and action hints

This route is read-only. It does not accept, decline, cancel, complete or create
bookings.

### `/api/app/inbox`

Purpose:

- business scope returns pending booking requests, pending reschedule requests
  and recent business notifications
- staff scope returns staff/general notifications for the signed-in staff user
- response is shaped as `needsAction` plus `updates` for a future native Inbox

This route is read-only. It does not mark notifications read or perform booking
actions.

### Protected Systems Unchanged

Batch 10A.2 does not change:

- booking creation
- booking status transitions
- availability/slot generation
- stale-slot prevention
- staff invite/linking
- auth/session/RLS
- billing writes
- notification generation behaviour
- database schema

### Next Recommended Batch

Batch 10A.3 should add either:

1. read-only app API QA with live bearer tokens from existing business/staff
   accounts, or
2. minimal SwiftUI scaffold now that Xcode Simulator devices are available.

Recommended order: QA the read-only API contracts first, then scaffold SwiftUI.
