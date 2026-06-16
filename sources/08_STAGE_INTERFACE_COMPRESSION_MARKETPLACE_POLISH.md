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
