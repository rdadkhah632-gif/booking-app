# Stage 7 - Launch Polish, Auth Readiness And App-Ready Simplification

Status: active.

Batch 1 status: full page, menu and launch-readiness audit implemented.
Application behavior is unchanged. Production build and static validation must
pass before Batch 1 is closed.

Batch 2 status: Mirëbook Business workspace simplification implemented.
Production build, static validation and focused responsive QA must pass before
Batch 2 is closed.

Batch 2B status: Mirëbook Business workspace layout cleanup implemented.
Production build and static validation pass. Authenticated desktop/mobile EN/SQ
visual QA remains required before Batch 2B is closed.

Batch 3 status: Staff workspace and owner-as-staff simplification implemented.
Production build and static validation pass. Authenticated desktop/mobile EN/SQ
visual QA remains required before Batch 3 is closed.

Batch 4 status: Customer journey polish implemented. Production build and
static validation pass. Authenticated booking, notification and reschedule QA
remains required before Batch 4 is closed.

Batch 4B status: Mirëbook Business navigation model and workspace information
architecture rebuild implemented. Production build, static validation and
authenticated owner visual QA must pass before Batch 4B is closed.

Batch 5 status: Email verification and password-reset readiness implemented.
Production build and static validation pass. Live Supabase confirmation,
recovery-email delivery and cross-domain callback QA remain required before
Batch 5 is closed.

Stages 1 through 6 are complete and protected.

## Goal

Make the current web product calmer, simpler and launch-ready before mobile
application work begins.

Stage 7 is not a new theme or a collection of unrelated visual tweaks. It is a
controlled simplification stage:

- reduce navigation and CTA overload
- make each role's primary job obvious
- remove duplicated ways to perform the same task
- keep customer, business, staff and operator language distinct
- complete authentication and email readiness deliberately
- define web route and workflow boundaries that can later become app screens

## Protected Foundations

Stage 7 must not regress:

- account identity and language persistence
- customer, business, staff and admin capability separation
- staff intent, secure invites and staff-business linking
- owner-as-staff behavior
- route protection and safe internal redirects
- request-mode and instant-confirmation booking
- booking insert, stale-slot, overlap and slot-generation behavior
- pending, confirmed, declined, cancelled and completed status behavior
- booking accept, decline, cancel, complete and reschedule actions
- business readiness and Explore listing rules
- customer, business, staff and admin notifications
- Stripe Checkout, webhook sync and manual billing state
- founding-business controls
- support ticket ownership and admin support controls
- the `mirebook.com` / `business.mirebook.com` product split
- the root-only business-hostname rewrite in `src/middleware.ts`

Stage 7 does not add customer appointment payments, hard billing lockouts,
database migrations or native/mobile code.

## Launch Timeline Assumption

Planning assumption: Mirëbook is in a short pre-launch hardening window of
approximately two to four focused development and QA cycles.

This is an ordering assumption, not a promised public launch date. It means:

1. simplify the highest-frequency owner and staff workflows first
2. finish customer and authentication trust paths
3. complete role-by-role launch QA
4. begin mobile architecture only after the web workflows are stable

## App-First Direction

Mirëbook Business is the first mobile priority.

The owner/staff product has the strongest repeated daily-use case:

- reviewing today's work
- approving requests
- checking the calendar
- managing availability
- seeing operational notifications

The customer product remains important, but its core journey is more naturally
task-based: discover, book, track and return when another appointment is
needed.

## Why Web Polish Comes Before App Preparation

The current web routes already contain the product rules an app must preserve.
Starting native work before simplifying them would copy current duplication
into a second interface.

Web polish comes first so Stage 7 can establish:

- one primary destination for each frequent task
- stable labels shared by web and future apps
- a clear owner versus staff information architecture
- explicit owner-as-staff switching without capability changes
- smaller screen-level responsibilities
- reliable auth, verification and recovery entry points
- reusable empty, loading, error and action states

The app architecture should consume these decisions, not make them again.

## Navigation Audit

### Public and customer navigation

Current authenticated customer navigation contains:

- Explore
- My bookings
- Notifications
- Customer support on wider screens
- language
- Account
- Log out

This is close to an app-ready five-destination model. Support and language are
better treated as Account/help utilities than permanent mobile primary tabs.

Recommended future customer app destinations:

1. Explore
2. My bookings
3. Notifications
4. Account

The selected public business profile and booking flow should be reached from
Explore rather than becoming permanent navigation destinations.

### Business workspace navigation

An owner can currently see up to:

- Home
- conditional Needs action
- Bookings
- Services
- Staff
- Analytics
- My schedule
- My availability
- My notifications
- Availability
- Business settings
- Billing
- Business support
- My account
- Log out

This is the highest-priority simplification issue. Operational work, setup,
personal staff work and account utilities are all presented at similar weight.
On mobile they become one long horizontal strip.

Recommended target information architecture:

Primary:

1. Home
2. Calendar or Bookings
3. Services
4. Team
5. More

Inside More:

- business availability
- business profile and booking settings
- billing
- analytics
- support
- account

For owners who take bookings, personal work should be an explicit context or a
compact Home shortcut, not three additional permanent destinations.

### Staff workspace navigation

Staff pages already use `DashboardLayout workspace="staff"`, which correctly
brands them as Mirëbook Business. The primary staff links are:

- My schedule
- My availability
- My notifications
- Staff support
- My account

However, My schedule and Calendar are separate routes with overlapping
appointment views. `StaffNav` also exposes both when used on shared pages. A
future app should have one Schedule destination with list/calendar modes.

### Admin navigation

Operator navigation is reasonably bounded:

- Operator
- Businesses
- Users
- Notifications
- Support
- Account

The larger issue is inside the pages: repeated header links and numerous
hardcoded English strings create translation and maintenance debt. Admin
polish is lower priority than customer, owner and staff launch paths, but
high-risk controls must remain visually distinct.

## Page And Menu Audit

| Surface | Role and purpose | Findings | App-readiness concern | Priority |
| --- | --- | --- | --- | --- |
| `/` | Public customer discovery entry | Customer-focused and compact business entry are correct. Search, journey, trust and CTA sections repeat Explore more than once but remain understandable. | Good customer-app launch/deep-link source; keep the app home more search-led than editorial. | Low |
| `/business` | Public owner/staff product entry | Correct Mirëbook Business positioning. Several long marketing sections and repeated register/login CTAs are acceptable on web but should not become app screens. | App onboarding should extract only role choice, value summary and sign-in/setup actions. | Low |
| `/explore` | Customer marketplace | Clear search/filter/results structure and useful empty states. Card readiness logic is already protected. | Strong candidate for customer app root; filters need a mobile sheet or compact control model later. | Medium |
| `/explore/[businessId]` | Public profile and booking journey | Coherent flow but the 1,700+ line page owns data loading, slots, booking, notifications and presentation. Owner preview adds business CTAs to a customer surface only for owners. | Must be decomposed into stable service, staff, date/time, summary and result screens before app reuse. | High |
| `/my-bookings` | Customer booking tracking and actions | Good lifecycle grouping, but overview card plus multiple sections and repeated navigation can feel dense. | App should use Requests, Upcoming and History as stable views with one booking-detail screen. | Medium |
| `/notifications` | Customer action/update centre | Role-appropriate, but it mixes stored notifications, booking requests and resolved updates in one long page. | App needs a normalized feed contract and clear action versus history grouping. | Medium |
| `/account` | Shared identity, verification, preferences and role entry | At 1,800+ lines it combines email verification, notification preferences, profile, security, region, customer guidance, business entry, staff entry and operator tools. | Must become role-aware sections/screens; it is not suitable as one app screen. | Critical |
| `/login` | Shared authentication entry | Product-specific business copy works. Verification resend exists. No visible forgot-password entry is present. | Needs stable return/deep-link handling and a complete recovery flow. | High |
| `/register` | Customer/business/staff registration | Role chooser, explanation, language, business quick setup and invite behavior make one long multi-role form. | Split into account type then role-specific steps; preserve the same provisioning logic. | High |
| `/dashboard` | Owner daily overview | Useful schedule, readiness and urgent guidance, but Home competes with Needs action and Bookings for operational ownership. | Define one app Home with today, requests and setup warnings only. | High |
| `/dashboard/bookings` | Owner booking manager | Correct main booking action surface with extensive filters and customer links. | Strong app core; convert filters to compact segments/sheets without changing actions. | High |
| `/dashboard/businesses` | Business creation and setup hub | Combines creation, readiness, publishing, setup guidance, business cards and owner-as-staff links. | Treat as Setup/Profile area, not a primary daily destination. | High |
| `/dashboard/services` | Service setup | Clear create/list/empty behavior and staff-assignment guidance. | Good app management screen after form/card decomposition. | Medium |
| `/dashboard/staff` | Team and assignment setup | Correct status concepts, but invite, owner-as-staff, service prerequisites and staff list create a long cognitive path. | Future Team screen needs separate member detail/invite flows. | High |
| `/dashboard/availability` | Business-wide working hours | Focused and relatively compact. | Good reusable settings screen; distinguish clearly from personal staff availability. | Medium |
| `/dashboard/settings` | Booking rules and business utilities | Overlaps Setup hub, availability, owner-as-staff, billing and support links. | Should become grouped settings, not another setup dashboard. | High |
| `/dashboard/billing` | Subscription state and test-mode Stripe | Purpose is clear and informational access is protected. | Keep under More/Settings; do not make billing a primary mobile tab. | Medium |
| `/dashboard/notifications` | Owner action centre | At 2,000+ lines it duplicates booking accept/decline and reschedule action surfaces from the booking manager. | Decide whether it is an inbox or action queue; avoid two equally primary action implementations. | Critical |
| `/dashboard/analytics` | Read-only owner metrics | Dense, secondary and hardcodes GBP in several values. It is currently a top-level sidebar item. | Defer from first mobile release or place under More; currency handling needs a later controlled audit. | Medium |
| `/staff` | Staff home, schedule and owner-as-staff entry | At 1,800+ lines it combines unlinked guidance, owner setup, business context, counts, requests, filters, day tabs and appointment cards. | Highest staff decomposition need. Home should show today and next actions; details belong elsewhere. | Critical |
| `/staff/calendar` | Staff monthly calendar | Clear calendar and selected-day details, but overlaps the schedule/date view on `/staff`. | Merge conceptually into one Schedule feature with list and calendar modes. | High |
| `/staff/availability` | Personal staff working hours | Correctly distinct in logic, with useful warnings and weekly summary. | Good app screen; retain distinction from business opening hours. | Medium |
| `/staff/notifications` | Staff update centre | Clear all/unread filter and no approval actions. | Good app inbox after consolidating schedule links and notification categories. | Medium |
| `/support` | Role support hub and admin entry | Public role chooser, quick links, FAQ and admin-specific presentation make ownership broad. | Route users directly to role support from app Account/help; do not reproduce the full hub. | Medium |
| `/support/customer` | Customer ticket creation | Thorough but long, with several guide and navigation sections around one form. | App should prioritize form, conversations and contextual booking reference. | Medium |
| `/support/business` | Owner ticket creation | Correct business context, but duplicates dashboard/support guidance. | Put under More/help and preserve business context automatically. | Medium |
| `/support/staff` | Staff ticket creation | Correct linked staff context, but long no-profile and guide content. | Put under Account/help with linked business identity visible. | Medium |
| `/support/messages` | User support conversations | Clear list and empty state. My bookings shortcut is customer-specific on a shared-role page. | Use role-aware back navigation in a later support polish pass. | Medium |
| `/admin` | Operator launch overview | Useful operational summary but repeats navigation and control cards. | Web-first operator surface; no first mobile release requirement. | Medium |
| `/admin/businesses` | Business, readiness, billing and founding control | Very large and operationally powerful. Some sections use translations while much of the page remains hardcoded English. | Keep web-only initially; split business review and billing/founding detail later. | High |
| `/admin/users` | User lookup and guarded access controls | Hardcoded English is extensive. High-risk role/admin controls share a very large page with profile and activity context. | Web-only; high-risk controls should remain isolated and auditable. | High |
| `/admin/notifications` | Targeted/bulk platform notices | Hardcoded English is extensive; target, compose, preview and history are all on one page. | Web-only. Preserve explicit bulk-send confirmation and later add full translation coverage. | High |
| `/admin/support` | Operator support inbox | Better localized and purpose-specific than other admin pages. | Web-first; list/detail split maps cleanly to responsive views. | Medium |

## Customer-Side Simplification Findings

Strengths:

- the customer homepage is now clearly marketplace-focused
- Explore and public profiles show booking mode and availability clearly
- customer booking statuses remain role-appropriate
- customer navigation is already close to a four-tab app model
- empty states generally explain the next action

Main issues:

- Account is overloaded with every capability and account concern
- registration asks users to understand all three roles on one long page
- My bookings and Notifications contain several overlapping update summaries
- support conversations use a customer-specific My bookings shortcut even for
  business or staff users
- the public booking page needs decomposition before app reuse, despite its
  current behavior being correct

## Business-Side Simplification Findings

Highest-priority issues:

1. The owner sidebar can expose approximately fourteen destinations plus Log
   out.
2. Operational work and setup utilities have equal navigation weight.
3. Needs action, Bookings and Notifications overlap.
4. Setup hub and Business settings link to many of the same areas.
5. Analytics is primary navigation despite being secondary launch usage.
6. Owner-as-staff adds three more permanent links rather than a clear work
   context.
7. Mobile navigation is a horizontally scrolling version of the full desktop
   sidebar, not a deliberate mobile information architecture.

Recommended Batch 2 direction:

- define five primary owner destinations at most
- keep `/dashboard/bookings` as the authoritative booking action surface
- make Needs action a Home indicator or filtered Bookings entry
- move Analytics, Billing, Support, Account and lower-frequency setup into More
- rename Staff to Team only if EN and SQ terminology remains unambiguous
- group business profile, booking rules and opening hours under Setup/Settings
  without removing routes
- preserve all current URLs through links or redirects only after separate QA
- do not alter capability, booking or readiness logic

## Staff-Side Simplification Findings

Strengths:

- staff pages are branded as Mirëbook Business
- staff does not receive owner booking approval controls
- personal availability is clearly distinct in behavior
- linked business context and unlinked guidance exist

Main issues:

- `/staff` tries to be onboarding, dashboard, schedule, request awareness and
  appointment manager simultaneously
- `/staff` date tabs and `/staff/calendar` duplicate schedule navigation
- shared `StaffNav` still exposes both My schedule and Calendar
- owner-as-staff guidance is correct but repeated across Account, Staff,
  Settings and Team pages

Recommended Batch 3 direction:

- make `/staff` a compact Today/home screen
- make one Schedule feature with list and calendar modes
- keep My availability and Notifications as separate destinations
- show linked business identity consistently in the shell
- give owner-as-staff one explicit switch or Home entry between Manage business
  and My work
- preserve all existing capabilities and route protection

## Auth And Email Readiness Findings

Existing foundations:

- shared customer/business/staff login
- role-aware post-login route resolution
- safe internal redirect validation
- staff invite return-path preservation
- email verification state and resend UI
- Supabase confirmation callback to `/login?verified=1`
- Account password-reset email request
- server-only transactional email adapter with disabled and Resend modes
- provider-disabled behavior does not claim email was sent

High-priority gaps:

1. There is no dedicated forgot-password entry on Login.
2. Password reset requests redirect to `/login`, but no dedicated recovery
   completion page was found to accept the recovery session and call
   `supabase.auth.updateUser({ password })`.
3. Confirmation, recovery and password reset must be tested on both production
   domains before activation.
4. The correct post-auth product/domain return behavior needs an explicit
   contract for customer, owner, staff invite and owner-as-staff cases.
5. Supabase Auth email confirmation must remain disabled until Batch 5 test
   environment QA passes.
6. Application email, Supabase Auth email and Stripe email remain separate
   systems and must not be described as one delivery pipeline.

Batch 5 must handle these as one controlled auth project. Batch 1 does not
change auth code or Supabase settings.

## Admin And Support Readiness Findings

- admin access checks and server-only privileged billing/founding operations
  remain protected
- support list/detail behavior and user ticket ownership are established
- admin Businesses, Users and Notifications pages contain extensive hardcoded
  English and should receive a focused operator translation pass
- admin pages repeat local header navigation already available in `AdminNav`
- high-risk user role/admin controls remain embedded in a broad account-detail
  page and need continued visual isolation
- support hub and support conversation navigation should become role-aware
- no admin surface should be prioritized for the first mobile app

## Mobile And App-Readiness Findings

Ready foundations:

- responsive layouts exist across the core routes
- customer navigation is already small
- owner and staff use a shared Mirëbook Business shell
- role/capability and route boundaries are reusable
- booking and notification status vocabulary is established

Not yet app-ready:

- mobile owner navigation mirrors the overloaded desktop link list
- several pages exceed 1,700-2,000 lines and combine multiple screen
  responsibilities
- staff Schedule and Calendar compete
- Account contains too many unrelated role experiences
- action ownership between business Notifications and Bookings is unclear
- forms and data loaders are tightly coupled to page presentation
- app deep-link, session handoff, offline/loading and push-notification contracts
  are not yet documented

Stage 7 should simplify behavior ownership first. A later architecture stage
can then identify shared hooks, service modules and app route contracts without
prematurely extracting code.

## Recommended Batches

### Batch 1 - Full Page/Menu Audit And Simplification Plan

- create this source document
- record page, menu, auth and app-readiness findings
- make no behavior changes

### Batch 2 - Mirëbook Business Workspace Simplification

- reduce owner primary navigation
- establish Home, Bookings/Calendar, Services, Team and More hierarchy
- clarify action ownership between Notifications and Bookings
- consolidate Setup hub and Settings entry hierarchy
- retain existing routes and all protected logic

Implementation notes:

- the business shell now presents five primary destinations: Home, Bookings,
  Services, Team and More
- pending booking attention is shown on Bookings rather than as a separate
  Needs action destination
- Home links urgent booking work to filtered Bookings and provides compact
  shortcuts for Bookings, Services, Team and business availability
- Staff is labelled Team in the owner workspace, with services and business
  availability grouped as supporting setup links
- `/dashboard/settings` is the More hub for setup, availability, notifications,
  analytics, billing, owner booking status, support, account and logout
- owner personal staff routes remain available through More without occupying
  permanent owner navigation
- business Notifications remains fully functional and accessible under More,
  while its copy directs appointment actions to Bookings
- all existing secondary URLs remain available; no route, capability, booking,
  readiness, billing, staff-linking or owner-as-staff logic was changed
- new and changed launch-facing labels are available in English and Albanian
- Prettier is not installed in this repository, so formatting relies on the
  existing source style and build validation

Deliberate limitation:

- existing booking action handlers on business Notifications were retained to
  avoid a behavior change in this simplification batch; navigation and copy now
  establish Bookings as the authoritative daily action surface

Recommended next batch:

- proceed with Batch 3 staff workspace and owner-as-staff simplification after
  focused desktop/mobile English/Albanian QA confirms the five-destination
  business shell, More hub and Team page have no Critical or High regression

### Batch 2B - Mirëbook Business Workspace Layout Cleanup

Implementation notes:

- More is divided into Business setup, Business operations and Account and
  billing sections instead of one dense undifferentiated tool block
- each More destination has one title, one short description and one clear
  action, with consistent card height, spacing and mobile stacking
- the public page is available once in Business setup; owner personal work is
  shown only when the owner has a linked staff profile
- business booking settings no longer repeat Setup hub, Needs action, Billing
  and Public page buttons above and below the form
- the booking settings page has one save action, a simpler editor heading and
  no repeated three-card settings summary
- confirmation mode controls now own their dark-theme button styling and
  accessible selected state inside the component that renders them
- booking-rule selects and policy controls use dark surfaces and dark browser
  color scheme without changing saved values
- Team no longer stacks separate navigation and setup hero cards; it keeps the
  staff creation flow, required service warning, staff list and one compact
  owner-as-staff status row
- Services opens directly into service creation and management without a
  duplicate Team/Public page hero
- Home keeps urgent guidance, booking summaries and the schedule, while
  removing duplicate route shortcuts and the second readiness-summary strip
- the shared business/staff workspace now uses a stable centered content width
  and the explanatory sidebar box was removed

Protected behavior:

- no booking, settings-save, invitation, linking, owner-as-staff, billing,
  route, auth, readiness, Stripe, Supabase or middleware logic changed
- no existing route was removed

Validation:

- production build: pass
- `git diff --check`: pass
- EN/SQ duplicate translation key check: pass
- Prettier: unavailable because it is not installed in this repository
- authenticated desktop/mobile visual QA: pending because the local browser
  session does not have an owner login

Remaining follow-up:

- run authenticated QA on the listed business routes in English and Albanian,
  including approximately 390px mobile width, before closing Batch 2B

Recommended next batch:

- Stage 7 Batch 3 - Staff Workspace and Owner-as-Staff Simplification

### Batch 3 - Staff Workspace And Owner-As-Staff Simplification

Implemented:

- Staff Home is now an operational summary with linked business identity,
  today's work, upcoming/approval counts, assigned services and three compact
  destinations: Calendar, Availability and Notifications
- the duplicated date tabs, filters, request feed and full appointment-card
  schedule were removed from Staff Home
- Calendar is the detailed staff schedule and status surface; the existing
  mark-complete behavior moved there so capability was not lost
- Availability now focuses on working hours and templates; duplicated
  appointment cards were replaced by a compact count and Calendar link
- staff primary navigation is Home, Calendar, Availability and Notifications;
  account, support and owner-only Manage business access remain secondary
- owner-as-staff identity is shown compactly without repeating large guidance
  cards across every staff page
- Team wording now covers staff and any owner who is personally bookable while
  preserving invite, linking, service assignment and availability behavior
- Account received only a small directional copy change: business management
  stays in Mirëbook Business and personal bookable work starts from Staff Home
- EN/SQ labels were added together for all newly touched staff navigation,
  summary and availability copy

Protected behavior:

- no booking status, booking action, invite, linking, owner-as-staff data,
  availability-save, auth, billing, readiness, route, Supabase, middleware or
  domain behavior changed
- no route was removed

Validation:

- production build: pass
- `git diff --check`: pass
- EN/SQ duplicate translation key check: pass
- Prettier: unavailable because it is not installed in this repository
- unauthenticated route check: pass; `/staff` redirects to Login with its return
  path preserved and no browser console errors
- authenticated desktop/mobile visual QA: pending because the local browser
  session does not have an owner or staff login

Remaining follow-ups:

- complete authenticated desktop/mobile QA for all staff routes, Team and
  business availability in English and Albanian
- split the shared Account page into clearer role-aware sections in a later
  batch; Batch 3 intentionally avoided an Account redesign

Recommended next batch:

- Stage 7 Batch 4 - Customer Journey Polish

### Batch 4 - Customer Journey Polish

Implemented:

- the customer homepage keeps discovery, booking guidance, trust and one compact
  Mirëbook Business entry; a repeated customer marketing/CTA band was removed
- Explore results no longer advertise business registration or repeat customer
  support actions in the results header
- Explore business cards retain booking mode, services, staff, location and one
  clear booking action while removing repeated bookability/availability pills
  and public phone clutter
- Explore empty states are customer-directed, and the lower marketplace trust
  section now explains the customer booking journey instead of leading with
  business SaaS wording
- public business owner preview uses one compact Mirëbook Business management
  link, and booking interval copy is less technical
- My Bookings remains the authoritative customer booking-management surface;
  duplicate overview guidance, navigation buttons and Notifications handoffs
  were removed while all booking actions and lifecycle sections remain
- Notifications is now a calm update inbox with one clear My Bookings handoff
  instead of duplicating full request, appointment and history card sections
- booking confirmation keeps one status hero, appointment details and focused
  next actions instead of repeating the same status in a second card
- registration retains the role selector and role-specific setup but removes
  the duplicated account-type explainer and repeated chooser guidance
- customer reschedule presentation is translated and clearer across errors,
  current/new appointment summaries, calendar, time and staff selection; the
  existing customer/business save branches and calculations are unchanged
- Account and Login were deliberately left structurally unchanged because their
  current product wording already distinguishes Mirëbook customer use from
  Mirëbook Business; Account decomposition remains a later responsibility

Protected behavior:

- no booking creation, cancellation, reschedule, slot generation, staff
  assignment, notification generation, auth, role, readiness, listing,
  billing, Supabase, middleware or domain behavior changed
- no route was removed

Validation:

- production build: pass
- `git diff --check`: pass
- EN/SQ duplicate translation key check: pass
- Prettier: unavailable because it is not installed in this repository
- public desktop/mobile browser QA: pass for Home, Explore, Login and Register;
  tested at approximately 390px with no horizontal overflow or raw translation
  keys, including Albanian Explore service/staff counts
- unauthenticated route QA: pass; My Bookings preserves its login return path,
  Notifications retains its existing login redirect and the business hostname
  continues to serve the Mirëbook Business landing page
- authenticated booking, My Bookings, Notifications and reschedule QA: pending
  because the local browser session does not have a customer login and test
  booking

Remaining follow-ups:

- complete an authenticated customer booking smoke test in English and Albanian
- verify booking confirmation and reschedule states with real pending and
  confirmed bookings
- split the shared Account page into smaller role-aware sections only in a
  separate controlled refactor

Recommended next batch:

- Stage 7 Batch 5 - Email Auth, Verification and Password Reset Readiness

### Batch 4B - Mirëbook Business Navigation And Workspace IA

Implemented:

- replaced the owner workspace primary navigation with five clear concepts:
  Home, Calendar, My Business, Inbox and the compact account/profile area
- removed More as a primary dumping-ground; Booking Settings now contains only
  booking rules and policies
- grouped profile, services, team, availability, booking rules and public-page
  access under My Business without removing any existing route
- changed the bookings surface presentation to Calendar while preserving all
  date/status/search filters and booking actions
- simplified Home to operational counts, genuine setup blockers and the
  seven-day schedule instead of repeating navigation and CTA cards
- replaced the large business setup checklist with a compact management index
  and retained the existing readiness, publishing and owner-as-staff behavior
- made Team profiles compact by default, with contact, assignment,
  availability and activation controls available through View details
- moved Account, Billing and Log out into a compact sidebar profile area;
  mobile keeps these destinations in the existing horizontally scrollable nav

Protected behavior:

- no booking query, status action, slot generation, readiness, publishing,
  service, staff linking, availability, billing, auth, route or database logic
  changed
- no route was removed and existing deep links remain valid

Validation:

- production build: pass
- `git diff --check`: pass
- EN/SQ duplicate translation key check: pass
- Prettier: unavailable because it is not installed in this repository
- unauthenticated business route protection: pass; `/dashboard` redirects to
  Login without browser console errors
- approximately 390px public/auth shell check: pass with no horizontal overflow
- authenticated owner desktop/mobile EN/SQ visual QA: pending because the local
  browser session has no owner login

Tracked follow-up:

- a full time-block calendar is intentionally deferred; the current Calendar
  remains a reliable date-grouped appointment manager for launch
- authenticated desktop/mobile owner QA is required in English and Albanian

### Batch 5 - Email Auth, Verification And Password Reset Readiness

Implemented:

- audited normal login, customer/business/staff registration, secure staff
  invite returns, Account verification state, resend verification and current
  password-reset behavior
- retained the existing Supabase-backed three-state email verification model:
  verified, unverified and unknown
- Login continues to detect Supabase's `email_not_confirmed` response and now
  also provides a clear password-recovery entry point
- Registration explains that email confirmation may be required without
  pretending the Supabase dashboard setting is already enabled; pending
  customer, business, staff and owner-as-staff setup remains stored in auth
  metadata and completes through the existing idempotent flow after sign-in
- resend verification remains available after an enforced unverified-login
  response, after registration returns no session and from Account when the
  auth user is explicitly unverified
- added `/forgot-password` for a translated, generic Supabase recovery request
  that does not reveal whether an email address exists
- added `/reset-password` for implicit recovery sessions and PKCE `code`
  callbacks; users enter and confirm a new password, Supabase updates it, then
  Mirëbook signs out the recovery session and returns them to the correct login
- Account password reset now returns to the completion route rather than Login,
  and Account verification/reset emails preserve customer versus Mirëbook
  Business domain context
- `src/lib/appUrls.ts` now supplies one small auth callback URL helper using the
  configured customer/business origins with the current origin as a local
  fallback
- direct Login and recovery visits on the configured business hostname use
  Mirëbook Business context even when the `product=business` query is absent
- all new and changed visible auth copy is present in English and Albanian

Current auth flow audit:

- normal login: Supabase password login, pending-registration completion, then
  existing capability routing
- customer registration: customer metadata and profile flow, then My Bookings
- business registration: pending business metadata or immediate business
  creation, then the existing business capability route
- staff registration/invite: staff intent remains represented by
  `account_mode=staff`; secure invite `redirectTo` is preserved and exact-email
  linking behavior is unchanged
- email confirmation: Supabase confirmation redirect returns to
  `/login?verified=1`; no custom verification tokens or app-side hard lockouts
- password reset request: `/forgot-password` and Account call
  `resetPasswordForEmail`
- password reset completion: `/reset-password` consumes the Supabase recovery
  session and calls `updateUser({ password })`
- Account security: verification state, resend action and reset request remain
  visible without exposing service-role data

Required Supabase Auth dashboard settings:

1. Keep confirmation disabled until the following non-production QA passes.
2. Set Site URL to `https://mirebook.com`.
3. Add allowed Redirect URLs:
   - `https://mirebook.com/**`
   - `https://www.mirebook.com/**`
   - `https://business.mirebook.com/**`
   - the current Vercel production and preview origins while they remain in use
   - `http://localhost:3000/**`
4. Confirm these callback paths are allowed:
   - `https://mirebook.com/login?verified=1`
   - `https://business.mirebook.com/login?verified=1&product=business`
   - `https://mirebook.com/reset-password?product=customer`
   - `https://business.mirebook.com/reset-password?product=business`
5. Review the Supabase Email provider before enabling Confirm email.
6. Do not enable confirmation in production until customer, business and staff
   invite registration have all passed with real confirmation links.

Recommended Supabase email templates:

- confirmation subject: `Confirm your Mirëbook account`
- confirmation body: explain that the link confirms the shared Mirëbook login;
  customers return to Mirëbook while business owners and invited staff may
  continue in Mirëbook Business
- recovery subject: `Reset your Mirëbook password`
- recovery body: explain that the secure link expires, changes the shared
  Mirëbook login password and may return business/staff users to Mirëbook
  Business
- keep Supabase's confirmation and recovery token/link variables unchanged
- do not describe application transactional email, Stripe email or Supabase
  Auth email as the same delivery system

Validation:

- production build: pass
- `git diff --check`: pass
- EN/SQ duplicate translation key check: pass
- Prettier: unavailable because it is not installed in this repository
- static route generation includes `/forgot-password` and `/reset-password`
- public responsive EN/SQ browser QA: pass at approximately 390px for customer
  and Mirëbook Business Login, Registration guidance, password-reset request
  and invalid/expired recovery-link states; no horizontal overflow, raw keys
  or browser console errors found
- live confirmation, resend and password recovery delivery: pending manual
  Supabase configuration and access to test inboxes

Manual QA checklist:

- customer Login and Registration on `mirebook.com`
- business Login and Registration on `business.mirebook.com`
- staff registration from a secure invite, including return to the same invite
  after verification
- unverified login error and resend action
- Account verified, unverified and unknown presentation
- customer and business password reset request
- valid recovery link, mismatched password, short password and successful
  password update
- expired or reused recovery link
- successful post-reset login and capability routing
- logout from customer, owner, staff and owner-as-staff sessions
- English and Albanian with no raw keys

Remaining follow-ups:

- apply and test the Supabase dashboard settings manually in a non-production
  environment
- verify actual SMTP/rate-limit behavior for confirmation and recovery emails
- confirm Vercel preview origins that should remain allowlisted
- do not remove current soft access behavior until confirmation is deliberately
  enabled and existing accounts have an agreed migration plan

Recommended next batch:

- Stage 7 Batch 6 - Final Launch QA and Stage 7 Closure

### Batch 6 - Final Launch QA And Stage 7 Closure

- desktop/mobile EN/SQ role-by-role QA
- customer booking smoke test
- owner request/instant booking action smoke test
- staff schedule/availability/invite smoke test
- billing and webhook regression smoke test
- admin/support access and privacy smoke test
- auth verification and password recovery smoke test
- cross-domain and redirect-loop QA
- close Stage 7 only with no Critical or High launch regressions

## Batch 1 Decisions

- no application code changes
- no copy or navigation changes
- no translation keys added
- no auth or Supabase settings changed
- no route removed or redirected
- no database, Stripe, booking, staff-linking, billing or admin behavior changed

The audit found issues that should be solved in controlled batches rather than
through isolated Batch 1 edits.

## Stage 7 Pass Standard

Stage 7 passes when:

- customer navigation remains booking-focused and understandable on mobile
- Mirëbook Business has no more than five clearly prioritized owner
  destinations
- daily operational tasks are visually separated from setup and account tools
- Bookings and Notifications have clear, non-competing action ownership
- staff sees one coherent Schedule feature and clear linked-business context
- owner-as-staff can move between Manage business and My work without role
  confusion
- Account presents identity, security, preferences and role workspaces without
  one overwhelming page
- customer, business and staff registration remain correct
- forgot password, recovery completion, verification resend and confirmation
  callbacks work on both production domains
- application email safely supports disabled and configured provider modes
- admin and support controls remain protected and understandable
- EN and SQ show no raw keys or obvious mixed launch-facing copy on tested
  routes
- core routes work at approximately 390px without horizontal overflow
- Stage 1 through Stage 6 behavior passes regression QA
- no native/mobile implementation starts before this pass standard is met
