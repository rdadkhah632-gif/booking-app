# Stage 3 - Launch UI, Responsive Polish and Trust Pass

Status: active.

Stage 1 and Stage 2 are complete with accepted minor follow-ups.

## Goal

Make Mirëbook feel polished, trustworthy and usable on desktop and mobile without changing the protected account, booking or operational logic established in Stages 1 and 2.

## Protected Foundations

Do not regress:

- customer, staff, business and admin role separation
- staff-intent and invited staff linking
- owner-as-staff behavior
- account identity and language preference persistence
- route protection and staff availability saving
- request-mode and instant-confirmation booking
- pending, confirmed, declined, cancelled and completed booking statuses
- duplicate submit/action prevention and stale-slot prevention
- accept, decline, cancel and complete actions
- business readiness and Explore listing rules
- notification and action-centre behavior

## Non-Goals

Do not add or redesign:

- Stripe, billing, subscriptions or payment checkout
- email or calendar sync
- advanced analytics
- database schema or RLS
- auth, session, role or capability logic
- staff invite/linking
- booking insert or slot generation logic
- the full visual theme or a full light mode

## Batches

1. Mobile responsive polish
2. Public and customer trust polish
3. Business workspace polish
4. Staff workspace polish
5. Translation, copy and empty-state sweep
6. Closure QA

## Batch 1 - Mobile Responsive Polish

Status: implementation complete, ready for manual authenticated QA.

Objective:

Fix core mobile usability issues without changing application logic.

Focus:

- public, authentication and customer pages
- public booking and booking confirmation
- business dashboard pages and navigation
- staff workspace pages and navigation
- horizontal overflow, cramped grids and overlapping controls
- form, slot, summary, action-button and dialog behavior on small screens

Rules:

- keep the current dark UI and component patterns
- prefer shared responsive styles over page-by-page redesign
- keep controls readable and touch-friendly
- preserve desktop behavior
- add EN and SQ translations together for any new visible text

Verification:

- run `npm run build`
- run `git diff --check`
- run Prettier on changed files when available
- complete manual mobile QA across the core public, customer, business and staff routes

Implemented:

- Added stable viewport width constraints to shared page containers.
- Made shared customer, account, business-notification and staff-notification action rows stack into full-width mobile controls.
- Fixed the business dashboard sidebar conflict so the workspace navigation becomes a contained, horizontally scrollable mobile bar.
- Kept business navigation links, personal staff links, settings, account and logout reachable without changing route logic.
- Tightened Explore card width constraints and mobile action stacking.
- Kept the public booking layout within the viewport and changed narrow-phone time slots to two stable columns.
- Added contained horizontal scrolling to the staff monthly calendar so seven days remain readable without creating page overflow.
- Tightened narrow-phone public navigation spacing so primary controls remain visible.

Automated verification:

- `npm run build` passed.
- `git diff --check` passed.
- No duplicate or new translation keys were required.
- Prettier is not installed in the local workspace.

Browser verification:

- 320px and 390px public home pages have no page-level horizontal overflow.
- Explore loads bookable business cards without page-level horizontal overflow.
- Public booking stacks to one column and the booking summary stays within the viewport.
- Public time-slot layout resolves to two equal columns on mobile.
- Login, registration, booking confirmation, My Bookings, notifications and account entry surfaces remain within the mobile viewport.
- Protected business and staff routes redirect cleanly to login in the unauthenticated browser session.

Manual authenticated QA remaining:

- Verify the business workspace navigation bar with a business owner account.
- Verify dashboard cards, forms and booking actions with real populated data.
- Verify staff calendar scrolling, availability forms and notifications with a linked staff account.
- Verify owner-as-staff navigation exposes both business and personal staff destinations.

## Known Follow-Ups

- Older mixed English and Albanian strings may remain outside the active Stage 3 surfaces.
- Staff workspace still uses its existing top-navigation structure.
- Stage 3 should improve that navigation responsively without changing role routing or rebuilding the navigation architecture.
