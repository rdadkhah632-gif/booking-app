# Stage 10 - Business and Staff iOS App Foundation

Status: Batch 10A.2 app API contracts implemented.

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
