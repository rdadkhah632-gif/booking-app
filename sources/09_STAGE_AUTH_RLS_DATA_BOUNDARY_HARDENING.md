# Stage 9 - Auth, RLS and Data Boundary Hardening

Status: active.

Batch 1 audit status: complete.

Batch 2 status: implemented and build-validated.

Batch 3 status: implemented and build-validated.

Batch 4 status: implemented and build-validated.

Batch 5 status: implemented and build-validated.

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

## Current RLS Draft

Draft SQL:

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

These drafts are not applied automatically. Stage 9 drafts 09, 10, 11 and 12
were manually applied in Supabase and QA'd in controlled passes. Draft 13 is
required because the broad-read audit found legacy policies still allowing
authenticated non-admin broad reads on several operational tables. Draft 14 is
required after SQL 13 because public booking creation needs a security-definer
validator now that customers cannot directly read raw setup tables. Draft 15 is
required after SQL 14 because related booking/request notification inserts need
a security-definer validator for the same reason. Draft 16 is required after
SQL 15 because helper RPC checks passed but notification inserts were still
blocked by an older restrictive notification policy. Draft 17 is required after
SQL 16 because staff could still read booking request rows through an older
booking request policy.

Recommended SQL review order:

1. Confirm the new public occupancy endpoint is deployed.
2. Review and test `09_rls_bookings_boundary_draft.sql`.
3. QA public booking, My Bookings, business Calendar/Inbox and staff Calendar.
4. Review and test `10_rls_requests_notifications_support_draft.sql`.
5. QA customer notifications, business Inbox, support ticket creation, support
   replies and admin support inbox.
6. Confirm the new public marketplace/profile endpoints are deployed.
7. Review and test `11_rls_marketplace_public_data_boundary_draft.sql`.
8. QA Explore, public business pages, owner preview, business setup, services,
   team, working hours and staff availability.
9. Deploy the support reply/admin profile server-route batch.
10. Review and test `12_rls_profiles_support_tightening_draft.sql`.
11. QA Account save, language preference save, registration/profile creation,
    admin user profile edits, admin role/admin access changes, user support
    replies and admin support replies.
12. Repeat broad-read checks as anonymous, customer, staff, business owner and
    admin.

## Remaining High-Risk Tables

`businesses`, `services`, `staff_members`, `staff_services`, `availability`,
`staff_availability`, `booking_requests`, `notifications`, `support_messages`
and `support_replies` now have applied Stage 9 drafts. They should remain
treated as high-risk until final role-based broad-read QA is complete across
anonymous, customer, staff, business owner and admin sessions.

Admin-only and server-only tables still need separate review.

## Safe Next Batch

1. Commit the SQL 13 policy-cleanup draft and Stage 9 notes.
2. Run SQL 13 in Supabase SQL editor.
3. Repeat broad-read checks as anonymous, customer, staff, business owner and
   admin.
4. QA public marketplace/profile endpoints and role workspaces.
5. Review admin-only/server-only tables for the next hardening batch.

Do not harden all tables blindly in one production pass. RLS should move in
small verified batches so working booking, staff and business flows are not
broken without an easy rollback point.
