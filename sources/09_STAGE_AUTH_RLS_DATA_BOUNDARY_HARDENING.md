# Stage 9 - Auth, RLS and Data Boundary Hardening

Status: active.

Batch 1 audit status: complete.

Batch 2 status: implemented and build-validated.

Batch 3 status: implemented and build-validated.

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

## Current RLS Draft

Draft SQL:

```text
sources/sql/09_rls_bookings_boundary_draft.sql
sources/sql/10_rls_requests_notifications_support_draft.sql
```

This draft is not applied automatically. It should be reviewed and tested in
Supabase/staging before production.

Recommended SQL review order:

1. Confirm the new public occupancy endpoint is deployed.
2. Review and test `09_rls_bookings_boundary_draft.sql`.
3. QA public booking, My Bookings, business Calendar/Inbox and staff Calendar.
4. Review and test `10_rls_requests_notifications_support_draft.sql`.
5. QA customer notifications, business Inbox, support ticket creation, support
   replies and admin support inbox.
6. Repeat broad-read checks as anonymous, customer, staff, business owner and
   admin.

## Remaining High-Risk Tables

After bookings, the next RLS passes should cover:

- `businesses`
- `services`
- `staff_members`
- `staff_services`
- `availability`
- `staff_availability`
- admin-only and server-only tables

`booking_requests`, `notifications`, `support_messages` and `support_replies`
now have a draft, but they should remain treated as high-risk until tested in
Supabase.

## Safe Next Batch

1. Build and smoke-test the new occupancy endpoint locally.
2. Verify public business booking still shows correct slots.
3. Verify booking submit still catches stale/occupied slots.
4. Review the `bookings` RLS draft against the live schema.
5. Apply the `bookings` RLS draft only in staging or during a controlled
   Supabase QA window.
6. Repeat live broad-read checks as anon/customer/staff/business/admin.

## Safe Next Batch After 2/3

The next large hardening pass should deal with marketplace/public data:

- `businesses`
- `services`
- `staff_members`
- `staff_services`
- `availability`
- `staff_availability`

The cleanest launch-safe approach is likely public-safe views or server
endpoints for marketplace/public profile data, because table-level public RLS on
`staff_members` can accidentally expose private staff fields if table grants are
too broad.

Do not harden all tables at once. RLS should move in small verified batches so
working booking, staff and business flows are not broken blindly.
