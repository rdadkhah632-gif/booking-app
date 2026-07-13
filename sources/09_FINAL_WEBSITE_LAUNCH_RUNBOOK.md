# Mirëbook Final Website Launch Runbook

Status: prepared on 13 July 2026.

This runbook covers the remaining production operations after the Stage 9 code,
RLS, role-boundary and interface closure passes. It does not authorize schema,
RLS, booking lifecycle, billing or production-data changes beyond the explicit
manual steps below.

## Current Launch Position

- Stage 9 auth, RLS and role-boundary closure: PASS.
- Customer, business, staff and admin production smoke: PASS.
- Resend delivery to normal Gmail inboxes: PASS.
- Business and staff Calendar operational QA: PASS.
- Marketplace production-data cleanup: COMPLETE.
- Manual appointment customer-claim real-inbox QA: REQUIRED.
- Reminder dry-run, real delivery and duplicate-prevention QA: REQUIRED before
  reminders are advertised as active.
- Supabase confirmation/recovery email localization: dashboard-managed and not
  yet proven as per-recipient EN/SQ.

## Marketplace Data Audit

Production audit result:

- 63 businesses matched the read-only `Likely QA / test` filter.
- 25 of those businesses were published.
- `Likely live businesses` returned zero records.
- Every matched row displayed the `Likely QA` badge.
- No confirmed false positives or obvious missed QA businesses were found.
- No records were edited, unpublished or deleted during the audit.

Production cleanup result on 13 July 2026:

- all 25 approved QA businesses below were unpublished individually through
  `/admin/businesses`
- no business, booking, service, staff or account record was deleted
- the admin source of truth changed from `25 published · 38 draft` to
  `0 published · 63 draft`
- anonymous `/explore` showed `No businesses are live yet` and the polished
  gradual-launch empty-state message
- no QA business remained publicly visible

### Published QA Businesses To Unpublish

These records were unpublished individually through `/admin/businesses` and
retained as regression fixtures.

1. Stage 9 Setup QA 1783422558521 — qa-business-setup-20260707-1783422558521@test.com
2. QA Gmail Reset Studio 20260706-gmail-378352 — moolyjakob@gmail.com
3. QA Mirebook Studio 20260704 — qa-owner-20260704-2@test.com
4. Stage 9 Boundary Studio 1783105564761 — stage9-role-owner-1783105564761@test.com
5. Stage 9 Boundary Studio 1783105486597 — stage9-role-owner-1783105486597@test.com
6. Browser QA Studio 1783104131566 — browserqa-owner-1783104131566@test.com
7. SQL17 Boundary Studio 1783103766590 — stage9-sql17-owner-1783103766590@test.com
8. SQL16 Boundary Studio 1783103242500 — stage9-sql16-owner-1783103242500@test.com
9. SQL16b Probe 1783103161218 — sql16b-probe-owner-1783103161218@test.com
10. SQL16 Probe 1783036750083 — sql16-probe-owner-1783036750083@test.com
11. SQL15 Probe 1783036588185 — sql15-probe-owner-1783036588185@test.com
12. SQL15 Boundary Studio 1783036561838 — stage9-sql15-owner-1783036561838@test.com
13. SQL14b Boundary Studio 1783034731662 — stage9-sql14b-owner-1783034731662@test.com
14. SQL14 Boundary Studio 1783034667564 — stage9-sql14-owner-1783034667564@test.com
15. SQL13 Boundary Studio 1783033979972 — stage9-sql13-owner-1783033979972@test.com
16. Stage 9 Broad Audit Business — stage9-broad-owner-1783032388557@test.com
17. QA Linked Staff Studio — mirebook.qa.staff.1782937596288@test.com
18. Live QA Flow Studio — live-business-1782579674372@test.com
19. Mint Flow QA Studio — business-flow-1782564978564@test.com
20. QA Test Salon — qa.business1@example.com
21. QA Incomplete Biz — qa_owner_05@test.com
22. Business 2 — slotlybusiness6@test.com
23. QA Test Studio Final — slotlybusiness2@test.com
24. Amirs hair shop — slotlybusiness2@test.com
25. Test shop — slotlybusiness2@test.com

Completed cleanup verification:

1. The retained records remain available as drafts in Admin Businesses.
2. Published and published-QA counts are zero.
3. `/explore` does not expose any of the names above.
4. Explore shows the polished launch empty state rather than an error or raw
   zero counters.

Publish the first genuine business only after its profile, service, staff,
hours and public preview have been reviewed.

## Transactional Email Language Audit

Mirëbook application emails have complete EN/SQ template copy. Locale selection
currently works as follows:

| Email                    | Language source                              | Fallback |
| ------------------------ | -------------------------------------------- | -------- |
| Customer booking updates | Customer profile `preferred_language`        | EN       |
| Business booking updates | Owner profile `preferred_language`           | EN       |
| Staff booking updates    | Linked staff profile `preferred_language`    | EN       |
| Appointment reminders    | Customer profile `preferred_language`        | EN       |
| Staff invitations        | Existing invited profile, then owner profile | EN       |
| Support requester emails | Requester profile `preferred_language`       | EN       |
| Support operator alerts  | Operator language fixed to EN                | EN       |

An unregistered manual-booking customer has no language profile, so their first
appointment email safely falls back to English. After the booking is claimed by
a customer account, future messages use that account's preferred language.

Supabase Auth owns signup confirmation and password-recovery emails. Signup
metadata already includes `preferred_language`, but the dashboard templates are
outside this repository and dynamic EN/SQ rendering has not been production
verified. The safest launch option is a concise bilingual EN/SQ confirmation
and recovery template until a localized Auth email hook is deliberately built
and QA'd.

## Reminder Cron QA

The production schedule in `vercel.json` runs daily at `08:00 UTC`. The route
selects confirmed linked-customer appointments 10–38 hours ahead. Overlapping
daily windows are safe because the delivery table has a unique booking/user/
reminder constraint.

Do not paste either cron secret into a QA chat, screenshot or source file.

### Dry Run

Run from the repository on a trusted machine:

```bash
set -a
source .env.local
set +a
curl -sS \
  -H "Authorization: Bearer ${REMINDER_CRON_SECRET:-$CRON_SECRET}" \
  "https://business.mirebook.com/api/email/reminders?dryRun=1"
```

Expected:

- `dryRun: true`
- `windowStrategy: "daily_10_to_38_hours"`
- `provider: "resend"`
- `sent: 0`
- no email and no new reminder-delivery record

If `eligibleLinkedCustomers` is zero, create one confirmed booking for a linked
customer inside the returned window and rerun the dry run.

### Real Delivery And Deduplication

Only proceed when the dry-run due list is understood. The live call processes
every eligible booking in the window, not only the newly created QA booking.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${REMINDER_CRON_SECRET:-$CRON_SECRET}" \
  "https://business.mirebook.com/api/email/reminders"
```

Confirm the expected Gmail/Resend delivery, then repeat the same POST once.
The second response should report `sent: 0` for the tested booking and increase
`skippedDuplicate`.

## Manual Appointment Customer Claim QA

Required real-inbox flow:

1. A business creates a confirmed manual appointment using a real email address
   that has never had a Mirëbook account.
2. Confirm the customer email arrives and opens the customer domain.
3. Open the link logged out or in a private browser window.
4. Confirm only customer sign-in/account creation is promoted.
5. Register with the exact appointment email and verify the email address.
6. Confirm the verification return preserves the booking ID.
7. Confirm the appointment appears in Booking confirmation, My Bookings and
   customer Notifications without creating a duplicate booking.
8. Confirm a different customer account cannot see or claim the appointment.

The code audit passed: claiming is limited to unlinked bookings with an exact
normalized email match, and business/staff/admin identities are excluded.

## Final Release Order

1. Commit and deploy the latest website build.
2. Marketplace cleanup and empty-state QA are complete.
3. Run manual appointment customer-claim QA.
4. Run reminder dry-run and controlled delivery/deduplication QA.
5. Run one English and one Albanian smoke across registration, booking email,
   Calendar and account language persistence.
6. Publish the first reviewed genuine business.
7. Run one final customer booking against that genuine listing.

## UI Position And Next Batch

No active P0/P1/P2 interface finding remains from the latest targeted business,
staff and customer retests. The next UI batch should therefore be a narrow
`real-data and Albanian launch polish` pass, not another broad redesign:

- inspect Explore after QA listings are hidden
- inspect the first genuine business profile with realistic names and services
- run EN/SQ desktop and mobile smoke on public, customer, business and staff
- correct only reproduced clipping, mixed-language, empty-state or density bugs

Business cover photos, ratings/reviews, customer-side light-theme redesign and
profile-photo upload are product-expansion items. They require storage, trust or
design decisions and are not launch blockers for the current booking product.
