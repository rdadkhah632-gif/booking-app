# Stage 8 - Interface Compression And Marketplace Polish

Status: active.

Wave 1 status: implemented and build-validated. Authenticated QA remains open
for signed-in customer and business workspaces.

## Goal

Make Mirëbook feel closer to premium booking marketplaces by reducing the
amount of interface required to use the existing product.

This stage is not feature expansion. It protects booking, availability, auth,
roles, staff linking, billing writes and notification behavior.

## Wave 1 Implemented

- compressed the homepage into a marketplace entry point with search, city and
  category shortcuts above the fold
- removed repeated homepage explanation and trust cards
- compressed Explore by reducing hero/counter weight, moving filters into a
  single compact row and removing the lower explanatory marketplace section
- made Explore cards denser and changed booking labels to customer language
- replaced public business booking-mode wording with Book instantly / Request
  appointment language
- compressed My Bookings header, summary counts and section descriptions
- reduced the public support hub to role-specific support routes
- cleaned customer-facing Supabase/SQL/internal terminology from account,
  login, register, forgot-password and legacy booking redirect copy
- sharpened the business landing page into hero, proof, early-partner offer and
  final CTA
- reduced support links in customer/public navigation while keeping routes live

## Protected Systems

Wave 1 did not change:

- booking creation logic
- slot generation or availability calculations
- booking lifecycle actions
- role separation
- Supabase auth or RLS behavior
- staff invite/linking or owner-as-staff logic
- billing/payment write logic
- notification creation or delivery behavior
- middleware/domain split

## Follow-Ups

- authenticated customer QA for My Bookings and Notifications after real
  bookings exist
- authenticated business owner QA for dashboard setup and calendar pages
- deeper Wave 2 guided setup refinement using existing readiness data only
- continue removing long explanatory blocks found during route-by-route QA

## Wave 2B Implemented

- refocused the authenticated business dashboard around Today, Needs attention,
  Upcoming and one primary next action
- replaced duplicate setup warning rows with a compact setup progress checklist
  derived from existing business, service, staff, availability and published
  state
- added a customer profile preview CTA when a business profile exists
- grouped business setup links in the sidebar while keeping existing routes
  intact
- kept staff workspace navigation separate and did not show owner setup guidance
  to staff-only workspaces

Wave 2B did not add persistence, schema, booking rules, listing rules or billing
changes. Customers navigation was not added to the business sidebar because the
repo currently has customer history/detail routes, not a safe standalone
customer-list route.

## Stage 8.5 Implemented

- reduced business primary navigation to Today, Calendar, Bookings, Setup and
  Inbox
- demoted Account, Membership, Help and Log out into the user/account area
- removed duplicate business logout from the setup/sidebar link group
- renamed the business dashboard label from Home to Today while keeping the
  `/dashboard` route stable
- kept setup pages accessible through the Setup route and existing deep links
- improved the empty Calendar state with setup, service, working-hours and
  public-profile preview actions
- kept staff navigation focused on Today, Calendar, Availability and Inbox,
  with owner/business management only shown for accounts that can use it

Stage 8.5 did not change booking logic, availability calculation, auth, RLS,
staff linking, billing writes, notification generation or route protection.

## Stage 8.6 Business Architecture Rebuild Implemented

- rebuilt the authenticated business shell around product-level navigation:
  Today, Calendar, Bookings, Setup and Inbox
- demoted Account, Membership, Help and Log out into a profile/account area for
  both business and staff workspaces
- clarified Calendar versus Bookings without changing the booking data model:
  Calendar is the schedule view for what happens when, while Bookings is the
  management view for requests, upcoming records and history
- rebuilt `/dashboard/businesses` as Setup with one primary next action, a
  five-step checklist, compact customer preview, secondary Advanced links and a
  collapsed profile-details editor
- kept Services, Team, Working hours, Booking rules and Membership routes live
  as Setup destinations rather than primary sidebar architecture
- made Today show operational status, requests, appointments and one next action
  instead of repeating the full setup workspace
- cleaned Account so it stays personal: verification, preferences, personal
  details, security, region and compact role summaries only
- changed owner-facing Billing copy to Membership / early partner wording and
  removed test/sandbox-style presentation from the business page
- shortened Working hours and Booking rules language to avoid exposing internal
  availability/settings architecture
- kept staff navigation focused on Today, Calendar, Availability and Inbox, with
  business dashboard access demoted into the account area for owner-as-staff

Stage 8.6 did not change:

- booking creation logic
- booking lifecycle/status transitions
- availability calculations or save behavior
- Supabase auth, RLS, route protection or middleware/domain split
- staff invite/linking or owner-as-staff data logic
- notification generation/read behavior
- billing write, checkout or webhook logic
- database schema

Remaining QA notes:

- visually inspect signed-in business routes on desktop and mobile:
  `/dashboard`, `/dashboard/bookings?view=today`,
  `/dashboard/bookings?view=upcoming`, `/dashboard/businesses`,
  `/dashboard/services`, `/dashboard/staff`, `/dashboard/availability`,
  `/dashboard/settings`, `/dashboard/notifications`, `/dashboard/billing` and
  `/account`
- visually inspect staff routes after login, especially owner-as-staff accounts
- verify real business data still makes the new Setup checklist point to the
  correct next action

## Stage 8.7 Authenticated UX Self-QA Polish Implemented

- completed a targeted authenticated copy sweep across business, staff, account,
  login and support-adjacent surfaces
- aligned Membership copy so user-facing billing states do not say billing
  record/details or test/sandbox wording
- tightened Working hours language and removed business-wide fallback phrasing
  from owner-facing availability surfaces
- simplified Booking rules copy so settings read as appointment rules rather
  than business settings architecture
- cleaned Team copy around staff invites, linked access and bookable people
- reduced owner-as-staff wording so it reads as a simple "do you take
  appointments?" product choice
- cleaned Staff workspace language so staff see their schedule, working hours,
  assigned services and updates without owner-account phrasing
- removed Supabase/Auth implementation language from account verification and
  password reset copy
- kept English and Albanian translation keys updated together for every touched
  visible string

Stage 8.7 did not change:

- booking creation logic
- booking lifecycle/status transitions
- availability calculations or save behavior
- Supabase auth, RLS, route protection or middleware/domain split
- staff invite/linking or owner-as-staff data logic
- notification generation/read behavior
- billing write, checkout or webhook logic
- database schema

Stage 8.7 remaining QA notes:

- visually inspect authenticated business pages with real business data on
  desktop and mobile
- visually inspect staff-only and owner-as-staff accounts after login
- confirm Albanian mode on Team, Working hours, Booking rules, Membership,
  Account and Staff routes
- continue treating old admin-only/debug copy as outside the launch customer and
  business surface unless it appears in normal user flows

## Stage 8.7A Business Ease-Of-Use Review Fixes Implemented

- fixed the authenticated business mobile nav so the first viewport shows the
  product instead of stretched active navigation blocks
- kept business navigation as product-level links while moving account actions
  into a compact secondary row on mobile
- compressed Setup by leaving the guided checklist, next action and customer
  preview as the primary experience
- changed the heavy business profile editor into an intentionally expandable
  section instead of opening automatically on fresh businesses
- removed duplicate setup/readiness card grids and old shortcut buttons from the
  business profile editor, including the old billing-groundwork link surface
- gave Calendar and Bookings distinct no-data states:
  Calendar explains the schedule, while Bookings explains requests, records and
  history
- cleaned normal business copy that exposed internal/planning language such as
  billing groundwork, business-wide hours and future-launch wording

Stage 8.7A did not change booking creation, status transitions, availability
calculation, auth/session behavior, RLS, staff invite/linking, billing writes,
notification generation or database schema.

Remaining QA notes after Stage 8.7A:

- visually inspect Setup after adding the first service, team member and working
  hours to confirm the next-action checklist advances cleanly
- inspect Booking rules and Account again for any remaining density issues after
  the mobile nav and Setup fixes land
- continue the next pass from the heaviest remaining owner pages rather than
  adding new features

## Stage 8.7B Illustrated Empty-State Polish Implemented

- added a reusable illustrated dashboard empty state inspired by the supplied
  Services and Team references, implemented as responsive code-native SVG/CSS
  rather than baked image assets
- replaced the plain empty Services card with a polished "No services yet"
  state and a translated CTA that reopens the existing add-service form
- replaced the plain empty Team card with a polished "No staff yet" state and a
  translated CTA that reopens the existing add-staff form
- kept the supplied artwork as visual direction only so copy remains
  translatable, responsive and consistent with Mirëbook's dark interface

Stage 8.7B did not change service creation, staff creation, booking logic,
availability logic, auth, RLS, billing writes, notification behavior or
database schema.

## Stage 8.8A Authenticated Mobile Shell Cleanup Implemented

- audited public, customer, business and staff flows with throwaway `@test.com`
  accounts across desktop and mobile screenshots
- tightened authenticated mobile navigation so customer links wrap instead of
  clipping account/logout controls off-screen
- compacted business and staff mobile shells by removing the large avatar/email
  account block from the first viewport while keeping Account, Membership/Help
  and Log out actions available
- shortened the Working hours setup summary and removed repeated Setup/Team/
  Services shortcut buttons from the first card so the page gets to the actual
  hours controls faster

Stage 8.8A did not change protected auth, role routing, booking, availability
save logic, staff linking, billing writes, notifications or database schema.

## Stage 8.8B Customer And Setup Compression Implemented

- moved Explore mobile into a results-first flow so bookable businesses appear
  before the filter panel on small screens
- reduced Explore mobile card image/action spacing so more marketplace content
  fits in the first scroll
- merged the Setup page progress and next-action panels into one compact status
  panel
- compressed Working hours by replacing separate stat cards with one status
  strip, tightening presets and shortening closed-day copy
- reordered Account so personal details, verification and security appear before
  secondary account summaries
- collapsed email preferences into a compact account details row instead of a
  full always-open settings section
- updated English and Albanian translation keys for every touched visible string

Stage 8.8B did not change booking logic, availability save behavior, auth,
route protection, staff linking, billing writes, notifications or database
schema.

## Stage 8.8C Working Hours Copy Compression Implemented

- removed the redundant Working hours intro card that repeated the page title,
  business name and explanation before the actual controls
- shortened the selected-business subtitle to the business name only
- kept the status strip, presets and day rows as the first functional content
  on the page

Stage 8.8C did not change availability save behavior, availability row data,
booking logic, auth, staff linking, billing writes, notifications or database
schema.

## Stage 8.8D Business Workspace Copy Compression Implemented

- applied the Working Hours "say it once" rule across key owner pages so page
  headers, section headings and intro cards no longer repeat the same purpose
- shortened Services, Team, Booking rules, Membership and Calendar/Bookings
  selected-business subtitles to the business name only
- removed redundant Services and Team list-intro sections while keeping empty
  states, creation forms, staff account-link status and existing actions
- removed the extra Booking rules header component and the Membership hero card
  so both pages start closer to their functional controls and status content
- compressed the Calendar/Bookings view switch into a true control while
  preserving the distinction between schedule view and booking records
- updated English and Albanian translation values for the active shortened copy

Stage 8.8D did not change booking logic, booking status transitions, service or
staff creation behavior, availability save behavior, auth, route protection,
staff linking, billing writes, notifications or database schema.

## Stage 8.9 Business Calendar And Shell Tightening Implemented

- rebuilt the business Calendar surface into a schedule-first time lane so empty
  and booked days look like a working calendar rather than another booking list
- kept Bookings as the record/action manager with existing accept, decline,
  cancel and complete actions unchanged
- tightened Today by removing duplicate explanatory copy and fixing mobile stat
  spacing so counts and labels no longer run together
- removed repeated helper text from the seven-day preview and business Inbox
  toolbar so operational screens start closer to usable content
- simplified Membership into one status summary plus plan details instead of
  several competing status cards
- corrected business sidebar active states so Today no longer appears active on
  every dashboard route
- updated English and Albanian translation values for the touched UI copy

Stage 8.9 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
linking, billing checkout/webhook writes, notifications behavior or database
schema.

## Stage 8.10 Staff And Customer Visual Polish Implemented

- visually reviewed staff and customer surfaces with Browser before editing,
  including Staff Today, Staff Calendar, Staff Working hours, Staff Inbox,
  My bookings, customer Updates and Account on mobile
- tightened Staff Today so it no longer uses a long email-like staff name as
  the main heading, and fixed quick-link spacing so labels and helper text do
  not run together
- compressed Staff Working hours by removing the repeated explanatory paragraph
  and duplicate staff/business context before the actual controls
- made Staff Calendar mobile fit the seven-day week in view, using simple dots
  for booked days and keeping appointment details in the selected-day panel
- simplified Staff Inbox and customer Updates so read/refresh actions do not
  dominate empty states
- removed raw signed-in email copy from customer My bookings and Updates page
  headers, shortened empty-state copy and kept one clear Explore path
- added a small Account mobile/input polish for long email values
- updated English and Albanian translation values for the touched visible copy

Stage 8.10 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.11 Cross-Role Visual QA Cleanup Implemented

- visually reviewed customer, business owner and staff-intent flows with Browser
  on a mobile viewport before editing
- fixed the staff/account top navigation overflow by shortening staff work
  labels to Today, Calendar, Availability and Inbox and allowing the rows to
  wrap cleanly on mobile
- aligned the Setup page's displayed progress with the Today dashboard's setup
  steps so the same business no longer appears as 2 of 5 complete on Today but
  0 of 5 on Setup
- kept publishing and Explore-readiness validation unchanged; Setup still uses
  existing booking-readiness rules before publishing
- compressed the customer support page by removing duplicate hero/form/guide
  explanations and keeping one support form plus three useful links
- updated English and Albanian translation values for the touched visible copy

Stage 8.11 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.12 Booksy/Fresha Compactness Pass Implemented

- reviewed the business owner flow with Browser against the Stage 8 principle:
  one clear page purpose, immediate primary action, less repeated explanation
  and denser useful information
- removed the full setup checklist from Today so the business dashboard starts
  with operational work, today's attention items and the next action only
- shortened registration copy and removed the after-registration explanation
  card so signup stays focused on account creation
- made Account more personal by removing the booking/business summary card pile,
  support promo card and long account-mode explanations
- kept Account access to workspace, notifications and support as compact links
  instead of large destination cards
- shortened account helper copy for email and language preferences in English
  and Albanian

Stage 8.12 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.13 Customer Booking Conversion Compression Implemented

- visually audited customer/public booking screens with Browser before editing,
  using the Booksy/Fresha principle of getting customers to services and times
  faster
- compressed public business profile headers so the first viewport no longer
  spends most of its space on a large profile image and support/back actions
- moved the public business page toward a booking-first flow by tightening the
  hero, service picker spacing, booking summary actions and support links
- reduced Explore result repetition by removing the duplicate results heading
  when no filters are active and by hiding generic fallback description copy on
  business cards
- simplified Login into a focused sign-in form instead of a split explanatory
  promo layout
- hid the four zero-count My Bookings summary tiles when a customer has no
  bookings, leaving one clear Explore action
- updated English and Albanian translation values for touched visible copy

Stage 8.13 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.14 Business Manual Booking Entry Implemented

- added a compact Add booking panel to the business Calendar workspace so owners
  can create a confirmed appointment from existing business services, active
  staff and service assignments
- kept the first manual-booking slice inside the existing bookings table and
  existing booking lifecycle: manual bookings are created as confirmed records
  after live pending/confirmed clash checks
- added live validation for active service, active staff, service assignment,
  future date/time and overlapping appointments before insert
- requested the existing transactional booking-status email after successful
  owner-created booking where email delivery is configured
- kept Calendar as the operational schedule view and Bookings as the record
  management view
- updated English and Albanian translation keys for the new compact panel

Stage 8.14 did not change customer public booking, slot generation,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

Remaining follow-up:

- build the richer manual booking invite/account-sync flow so an entered
  customer email can attach to an existing Mirëbook customer account where safe,
  or receive a join/view-booking invitation when no account exists.

## Stage 8.15 Authenticated Workspace Compression Implemented

- tightened the shared business/staff sidebar so mobile account actions stay in
  one compact horizontal row instead of taking over the first viewport
- stopped using long email prefixes as the visible account label when no full
  name is available, keeping the account area calmer on test and production
  accounts
- removed duplicate staff page hero cards from Today, Calendar, Working hours
  and Inbox so the shared page header carries the title once
- compressed Staff Working hours with tighter templates, day cards and closed
  day copy while leaving availability save behavior unchanged
- compacted Booking rules cards and controls so owners reach the actual
  settings faster without changing any setting values or persistence
- compacted Membership status/details so it reads as a secondary account
  surface rather than a billing implementation screen
- made the Setup status panel focus on the next setup step while leaving the
  business name in the customer preview where it belongs

Stage 8.15 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.16 Customer Booking Conversion Compression Implemented

- visually reviewed the public/customer booking path before editing, with
  emphasis on the mobile public business booking page
- compressed the public booking summary into a progressive panel: before a
  customer chooses a service/time, it now shows only the next booking action
  instead of account prompts, forms, policies and repeated status text
- revealed sign-in/customer-role guidance, customer details and booking policies
  only after an appointment slot has been selected
- removed repeated step/helper copy from the public staff and time selection
  cards so customers reach the actual choices faster
- made the booking summary styling apply correctly across the child component
  boundary and tightened the mobile form/policy spacing
- updated English and Albanian translation keys for the touched visible copy

Stage 8.16 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.17 Business Setup And Forms Compression Implemented

- visually reviewed the business, customer and staff workspaces before editing,
  with emphasis on the places that still felt over-explained or space-heavy
- compressed the Add Service form so the primary path is service name, duration,
  price and save; moved description, image upload and preview under More details
- tightened the Today mobile summary into a compact three-column strip so the
  first viewport is less dominated by stacked stat cards
- reduced Working hours repetition by removing the quick-preset helper paragraph
  and hiding the duplicate time-range display on mobile while keeping the inputs
  visible
- demoted timing, region and policy controls under Advanced booking rules while
  keeping confirmation mode visible as the main booking rule
- updated English and Albanian translation keys for the touched visible copy

Stage 8.17 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.18 Mobile Workspace Navigation Compression Implemented

- visually reviewed the business mobile dashboard header and confirmed the
  account actions were acting like a second full navigation row
- kept the primary business navigation visible on mobile while collapsing
  Account, Membership, Help and Log out behind one compact Account control
- preserved the desktop sidebar account card and desktop action links
- kept the same account destinations and logout behavior; only the mobile
  presentation changed

Stage 8.18 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.19 Staff And Customer Account Polish Implemented

- visually reviewed customer My bookings, customer Updates and staff Working
  hours mobile states after the business workspace compression pass
- collapsed mobile authenticated customer/business account controls into one
  Account menu so language, Account and Log out no longer dominate empty
  customer pages
- removed full-width refresh/action bars from empty My bookings and empty
  Updates so the first clear action is the useful empty-state CTA
- fixed the mobile staff dashboard grid spacing that left a large blank area
  between the staff nav and unlinked staff content
- kept existing destinations, logout behavior, language persistence, staff
  route protection and booking status behaviour unchanged

Stage 8.19 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.20 Real Data Account State Compression Implemented

- compressed customer booking cards for real booking states so service,
  business, status, appointment time, staff, duration and price read as one
  appointment record instead of several repeated explanation blocks
- replaced the customer booking count cards with a compact status strip while
  preserving jump behavior to Request sent, Upcoming, Change requests and
  History sections
- tightened customer notification cards so read/unread state, title, message,
  date and actions scan in one compact row
- removed duplicate staff Today shortcut cards that repeated the Staff nav
  destinations and made the assigned-services summary a smaller context block
- rebuilt staff calendar appointment cards into schedule-style rows with time
  first, customer/service second and actions last
- kept cancel/reschedule/mark-complete/read actions, destinations and status
  wording unchanged

Stage 8.20 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.21 Booking Flow Visual QA Fixes Implemented

- visually tested the fresh business setup path with Browser using a throwaway
  business account, service, staff member and working hours
- surfaced the existing Publish to Mirëbook action in the visible Setup summary
  when a business is ready but still hidden, instead of burying it inside the
  expanded profile editor
- added compact tappable date options to the public booking time picker so
  customers can choose near-term appointment dates without relying on the native
  mobile date input
- kept the native date input as a secondary More dates fallback and added input
  handling/labels for better browser and accessibility behavior
- removed seconds from customer-facing confirmation and My bookings appointment
  date/time displays after the live booking QA exposed the awkward default format
- updated English and Albanian translation keys for the touched visible labels

Stage 8.21 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.22 Business Calendar Simplification Implemented

- removed the duplicate empty Services add panel so an empty Services page shows
  one clear empty state with one add action
- removed Bookings as a separate primary business navigation concept and kept
  the existing `/dashboard/bookings` route as the Calendar workspace for
  compatibility
- rebuilt the business Calendar surface around a week-first schedule with
  previous/today/next controls, date selection and clickable appointment blocks
  that reveal appointment details
- removed the old Calendar/Bookings toggle, status filters, staff filters,
  range chips and pending strip from the Calendar page
- routed Today page attention items to Inbox and appointment schedule links to
  Calendar, matching the product split of Inbox for actions and Calendar for
  appointments
- updated business-side labels from View/Open/Back to bookings to Calendar or
  appointment language while leaving customer My bookings wording intact

Stage 8.22 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.23 Account And Team Duplication Cleanup Implemented

- removed the bottom Account shortcut row for Today, Notifications and Support
  so Account stays focused on personal details, verification, email
  preferences, security and region
- removed the Team page's account-link counter strip because invite/link status
  is already visible where it matters, on each staff row
- removed the owner-as-staff "My staff work" jump from the business Team page
  so owners are not pushed into a separate staff workspace for appointment
  management
- made the owner's own staff row display as "You" with a "Your profile" status,
  making it clear when the listed staff member is the signed-in owner
- kept actual staff workspace routes available for staff accounts, while
  leaving business appointment management in Inbox and Calendar

Stage 8.23 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.24 Calendar Consistency Polish Implemented

- rebuilt the staff Calendar from a month-grid plus selected-day list into the
  same week-first schedule pattern used by the business Calendar
- added previous/today/next week controls, date jump, seven-day headers, time
  rail and duration-sized appointment blocks to the staff Calendar
- made staff appointment blocks clickable so details, contact actions and mark
  complete appear in one selected-appointment panel
- kept pending staff appointments read-only with the existing "Awaiting
  business approval" meaning
- aligned business and staff calendar appointment count copy so plurals use
  translation keys rather than appending English `s`

Stage 8.24 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection,
staff invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.25 Business Customer History Compression Implemented

- compressed the business-facing customer detail and email-matched customer
  history routes into one shared compact customer profile view
- removed technical customer IDs, "locked record" copy and older status labels
  such as "Pending approval" from these owner-facing customer pages
- replaced stacked metric cards and next/last appointment cards with one compact
  customer summary strip and dense appointment rows
- kept account-ID and email-matched customer history data loading unchanged,
  while making email-matched history a small note instead of a warning-style
  card
- added English and Albanian translation keys for the new customer-history
  labels, empty states and actions

Stage 8.25 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.26 Calendar Visual QA Fix Implemented

- fixed the business Calendar week view so the day headers render as dark
  schedule controls instead of native white buttons
- contained the business Calendar week grid in its own horizontal scroll area,
  preventing mobile page overflow while keeping the week schedule readable
- applied the same contained week-grid treatment to the staff Calendar so both
  workspaces use consistent schedule presentation
- kept hour rails, day lanes and appointment blocks inside the calendar surface
  so the page no longer shows stray long schedule lines
- removed the remaining Setup prompt that sent owner-as-staff users to My Work,
  keeping business setup focused on business readiness

Stage 8.26 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.27 Working Hours And Booking Rules Compression Implemented

- compressed business Working hours from card-heavy day blocks into compact
  day rows with one open/closed control and direct start/end inputs
- removed repeated time-range display where the same start/end times were
  already visible in editable inputs
- made business Working hours summary and preset controls lighter so the page
  reads as one schedule editor rather than several explanation cards
- applied the same list-first treatment to staff Working hours while preserving
  staff availability save behavior
- simplified Booking rules so confirmation mode, timing, buffers, region and
  policies use shorter labels and denser controls
- updated English and Albanian copy for the shortened Booking rules labels

Stage 8.27 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.28 Business Inbox Action Centre Polish Implemented

- rebuilt the business Inbox presentation around one compact action-centre
  overview instead of separate summary cards and repeated notification headings
- grouped pending booking approvals and pending reschedule requests under one
  Needs action section so customer requests are the first visible work
- compacted approval and reschedule rows into scannable customer, time, service,
  staff and contact chips while keeping the existing accept/decline/open actions
- moved general notification rows into a denser Recent updates section and hid
  duplicate pending-action notifications when the matching action row is already
  visible
- folded handled reschedule requests into a collapsible history block so old
  records do not dominate the active work surface
- updated English and Albanian copy for the shorter Inbox/action-centre labels

Stage 8.28 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.29 Customer Booking Conversion Compression Implemented

- visually reviewed Explore and the public business booking page on desktop and
  mobile against the Stage 8 compactness standard
- compressed the public booking summary so it stays quiet before a service is
  selected, then shows useful appointment state instead of repeated empty
  service/time rows
- changed the mobile date chooser into a horizontal date strip and collapsed
  the native date input behind More dates
- auto-selected today after service selection and preserved the selected date
  when switching staff, reducing a needless tap before slots appear
- masked generated-looking staff names such as `live-business-*` on the public
  customer booking page while keeping real staff names visible
- removed a duplicate Staff label in the booking summary value after slot
  selection

Stage 8.29 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.30 Business Calendar Appointment Workspace Implemented

- visually reviewed the business Calendar on mobile before editing and found
  the schedule was still being pushed down by a stacked form-style toolbar
- rebuilt the Calendar page into a main schedule column with an appointment
  side panel on wider screens, keeping the week schedule as the primary surface
- compressed the week controls into a single stepper, date picker and Add
  appointment action instead of five stacked full-width controls
- added clickable empty time slots in the week schedule so owners can start a
  manual appointment from the calendar time itself
- reused the existing manual appointment creation path, service/staff checks,
  clash prevention and transactional email request instead of adding new
  booking logic
- changed owner-facing calendar copy from Add booking to Add appointment and
  shortened the setup-needed guidance

Stage 8.30 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.31 Manual Appointment QA Fixes Implemented

- visually tested a fresh business-owner setup flow with Browser: signup,
  first service, owner-as-staff service assignment, working hours and Calendar
  add-appointment
- removed the duplicate Services empty state that stayed visible underneath the
  open add-service form
- changed the Calendar manual appointment staff selector to show the current
  owner staff profile as "You" instead of the generated email-name fallback
- confirmed the previous client-side manual appointment insert was blocked by
  Supabase RLS for `bookings`
- added an owner-authorized manual appointment API route using the existing
  Supabase service-role server pattern; the route verifies the signed-in owner,
  validates service/staff assignment and checks overlapping pending/confirmed
  appointments before inserting a confirmed manual appointment
- kept public customer booking, booking status transitions, availability
  calculation, staff linking, route protection and database schema unchanged

Local QA note:

- full manual appointment creation now requires `SUPABASE_SERVICE_ROLE_KEY` in
  the local environment, matching the existing server-admin routes

Stage 8.31 did not change public booking creation, booking lifecycle/status
transitions, availability calculation/save behavior, auth session resolution,
RLS policies, route protection, staff invite/linking, owner-as-staff data logic,
billing writes, notification generation/read behavior or database schema.

## Stage 8.32 Manual Calendar Time QA Fix Implemented

- fixed the business Calendar manual appointment flow so selected date/time
  values are converted from the business timezone before being saved
- aligned manual appointment conflict checks, week grouping and appointment
  block placement with the business timezone
- kept duplicate appointment prevention intact and did not change booking
  statuses, availability calculation, staff linking, auth, RLS or billing logic

Remaining QA notes after Stage 8.32:

- re-test the live Calendar flow by adding a future appointment and confirming
  the visible block matches the selected time
- re-test same-staff same-time duplicate creation to confirm the clash message
  still appears

## Stage 8.33 Occupied Calendar Cell Cleanup Implemented

- removed add-appointment hit targets from business Calendar hour cells already
  occupied by pending or confirmed appointments
- kept appointment blocks as the clickable detail surface for occupied time
  ranges
- preserved the top Add appointment action and duplicate clash prevention for
  manual entry

Stage 8.33 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.34 Customer Booking QA Polish Implemented

- reduced booking-confirmation status repetition so the result page has one
  clear heading and appointment details without repeated status rows
- changed confirmed booking copy to read as a finished customer outcome instead
  of repeating the same confirmation sentence
- reused the public staff display helper on booking confirmation and My
  Bookings so generated-looking staff names such as `live-business-*` are not
  shown to customers
- hardened signed-in nav logout buttons with explicit button type and
  accessible labels across customer, business, staff and admin nav surfaces

Stage 8.34 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.35 Customer Flow Compression Follow-Up Implemented

- compressed My Bookings sections to simple Requests, Change requests,
  Upcoming and History headings instead of repeating status/explainer copy
- removed the My Bookings header subtitle and tightened customer booking action
  button semantics
- removed the extra confirmed-booking lifecycle sentence from active customer
  booking cards and shortened the confirmed time label to Appointment time
- made the public business staff chooser a compact step instead of another
  full card in the booking flow
- removed the customer-facing "Only bookable services are shown" helper from
  public service lists where it added setup-language noise
- simplified the selected booking summary heading to Review appointment
- consolidated CustomerNav into one account menu so desktop and mobile account
  controls are not duplicated in the DOM

Stage 8.35 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.36 Customer Notifications And Account Compression Implemented

- simplified customer Notifications into a true updates feed instead of a
  secondary bookings handoff surface
- removed the duplicate My Bookings CTA and explanatory booking handoff copy
  from Notifications
- removed unused booking/request lookups from the Notifications page so the
  page only loads notification rows and read state
- shortened Notifications headings to Updates / Latest and kept notification
  actions on each update card
- tightened Account copy from account settings language to My account language
  focused on personal details, language and security
- removed user-facing Supabase, SQL and future-batch wording from touched
  account email preference and verification strings
- shortened Account secondary cards by removing repeated kicker labels and
  keeping Region/Security compact

Stage 8.36 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.37 Staff Workspace Compression Sweep Implemented

- compressed staff Inbox into a slimmer action feed with All / Unread filters,
  one mark-all-read action and a single Calendar empty-state action
- removed duplicate staff support and schedule wording from Inbox empty states
  while keeping notification read behavior unchanged
- tightened staff Today copy so owner-as-staff and assigned-service guidance
  uses plainer workspace language
- renamed staff availability navigation/action copy toward Working hours and
  shortened loading/success/error text
- removed the Working hours footer note when no upcoming appointments exist;
  upcoming appointments are only called out when there is something to know
- made staff Calendar pending counts use staff-facing awaiting-approval wording
- replaced the unlinked staff Calendar error banner with a normal empty state
  and removed duplicate Staff support CTAs from unlinked Working hours
- cleaned the business/staff sidebar identity fallback so missing profile names
  use the email prefix instead of repeating Account

Stage 8.37 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.38 Linked Staff Workspace Follow-Up Implemented

- tightened linked staff Today metrics so only active assigned work
  (`pending` and `confirmed`) counts as today/upcoming work
- kept completed, declined and cancelled bookings out of active staff summary
  counts so they do not look actionable
- simplified empty linked staff Calendar weeks by showing the week controls and
  one compact empty state instead of a full blank schedule grid plus a second
  empty message

Stage 8.38 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.39 Linked Staff QA Follow-Up Implemented

- created a disposable owner-as-staff QA account with linked staff profile,
  assigned service and pending, confirmed, completed and cancelled bookings for
  staff/customer/business surface checks
- confirmed the local routes for Login, Staff, Dashboard and My Bookings serve
  successfully with the current build
- tightened Staff Calendar selected-booking actions so only confirmed
  appointments expose staff contact/complete actions
- non-active staff booking states now show a compact no-action note instead of
  looking like staff should contact the customer
- tightened linked staff Today again so pending requests do not appear as the
  next confirmed appointment; pending remains isolated as awaiting approval
- in-app Browser and Computer Use visual inspection were attempted but timed
  out on local page navigation/window state; visual verification still needs a
  manual browser pass against the seeded QA account

Stage 8.39 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.40 Appointment Language Alignment Implemented

- aligned remaining business-facing Calendar copy away from generic "bookings"
  language toward appointments/calendar wording
- changed Today, analytics, schedule preview, Calendar loading, refresh,
  search and empty-state copy to describe appointments instead of a separate
  bookings manager
- kept the existing `/dashboard/bookings` route as the Calendar workspace for
  route compatibility
- tightened customer notification card actions to say Review in My bookings or
  Open My bookings instead of repeating generic View booking buttons
- added matching EN/SQ translation keys for the touched customer notification
  and business Calendar wording

Stage 8.40 did not change booking creation, booking status transitions,
availability calculation/save behavior, auth, RLS, route protection, staff
invite/linking, owner-as-staff data logic, billing writes, notification
generation/read behavior or database schema.

## Stage 8.41 Web Mobile Calendar And Small Polish Implemented

- kept desktop business and staff calendars as week schedule views
- added mobile agenda views for business and staff calendars so phone users see
  readable day-by-day appointment rows instead of a squeezed desktop grid
- preserved the existing business manual appointment entry and selected
  appointment details without changing booking creation or status logic
- improved Explore card fallback media so businesses without uploaded images
  look intentional rather than like missing-image placeholders
- tightened the signed-in customer mobile nav so Account remains reachable
  without clipping
- changed staff account role badging to Staff instead of Business on staff
  pages
- shortened Team staff status pills from account/linkage phrasing to product
  labels such as Linked account, Bookable and Hidden from bookings

Stage 8.41 did not change booking creation, booking lifecycle transitions,
availability calculations, staff linking data, auth/session behavior, RLS,
billing writes, notification behavior or database schema.

## Stage 8.42 Manual Appointment Account Sync Implemented

- tightened the existing business Calendar manual appointment flow so manually
  added appointments attach to an existing Mirëbook customer account when the
  entered customer email already exists in `profiles`
- kept guest/manual customer appointments supported by leaving
  `customer_user_id` empty when no matching account exists
- preserved the existing owner-only API guard, active service/staff validation,
  service-to-staff assignment check and clash prevention
- kept customer booking flow, public availability generation, booking status
  lifecycle, RLS, billing and database schema unchanged

Stage 8.42 makes the current web flow closer to the intended app behavior:
owner-created appointments can appear in a customer's existing My Bookings
without requiring a separate sync table or app-only workaround.

## Stage 8.43 Cross-Role Live QA Fixes Implemented

- fixed the owner Staff working hours editor so saved `staff_availability`
  rows include `business_id`, satisfying the live Stage 9 RLS policy that
  checks staff availability belongs to the same business as the staff member
- replaced raw row-level-security save failures on owner staff-hours saves with
  friendly working-hours copy
- hardened shared timezone parsing so appointment time inputs with optional
  seconds, such as `10:00:00`, are accepted instead of being treated as invalid
- separated invalid manual appointment time copy from past-time copy so valid
  future appointments are not confused with parsing errors
- preserved selected public booking intent through Login/Create account links
  by carrying service/date/time/staff query values back to the public business
  page and restoring them after auth
- cleaned the reschedule page date/time display to remove seconds and removed
  unexplained slot-count numbers from calendar cells

Stage 8.43 did not change booking status transitions, public slot generation,
staff invite/linking data, auth/session rules, billing writes, notification
generation or database schema.

## Stage 8.44 Cross-Role Retest Fixes Implemented

- hardened business Calendar manual appointment creation by sending the exact
  selected appointment start time to the owner-authorized API and removing the
  duplicate client-side future-time blocker that rejected valid future dates in
  live QA
- kept the manual appointment API authoritative for past-time, conflict,
  service and staff checks while allowing it to use the submitted ISO start time
  for the selected calendar slot
- changed Team availability links to open the staff-specific Working hours
  editor instead of the generic business working-hours page
- filtered the staff-specific Working hours editor to that staff member's
  business availability rows and kept the save confirmation visible after the
  post-save refresh
- aligned the customer Notifications badge with the customer Notifications page
  by counting unread customer notification rows only, rather than adding pending
  reschedule records that are shown in My bookings instead

Stage 8.44 did not change booking status transitions, public slot generation,
staff invite/linking data, auth/session rules, billing writes, notification
generation or database schema.

## Stage 8.45 Business Retest Reliability Fixes Implemented

- moved owner staff Working hours saves to an owner-authorized server route so
  saving replaces all rows for the selected staff member through the service
  role after verifying the owner owns that staff member's business
- kept the staff Working hours page business-scoped on refresh so saved rows are
  re-read from the same business context shown to the owner
- made manual Calendar appointment submission read the actual submitted form
  values before validation and API payload construction, avoiding stale
  React-state fallbacks to today's date and `09:00`
- removed the hard server-side future-time blocker from manual owner-created
  appointments; the route still verifies owner, active service, active staff,
  staff-service assignment and appointment overlap before insert

Stage 8.45 did not change public customer booking, public slot generation,
booking status transitions, staff invite/linking data, auth/session rules,
billing writes, notification generation or database schema.

## Stage 8.46 Staff Working Hours Submit Fix Implemented

- changed the owner staff Working hours page to submit the visible form values
  directly, matching the manual Calendar appointment reliability fix
- saved the exact displayed closed/start/end controls instead of relying on
  potentially stale React state when the owner edits a time and immediately
  saves
- kept the owner-authorized staff-hours API, business-scoped refresh and
  friendly save feedback from Stage 8.45

Stage 8.46 did not change public customer booking, public slot generation,
booking status transitions, staff invite/linking data, auth/session rules,
billing writes, notification generation or database schema.

## Stage 8.47 Staff Working Hours Duplicate-Row Hardening Implemented

- hardened the owner staff Working hours API against legacy duplicate
  `staff_availability` rows by updating every row for each staff/day instead of
  relying on delete/insert replacement
- inserted missing day rows only when no row exists for that staff/day
- returned the server read-back rows to the UI and normalised time values from
  database `HH:mm:ss` format to form-friendly `HH:mm`
- kept the visible save confirmation and business-scoped staff-hours refresh

Stage 8.47 did not change public customer booking, public slot generation,
booking status transitions, staff invite/linking data, auth/session rules,
billing writes, notification generation or database schema.

## Stage 8.48 Customer Session And Booking Reachability Fixes Implemented

- made logout local-first and shared across customer navigation, account and
  authenticated workspace shells so a stalled Supabase sign-out request cannot
  leave the user visually logged in
- cleared Supabase browser storage and auth cookies before and after the local
  sign-out call, then redirected with a full page navigation
- restored normal vertical overscroll behavior on the app body
- gave the public business booking summary a contained scroll area on desktop
  so customer/auth/submit controls remain reachable at normal laptop-height
  viewports
- added extra bottom room to public booking and reschedule pages so date, time
  and submit controls are reachable during customer QA
- replaced the business Inbox reschedule decline native prompt with an inline
  decline composer, keeping the same decline status update while making the
  action easier to verify and less browser-dialog dependent

Stage 8.48 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest customer logout, public booking reachability, reschedule reachability
  and business Inbox reschedule decline on the deployed site.

## Stage 8.49 Customer Nav Logout And Booking Submit Reachability Implemented

- added a dedicated `/logout` route that clears the browser session through the
  shared local-first sign-out helper
- changed the customer nav account-menu logout control to use the `/logout`
  route so clicking the visible nav item cannot be blocked by the details-menu
  interaction surface
- removed the sticky/nested-scroll behavior from the public booking summary so
  the full customer form and Confirm booking button move with normal page
  scrolling at laptop-height viewports

Stage 8.49 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest customer nav logout and public booking submit reachability on the
  deployed site at 1280x720.

## Stage 8.50 Customer Nav Hard-Logout Link Implemented

- changed the customer account-menu Logout item from a client-routed Next link
  to a plain hard-navigation anchor
- the visible nav Logout item now forces `/logout` through
  `window.location.assign("/logout")` on pointer/click interaction, matching
  the direct `/logout` route that already passed QA

Stage 8.50 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest the visible customer nav Logout item on the deployed site.

## Stage 8.51 Customer Logout Demoted Out Of Dropdown Implemented

- removed Logout from the customer account dropdown entirely
- added Logout as its own top-level customer nav action beside Account, using
  the same hard-navigation `/logout` behavior
- kept the Account dropdown focused on language and account settings only

Stage 8.51 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest the standalone customer nav Logout action on the deployed site.

## Stage 8.52 Closure QA Polish Fixes Implemented

- fixed mobile Explore ordering so filters appear before results instead of
  after the full results list
- tightened signed-in customer mobile nav into a compact two-column action grid
  while keeping Logout as a top-level action
- kept business and staff mobile account actions inside the compact account
  menu across tablet/mobile widths instead of expanding Account, Help and Log
  out as competing top-level actions
- removed seconds from customer notification date/time displays and sanitized
  stored notification messages that include `HH:mm:ss`
- kept business Working hours success feedback visible after save/refresh,
  including no-change saves
- compressed the owner staff Working hours page by removing the heavy booking
  readiness block, trimming secondary links and simplifying quick-preset copy

Stage 8.52 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest mobile Explore, mobile authenticated business/staff nav, customer
  notification timestamps and business Working hours save feedback on the
  deployed site.

## Stage 8.53 Mobile Details Menu Visibility Fix Implemented

- explicitly hide customer Account dropdown contents unless the Account details
  menu is open
- explicitly hide business/staff mobile Account menu contents unless the mobile
  Account details menu is open
- preserved the compact account-menu structure introduced in Stage 8.52 while
  fixing the leaked Account/Help/Log out controls seen in QA

Stage 8.53 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest closed mobile customer/business/staff Account menus on the deployed
  site to confirm their contents stay hidden until tapped.

## Stage 8.54 Mobile Account Menu Open-State Fix Implemented

- made the business/staff mobile Account trigger occupy a real nav grid column
  instead of relying on absolute positioning that could collapse the tappable
  target
- changed the customer mobile Account dropdown from a fixed overlay to normal
  in-flow content so opening Account cannot cover the standalone Logout action
- preserved the closed-state hiding from Stage 8.53

Stage 8.54 did not change booking creation, slot generation, booking status
transitions, staff invite/linking data, role/RLS rules, billing writes,
notification generation or database schema.

Remaining QA note:

- retest the open state of customer, business and staff mobile Account menus on
  the deployed site.
