# Stage 4 - Billing, Pricing and Subscription Foundation

Status: active.

Batch 1 status: audit and source planning complete after build verification.

Batch 2 status: implementation complete; build passed. Manual Supabase
deployment and live RLS QA remain.

Stripe test Checkout and webhook synchronization status: implemented; live
deployment configuration and event QA remain.

Stage 1 and Stage 2 are complete and protected.

Stage 3 is complete with tracked minor follow-ups.

## Purpose

Stage 4 establishes a safe commercial foundation for Mirëbook business subscriptions.

This stage is about how businesses pay Mirëbook to use the platform. It is not customer appointment checkout, deposits or payment collection.

The immediate goal is to define one launch offer, establish trustworthy billing ownership and prepare the application for a future Stripe integration without enabling payment processing prematurely.

## Core Commercial Rule

Customers do not pay Mirëbook to submit or manage an appointment booking.

Business subscription billing must remain separate from:

- public booking creation
- booking request or instant-confirmation behavior
- service prices
- appointment deposits or checkout
- booking status transitions
- business readiness and Explore listing eligibility

Subscription state must not change booking, role, auth, staff linking, publishing, readiness, listing or notification behavior during the foundation batches.

## One-Plan Launch Strategy

Launch with one paid product:

**Mirëbook Business**

The launch plan should include the current business workspace:

- public business profile
- services and staff management
- business and staff availability
- customer booking requests and instant confirmation
- booking manager and status actions
- customer, business and staff notifications
- business and staff workspaces
- English and Albanian support
- standard support

Do not create feature gates for Starter, Growth, Pro or Custom during the one-plan launch.

The existing plan labels may remain as historical UI groundwork until a controlled cleanup batch, but they must not become real entitlements without a separate product decision.

Benefits of one launch plan:

- simpler sales and onboarding
- fewer entitlement and role regressions
- easier Stripe product and price mapping
- clearer business-owner billing UI
- easier support and refund handling
- pricing can be learned before tiering features

## Founding Business Offer

Recommended working offer for validation:

- first 25 approved businesses
- no setup fee
- 60-day free trial
- founding price protected for 12 months after the trial
- cancel before renewal without a long-term contract
- all Mirëbook Business launch features included

Recommended founding price candidates:

- UK: GBP 19 per month
- Albania: EUR 12 per month

These are internal working assumptions, not public commitments. Confirm tax treatment, invoice currency and market positioning before publishing them.

Founding status should be commercial metadata, not a separate permission role or capability.

## Internal Pricing Bands

Use these only for planning and customer discovery until pricing is approved:

| Band | UK monthly range | Albania monthly range | Intended use |
| --- | ---: | ---: | --- |
| Founding | GBP 15-19 | EUR 9-12 | First validated businesses |
| Launch | GBP 25-29 | EUR 15-19 | Standard one-plan launch |
| Mature | GBP 39-49 | EUR 25-35 | Later, after measurable product value |
| Custom | Manual quote | Manual quote | Future multi-location or special contracts |

Pricing principles:

- store currency explicitly
- store amounts in minor units, not floating-point display values
- do not infer currency from browser locale
- do not trust prices submitted by the client
- do not expose internal bands as selectable public plans
- do not add multiple paid tiers until usage and support data justify them

## Billing Statuses

The current repository uses:

- `trial`
- `active`
- `past_due`
- `paused`
- `cancelled`

For the foundation, retain these meanings:

### `trial`

The business is in a manually or provider-managed trial period.

### `active`

The business subscription is commercially active.

### `past_due`

A payment requires attention. During early Stage 4 this is informational only and must not create a hard product lockout.

### `paused`

An operator has paused the commercial account. This remains informational until an explicit enforcement policy is approved.

### `cancelled`

The subscription has ended or is scheduled not to renew. Cancellation timing and retained access must be defined before enforcement.

### Not configured

A null or missing status means billing has not been configured. Do not silently treat this as a real paid trial after Stripe becomes authoritative.

Future Stripe event mapping may also need to understand provider states such as `incomplete`, `incomplete_expired`, `unpaid` and `trialing`, but the application should map them into a deliberately defined Mirëbook domain status rather than spreading raw provider strings through the UI.

## Billing Architecture

### Ownership

Billing state must be server-controlled once real payments are introduced.

Business owners may manage:

- billing contact email
- future checkout initiation
- future billing portal access

Business owners must not directly set:

- subscription status
- charged price
- trial end date
- Stripe customer ID
- Stripe subscription ID
- founding offer eligibility
- cancellation or payment state

Admin operators may manage approved manual overrides through protected server-side actions.

### Recommended Data Model

Before implementation, verify the live database and RLS.

Recommended eventual separation:

`business_subscriptions`

- `id`
- `business_id`
- `provider`
- `provider_customer_id`
- `provider_subscription_id`
- `plan_code`
- `status`
- `currency`
- `unit_amount_minor`
- `trial_ends_at`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `cancelled_at`
- `founding_offer`
- `founding_price_ends_at`
- `created_at`
- `updated_at`

`billing_events`

- provider event ID
- event type
- business/subscription reference
- processing status
- received and processed timestamps
- non-sensitive diagnostic payload or provider reference

The `businesses` table may retain a read-optimized billing summary during migration, but provider IDs and authoritative payment status should have one defined owner.

### Server Boundary

Future Stripe work must use server-only code for:

- Stripe secret key access
- customer and subscription creation
- checkout session creation
- billing portal session creation
- webhook signature verification
- price lookup
- status synchronization
- administrative overrides

No secret Stripe key may use a `NEXT_PUBLIC_` environment variable.

### Provider Synchronization

Stripe webhooks should become the source of truth for provider-managed state.

Webhook processing must be:

- signature verified
- idempotent
- safe to retry
- logged without exposing sensitive data
- mapped to a known business subscription
- unable to modify booking or role state

### Access Enforcement

Do not implement hard billing lockouts in the foundation batches.

Start with:

- informational billing status
- trial and payment-attention banners
- operator review queues
- support links

Any later enforcement must define grace periods, owner access, data export, existing booking handling and recovery after payment.

## Staged Implementation Batches

### Batch 1 - Audit and Source Plan

- inspect existing billing, admin and database-facing code
- document the commercial model and architecture
- identify current risks and gaps
- make no application behavior changes

### Batch 2 - Manual Billing State Foundation

- add a repository-owned manual Supabase SQL foundation
- create one billing record per business with explicit status and currency
- store agreed pricing in minor currency units
- define owner-read and admin-manage RLS groundwork
- replace owner-editable billing state with a read-only launch-plan summary
- add no Stripe SDK, API route, environment variable or payment processing

### Batch 3 - Protected Admin Subscription Operations

- move manual status, trial and price changes behind protected server-side operations
- add founding-offer metadata and expiry
- separate booking readiness from billing attention in admin summaries
- preserve current publishing and listing behavior

### Batch 4 - Stripe Test-Mode Integration

Status: Checkout and webhook synchronization implemented; deployment QA
pending.

Implemented:

- installed the official Stripe server SDK
- reads Stripe keys, launch price and application URL from environment
  variables only
- added an authenticated subscription-mode Checkout Session API route
- verifies the current Supabase user owns the selected business before
  creating a session
- uses the configured recurring `STRIPE_PRICE_ID_LAUNCH`
- attaches business and owner references to Checkout and subscription metadata
- returns successful and cancelled test Checkout sessions to the business
  billing page
- enforces an `sk_test_` server key during this stage
- keeps booking, listing, dashboard and staff access unchanged
- added `POST /api/stripe/webhook` with raw request body handling
- verifies every webhook using `STRIPE_WEBHOOK_SECRET`
- uses a server-only Supabase service-role client for billing-state writes
- acknowledges valid ignored events without exposing event payloads
- logs missing billing matches using only safe event/provider identifiers
- returns a retryable server error when a real Supabase synchronization write
  fails

Webhook events handled:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Stripe status mapping:

- `active` -> `active`
- `trialing` -> `free_trial`
- `past_due` -> `past_due`
- `unpaid` -> `past_due`
- `canceled` -> `cancelled`
- `paused` -> `paused`

The webhook updates Stripe customer/subscription references and the latest
subscription-item period end where available. Repeated delivery is safe
because events converge the same billing row to the same state.

Server environment variables required:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_LAUNCH`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` and Stripe secrets must remain server-only and
must never use a `NEXT_PUBLIC_` prefix.

Still pending:

- persistent billing-event receipt/audit table
- Customer Portal access
- production/live-mode enablement

### Batch 5 - Business Checkout and Portal

- add business-owner subscription checkout
- add Stripe Customer Portal access
- show invoices, renewal and cancellation state
- keep customer appointment booking payment-free

### Batch 6 - Soft Billing Guidance

- add trial-ending and payment-attention messaging
- add grace-period support guidance
- notify business owners and operators
- do not hard lock business operations without a separate approval

### Batch 7 - Stage 4 QA and Controlled Rollout

- test trial, active, past-due, cancellation and recovery flows
- verify webhook idempotency
- verify regional currency and approved price mapping
- verify no customer checkout was introduced
- verify booking, role, readiness, listing and notifications did not regress
- roll out to selected founding businesses before general availability

## Protected Foundations

Stage 4 must not change:

- customer, business, staff and admin role separation
- auth or session behavior
- staff invitations or staff-business linking
- owner-as-staff behavior
- account or language persistence
- booking insert and slot generation
- request versus instant-confirmation behavior
- booking status actions
- stale-slot or duplicate-action prevention
- staff or business availability saving
- business readiness calculations
- Explore listing rules
- notification categories or action-center behavior

## Out of Scope

Until explicitly approved, do not add:

- live-mode Stripe checkout
- real payment processing outside Stripe test mode
- customer appointment payments or deposits
- saved customer cards
- refunds
- tax calculation or VAT automation
- invoice generation outside the provider
- coupons or promotion-code engines
- usage-based billing
- per-staff billing
- multi-location billing
- multiple live plan entitlements
- hard billing lockouts
- automatic unpublishing for payment state

## Current Repository Audit

Audit date: June 6, 2026.

### Existing Billing Page

`src/pages/dashboard/billing.tsx`

Current behavior:

- loads billing fields directly from the owned `businesses` rows through the browser Supabase client
- displays trial, status, plan, monthly price, billing email and stored Stripe references
- allows the business owner to save status, plan, monthly price, billing email and trial end date directly to `businesses`
- presents Starter, Growth, Pro and Custom as selectable groundwork labels
- clearly states Stripe charging is not connected
- contains no checkout, portal or payment action

Risk:

Once billing becomes real, owners must not be able to self-assign active status, price, plan or trial dates. RLS may currently limit row ownership, but row ownership alone does not make those fields safe for owner writes.

### Business Workspace References

- `src/components/DashboardLayout.tsx` links to Billing.
- `src/components/dashboard-home/DashboardShortcuts.tsx` links to billing groundwork.
- `src/pages/dashboard/settings.tsx` links to plan, trial and payment settings.
- business setup/profile components link to the selected business billing page.
- no inspected dashboard reference currently enforces subscription access.

### Admin Controls

`src/pages/admin/businesses.tsx`

- loads the same billing fields directly from `businesses`
- lets an admin set trial, active, past-due, paused or cancelled
- lets an admin choose Starter, Growth, Pro or Custom
- lets an admin set monthly price, billing email and trial end
- provides 30-day and 60-day trial shortcuts
- combines billing edits with publishing and booking-setting edits in one direct client-side update

`src/pages/admin/index.tsx`

- summarizes trial, active, paused/past-due and monthly value
- flags trials ending within seven days

`src/pages/admin/users.tsx`

- displays each owned business plan, subscription state and trial end

`src/pages/admin/notifications.tsx`

- supports manual trial-reminder and billing-notice notification types
- does not send payment-provider events

### Stripe Status

The repository now has a Stripe test Checkout foundation.

Implemented:

- official `stripe` server package
- authenticated `POST /api/stripe/create-checkout-session`
- business-owner verification before Checkout Session creation
- subscription mode using the environment-provided launch price
- success and cancellation return states on `/dashboard/billing`
- test-key guard preventing live secret keys during this stage

Still absent:

- no billing-portal route
- no persistent webhook event-history table
- no production/live-mode payment processing

Checkout metadata includes the business and owner identifiers, but the
application does not trust the browser success redirect to activate a local
subscription. Verified Stripe webhook events update the matching
`business_billing` row.

### Supabase and Schema Status

- the repository has one browser Supabase client in `src/lib/supabaseClient.ts`
- there are no generated Supabase database types
- there is no repository `supabase/` directory
- there are no SQL schema or migration files
- there are no billing-specific data helpers or server APIs

The application expects these fields on `businesses`:

- `billing_email`
- `subscription_status`
- `subscription_plan`
- `subscription_price_monthly`
- `stripe_customer_id`
- `stripe_subscription_id`
- `trial_ends_at`

Their live definitions, defaults, constraints and RLS policies cannot be verified from this repository because the database schema is not versioned here.

### Current Billing Gaps

- no approved single launch price or currency model
- no explicit currency field
- monthly price appears to use a floating-point major-unit value
- no authoritative subscription table
- no versioned schema or migration history
- no generated database types
- billing constants are duplicated across owner and admin pages
- owner UI can attempt to write provider-controlled billing state
- admin billing writes run directly from the browser client
- provider IDs live beside general business profile fields
- no server boundary for privileged billing mutations
- no webhook or idempotency model
- no founding-offer metadata
- no current-period or cancellation timing fields
- no tax, invoice or regional-price decision
- no soft enforcement policy or grace-period definition

## Batch 2 - Manual Billing State Foundation

Status: implementation complete and build verified. The SQL must be run
manually in Supabase before live billing records appear.

Implemented:

- added `src/lib/billing.ts` as the shared manual billing status and
  minor-unit price formatting contract
- added `sources/sql/04_business_billing_foundation.sql`
- replaced the owner-editable groundwork form with a read-only Mirëbook
  Launch subscription summary
- added founding-business, second-month-free, trial, agreed-price and current
  period presentation
- added clear EN and SQ copy explaining that online subscription payment is
  coming later
- kept billing informational: it does not affect booking, dashboard, staff or
  Explore access
- added a soft setup state if the live `business_billing` table has not yet
  been deployed

### Manual Schema

The SQL creates `public.business_billing` with:

- one unique billing record per business
- `not_configured`, `free_trial`, `founding_free`, `active`,
  `manual_comped`, `past_due`, `cancelled` and `paused` statuses
- the one-plan launch name
- agreed monthly price in minor currency units
- explicit three-letter currency
- trial start and end
- founding-business and second-month-free eligibility
- future Stripe customer and subscription references
- current-period end
- internal notes
- created and updated timestamps

It also:

- creates records for existing businesses
- creates a default record for each new business
- gives business owners read access to their own safe billing fields
- gives authenticated admin profiles RLS permission to manage billing rows
- excludes internal notes and Stripe references from authenticated client
  select grants
- leaves anonymous users without access

This repository has no migration runner. Run
`sources/sql/04_business_billing_foundation.sql` manually in the Supabase SQL
editor and verify its policies against the live `profiles` and `businesses`
tables before production use.

### Admin and Manual Operations

The existing admin business page still edits legacy billing columns on
`businesses`; it does not edit the new authoritative `business_billing` row.

For Batch 2, manual records must be managed through the Supabase table editor
or SQL editor. A new client-side admin editor was deliberately not added
because the app does not yet have a protected server mutation boundary.

The SQL includes an admin RLS management policy as groundwork. The next
implementation batch should move admin billing operations into protected
server-side actions, then update admin summaries to read
`business_billing`.

### Current Limitations

- SQL deployment is manual.
- No online payment is taken.
- Stripe Checkout and webhook synchronization exist in test mode; Customer
  Portal access does not.
- No invoice or renewal history is displayed.
- Billing email remains on the legacy `businesses` record.
- Legacy admin billing summaries and controls still read/write
  `businesses`.
- Billing status does not enforce access or publishing.
- Founding and launch prices remain manually agreed values.

## Recommended Next Batch

Proceed with **Protected Admin Billing Operations**:

1. Apply and verify the Batch 2 SQL in Supabase.
2. Confirm owner read and non-owner denial with real accounts.
3. Add protected server-side admin read/update operations.
4. Move the admin business billing controls to `business_billing`.
5. Update admin billing summaries to use the new statuses and minor-unit
   prices.
6. Add billing change audit metadata or an event log.
7. Remove or stop writing legacy subscription state on `businesses` only
   after live data has been migrated and checked.
8. Keep Customer Portal access and persistent webhook event-history storage
   for the next approved Stripe test-mode batch.

## Stripe Webhook QA

Before testing:

1. Apply `sources/sql/04_business_billing_foundation.sql` in Supabase.
2. Add `STRIPE_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` locally and in
   Vercel.
3. Configure the Stripe test webhook endpoint:
   `https://<app-domain>/api/stripe/webhook`.
4. Subscribe the endpoint to the six implemented event types.

Test flow:

1. Start Checkout as a real business owner.
2. Complete Checkout with a Stripe test payment method.
3. Confirm the matching `business_billing` row receives customer and
   subscription IDs.
4. Confirm `billing_status` becomes `active` or `free_trial`.
5. Confirm `current_period_end` is populated when Stripe supplies a
   subscription-item period end.
6. Trigger payment-failed and payment-succeeded test events and confirm
   `past_due` then `active`.
7. Cancel the test subscription and confirm `cancelled`.
8. Replay an event and confirm the same row remains consistent.
9. Send an invalid signature and confirm the endpoint returns `400`.
10. Confirm bookings, Explore listing, dashboard and staff access remain
    unchanged for every billing status.

## Stage 4 Pass Standard

Stage 4 passes when:

- Mirëbook has one approved business subscription offer
- founding-business pricing and duration are explicit
- subscription status, price and currency have authoritative ownership
- billing schema and RLS are versioned in the repository
- business owners cannot self-assign paid or trial state
- privileged billing mutations run server-side
- Stripe test-mode subscription lifecycle is synchronized through verified, idempotent webhooks
- business owners can understand plan, trial, renewal and cancellation state
- operators can support founding businesses and payment-attention cases
- customer appointment booking remains separate and payment-free
- no hard billing lockout is enabled without a separately approved enforcement policy
- Stage 1, Stage 2 and Stage 3 foundations pass regression QA
