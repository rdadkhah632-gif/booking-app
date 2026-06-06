# Stage 4 - Billing, Pricing and Subscription Foundation

Status: active.

Batch 1 status: audit and source planning complete after build verification.

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

### Batch 2 - Billing Domain and UI Contract

- verify the live `businesses` billing columns and RLS policies
- define shared billing status, plan and currency types
- replace scattered status and plan constants with one shared domain helper
- change the business billing page from self-managed commercial state to a truthful one-plan account summary
- allow only safe owner-managed contact fields
- retain admin manual controls temporarily
- add no Stripe SDK, API route, environment variable or payment processing

### Batch 3 - Versioned Database Foundation

- add a repository-owned Supabase migration structure
- create or normalize subscription records and constraints
- add explicit currency and minor-unit pricing
- define owner read access and protected write access
- add audit timestamps and provider ID uniqueness
- migrate existing billing groundwork safely

### Batch 4 - Admin Subscription Operations

- move manual status, trial and price changes behind protected server-side operations
- add founding-offer metadata and expiry
- separate booking readiness from billing attention in admin summaries
- preserve current publishing and listing behavior

### Batch 5 - Stripe Test-Mode Integration

- install the official Stripe server SDK only when approved
- add server-only environment variables
- create customer/subscription or checkout-session routes
- create a verified webhook route
- map one Mirëbook Business product to approved regional prices
- keep payment processing in Stripe test mode

### Batch 6 - Business Checkout and Portal

- add business-owner subscription checkout
- add Stripe Customer Portal access
- show invoices, renewal and cancellation state
- keep customer appointment booking payment-free

### Batch 7 - Soft Billing Guidance

- add trial-ending and payment-attention messaging
- add grace-period support guidance
- notify business owners and operators
- do not hard lock business operations without a separate approval

### Batch 8 - Stage 4 QA and Controlled Rollout

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

- Stripe checkout
- payment processing
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

Stripe is not integrated.

Confirmed absent:

- no `stripe` package in `package.json`
- no Stripe API routes
- no checkout-session route
- no billing-portal route
- no webhook handler
- no Stripe environment variables in `.env.example`
- no server-side Stripe client
- no payment processing

The app expects `stripe_customer_id` and `stripe_subscription_id` fields on `businesses`, but only reads and displays them. No inspected code creates or updates these references through Stripe.

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

## Recommended Batch 2

Proceed with **Billing Domain and UI Contract** before adding schema or Stripe.

Recommended Batch 2 deliverables:

1. Verify the live billing columns and RLS policies outside the repository.
2. Decide the launch currency and approve the working founding and launch prices.
3. Add a shared billing domain helper for the existing statuses and one `mirebook_business` plan code.
4. Remove owner-editable status, plan, price and trial controls from the business billing page.
5. Keep billing email as the only owner-editable billing groundwork field, if live RLS safely permits it.
6. Present a read-only one-plan summary, trial status and clear “payments not connected yet” state.
7. Keep admin manual controls for the short term, but document that they must move server-side before Stripe.
8. Produce the proposed migration and RLS design for Batch 3 without applying it yet.

Batch 2 must not install Stripe, add environment variables, create API routes, process payments or enforce subscription access.

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
