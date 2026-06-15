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
