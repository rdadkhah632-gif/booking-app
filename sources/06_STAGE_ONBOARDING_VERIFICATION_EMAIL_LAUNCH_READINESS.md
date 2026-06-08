# Stage 6 - Onboarding, Verification, Email And Launch Readiness

Status: active.

Batch 1 status: implemented; production build passed.

Batch 2 status: implemented; production build passed.

Batch 3 status: implemented; production build passed.

Batch 4 status: implemented as a provider-disabled foundation; production
build passed.

Stages 1 through 5 are complete and protected.

## Purpose

Stage 6 prepares Mirëbook for launch by making first-run guidance clearer,
then adding deliberate identity verification, email delivery, notification
preferences and appointment reminders in later controlled batches.

The immediate Batch 1/2 goal is organizational: reduce repeated actions and
help each role understand the next useful step without changing product logic.

## Protected Foundations

Stage 6 must preserve:

- account identity, role routing and language persistence
- staff intent, staff invites, linking and owner-as-staff behavior
- request and instant-confirmation booking flows
- booking status and action behavior
- availability, readiness and Explore listing rules
- responsive dark UI and current translation patterns
- Stripe test Checkout, webhook synchronization and soft billing access
- admin route protection, support tickets and manual billing controls

## Planned Batches

1. Final UI organization and duplicate action sweep
2. Role-based onboarding guidance
3. Email verification foundation
4. Email notification foundation
5. Notification preferences
6. Appointment reminders
7. Founding-business offer tracking
8. Stage 6 closure QA

## Batch 1/2 Scope

- consolidate repeated setup and action surfaces
- remove prototype or stale helper copy on touched pages
- keep one clear primary action where several surfaces repeat the same route
- guide business owners through profile, services, staff, assignments, hours,
  preview and publishing
- guide unlinked staff toward an invite using their exact login email
- guide linked staff toward schedule, availability, notifications and support
- distinguish owner business management from personal staff work
- give customers a light path through Explore, bookings and notifications

## Batch 1/2 Out Of Scope

- email sending or email verification
- SMS or phone verification
- notification preference tables
- reminder schedules, cron jobs or queues
- live Stripe billing or hard billing lockouts
- automatic second-free-month decisions
- booking, readiness, Explore, role or staff-linking changes

## Launch Offer Principle

The working founding-business offer is:

- first month free
- a possible second free month after genuine usage
- manual operator review before any second-month award

The second month must not be awarded from a raw, easily inflated account count.

## Anti-Abuse Direction

Future offer tracking should:

- never count raw signups as meaningful usage
- count verified customers only after verification exists
- prefer genuine completed or confirmed booking activity
- detect repeated self-booking or obviously synthetic activity
- present evidence to an admin for review
- require an explicit admin decision before applying a second free month

## Pass Standard

Batch 1/2 passes when:

- business setup has one coherent next-step sequence
- staff-intent users understand how linking happens
- linked staff see staff-specific next actions
- owner-as-staff users understand the two workspaces
- customers see a simple booking journey without a large tour
- redundant local actions are reduced without hiding support or primary work
- EN and SQ remain aligned
- mobile layouts remain contained
- production build passes

## Batch 1 - Final UI Organization And Duplicate Action Sweep

Status: implemented; production build passed.

Pages and components touched:

- `/account`
- `/dashboard`
- `/dashboard/businesses`
- `/staff`
- shared EN and SQ translation dictionaries
- repository agent instructions

Implemented:

- consolidated the business setup hub from a readiness strip, setup-card grid
  and separate missing-action card into one ordered seven-step checklist
- preserved the existing readiness calculations for profile, services, staff,
  staff-service assignments, working hours and publishing
- kept public preview and publishing as explicit final steps
- separated the optional owner-as-staff decision from required business setup
- removed the duplicate setup button from the dashboard command card because
  setup guidance already owns that action
- removed a no-op dashboard header render
- removed duplicate Support and Log out actions from the Account header because
  authenticated navigation already provides them
- simplified the Account support footer to one role-correct support entry and
  one saved-conversation entry
- removed the duplicate Staff-management link from the owner-as-staff Account
  card
- removed the duplicate Account button from the unlinked staff action row
- removed premature copy promising a future invitation email
- retained Stripe test-mode warnings and all useful support access

No booking action, setup calculation, publishing rule, navigation architecture
or support workflow was changed.

## Batch 2 - Role-Based Onboarding Guidance

Status: implemented; production build passed.

### Business Owners

The setup hub now presents:

1. complete business profile
2. add services
3. add staff
4. assign services to staff
5. set working hours
6. preview the public page
7. publish when ready

The guidance distinguishes:

- profile details as customer-trust polish
- services, active staff, assignments and hours as booking readiness
- publishing as the visibility control
- billing as informational and non-blocking

### Staff-Intent And Unlinked Staff

The staff workspace now:

- displays the current login email directly
- asks the owner to invite that exact email from Staff setup
- explains that schedule, availability and staff notifications appear after
  linking
- keeps Refresh and Staff support as the useful actions
- does not promise that an invitation email is currently sent

### Linked Staff

Linked staff now receive a compact workspace guide with direct paths to:

- calendar
- availability
- staff notifications
- staff support

The guidance remains staff-specific and does not introduce customer-dashboard
language or booking approval actions.

### Owner As Staff

Account, business setup and staff workspace guidance now consistently explains:

- Business dashboard manages services, staff, bookings and setup
- My Work manages the owner's personal schedule and availability
- customers can book the owner only while the staff profile is active and
  assigned to services

No owner-as-staff linking behavior changed.

### Customers

Customer-only Account pages now include a light three-step journey:

- Explore businesses
- track requests and bookings
- check updates

This is a small navigation guide, not a modal tour or new dashboard.

## Translation And Responsive Notes

- all new visible strings use translation keys
- EN and SQ dictionaries were updated together
- no duplicate translation keys were introduced
- no visible `Slotly` text remains in the searched launch surfaces
- setup and onboarding grids collapse to one column on narrow screens
- staff and Account action groups retain full-width mobile controls

## Batch 3 - Email Verification Foundation

Status: implemented; production build passed.

Mirëbook now uses Supabase Auth's existing email-confirmation state rather than
creating a custom verification-token system.

Implemented behavior:

- registration supplies a Supabase confirmation redirect back to `/login`
- when Supabase requires confirmation and returns no session, registration
  shows a translated check-email state instead of attempting authenticated
  profile or business writes
- the selected customer, staff or business registration intent is retained in
  auth metadata
- after a confirmed user signs in, pending profile, business and optional
  owner-as-staff setup is completed idempotently before capability routing
- login detects Supabase's unconfirmed-email response and offers resend
- Account shows verified or unverified status from
  `session.user.email_confirmed_at`
- unverified Account users can request another Supabase signup confirmation
- `/admin/users` loads the selected auth user's verification state through a
  service-role-backed, admin-authorized API route

Verification remains a soft launch signal:

- existing test accounts are not blocked
- booking, business publishing, staff linking and workspace access are not
  restricted
- no role or capability is derived from verification state
- no founding offer is granted automatically

Future founding-offer eligibility must require:

- a verified email
- a unique customer/email identity
- genuine confirmed or completed booking activity
- manual operator review

Raw signups must never qualify a business for a second free month.

## Batch 4 - Email Notification Foundation

Status: implemented as a provider-disabled foundation; production build
passed.

The repository had no email provider or email package. No package was
installed.

Implemented architecture:

- typed transactional email events and results under `src/lib/email`
- simple booking email templates with subject, core appointment details and a
  Mirëbook action link
- server-only `sendTransactionalEmail(...)` adapter
- authenticated `/api/email/transactional` route
- service-role recipient and booking-context lookup
- authorization that permits customers to request only their newly created
  booking event and business owners to request status events only for their
  own business
- safe `skipped` results while `EMAIL_PROVIDER=disabled`
- server-only development logging without recipient addresses or message
  bodies
- API failures do not fail booking creation or booking status changes

In-app notifications remain the authoritative delivery and status channel.

Booking events currently wired:

- customer booking request sent
- customer instant booking confirmed
- business owner new request needs approval
- business owner new instant booking confirmed
- customer booking confirmed
- customer booking declined
- customer booking cancelled
- customer appointment completed
- linked/identified staff assignment for confirmed bookings
- linked/identified staff cancellation or decline update

The same status-event hook is present on both current business booking action
surfaces: `/dashboard/bookings` and `/dashboard/notifications`.

Environment placeholders:

```text
EMAIL_PROVIDER=disabled
EMAIL_FROM_ADDRESS=
EMAIL_REPLY_TO=
```

No provider API key or real sender is defined. Setting an unsupported provider
does not claim success; delivery remains skipped until a provider-specific
adapter is deliberately implemented.

Events defined but intentionally not wired in this batch:

- support ticket received
- support reply
- staff invite
- customer cancellation/reschedule email
- appointment reminders
- marketing or founding-offer email

Support and staff-invite delivery need a real provider, deduplication policy
and provider QA before they are connected. Existing in-app support and staff
linking behavior remains unchanged.

Current templates are English-only server templates. EN and SQ are aligned for
all new verification UI. Localized transactional email templates should be
added with the real provider implementation using the recipient's saved
language.

## Known Limitations

- authenticated role-by-role browser QA is still required with real customer,
  business, linked staff, unlinked staff and owner-as-staff accounts
- Supabase project email-confirmation settings still control whether new
  registrations require inbox confirmation
- verification is visible but does not enforce access
- transactional email delivery is skipped while `EMAIL_PROVIDER=disabled`
- no real provider credentials or provider-specific adapter exist
- transactional booking templates are not localized yet
- repeated API requests are authorized but do not yet have persistent
  delivery idempotency; a provider batch must add event/delivery records
- support, staff-invite, reschedule and reminder emails are not wired
- onboarding progress is derived from current records and is not stored as a
  separate completion state
- the business dashboard summary does not independently query staff-service
  assignments; the authoritative setup hub remains the detailed checklist
- old translation gaps may remain outside the touched Stage 6 surfaces

## Next Recommended Batches

Stage 6 Batch 5 - Notification preferences.

Define channel preferences without weakening in-app notifications as the
source of truth. Decide defaults, ownership and migration behavior before
adding a preference table.

Stage 6 Batch 6 - Appointment reminder foundation.

Choose a real email provider, add delivery idempotency and plan a server-side
schedule or queue before sending 24-hour reminders. Do not use browser timers
or client-only scheduling.

## Batch 3/4 QA Checklist

- register with Supabase confirmation enabled and confirm no premature profile
  or business write error appears
- use the verification link and confirm login completes the intended customer,
  staff or business setup
- confirm owner-as-staff registration provisions only one owner staff record
- confirm unconfirmed login offers resend without exposing account details
- confirm Account shows verified/unverified state accurately
- confirm resend uses the current login address
- confirm an admin can see selected-user verification state
- confirm a non-admin cannot call the admin verification API
- create request-mode and instant bookings with email provider disabled
- confirm booking succeeds and in-app notifications are still created
- accept, decline, cancel and complete bookings from the booking manager
- accept and decline a booking from business notifications
- confirm email API responses report skipped rather than sent
- confirm no client bundle contains service-role or future provider secrets
- confirm Stage 1 role routing and staff linking remain unchanged

Automated Batch 3/4 verification:

- `npm run build`: passed
- `git diff --check`: passed
- EN and SQ translation dictionaries contain no duplicate keys
- Prettier is unavailable in the local workspace

## Batch 1/2 QA Checklist

- customer Account shows Explore, Track bookings and Check updates
- business setup checklist reflects existing profile/readiness/publish state
- checklist links open the correct setup surface
- billing wording remains informational and no setup action is blocked
- unlinked staff sees the exact login email and no email-delivery promise
- linked staff sees calendar, availability, notifications and support
- owner-as-staff sees the distinction between Business dashboard and My Work
- Account support opens the correct customer, business or staff support route
- saved support messages always open `/support/messages`
- EN and SQ render without raw keys
- `/account`, `/dashboard/businesses` and `/staff` remain contained at about
  390px
- booking, Explore, Stripe, admin and support smoke tests still pass

Automated verification:

- `npm run build`: passed
- `git diff --check`: passed
- Prettier: unavailable in the local workspace
