# Stage 6 - Onboarding, Verification, Email And Launch Readiness

Status: active.

Batch 1 status: implemented; production build passed.

Batch 2 status: implemented; production build passed.

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

## Known Limitations

- authenticated role-by-role browser QA is still required with real customer,
  business, linked staff, unlinked staff and owner-as-staff accounts
- Stage 6 does not yet verify email ownership
- no transactional email or invitation email is sent
- onboarding progress is derived from current records and is not stored as a
  separate completion state
- the business dashboard summary does not independently query staff-service
  assignments; the authoritative setup hub remains the detailed checklist
- old translation gaps may remain outside the touched Stage 6 surfaces

## Next Recommended Batch

Stage 6 Batch 3 - Email verification foundation.

Plan the verification state, Supabase Auth behavior, resend flow, safe
unverified-user experience and role-specific access policy before changing
authentication behavior. Do not add email notifications or reminder delivery
inside the verification batch.

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
