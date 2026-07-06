# Stage 9 - Auth, RLS and Data Boundary Hardening

Status: active after Stage 8 closure.

RLS/data-boundary closure status: pass with one tracked auth-routing polish
follow-up.

Current Stage 9 focus:

- keep the SQL 09-17 RLS boundaries stable unless a fresh leak appears
- verify production Supabase Auth settings before enabling stricter auth flows
- verify Vercel environment configuration for server-only routes, Stripe test
  sync, app domains, support email and reminders
- run final role-by-role launch QA without reopening UI polish unless a direct
  regression appears

Batch 1 audit status: complete.

Batch 2 status: implemented and build-validated.

Batch 3 status: implemented and build-validated.

Batch 4 status: implemented and build-validated.

Batch 5 status: implemented and build-validated.

Batches 6-10 status: SQL policy cleanup and validators created, applied
manually in Supabase and QA'd through the Stage 9 closure matrix.

Stage 8 closure note: interface compression and mobile account-menu QA passed
after Stage 8.54. Do not reopen Stage 8 unless a direct regression appears.

## Goal

Make Supabase row-level security the real data boundary for Mirëbook before
final auth hardening.

The app should still use scoped client queries, but security must not depend on
the browser remembering to include `.eq(...)` filters.

## Protected Foundations

Do not change:

- booking creation logic
- booking status lifecycle
- staff invite/linking logic
- owner-as-staff logic
- role/capability routing
- Supabase auth/session behaviour
- Stripe billing write logic
- notification generation behaviour

## Batch 1 Audit Findings

Read-only audit found that app code usually scopes reads by:

- `customer_user_id`
- `business_id`
- `staff_member_id`
- `user_id`
- `profiles.is_admin`

However, live broad read checks showed that core tables were still readable too
broadly from Supabase:

- anonymous users could count core booking/marketplace tables
- authenticated users could count booking rows beyond their own scoped context
- public booking pages depended on raw `bookings` reads to calculate occupied
  slots

This means app-side filters are not enough for launch.

## Batch 2 Implemented

- Added a server-side public booking occupancy endpoint:
  `/api/public/booking-occupancy`
- Moved the public business booking page away from direct client-side
  `bookings` reads for occupied slot calculation.
- The endpoint returns only slot-blocking schedule fields:
  `staff_member_id`, `start_at`, `end_at`, `duration_minutes`.
- The endpoint uses service-role access on the server, but only exposes data for
  published businesses or owner preview.
- Public booking submit still refreshes occupied slots before insert, preserving
  stale-slot protection.
- Customer booking insert logic was not changed.

## Batch 3 Implemented

- Added a server-side support admin notification endpoint:
  `/api/support/admin-notification`
- Removed direct client-side admin profile enumeration from normal support
  ticket creation/reply flows.
- Customer, business, staff and support-thread pages now ask the server route to
  notify admins after the ticket/reply is saved.
- The server route verifies the caller owns the support ticket before inserting
  admin notifications with service-role access.
- Added a second SQL draft for:
  - `booking_requests`
  - `notifications`
  - `support_messages`
  - `support_replies`

This batch does not change support ticket creation, support reply creation,
booking request logic, notification read behaviour or admin support behaviour.

## Batch 4 Implemented

- Added a server-side public marketplace endpoint:
  `/api/public/explore-businesses`
- Added a server-side public business profile endpoint:
  `/api/public/business-profile`
- Moved Explore away from direct browser reads of:
  - `businesses`
  - `services`
  - `staff_members`
  - `staff_services`
  - `availability`
- Moved the public business booking page away from direct browser reads of:
  - `businesses`
  - `services`
  - `staff_members`
  - `staff_services`
  - `staff_availability`
  - `availability`
- Public pages now receive public-safe, shaped data from server routes.
- Private setup fields such as staff email/user IDs and business owner IDs are
  not returned by the public profile endpoints.
- Public booking submit still performs a fresh service/staff/assignment/profile
  refresh before insert and still refreshes occupied slots before insert.
- Customer booking insert logic, booking status lifecycle and slot generation
  were not rewritten.
- Added a third SQL draft for:
  - `businesses`
  - `services`
  - `staff_members`
  - `staff_services`
  - `availability`
  - `staff_availability`

This batch requires `SUPABASE_SERVICE_ROLE_KEY` in local/Vercel environments
because public marketplace/profile data now flows through service-role server
routes with explicit public-safe response shaping.

## SQL 8 Staff Invite Token QA

After `sources/sql/08_staff_invite_tokens.sql` was run manually in Supabase:

- anonymous direct reads of `staff_invite_tokens` returned permission denied
- invalid invite-token API checks returned `valid: false` instead of storage
  missing
- unauthenticated invite creation returned `401`
- a throwaway business owner created a staff invite successfully
- provider-disabled email returned a manual invite URL without claiming delivery
- the invite URL validated as active
- the invited staff account accepted the token successfully
- the staff member row was linked to the invited account
- the same token validated as inactive after acceptance

QA records created:

- `stage9-invite-owner-1783030441577@test.com`
- `stage9-invite-staff-1783030441577@test.com`
- business `161014f4-a6e5-4623-9c6b-2c38084f032a`
- staff member `f7d48189-1975-4019-8f3b-b3a88185dab8`

## Batch 5 Implemented

- Added `/api/support/reply` so customer/business/staff support-thread replies
  are verified server-side before creating a reply and reopening the ticket.
- Updated `/support/messages/[id]` to use the server reply route instead of
  directly inserting `support_replies` and updating `support_messages`.
- Added `/api/admin/profile` so admin user profile/access changes happen
  through a service-role route after an explicit admin check.
- Updated `/admin/users` to use the admin profile route for profile edits and
  role/admin access changes.
- Added `sources/sql/12_rls_profiles_support_tightening_draft.sql`.

The new SQL draft:

- versions the `profiles` RLS boundary
- limits normal authenticated profile writes to safe self-owned fields
  (`full_name`, `phone`, `preferred_language`)
- keeps role/admin mutations behind the admin profile API
- narrows `support_messages` updates to admins only
- narrows direct `support_replies` inserts to admins only
- relies on `/api/support/reply` for user support replies

This batch does not change booking, role routing, staff linking, billing,
notification generation or support ticket creation behaviour.

## SQL 12 Profiles and Support QA

After `sources/sql/12_rls_profiles_support_tightening_draft.sql` was run
manually in Supabase:

- anonymous direct reads of `profiles`, `support_messages` and
  `support_replies` returned permission denied
- new auth signups still created readable self-owned profile rows through the
  existing database trigger
- the previous registration `profiles.upsert(...)` pattern failed because SQL
  12 intentionally blocks browser-side updates to `role` and `is_admin`
- `/register` and the login profile fallback were updated to use a
  read-then-insert pattern and only update the safe `preferred_language` field
- patched customer-style registration passed against live Supabase
- patched business-style registration passed against live Supabase, including
  business row creation and owner-as-staff creation
- account save still updates safe self-owned fields:
  `full_name`, `phone`, `preferred_language`
- normal users cannot directly update `profiles.role` or `profiles.is_admin`
- normal-user broad profile reads are limited to the signed-in user
- normal users can still create their own support ticket
- normal-user broad support ticket reads are limited to own tickets
- direct user inserts into `support_replies` are blocked
- direct user updates to `support_messages` do not change the ticket row
- `/api/support/reply` accepts owner replies and rejects non-owner replies
- non-admin users cannot call `/api/admin/profile`

Remaining manual admin QA:

- sign in with a real admin account
- edit a user profile from `/admin/users`
- change a user's role/admin access through `/admin/users`
- reply from `/admin/support` and update support status

## Broad-Read Audit After SQL 12

Production broad-read QA with fresh anonymous, customer, business owner, staff
and admin sessions found:

- anonymous reads are blocked across the tested Stage 9 tables
- `profiles`, `booking_requests`, `notifications`, `support_messages`,
  `support_replies`, `business_billing` and
  `notification_email_preferences` behaved as expected for the tested roles
- admin broad reads behaved as expected for operator surfaces
- server-only/admin-operated tables remained denied to browser clients:
  `staff_invite_tokens`, `appointment_reminder_deliveries`,
  `founding_offer_reviews`, `business_billing_admin_audit`

The same audit also found a blocker:

- normal authenticated non-admin users can still broad-read unrelated rows from
  `businesses`, `services`, `staff_members`, `staff_services`,
  `availability`, `staff_availability` and `bookings`

The tested users were not admins. This points to older permissive Supabase
policies still existing beside the newer Stage 9 policies.

Created:

```text
sources/sql/13_rls_policy_cleanup_after_broad_read_audit.sql
```

That SQL drops all policies on the leaking marketplace/schedule/booking tables
and recreates the intended Stage 9 policies. It does not change schema,
booking lifecycle logic, staff linking, auth, billing writes or app code.

Required next order:

1. Review and run
   `sources/sql/13_rls_policy_cleanup_after_broad_read_audit.sql` in Supabase
   SQL editor.
2. Rerun broad-read QA as anonymous, customer, business owner, staff and admin.
3. QA public Explore and public business profile endpoints.
4. QA customer booking creation, My Bookings, business Calendar, business Setup,
   staff Calendar and staff Availability.

## SQL 13 QA Finding

After SQL 13 was run, the broad-read cleanup successfully removed the legacy
permissive policies from the marketplace/setup tables, but customer booking
creation failed at insert time with:

```text
new row violates row-level security policy for table "bookings"
```

Cause:

- the booking insert policy still validated published business, active service,
  active staff and staff-service assignment using direct subqueries
- after SQL 13, customers can no longer directly read those setup tables
- therefore the direct subquery checks no longer pass for customer booking
  creation

Created:

```text
sources/sql/14_rls_public_booking_insert_validator.sql
```

SQL 14 keeps raw setup tables private and adds a narrow security-definer helper
used by the bookings insert policy:

```text
public.mirebook_can_create_public_booking(...)
```

Required next order:

1. Review and run
   `sources/sql/14_rls_public_booking_insert_validator.sql` in Supabase SQL
   editor.
2. Rerun public booking creation QA.
3. Rerun customer, owner, staff, outsider and admin broad-read QA.
4. Confirm customer My Bookings, business Calendar/Inbox and staff Calendar
   still work.

## SQL 14 QA Finding

After SQL 14 was run, customer booking creation passed again. The next blocker
appeared immediately after the booking insert:

```text
new row violates row-level security policy for table "notifications"
```

The failing case was the customer-created business-side notification generated
after a public booking.

Cause:

- the notification insert policy still validated related booking/request access
  through direct subqueries
- after SQL 13, those direct checks can fail for related actors even when the
  actor is allowed to create the notification

Created:

```text
sources/sql/15_rls_related_notification_insert_validator.sql
```

SQL 15 keeps notification reads scoped and adds a narrow security-definer
validator for notification inserts:

```text
public.mirebook_can_insert_related_notification(...)
```

Required next order:

1. Review and run
   `sources/sql/15_rls_related_notification_insert_validator.sql` in Supabase
   SQL editor.
2. Rerun customer public booking creation including customer and business
   notifications.
3. Rerun customer, owner, staff, outsider and admin broad-read QA.
4. Confirm customer My Bookings, business Calendar/Inbox and staff Calendar
   still work.

## SQL 15 QA Finding

After SQL 15 was run, direct RPC testing confirmed:

```text
public.mirebook_can_insert_related_notification(...) = true
```

for a valid customer-created business booking notification. However, the actual
insert into `public.notifications` still failed with:

```text
new row violates row-level security policy for table "notifications"
```

This means the helper is correct, but an older restrictive notification insert
policy is still present in Supabase and is being applied alongside the new
policy.

Created:

```text
sources/sql/16_rls_notifications_policy_cleanup.sql
```

SQL 16 drops every policy on `public.notifications` only, then recreates the
intended scoped policies:

- select: own user notifications, owned-business notifications, or admin
- update: same scoped actors
- insert: related actor validator from SQL 15

Required next order:

1. Review and run `sources/sql/16_rls_notifications_policy_cleanup.sql` in
   Supabase SQL editor.
2. Rerun customer public booking creation including customer and business
   notifications.
3. Rerun customer, owner, staff, outsider and admin broad-read QA.
4. Confirm customer My Bookings, business Calendar/Inbox and staff Calendar
   still work.

## SQL 16 QA Finding

After SQL 16 was run, notification QA passed with the correct test shape:

- customer can create customer-facing notifications and read them back
- customer can create business-facing notifications without returning the row
- business owner can read the business-facing notification
- customer cannot read the business-facing notification after insert

The follow-up broad-read matrix also confirmed public booking creation,
customer booking requests, support replies, public Explore/profile APIs and the
major role boundaries.

Two email preference failures in the first SQL 16 run were QA-script noise: the
script used old field names. A corrected check against the real
`notification_email_preferences` schema passed.

One real blocker remained:

- staff can still read customer reschedule request rows for assigned bookings

The intended Stage 9 policy keeps booking request rows visible only to the
requesting customer, the owning business and admins. Staff can see assigned
bookings, but request approval remains business-owned.

Created:

```text
sources/sql/17_rls_booking_requests_policy_cleanup.sql
```

SQL 17 drops every policy on `public.booking_requests` only, then recreates the
intended scoped policies for select, customer insert/update and business/admin
update.

Required next order:

1. Review and run `sources/sql/17_rls_booking_requests_policy_cleanup.sql` in
   Supabase SQL editor.
2. Rerun customer reschedule request creation.
3. Confirm customer and business owner can read the request.
4. Confirm staff and unrelated users cannot read the request.
5. Rerun the final Stage 9 broad-read QA matrix.

## Post-SQL 17 Customer Booking Detail Fix

After the final broad-read QA matrix passed, browser QA found that stricter RLS
left customer-owned booking detail screens with safe fallback labels:

- `/booking-confirmation` showed generic business, service and staff text
- `/my-bookings` showed `Business`, `Service not recorded` and
  `Staff not recorded`
- `/reschedule-booking` could not load staff/service availability context and
  incorrectly said no active staff were assigned to the service

The underlying RLS boundaries were correct. The customer browser could read its
own booking rows, but could no longer join directly into private business,
service, staff and availability setup tables.

Fix implemented:

- added a verified server route at `/api/customer/bookings`
- the route uses service-role access only after validating the caller's Supabase
  session
- list mode returns only the signed-in customer's own bookings and safe related
  labels
- detail mode returns a single booking only if the caller is the booking
  customer or the owner of the booking's business
- reschedule mode returns safe schedule context for the allowed booking so the
  existing reschedule UI can calculate available alternatives
- customer pages now use the route for read context instead of direct private
  joins
- logout now clears stale Supabase browser session keys after sign-out

No SQL was added for this fix. It intentionally keeps the SQL 13-17 RLS
hardening intact and moves only the required customer-owned display context
behind a verified server boundary.

## Stage 9 Closure QA Follow-Up

Closure QA found one UI-only staff workspace issue after the RLS matrix passed:

- `/staff/calendar?date=...` loaded the correct staff account but ignored the
  date query on first render
- the visible week could stay on the current week while the URL pointed at a
  later appointment week

Fix implemented:

- staff Calendar now reads a valid `date` query before loading schedule data
- previous, next, today, date input and appointment click all use the same
  date-change path
- unauthenticated staff calendar redirects include the selected date in the
  login redirect target

This did not change booking reads, booking status transitions, staff linking,
role routing, RLS policies or availability calculations.

## Stage 9 Closure QA Status

Status: pass with one tracked auth-redirect follow-up.

Confirmed:

- direct anonymous reads remain blocked or empty across the tested Stage 9
  tables
- customer reads are scoped to customer-owned bookings, requests and support
  tickets
- unrelated authenticated users cannot read another customer's booking or
  request rows
- business owners can read their own business, bookings and booking requests
- staff can read their linked staff row, own availability and assigned bookings
- staff cannot read business-owned booking request rows
- public Explore and public business profile endpoints return shaped public data
- customer booking detail API returns safe labels for the owning customer
- outsider access to customer booking detail API is denied
- non-admin access to the admin profile API is denied
- staff Calendar now honors dated links such as
  `/staff/calendar?date=2026-07-11` on first render

Tracked follow-up:

- login currently sends staff users to the default staff workspace after sign-in
  rather than preserving every safe staff deep link; this does not weaken RLS or
  data boundaries, but it should be considered for a later auth-routing polish
  pass.

## Current RLS Source Files

Versioned SQL:

```text
sources/sql/09_rls_bookings_boundary_draft.sql
sources/sql/10_rls_requests_notifications_support_draft.sql
sources/sql/11_rls_marketplace_public_data_boundary_draft.sql
sources/sql/12_rls_profiles_support_tightening_draft.sql
sources/sql/13_rls_policy_cleanup_after_broad_read_audit.sql
sources/sql/14_rls_public_booking_insert_validator.sql
sources/sql/15_rls_related_notification_insert_validator.sql
sources/sql/16_rls_notifications_policy_cleanup.sql
sources/sql/17_rls_booking_requests_policy_cleanup.sql
```

These files are the versioned record of the Stage 9 hardening pass. They are
not automatically applied by the app. The project history records SQL 09-17 as
manually run in Supabase and QA'd through the Stage 9 matrix.

Do not rerun or rewrite these policies casually. Treat them as production data
boundaries and only change them after a targeted leak, broken workflow or
schema change is identified.

## Current High-Risk Tables

`businesses`, `services`, `staff_members`, `staff_services`, `availability`,
`staff_availability`, `bookings`, `booking_requests`, `notifications`,
`support_messages`, `support_replies`, `profiles`,
`notification_email_preferences` and `business_billing` are launch-sensitive
because they define cross-role visibility.

Latest QA status: pass for the tested anonymous, customer, staff, business
owner and admin boundaries. Future changes to these tables require focused RLS
QA before launch.

Admin-only and server-only tables should remain denied to browser clients:

- `staff_invite_tokens`
- `appointment_reminder_deliveries`
- `founding_offer_reviews`
- `business_billing_admin_audit`

## Safe Next Batch

Stage 9 should now move from broad SQL cleanup into final production readiness.

Recommended Batch 11 - Production Auth, Environment And Email Readiness:

1. Verify Vercel environment configuration exists for the production and
   business domains without exposing secret values.
2. Verify Supabase Auth dashboard settings:
   - Site URL
   - Redirect URLs
   - confirmation/recovery templates
   - whether email confirmation is intentionally disabled or ready for a staged
     activation test
3. Verify application email mode:
   - `EMAIL_PROVIDER=disabled` remains safe for no-send launch testing
   - `EMAIL_PROVIDER=resend` is only used after sender-domain and inbox QA
   - `SUPPORT_ADMIN_EMAIL` is monitored before operator alerts are called live
4. Verify reminders:
   - `REMINDER_CRON_SECRET` exists before any scheduler is enabled
   - reminder cron is not marketed as active until real provider delivery is QA'd
5. Run final role-by-role launch QA:
   - anonymous marketplace/public booking
   - customer registration, booking, reschedule, cancellation and support
   - business owner setup, calendar, manual appointment, inbox and support
   - staff login, calendar, availability and notifications
   - admin user/support/billing visibility

Do not harden all tables blindly in one production pass. From here, Stage 9
changes should be small, audited and tied to a specific launch-readiness
finding.

## Batch 11A Volume QA Follow-Up Implemented

Multi-account volume QA before auth tightening created multiple customer,
owner, staff, business, service and booking records across the deployed
customer and business domains.

Confirmed:

- no P0 cross-customer, cross-business or cross-staff data leaks were found
- customer Explore, booking, My Bookings, Notifications, cancellation and
  account/logout held under the tested volume
- business owner setup, manual appointment creation, overlap prevention,
  Calendar, Inbox, staff linking and staff workspace isolation held for sampled
  businesses
- request-mode and instant-confirmation customer bookings both worked
- no raw database/RLS errors were reported

Follow-up fixes applied:

- reschedule now blocks submitting the same appointment time with the same or
  ambiguous staff choice, preventing meaningless change requests
- business manual Add appointment now defaults to the first service with active
  assigned staff and clearly disables services that have no staff assigned
- Team service assignment updates no longer trigger a full page reload, keeping
  the staff details panel open for multi-service assignment
- public business profile loading now offers a retry affordance if loading takes
  longer than expected
- mobile public business service cards are more compact so customers can compare
  services faster

Protected systems unchanged:

- no SQL, RLS, booking lifecycle, availability calculation, staff invite/linking,
  billing write or auth/session behaviour was changed

Remaining Batch 11A follow-up QA:

- retest customer reschedule on confirmed bookings and verify same-time submit
  is disabled or blocked
- retest business manual appointment with a mix of assigned and unassigned
  services
- retest assigning multiple services to one staff member without the panel
  collapsing
- run a focused same-business multi-staff QA pass if time allows

## Batch 11A Retest Status

Status: pass.

Business/staff retest confirmed:

- Add appointment defaults to an active assigned service
- unassigned services are disabled and labelled as having no staff assigned
- manual appointment creation still works for assigned/bookable services
- overlap prevention still blocks duplicate same-staff/time appointments
- assigning multiple services keeps the staff detail panel open
- staff workspace remains scoped to assigned business/services/appointments

Customer retest confirmed:

- same-time reschedule submit is disabled and shows the no-change message
- choosing a genuinely different time still submits a reschedule request
- mobile public business service cards are more compact
- cross-customer booking and notification isolation still holds

No P0/P1 findings remained. The retry fallback was not triggered during normal
QA because the tested public profile loaded successfully.

## Batch 11B Production Auth, Environment And Email Readiness Audit

Status: repo-level audit complete. Live Vercel and Supabase dashboard values
still need manual verification; secret values were not read or exposed.

### Vercel Environment Requirements

Required for the core deployed app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CUSTOMER_APP_URL`
- `NEXT_PUBLIC_BUSINESS_APP_URL`

`SUPABASE_SERVICE_ROLE_KEY` is server-only and required by the Stage 9 server
boundaries, including public Explore/profile/occupancy APIs, customer booking
detail APIs, support/admin routes, reminders and Stripe billing sync. It must
never be exposed as `NEXT_PUBLIC_*`.

Production URL expectations:

- `NEXT_PUBLIC_APP_URL` should be a valid HTTPS production customer origin,
  normally `https://mirebook.com`
- `NEXT_PUBLIC_CUSTOMER_APP_URL` should be `https://mirebook.com`
- `NEXT_PUBLIC_BUSINESS_APP_URL` should be `https://business.mirebook.com`

Stripe test billing variables required while test Checkout/webhook remain
enabled:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_LAUNCH`

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is listed in `.env.example` for Stripe
client readiness, but current Checkout creation is server-driven. Do not put
secret Stripe keys in any `NEXT_PUBLIC_*` variable.

### Application Email Mode

Safe launch-testing default:

- `EMAIL_PROVIDER=disabled`

In disabled mode, application transactional email is skipped and the in-app
booking/support/notification surfaces remain authoritative.

Required before enabling provider delivery:

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`

Recommended before operator alerts are considered live:

- `EMAIL_REPLY_TO`
- `SUPPORT_ADMIN_EMAIL`

Provider delivery should not be enabled until the sender domain is verified,
the from/reply-to inboxes are monitored, and test booking/support/staff-invite
emails are confirmed from the deployed app.

### Reminder/Cron Readiness

The reminder API requires:

- `REMINDER_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- a valid production `NEXT_PUBLIC_APP_URL`
- installed reminder SQL from
  `sources/sql/06_notification_email_preferences_and_reminders.sql`
- email provider delivery if reminders should actually send

No `vercel.json` is present in the repo, so no Vercel Cron schedule is currently
versioned here. Reminders must not be marketed as active until a protected
scheduler is added/configured and real provider delivery is QA'd.

### Supabase Auth Dashboard Requirements

Before enabling stricter email confirmation:

1. Set Supabase Auth Site URL to `https://mirebook.com`.
2. Add allowed redirect URLs for:
   - `https://mirebook.com/**`
   - `https://www.mirebook.com/**`
   - `https://business.mirebook.com/**`
   - active Vercel production/preview origins while they remain in use
   - `http://localhost:3000/**` for local QA
3. Confirm these callback families are allowed:
   - `/login?verified=1`
   - `/reset-password`
   - customer and business `product` query variants
   - `/staff/invite` return paths for secure staff invite acceptance
4. Review confirmation and recovery email templates without changing Supabase
   token/link variables.
5. Keep email confirmation disabled until staged customer, business and invited
   staff registration QA passes with real inboxes.

### Batch 11B Pass Standard

Batch 11B should be considered ready to move into staged auth activation only
when:

- required Vercel production variables are present in the Vercel dashboard
- Supabase Auth redirect URLs match both customer and business domains
- password recovery works on both domains
- staff invite return paths still work
- `EMAIL_PROVIDER=disabled` no-send behaviour is confirmed, or Resend delivery
  is fully configured and QA'd
- reminder cron remains disabled or is configured with `REMINDER_CRON_SECRET`
  and tested deliberately

### Recommended Next Batch

Stage 9 Batch 11C - Staged Auth And Email Confirmation QA:

- keep app code unchanged unless QA finds a direct blocker
- configure Supabase Auth redirects/templates in the dashboard
- test password recovery on customer and business domains
- test optional email confirmation in a controlled/staging-like window before
  enforcing it for production users
- retest customer registration, business registration and secure staff invite
  acceptance with real confirmation/recovery links

## Batch 11C Auth/Redirect QA Follow-Up Implemented

QA found the core domain and auth routing healthy, with three launch-readiness
follow-ups:

- password reset surfaced a Supabase reset-provider error for registered QA
  emails even though registration/login accepted those emails
- plain `/register` on `business.mirebook.com` defaulted to Customer instead of
  Business
- staff exact-email linking worked, but the secure `/staff/invite` token link
  was not exposed for QA when creating staff from Team

Fixes applied:

- forgot-password requests now use generic recovery-request success copy even if
  the provider rejects or rate-limits the request, avoiding raw provider errors
  and keeping the no-account-enumeration pattern
- the forgot-password email field uses text input with email keyboard hints so
  browser email validation cannot reject addresses that registration accepts
- business-domain `/register` now defaults to Business unless an explicit
  account type is provided
- creating a staff member with an email now attempts secure invite-link
  generation immediately and surfaces the manual invite link when email delivery
  is skipped/disabled

Protected systems unchanged:

- no SQL, RLS, booking lifecycle, staff linking rules, auth session handling,
  billing writes or email provider configuration was changed

Remaining Batch 11C QA:

- retest customer and business password reset request UI with the registered QA
  emails from the failed run
- retest plain `https://business.mirebook.com/register`
- create a new staff member with an email and verify a manual `/staff/invite`
  link is available when email delivery is skipped

## Batch 11C Password Reset No-Enumeration Follow-Up

Customer forgot-password QA still saw provider-side invalid-email copy for a
registered `@test.com` QA account.

Fix applied:

- forgot-password now shows the generic accepted message immediately and treats
  Supabase recovery email delivery as a background best-effort request
- provider/client validation or delivery errors are logged only in development
  and are never rendered to the user
- this keeps the recovery request UI aligned with the no-account-enumeration
  pattern while email confirmation/recovery delivery is still being staged

Retest result:

- customer forgot-password: PASS
- business forgot-password: PASS
- both flows showed generic accepted recovery copy without raw provider errors

## Batch 11D Final Auth Hardening Prep

Goal:

- prepare password reset completion, email-confirmation staging and final
  role-boundary QA without changing protected booking, role, RLS, staff-linking
  or billing systems

App-side hardening applied:

- `/reset-password` no longer renders raw Supabase recovery-link or
  code-exchange errors to users
- expired, invalid or already-used reset links now show the existing inactive
  reset-link state with a safe "request another reset link" action
- failed password updates show generic recovery guidance while provider details
  are logged only in development
- Account-page password reset requests now follow the same no-enumeration
  pattern as `/forgot-password`: the generic accepted message is shown without
  rendering provider rejection text

External checks still required:

- use a real inbox to open a customer recovery email and confirm the link lands
  on `/reset-password`, accepts a new password and allows login with the new
  password
- repeat the recovery-link completion on the business domain using a business
  account
- decide whether Supabase email confirmation remains disabled for launch or is
  staged in a controlled test window before enforcement
- current recommendation: keep Supabase email confirmation disabled for launch
  until customer, business and invited-staff confirmation links have passed
  real-inbox QA on the deployed domains
- if email confirmation is staged, verify customer signup, business signup and
  invited-staff signup all return to the correct product area after confirming
  the email
- rerun a final role/data-boundary smoke after any Supabase Auth dashboard
  setting change

Recommended final smoke matrix:

- anonymous: Explore and public business profiles load, protected pages redirect
  to login, no private dashboard data is visible
- customer: register/login/logout, booking, My Bookings, reschedule,
  cancellation, Notifications, Account reset request and support
- business owner: login, Today, Calendar manual appointment, Setup, Team staff
  invite/manual link, Inbox actions, Membership and Account reset request
- staff: invited/exact-email login, Today, Calendar, Availability, Inbox, no
  owner-only actions
- admin: admin dashboard/user/support access works only for admin accounts, and
  non-admin accounts are denied

## Batch 11D Real-Inbox QA Follow-Up

Real-inbox QA result:

- customer password recovery: PASS
- business password recovery: FAIL because the recovery email did not arrive
- Account-page reset request copy: PASS for customer and business

Likely cause:

- customer recovery proved the deployed reset page, recovery link handling,
  password update and login flow work
- business recovery used the business-domain recovery redirect; if Supabase Auth
  rejects that redirect URL, it will not send a recovery email
- because Mirëbook correctly uses no-enumeration UI, that provider rejection is
  not shown to users

Fix applied:

- password reset requests now share a small helper for `/forgot-password` and
  Account reset requests
- business reset requests now use the customer-domain reset page while
  preserving `product=business`, because customer-domain recovery delivery has
  passed real-inbox QA and Supabase can return generic success even when a
  business-domain recovery email is not delivered
- if the customer-domain reset redirect is rejected, Mirëbook can still retry
  the business-domain reset page as a fallback
- `getCustomerAppUrl` now falls back to the required `NEXT_PUBLIC_APP_URL` when
  `NEXT_PUBLIC_CUSTOMER_APP_URL` is not present

Expected behaviour after fix:

- preferred path: business recovery email links to
  `https://mirebook.com/reset-password?product=business`
- fallback path: if the customer-domain reset redirect is rejected, the recovery
  email may link to
  `https://business.mirebook.com/reset-password?product=business`
- either path should still update the password and route the business user back
  toward Mirëbook Business login/dashboard

Required retest:

- repeat business real-inbox password recovery after deploy
- confirm a recovery email arrives
- confirm the reset link opens `/reset-password?product=business`
- set a new password, confirm old password fails, and confirm the new password
  logs the business user into `/dashboard`
- if the email still does not arrive, recheck Supabase Auth allowed redirects
  for both `https://business.mirebook.com/**` and `https://mirebook.com/**`

Retest after stable callback:

- Supabase Auth logs showed `mail.send` success for the `web-library.net`
  business recovery attempt
- the disposable `web-library.net` inbox did not surface the delivered recovery
  email
- a normal real inbox received the business recovery email
- the recovery link opened successfully at
  `https://mirebook.com/reset-password?product=business`
- the reset page showed business-aware copy, including "Mirëbook Business
  security"
- new-password and confirm-password fields were visible
- no raw Supabase/provider error appeared

Conclusion:

- this is no longer an app redirect construction issue
- this is no longer a Supabase Auth send issue for normal inboxes
- the failed `web-library.net` run was a disposable-inbox deliverability issue
- do not add an app-level password reset bypass

Supabase checks completed:

- Authentication logs showed recovery request success and `mail.send` success
- Auth user record: confirm the email identity is present, not banned, not
  deleted/soft-deleted and has the expected email provider identity
- URL Configuration: confirm Site URL is `https://mirebook.com` and Redirect
  URLs include `https://mirebook.com/**` and
  `https://business.mirebook.com/**`
- Email Templates: confirm the recovery/reset template still includes the
  Supabase recovery link variable and was not edited into a dead/static link

Final password-change QA:

- submitted the final business password change from the verified recovery page
- old password failed with `Invalid login credentials`
- new password logged the business user into
  `https://business.mirebook.com/dashboard`
- no raw Supabase/provider error appeared

Operational note:

- consider disposable inboxes unreliable for final auth delivery QA

Launch decision:

- business recovery link delivery and reset-page routing are no longer blocking
  when tested with a normal inbox
- business password recovery completion is PASS
- stricter email-confirmation staging should still use normal inboxes, not
  disposable test inboxes

## Batch 11E Transactional Email Activation Prep

Goal:

- make Mirëbook application emails production-ready before launch while keeping
  Supabase Auth emails, booking logic, staff linking, RLS and billing writes
  unchanged

App-side changes:

- booking emails now use role-appropriate app links:
  - customers open `mirebook.com`
  - business owners open `business.mirebook.com`
  - staff open the staff workspace on the business app
- staff invite emails now use the business app invite route when
  `NEXT_PUBLIC_BUSINESS_APP_URL` is configured
- customer-cancelled bookings now also request a customer receipt email instead
  of only notifying the business
- assigned staff now receive lifecycle change emails for completed bookings as
  well as confirmed, cancelled and declined bookings
- completed booking email copy now uses completed-appointment wording for
  staff/business recipients instead of confirmed-booking copy
- the reminder endpoint accepts both `REMINDER_CRON_SECRET` and Vercel's
  standard `CRON_SECRET`
- `.env.example` documents `CRON_SECRET` as the Vercel Cron-compatible reminder
  secret

Production environment switch:

- set `EMAIL_PROVIDER=resend`
- set `RESEND_API_KEY`
- set `EMAIL_FROM_ADDRESS` to a verified Resend sender, preferably a
  Mirëbook-owned domain sender
- set `EMAIL_REPLY_TO` to a monitored inbox
- set `SUPPORT_ADMIN_EMAIL` to the operator/support inbox
- keep `NEXT_PUBLIC_APP_URL=https://mirebook.com`
- keep `NEXT_PUBLIC_CUSTOMER_APP_URL=https://mirebook.com`
- keep `NEXT_PUBLIC_BUSINESS_APP_URL=https://business.mirebook.com`
- set `REMINDER_CRON_SECRET`
- if scheduling reminders through Vercel Cron, also set `CRON_SECRET` to the
  same value

Current email coverage:

- Supabase Auth owns signup confirmation, recovery and verification emails
- Mirëbook/Resend owns staff invites, booking created/status emails,
  customer-cancel receipts, support receipts/admin alerts and appointment
  reminder delivery
- booking and support actions remain successful even if email delivery fails;
  in-app notifications/support remain authoritative

Reminder scheduler note:

- `/api/email/reminders` is ready for protected scheduled invocation
- no `vercel.json` cron schedule was added in this batch because reminder
  frequency depends on the Vercel plan
- professional reminder coverage should run hourly with `CRON_SECRET`; if the
  project is on a Vercel plan limited to daily cron, schedule design should be
  adjusted deliberately rather than silently missing most appointment times

QA required after Vercel env update:

- create a request-mode booking and confirm customer + business emails
- create an instant booking and confirm customer + business + assigned staff
  emails
- accept, decline, cancel and complete bookings and confirm role-specific
  lifecycle emails
- create a manual business appointment and confirm customer + staff emails
- create a customer-cancelled booking and confirm customer receipt + business +
  staff cancellation emails where recipients exist
- create a staff invite and confirm the staff receives an invite email whose
  link opens the secure token acceptance flow
- create support tickets as customer/business/staff and confirm requester
  receipt plus operator alert when `SUPPORT_ADMIN_EMAIL` is configured
- call `/api/email/reminders` with the configured secret and confirm delivery
  only for due confirmed bookings

## Batch 11F Professional Email Template Polish

Goal:

- make Mirëbook transactional emails feel production-ready while keeping the
  same Resend adapter, recipient rules, preferences and in-app authoritative
  record behaviour

Implemented:

- added branded HTML email bodies with a dark Mirëbook header, concise title,
  clear action button, structured detail rows and small footer copy
- kept plain-text fallbacks for every transactional email
- covered booking lifecycle emails for customer, business and staff recipients
- covered appointment reminder emails
- covered secure staff invite emails
- covered support requester/admin/reply emails
- escaped dynamic values before injecting them into HTML

Notes:

- no React Email dependency was added; the current implementation uses safe
  inline HTML strings and the existing Resend HTTPS adapter
- Supabase Auth emails remain configured in Supabase, not in this repo
- templates are English-only for launch and should be localized later if email
  language preference becomes launch-critical

## Batch 11G Transactional Email Production QA Follow-Up

Production QA after Resend setup found:

- staff invite email did not arrive, and the UI showed the manual invite-link
  fallback
- customer instant-booking confirmation email did not arrive
- assigned staff booking email did not arrive
- owner booking email did not arrive in the checked owner inbox
- in-app booking state still worked across customer, business calendar, business
  inbox and staff calendar

Follow-up applied:

- public booking creation now waits for the transactional-email API request
  before redirecting to booking confirmation, reducing the chance that the
  browser cancels the request during navigation
- staff invite fallback copy now distinguishes "email could not be sent" from a
  successful email send and still provides the secure manual invite link
- assigned staff booking notifications are now created server-side from the
  transactional email route, using the private staff user id already loaded on
  the server instead of exposing staff account ids to public booking pages

Still required in Vercel/Resend before this is considered pass:

- confirm `EMAIL_PROVIDER=resend` is set in Production
- confirm `RESEND_API_KEY` is set in Production
- confirm `EMAIL_FROM_ADDRESS` uses a Resend-verified sender domain
- redeploy Production after environment changes
- check Vercel runtime logs for email configuration warnings or Resend provider
  errors
- check the Resend Emails dashboard for accepted, failed or rejected deliveries

Real inbox QA with Gmail aliases confirmed staff invite, customer booking,
business owner booking and staff assignment emails arrived. Resend showed Gmail
delivery while disposable `web-library.net` recipients stayed at sent/delayed,
so that domain should not be used as the final launch email-delivery signal.
