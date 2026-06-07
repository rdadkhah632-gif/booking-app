# Stage 5 - Admin, Support and Operational Control

Status: active.

Batch 1 status: implemented; production build passed.

Batch 2 status: implemented; production build passed.

Batch 3 status: implemented; production build passed.

Batch 4 status: implemented; production build passed.

Batch 5 status: implemented; production build passed.

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

## Batch 3 - Support Message Flow And Admin Inbox

Status: implemented; production build passed.

### Support Route Protection

The shared authenticated navigation now treats role-specific support routes as
explicit workspaces:

- `/support/customer` always renders the customer support navigation context
- `/support/business` renders business navigation only when the account owns a
  business; otherwise it remains in a safe customer context
- `/support/staff` renders staff navigation only when the account has staff
  access; otherwise it remains in a safe customer context
- `/admin/support` remains admin-only and redirects non-admin users to the
  public support hub

This resolves the QA follow-up where direct customer-support navigation could
briefly inherit an operator-style route presentation. It does not change the
underlying account capability model or default login routing.

Unauthenticated customer, business, staff and message routes continue to
redirect to login with the intended support route as `redirectTo`.

### Support Message Flow

Customer, business and staff support forms:

1. require an authenticated session
2. load the current profile and relevant business/staff context
3. show a clear translated error if that context cannot be loaded
4. validate subject and message fields
5. insert a real `support_messages` record with `user_id`, role context,
   optional `business_id`, category, subject, status and priority
6. show success only after the insert succeeds
7. notify admin profiles with a link to the exact ticket
8. link the requester to the saved conversation

No email, live-chat or fake-success behavior was added.

### Admin Support Inbox

`/admin/support` now:

- loads after the router is ready so exact-ticket links are reliable
- honors `/admin/support?ticketId=<id>` from support notifications
- separates open, in-progress/waiting and resolved queues
- keeps the selected ticket inside the active filter
- supports safe status changes to open, in progress, waiting for user and
  resolved
- uses the existing `in_review` stored value for the displayed In progress
  state, avoiding an unverified new database status
- shows requester name/email, account type, category, priority, status, reply
  state, created time and last-updated time
- resolves linked business names and links to the business operator view
- links to the requester account when `user_id` is available
- displays the original message and complete reply thread
- notifies the requester after an operator reply or resolution
- provides translated empty, loading, status and action states in EN and SQ

No delete, impersonation, access-lock or billing-control action was added.

### Message Visibility And Access

`/support/messages` remains scoped to:

```text
support_messages.user_id = current authenticated user
```

`/support/messages/[id]` first loads the ticket using both its ID and the
current user's ID. User replies also scope the ticket status update by both
ticket ID and current user ID.

Admins use `/admin/support`; the user conversation pages do not provide an
admin bypass that could expose another user's ticket.

The conversation list and detail page now display current In progress and
Waiting for user labels consistently, plus the last-updated time when
available.

### Batch 3 QA Checklist

- customer direct navigation to `/support/customer` shows customer support,
  never an Admin only state
- business owner can open `/support/business` with owned business context
- linked or staff-intent account can open `/support/staff`
- unauthenticated support form/message routes redirect to login safely
- non-admin navigation to `/admin/support` returns to `/support`
- customer, business and staff forms create real support records
- failed profile/context loads show a visible error and do not fake success
- successful form submission links to the created conversation
- admin notification opens the exact ticket in `/admin/support`
- open, in-progress/waiting and resolved filters show the correct tickets
- status, priority, reply and resolution updates remain functional
- admin inbox shows requester, role, business, timestamps and thread context
- user message list contains only the current user's records
- direct access to another user's ticket ID returns not found
- EN and SQ labels render without raw translation keys
- support pages remain contained on mobile
- booking, Explore, Stripe, billing access and role defaults remain unchanged

### Batch 3 Known Limitations

- `support_messages` and `support_replies` exist in the live application but
  their schema and RLS are not versioned in this repository.
- Ticket creation and admin notification creation are separate best-effort
  client operations rather than one atomic server transaction.
- Operator replies and status changes still use authenticated Supabase client
  writes protected by existing RLS.
- There is no operator assignment, SLA, attachment, email delivery, search or
  immutable support audit log.
- `updated_at` depends on the existing support table behavior; Batch 3 does not
  add a database trigger.

## Batch 4 - Manual Billing And Founding Controls

Status: implemented; production build passed.

### Protected Server Boundary

`/api/admin/business-billing` now owns private manual billing reads and writes.
The route:

- requires an authenticated bearer token
- verifies the user through Supabase Auth
- verifies `profiles.is_admin` using the server-only service-role client
- rejects non-admin requests before reading private billing data
- validates billing status, currency, price, dates, flags and change reason
- updates only the approved manual billing fields
- never accepts Stripe customer or subscription IDs from the browser
- never changes booking, publishing, readiness, role or access state

The endpoint can read private notes and provider IDs for the protected operator
view. Those fields remain absent from the owner-facing billing query.

### Admin Business Billing Control

The selected-business panel on `/admin/businesses` now provides:

- all supported Mirëbook billing statuses
- agreed monthly price and currency
- trial start and end dates
- founding-business status
- second-free-month eligibility
- private internal billing notes
- a required reason for each manual update
- read-only Stripe customer and subscription IDs
- read-only current subscription period end
- Stripe-managed versus manual/founding context
- explicit confirmation before paused or cancelled states
- success and failure feedback after each update

The panel explicitly states that billing remains informational. Manual statuses
do not block bookings, staff access, dashboard access or public listing.

Stripe webhook behavior was not changed. Existing webhook payloads update only
provider-owned status, customer/subscription identifiers and current period
end. They do not overwrite founding flags, agreed price, trial dates or private
notes.

### Billing Audit SQL

`sources/sql/05_business_billing_admin_audit.sql` adds an optional,
server-only durable audit table containing:

- business ID
- admin user ID
- action
- required reason
- previous billing state
- next billing state
- timestamp

Run this idempotent script manually in the Supabase SQL editor. The billing
update remains usable before the script is installed, but the operator receives
a clear warning that no durable audit row was stored. The server still records
a non-sensitive operational log entry.

No additional changes to the existing `business_billing` schema are required.

## Batch 5 - Operational Safety And Admin Closure Polish

Status: implemented; production build passed.

Confirmed:

- `/admin` and all current admin subroutes keep their existing session and
  `profiles.is_admin` checks
- non-admin users do not receive admin business, billing, support or
  notification datasets
- the private billing endpoint adds a second server-side admin boundary for
  money-related mutations
- `/support/customer`, `/support/business` and `/support/staff` retain their
  explicit role navigation contexts
- `/admin/support` remains the separate admin-only support inbox
- user support lists and threads remain scoped by the authenticated `user_id`
- admin support status, priority, reply and resolution behavior remains intact
- new billing controls stack responsively and provider identifiers wrap safely
  on narrow screens
- new operator billing copy is available in English and Albanian
- no destructive delete, impersonation, Stripe cancellation or access-lock
  control was added

### Stage 5 Top-Level QA Checklist

- sign in as a non-admin and verify `/admin`, `/admin/businesses`,
  `/admin/users`, `/admin/support` and `/admin/notifications` expose no admin
  data
- sign in as an admin and verify each admin route loads cleanly
- open a business and confirm authoritative billing data loads in the
  admin-only panel
- verify Stripe IDs and private notes appear only for the admin
- set founding-business, trial dates, agreed price and currency, then reload
  and confirm persistence
- change billing status through each safe launch state
- verify paused and cancelled require confirmation
- verify a missing change reason is rejected
- install the audit SQL and confirm an audit row records admin, reason,
  previous state, next state and timestamp
- complete a Stripe test webhook update and confirm manual founding, price and
  notes fields remain intact
- confirm billing changes do not affect Explore, booking, staff access or
  business dashboard access
- verify customer, business and staff support routes show the correct role
  navigation
- verify support users can read only their own conversations
- verify the admin support inbox can filter, reply, change status and resolve
  tickets
- verify EN and SQ controls render without raw keys
- verify `/admin/businesses` and `/admin/support` remain usable at approximately
  390px with no horizontal overflow
- rerun a booking smoke test and Stripe Checkout/webhook test before Stage 5
  closure

### Recommended Next Stage

After Stage 5 top-level QA, start a launch verification stage focused on:

- production environment and deployment checks
- authenticated role-by-role regression testing
- database/RLS and server-route security verification
- Stripe test-mode operational runbook
- observability, backup and incident-response basics
- final launch checklist and go/no-go evidence

## Current Gaps And Risks

- Admin route checks are performed in page code after the client session loads.
  Database RLS remains the final data boundary; a future server-side route
  guard could improve first-render behavior.
- Existing advanced role/admin controls on `/admin/users` are powerful. They
  use confirmation UI but should eventually move behind protected server-side
  actions with an audit trail.
- `/admin/notifications` can send broad notices. Delivery history exists, but
  there is no operator approval or immutable campaign audit log.
- Manual billing changes now use a protected server route, but the optional
  durable audit table must be installed manually in Supabase.
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

Implemented. See Batch 3 above.

### Batch 4 - Manual Billing And Founding Controls

Implemented. See Batch 4 above.

### Batch 5 - Protected Admin Mutations

- move remaining role/admin access changes behind server-side privileged routes
- require the billing audit SQL before production operator use
- add equivalent audit coverage before expanding other privileged controls
- do not add business deletion, impersonation or blanket lockout controls

### Batch 6 - Legacy Billing Cleanup

- compare legacy `businesses` subscription fields with `business_billing`
- migrate any required historical values
- update remaining admin user and notification displays
- remove legacy writes only after live data is verified

### Batch 7 - Closure QA

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
