# Stage 6 - Mirëbook / Mirëbook Business Platform Split And App-Ready Structure

Status: active.

Batch 1 status: route, navigation and product-boundary audit implemented.
Production build and static checks passed.

Batch 2 status: Mirëbook Business public homepage and domain-ready entry split
implemented. Production build and static checks passed.

Batch 3 status: domain-aware URL helpers and deployment preparation
implemented. Production build and static checks passed.

Batch 4 status: business-domain root behavior and cross-domain QA hardening
implemented. Production build, static checks and simulated hostname QA passed.

Batch 5 status: customer and business public content separation implemented.
Production build, static checks and responsive EN/SQ browser QA passed.

Stages 1 through 5 remain complete or closed with tracked follow-ups. The
earlier onboarding, email and launch-readiness work remains recorded in
`sources/06_STAGE_ONBOARDING_VERIFICATION_EMAIL_LAUNCH_READINESS.md`; this
document defines the new active platform-structure stage.

## Goal

Make Mirëbook feel like two connected products without splitting the codebase,
backend or identity system:

1. **Mirëbook** - the customer marketplace and appointment experience.
2. **Mirëbook Business** - the operational workspace for business owners and
   staff.

In Albanian, the business product label is **Mirëbook Biznes**.

This is a soft product split:

- one repository
- one Supabase backend
- one authentication system
- shared booking and business logic
- two clear route, layout and product experiences

## Why The Split Is Needed

Customers use Mirëbook occasionally to discover services, book appointments
and track outcomes. Business owners and staff use the operational product
repeatedly throughout the working day for schedules, availability, bookings,
services and customer actions.

A clear product boundary:

- reduces customer-facing operational language
- makes staff feel part of the business product
- gives owners and staff one coherent workspace
- prepares route and layout boundaries for future mobile apps
- avoids duplicating backend logic while each experience develops separately

## Product Sides

### Mirëbook

Audience:

- signed-out marketplace visitors
- customers discovering and booking services
- customers managing appointment requests and confirmed bookings

Core responsibilities:

- discovery and search
- public business profiles
- service, staff and time selection
- request or instant booking
- booking confirmation
- customer bookings and notifications
- customer account and support

Product label:

- English: `Mirëbook`
- Albanian: `Mirëbook`

### Mirëbook Business

Audience:

- business owners
- managers where later supported
- invited and linked staff
- owners who also perform bookable work

Core responsibilities:

- business setup and public profile management
- services and staff
- business and staff availability
- booking approval and operational actions
- business and staff schedules
- notifications and support
- business subscription billing

Product label:

- English: `Mirëbook Business`
- Albanian: `Mirëbook Biznes`

Staff is a capability and workspace inside Mirëbook Business, not a third
customer-style product.

## Current Route Audit

### Customer routes

| Route | Current purpose | Future customer-app mapping |
| --- | --- | --- |
| `/` | Public entry and marketplace search | Customer app discover/home |
| `/explore` | Marketplace results | Discover/search |
| `/explore/[businessId]` | Public business profile and booking | Business detail and booking |
| `/book/[businessId]` | Direct booking entry | Booking deep link |
| `/booking-confirmation` | Booking result | Booking result |
| `/my-bookings` | Customer requests, upcoming bookings and history | Bookings |
| `/notifications` | Customer booking and support updates | Customer inbox |
| `/account` | Shared account settings and workspace entry points | Customer account when opened from Mirëbook |
| `/support/customer` | Customer support | Customer support |

These routes already use the public/customer navigation rather than the
business dashboard shell.

### Business-owner routes

| Route | Current purpose | Future business-app mapping |
| --- | --- | --- |
| `/dashboard` | Business overview | Business home |
| `/dashboard/bookings` | Booking manager | Bookings |
| `/dashboard/services` | Service management | Services |
| `/dashboard/staff` | Staff, invites and assignments | Team |
| `/dashboard/availability` | Business-wide hours | Business availability |
| `/dashboard/settings` | Booking and regional settings | Business settings |
| `/dashboard/businesses` | Setup hub and public profile | Business profile/setup |
| `/dashboard/notifications` | Owner action centre | Business inbox |
| `/dashboard/billing` | Subscription state | Billing |
| `/dashboard/analytics` | Operational summaries | Insights |
| `/support/business` | Business support | Business support |

These routes already share `DashboardLayout` and remain the owner side of
Mirëbook Business.

### Staff routes

| Route | Current purpose | Future business-app mapping |
| --- | --- | --- |
| `/staff` | Personal schedule and assigned work | My work |
| `/staff/calendar` | Calendar view | Calendar |
| `/staff/availability` | Personal working hours | My availability |
| `/staff/notifications` | Staff updates | Staff inbox |
| `/staff/invite` | Invite acceptance and linking | Invite deep link |
| `/support/staff` | Staff support | Staff support |

Authenticated staff routes now share the dashboard-style shell. Owners who are
also linked staff retain the full business navigation and see their personal
routes under `My work`. Staff-only users receive the same visual product shell
with only staff-appropriate destinations.

## Target Route Groups

The current URLs remain stable during this stage.

Logical route groups:

```text
Mirëbook
  /
  /explore
  /explore/[businessId]
  /book/[businessId]
  /booking-confirmation
  /my-bookings
  /notifications
  /support/customer

Mirëbook Business
  /dashboard/*
  /staff/*
  /support/business
  /support/staff

Shared identity and utility
  /login
  /register
  /account
  /privacy
  /terms
  /support

Operator
  /admin/*
```

A future `/business` entry route, subdomain or deployment may be considered,
but Batch 1 does not create one.

## Staff And Business Relationship

- Staff belongs to Mirëbook Business.
- Staff-only users must not see billing, business setup, service management,
  staff management or admin controls.
- Owners who are also staff should remain in the business shell while opening
  personal schedule, availability and notification pages.
- Staff linking and permissions remain controlled by the existing capability
  model and database policies.
- Route presentation must not become a substitute for authorization.

## Owner-As-Staff Principle

Many small-business owners also deliver the service customers book. The product
should eventually make owner bookability the normal, low-friction setup while
allowing an owner to opt out.

Current decision:

- preserve the existing explicit owner-as-staff setup
- do not create or activate a staff row automatically in this batch
- do not change database schema, readiness rules or booking assignment
- record automatic/default owner bookability as a later product and data-model
  decision

## Future Mobile Direction

The first likely mobile priority is **Mirëbook Business** because owners and
staff repeatedly use schedules, bookings, notifications and availability
during the working day.

Suggested future mapping:

```text
Mirëbook customer app
  Discover
  Business profile
  Book
  My bookings
  Notifications
  Account

Mirëbook Business app
  Business home
  Bookings
  Calendar / My work
  Services
  Team
  Availability
  Notifications
  Business settings
  Account
```

Shared domain logic, Supabase access rules and server APIs should be extracted
or reused deliberately when native clients are introduced. No mobile or native
code is added in this stage.

## Protected Foundations

Do not regress:

- account identity, language persistence and route protection
- customer, business, staff and admin capability separation
- staff invites, linking and owner-as-staff behavior
- request and instant-confirmation booking
- booking statuses and operational actions
- slot generation, stale-slot protection and availability saving
- business readiness and Explore listing rules
- Stripe billing and webhook synchronization
- admin and support controls
- notification and email behavior

## Out Of Scope

- separate repositories or Supabase projects
- separate authentication systems
- native or mobile application code
- route moves or breaking URL changes
- separate customer and business deployments
- database or RLS changes
- automatic owner-as-staff creation
- booking, billing, admin, support, invite or email logic changes
- broad visual redesign

## Batch 1 Audit Findings

- Customer marketplace and booking pages already use the public/customer
  navigation.
- Business owner pages already share `DashboardLayout`.
- Authenticated staff pages now reuse the same dashboard-style shell.
- Owner-as-staff personal routes are already grouped as `My work`.
- Staff-only navigation already excludes owner-only setup and billing pages.
- `AuthNav` still described customer, business and staff mainly as role badges
  rather than two product experiences.
- The shared dashboard logo still displayed plain `Mirëbook`, leaving the
  operational product boundary visually understated.
- `/account`, `/login` and `/register` remain intentionally shared identity
  surfaces and should explain or route to the appropriate product rather than
  being duplicated.
- Admin remains a separate operator surface, not part of either consumer
  product brand.

## Batch 1 Safe Implementation

- label the owner/staff dashboard shell as `Mirëbook Business` or
  `Mirëbook Biznes`
- use the same business-product suffix for business and staff contexts in
  shared authenticated navigation
- leave customer and signed-out navigation branded simply `Mirëbook`
- preserve the Operator badge for admin routes
- keep all current URLs, route guards and capability checks unchanged

## Recommended Batches

### Batch 2 - Shared Entry And Account Clarity

Implemented:

- added `/business` as the public Mirëbook Business sales and entry homepage
- kept `/` focused on customer discovery and booking
- linked public navigation and customer-home business prompts to `/business`
- added business-selected registration through
  `/register?accountType=business`
- added a business-aware presentation at `/login?product=business` without
  changing authentication or capability routing
- kept one auth flow and avoided duplicated account settings

The `/business` page presents only current or deliberately qualified product
capabilities:

- booking and calendar management
- staff, service assignments and availability
- request or instant-confirmation booking modes
- customer-facing public profiles
- role-appropriate notifications and workspaces
- the existing one-membership and founding-offer direction

It does not claim customer checkout, deposits, calendar sync, multi-location
switching or unimplemented analytics.

### Batch 3 - Domain-Aware Routing And Vercel Split Preparation

Implemented:

- added `src/lib/appUrls.ts` with safe customer and business app URL helpers
- documented optional `NEXT_PUBLIC_CUSTOMER_APP_URL` and
  `NEXT_PUBLIC_BUSINESS_APP_URL` values in `.env.example`
- kept relative same-origin fallbacks when the optional values are absent
- updated only cross-product homepage, login and registration links
- added an unused `isBusinessAppHostname` detector for a future routing batch
- did not enable hostname redirects, rewrites or middleware
- kept `/business` directly accessible on local and existing deployments

Configured public origins are accepted only when they are valid HTTP or HTTPS
URLs without embedded credentials. Invalid values fall back to the current
same-origin route behavior.

### Batch 4 - Business Domain Root Behavior

Implemented:

- added a narrow root-only Next.js middleware rewrite
- `business.mirebook.com/` internally renders the existing `/business` page
- `mirebook.com/` continues to render the customer homepage
- `/business` remains directly accessible on every connected hostname
- localhost and ordinary Vercel preview roots remain unchanged
- cross-product links continue to use the optional configured app origins
- no visible redirect, route move or second deployment was introduced

The middleware checks only `/` and uses
`NEXT_PUBLIC_BUSINESS_APP_URL` as the authoritative hostname when configured.
If that variable is absent, a guarded `business.*` hostname fallback is
available, excluding `business.localhost`.

### Batch 5 - Customer Product Boundary

Implemented:

- removed the large business operations card from the customer homepage hero
- removed business setup, team administration and SaaS growth sections from
  the customer homepage
- centered `/` on local-service discovery, real availability, booking mode,
  appointment status and My bookings
- retained one compact `For businesses` entry to Mirëbook Business
- made signed-out navigation business-aware without changing auth resolution
- added a clear owner, staff and owner-as-staff audience section to the
  Mirëbook Business homepage
- preserved shared login, registration and account infrastructure

### Batch 6 - Business Information Architecture

- review dashboard navigation grouping for daily work versus setup
- align owner and staff terminology around Home, Bookings, Calendar, Team and
  Settings
- keep permissions and URLs unchanged

### Batch 7 - Shared Domain And API Audit

- identify UI-coupled data access that future mobile clients cannot reuse
- document candidate server endpoints and shared types
- do not create a second backend or duplicate booking logic

### Batch 8 - App-Readiness QA

- verify customer, owner, owner-as-staff and staff-only journeys
- verify product labels in EN and SQ
- verify deep links and existing URLs
- verify mobile navigation and responsive layouts
- record remaining prerequisites before native-app work

## Pass Standard

Stage 6 passes when:

- customers consistently experience the product as Mirëbook
- owners and staff consistently experience operations as Mirëbook Business
- staff feels like part of the business product
- owner-as-staff can move between management and personal work without changing
  product shells
- staff-only users never receive owner-only controls
- current URLs and protected application behavior remain stable
- route groups map clearly to future customer and business mobile apps
- shared auth, backend and booking logic remain shared
- EN and SQ product labels are aligned
- production build and closure QA pass

## Batch 1 Verification

- `npm run build`: passed
- `git diff --check`: passed
- EN and SQ translation dictionaries contain no duplicate keys
- Prettier is unavailable in the local workspace

Manual QA remaining:

- verify `Mirëbook Business` and `Mirëbook Biznes` fit the desktop and mobile
  dashboard logo
- verify customer navigation shows plain `Mirëbook` without a Customer badge
- verify business and staff support routes use the business-product label
- verify Operator navigation retains its separate Operator badge

## Batch 2 Domain-Ready Plan

Current route behavior:

```text
mirebook.com
  / -> Mirëbook customer homepage
  /explore -> customer marketplace
  /business -> Mirëbook Business public homepage
  /dashboard/* -> authenticated owner workspace
  /staff/* -> authenticated staff workspace
```

Target future domain behavior:

```text
mirebook.com -> customer homepage and booking routes
business.mirebook.com -> Mirëbook Business homepage and owner/staff entry
```

The future business domain can initially map its root request to the existing
`/business` page while authenticated owner and staff routes remain unchanged.
A later domain-routing batch may make `/business` render as the subdomain root
without moving page modules or duplicating application logic.

Future Vercel work:

- add `business.mirebook.com` to the same Vercel project
- configure DNS for the business subdomain
- add both customer and business origins to Supabase allowed redirect URLs
- decide whether middleware or platform routing maps the business-domain root
  to `/business`
- verify auth email redirects return to an allowed shared origin

No Vercel configuration was changed in Batch 2.

No new environment variables were added. Future optional public URL variables
may be documented as:

- `NEXT_PUBLIC_CUSTOMER_APP_URL`
- `NEXT_PUBLIC_BUSINESS_APP_URL`

They are not required while both product entries use same-origin routes.

No Supabase schema, RLS, project or authentication change is required for the
soft domain split. Supabase dashboard URL allowlists will need both origins
before the business subdomain becomes active.

## Batch 3 Deployment Preparation

Optional public environment variables:

```text
NEXT_PUBLIC_CUSTOMER_APP_URL=https://mirebook.com
NEXT_PUBLIC_BUSINESS_APP_URL=https://business.mirebook.com
```

These variables are not required for local development or the current Vercel
URL. When they are absent:

- customer links remain relative to `/`
- the business homepage remains `/business`
- business login and registration remain the existing shared `/login` and
  `/register` routes with their product query parameters

The URL helper also exposes hostname detection for future use. Batch 3 does
not call it and does not redirect requests based on hostname.

Future Vercel setup:

1. Add `mirebook.com` to the current Vercel project.
2. Add `business.mirebook.com` to the same project.
3. Configure the required DNS records for both domains.
4. Set `NEXT_PUBLIC_CUSTOMER_APP_URL` to `https://mirebook.com`.
5. Set `NEXT_PUBLIC_BUSINESS_APP_URL` to
   `https://business.mirebook.com`.
6. Redeploy after the environment variables are saved.
7. In a later routing batch, decide whether the business hostname root should
   rewrite to `/business` or render the same page through middleware.

Both domains should initially point to the same Vercel project, repository and
Supabase backend. Separate deployments and separate codebases are not needed.

Future Supabase Auth setup:

- keep the existing Supabase project and schema
- add both real origins to the allowed redirect URL configuration
- review the primary Site URL when the production customer domain is active
- allow login, registration verification and password reset callback URLs for
  both customer and business domains
- test login, registration, verification and reset flows from both domains
  before enabling hostname-aware routing

No Supabase schema, migration, RLS or authentication-resolution code change is
required for this domain split.

## Batch 4 Live Domain Setup And QA

The production domains have been prepared manually:

- `mirebook.com` was purchased
- Fasthosts is used for DNS and hostname configuration
- `mirebook.com` and `business.mirebook.com` are connected to the same Vercel
  project

Expected root behavior:

```text
https://mirebook.com/ -> customer Mirëbook homepage
https://business.mirebook.com/ -> Mirëbook Business homepage
https://business.mirebook.com/business -> direct business homepage route
```

The business root uses an internal middleware rewrite to `/business`. The
browser remains on `https://business.mirebook.com/`; there is no redirect
chain. All other paths continue through the existing Pages Router unchanged.

Required Vercel public environment variables:

```text
NEXT_PUBLIC_CUSTOMER_APP_URL=https://mirebook.com
NEXT_PUBLIC_BUSINESS_APP_URL=https://business.mirebook.com
```

Both values must be available to the production deployment, followed by a
redeploy. No secret values are introduced by these variables.

Supabase Auth URL configuration to verify:

```text
https://mirebook.com/**
https://www.mirebook.com/**
https://business.mirebook.com/**
https://booking-app-blush-nu.vercel.app/**
http://localhost:3000/**
http://localhost:3001/**
```

The production customer origin should also be reviewed as the Supabase Site
URL. Login, registration, email verification and password reset should be
tested from both production domains. No Supabase schema, migration, RLS or
authentication-resolution code change is needed.

Manual QA:

1. Visit `https://mirebook.com/` and confirm the customer homepage.
2. Visit `https://business.mirebook.com/` and confirm the business homepage.
3. Visit `https://business.mirebook.com/business` directly.
4. Visit `https://mirebook.com/explore`.
5. Test login from both domains.
6. Test registration from both domains.
7. Open `/dashboard` from the business domain with an owner account.
8. Open `/staff` from the business domain with a linked staff account.
9. Complete a customer booking smoke test.
10. Confirm admin, support and billing routes retain their current behavior.

Customer homepage content is intentionally not broadly cleaned up in Batch 4.
A later customer product-boundary batch should reduce remaining business SaaS
messaging on customer-owned pages.

Recommended Batch 5:

- audit customer navigation, account and support entry points
- reduce business-operational content on the customer homepage
- preserve the shared identity and capability model

## Batch 5 Public Content Separation

Customer homepage:

- leads with local-service search and Explore
- explains service, staff and time selection
- explains request versus instant-confirmation outcomes
- points customers to My bookings, customer support and account creation
- contains only one compact entry to Mirëbook Business
- no longer presents business billing, staff administration, publishing or
  operational dashboard features as primary customer-home content

Mirëbook Business homepage:

- remains the main public sales and product explanation surface for owners
- covers booking management, calendar, services, staff, availability, booking
  modes, public profiles, notifications and launch membership
- now names owners, staff and owner-as-staff businesses explicitly
- links to business registration, business login and the existing dashboard
- avoids claims about deposits, customer checkout, calendar sync or other
  unimplemented features

Public navigation:

- customer pages retain Mirëbook, Explore and a small `For businesses` link
- the business homepage shows a link back to customer Mirëbook, business
  support, business login and business setup
- language selection remains available on both product entries
- authenticated role and capability routing remains unchanged

Remaining follow-ups:

- audit shared `/account` wording and workspace entry hierarchy
- complete live-domain login, registration and email callback QA
- review support landing-page ownership across customer and business domains

Recommended Batch 6:

- review business information architecture for daily work versus setup
- align owner and staff terminology around Home, Bookings, Calendar, Team and
  Settings
- keep permissions, routes and operational logic unchanged
