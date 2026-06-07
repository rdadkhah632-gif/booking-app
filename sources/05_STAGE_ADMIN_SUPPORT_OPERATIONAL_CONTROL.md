# Stage 5 - Admin, Support and Operational Control

Status: active.

Batch 1 status: implemented; production build passed.

Batch 2 status: implemented; production build passed.

Stage 1, Stage 2 and Stage 3 are complete and protected.

Stage 4 billing foundation is complete with tracked operational follow-ups.

## Purpose

Stage 5 gives Mirëbook operators enough visibility to launch, support users and
spot operational problems without changing the product's protected booking,
identity or billing foundations.

This stage is about:

- knowing which businesses and users exist
- seeing whether a business is published and booking-ready
- seeing support demand and following a support conversation
- seeing authoritative billing state and payment-attention cases
- finding the correct owner, staff link or booking context before replying
- keeping operator actions deliberate and limited

It is not a broad internal CRM, analytics system or unrestricted database
editor.

## Protected Foundations

Stage 5 must not change:

- account identity, auth/session or route-default logic
- customer, business, staff and admin capability separation
- staff invites, linking or owner-as-staff behavior
- booking creation, slot generation or availability calculations
- booking statuses or booking action behavior
- Explore readiness and listing rules
- Stripe Checkout, webhook verification or webhook event mapping
- customer appointment payment behavior
- billing-based access, booking or listing enforcement

Billing remains informational for product access. There are no hard billing
lockouts.

## Current Route Map

### Admin routes

| Route | Current purpose | Current protection |
| --- | --- | --- |
| `/admin` | Operator overview, readiness queue, billing summary and launch links | Requires a session and `profiles.is_admin`; non-admins receive an admin-only state |
| `/admin/businesses` | Business lookup, owner context, readiness and selected operational settings | Requires a session and `profiles.is_admin` |
| `/admin/users` | User lookup, role/business/staff/booking context and existing guarded advanced access controls | Requires a session and `profiles.is_admin` |
| `/admin/notifications` | Targeted operator notices and recent notification visibility | Requires a session and `profiles.is_admin` |
| `/admin/support` | Support inbox, replies, priority and resolution workflow | Requires a session and `profiles.is_admin`; non-admins redirect to `/account` |

The admin navigation is selected by the existing capability-aware `AuthNav`.
This stage does not add a second admin identity or change route selection.

### Support routes

| Route | Current purpose | Current protection |
| --- | --- | --- |
| `/support` | Public support hub; signed-in admins see an operator-oriented entry view | Public route with an optional admin profile check |
| `/support/customer` | Customer support request form | Requires a signed-in user and stores the ticket against that user |
| `/support/business` | Business support request form with business context | Requires a signed-in business owner context |
| `/support/staff` | Staff support request form with linked-business context | Requires a signed-in staff context |
| `/support/messages` | Signed-in user's support conversation list | Requires a session and filters by `user_id` |
| `/support/messages/[id]` | Signed-in user's ticket thread and replies | Requires a session and filters the ticket by both `id` and `user_id` |

### Relevant business and billing routes

| Route | Operational relevance |
| --- | --- |
| `/dashboard/businesses` | Owner-facing business setup and readiness |
| `/dashboard/billing` | Owner-facing plan, billing status, trial and Stripe test-mode state |
| `/api/stripe/create-checkout-session` | Creates the business subscription Checkout Session |
| `/api/stripe/webhook` | Verifies Stripe signatures and synchronizes `business_billing` |

## Current Data Ownership

### Business readiness

The operator views derive display-only readiness from:

- business name, category and location
- active services
- active staff
- staff-to-service assignments
- publishing state
- pending booking count

These checks are operational guidance only. Stage 5 does not change the
customer-facing Explore eligibility rules.

### Billing

`business_billing` is the authoritative billing source for:

- `billing_status`
- plan name
- agreed monthly price in minor currency units
- currency
- trial dates
- founding-business and second-month-free flags
- current subscription period end

Supported Mirëbook billing statuses are:

- `not_configured`
- `free_trial`
- `founding_free`
- `active`
- `manual_comped`
- `past_due`
- `cancelled`
- `paused`

Stripe webhooks and controlled manual operations own this row. The Stage 5
admin UI reads safe fields only and does not read internal billing notes or
Stripe identifiers.

Legacy subscription fields still exist on `businesses` and remain visible in
older admin user/notification code. Stage 5 Batch 2 stops using those fields for
the operator dashboard and business-manager billing summaries. Their later
removal requires a separate data migration and compatibility pass.

### Support

Support requests use:

- `support_messages` for ticket identity, account/business context, category,
  subject, priority and status
- `support_replies` for user and admin conversation replies
- `notifications` for admin ticket alerts and user reply/resolution alerts

Customer, business and staff forms notify current admin profiles after creating
a ticket. User conversation views are scoped to the signed-in user's ticket.
The operator inbox reads all tickets under admin access.

## Batch 1 - Source Audit

Implemented:

- recorded the current admin and support route maps
- recorded client-side admin protection and user ticket scoping
- recorded authoritative and legacy billing ownership
- documented the current support request and reply flow
- identified the first operational risks and safe next batches

## Batch 2 - Read-Only Operational Visibility

Implemented:

- operator dashboard business, publishing and booking-readiness totals
- open, waiting and total support-ticket visibility
- authoritative active/trial/payment-attention billing totals
- active monthly value from `business_billing.price_amount`
- a clear operational data-source note
- authoritative billing status on business list rows
- selected-business billing plan, price, trial end, period end and founding
  offer visibility
- removal of legacy subscription status, price, trial and pause controls from
  the business operator page

Existing publishing and booking-setting controls remain unchanged. This batch
does not add billing mutations or destructive operator actions.

## Current Gaps And Risks

- Admin route checks are performed in page code after the client session loads.
  Database RLS remains the final data boundary; a future server-side route
  guard could improve first-render behavior.
- Existing advanced role/admin controls on `/admin/users` are powerful. They
  use confirmation UI but should eventually move behind protected server-side
  actions with an audit trail.
- `/admin/notifications` can send broad notices. Delivery history exists, but
  there is no operator approval or immutable campaign audit log.
- Billing manual changes still require controlled Supabase/admin operations;
  Stage 5 does not add a browser-side billing editor.
- Legacy subscription columns remain in some admin user and notification
  queries and can disagree with `business_billing`.
- Support notifications are best-effort client writes after ticket creation.
  A future server-side support mutation would make ticket and notification
  creation atomic.
- Support lacks ownership/assignee, SLA, attachment, escalation and searchable
  full-history tooling.
- Admin operational counts load capped client-side record sets and are suitable
  for launch scale, not mature analytics.
- No billing lockout or automatic unpublishing is enabled. This is deliberate.

## Recommended Next Batches

### Batch 3 - Safe Support Operations

- improve admin support filters and user/business context links
- show unread/open/waiting queues clearly
- add operator ownership only if the support schema is deliberately extended
- preserve user-scoped conversation access
- avoid a full external inbox or email integration

### Batch 4 - Protected Admin Mutations

- move role/admin access changes behind server-side privileged routes
- add an operator action audit table before expanding controls
- add protected manual billing adjustments only after audit requirements are
  approved
- do not add business deletion, impersonation or blanket lockout controls

### Batch 5 - Legacy Billing Cleanup

- compare legacy `businesses` subscription fields with `business_billing`
- migrate any required historical values
- update remaining admin user and notification displays
- remove legacy writes only after live data is verified

### Batch 6 - Closure QA

- verify admin/non-admin route behavior
- verify customer, business and staff ticket creation and reply scoping
- verify authoritative billing totals and payment-attention states
- verify no private billing notes or Stripe secrets appear in client responses
- verify no booking, Explore, role or Stripe regression

## Out Of Scope

- hard billing lockouts
- customer appointment payments
- destructive business/user deletion
- admin impersonation
- full CRM or support inbox replacement
- email support integration
- file attachments
- advanced analytics or revenue accounting
- multi-admin approval workflows
- database schema changes in Batch 1 or Batch 2
- RLS, auth or capability changes

## Stage 5 Pass Standard

Stage 5 passes when:

- admin routes remain restricted to real admin accounts
- operators can locate businesses, users and support conversations
- business publishing and readiness are understandable without changing rules
- billing summaries use `business_billing`, not legacy subscription fields
- payment-attention states are visible without restricting product access
- customer, business and staff support requests reach the operator workflow
- users can read and reply only to their own support conversations
- operator actions that can change access or money are protected and auditable
  before they are expanded
- no private billing notes, Stripe secrets or service-role credentials reach
  the browser
- Stage 1 through Stage 4 behavior remains protected
