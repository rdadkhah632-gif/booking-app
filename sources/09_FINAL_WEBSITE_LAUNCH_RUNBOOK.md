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
- Manual appointment customer-claim real-inbox QA: PASS.
- Reminder dry-run, real delivery and duplicate-prevention QA: PASS.
- Supabase confirmation/recovery email localization: dashboard-managed and not
  yet proven as per-recipient EN/SQ.
- Application transactional email templates and recipient-locale selection:
  PASS for EN/SQ, including real Albanian Resend delivery.

## Static Launch Asset And Header Audit

The 14 July static production audit found and corrected two launch-facing
issues that were not visible in normal booking QA:

- `public/manifest.json` contained an obsolete Slotly manifest followed by the
  Mirëbook manifest, making the file invalid JSON
- the declared favicon, 192px icon and 512px icon returned `404`

The manifest is now one valid Mirëbook document and the declared browser,
Apple touch and manifest icons use a single Mirëbook mark. Basic non-breaking
browser hardening headers are also configured globally:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

The default `X-Powered-By` framework disclosure is disabled.
Pages without route-specific metadata now use `Mirëbook` as the browser title
instead of displaying the raw domain.

The final translation audit also restored the English entries used by shared
account loading, save and linked-business states; their Albanian counterparts
were already present.

No content security policy was added in this batch because introducing one
without a dedicated Supabase, Stripe and Next.js browser-flow test could break
launch behavior. HTTPS/HSTS remains provided by Vercel.

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

### Production Result — 15 July 2026

The controlled production run passed the complete reminder gate:

- dry run returned HTTP `200`, `dryRun: true`, provider `resend` and strategy
  `daily_10_to_38_hours`
- both due linked-customer appointments were already processed, with no
  missing recipient or unlinked guest booking
- the controlled booking had exactly one `customer_24h` delivery row with
  status `sent`
- Resend recorded exactly one delivered Albanian reminder with the correct
  business, service, staff, local appointment time and customer-domain CTA
- a repeated live request returned `sent: 0` and `skippedDuplicate: 2`
- Booking confirmation, My Bookings, business Calendar and business Inbox
  remained consistent with no duplicate appointment or reminder

One already-processed `@test.com` fixture also fell inside the due window. The
unique delivery constraint prevented any duplicate send. Remove or move old
future reminder fixtures during launch data housekeeping; do not add a broad
email-domain filter to production reminder logic.

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

Production QA on 13 July 2026 confirmed that a manual appointment survived the
verification return, appeared once on Booking confirmation and appeared once
in My Bookings. It also found that the claimed customer did not receive the
matching in-app notification.

The follow-up implementation now returns the exact rows linked during the
claim and creates one status-appropriate customer notification for each newly
claimed booking. Existing notification rows are checked first, and subsequent
booking loads do not re-claim the same row, so the backfill is idempotent for
the claim flow. Booking creation, status and customer-isolation rules were not
changed.

Focused production retest passed on 13 July 2026:

- the appointment claim link stayed on the customer domain and preserved the
  booking ID through registration and email verification
- Booking confirmation, My Bookings and Notifications each showed the claimed
  appointment exactly once
- two refreshes of My Bookings and Notifications created no duplicate rows
- the notification action returned to the same booking ID
- a different verified customer could not view the appointment or its details

The manual appointment claim lifecycle is therefore launch-ready.

## Albanian Launch Localization Follow-Up

The 13 July EN/SQ smoke found correct Albanian marketplace copy but reproduced
English document language metadata, English-formatted dates, an English My
Bookings loading fallback and two English staff Inbox labels.

The follow-up implementation:

- synchronizes the document `lang` attribute with the active `en` or `sq`
  locale
- uses deterministic Albanian month and weekday names on the public booking,
  confirmation, reschedule, My Bookings, customer notification, business
  Today/Calendar and staff Today/Calendar/Notifications surfaces instead of
  relying on inconsistent browser locale data
- translates booking status, unavailable-day guidance, staff-selection copy
  and inaccessible/not-found states on the customer reschedule and
  confirmation routes
- refreshes the staff shell's derived workspace label when the saved locale
  loads
- adds the missing Albanian My Bookings loading copy
- replaces the remaining staff Inbox labels with `Njoftimet`

Application booking, reminder, support and staff-invite email templates already
contain complete Albanian copy and choose locale from the relevant customer,
owner or staff profile. Real-inbox QA is still required to prove one Albanian
subject/body delivery after deployment. Supabase Auth confirmation and recovery
templates remain dashboard-managed and should stay bilingual unless a separate
localized Auth email-hook project is approved.

Real-inbox evidence on 14 July confirmed the Albanian booking email body,
labels and customer CTA. It also exposed that email appointment times were
being formatted in UTC rather than the business timezone. Booking update and
reminder templates now receive the business timezone and display the local
appointment time with a short zone marker, with `Europe/London` as the same
safe fallback used by the booking platform. A focused real-inbox retest should
confirm that the controlled 10:00 BST appointment is displayed as 10:00 rather
than 09:00 UTC.

Focused QA already confirmed `html lang="sq"`, Albanian My Bookings loading
copy and `Njoftimet` navigation. After this date/copy follow-up is deployed,
retest one SQ customer booking/confirmation/reschedule flow, business
Today/Calendar and staff Today/Calendar/Notifications. The remaining email
check requires either inbox access or the captured subject/body and Resend
delivery detail; it cannot be inferred from browser UI alone.

## Regional Display Refinement

The grouped launch-refinement pass now uses each business's saved currency and
timezone throughout the active customer and owner surfaces:

- public service prices, Booking confirmation and My Bookings
- Services setup/preview and Team service assignments
- customer appointment history and completed-value summaries
- Today appointment dates, day matching and Calendar deep links
- the optional Analytics route and reusable booking/value components

GBP, EUR, ALL and legacy USD values use one locale-aware formatter rather than
page-specific symbols. Albanian date formatting now honors an explicitly
provided business timezone while retaining Mirëbook's deterministic Albanian
month, weekday and 24-hour time style.

The same pass added explicit button behavior to active non-submit controls,
improved language-selector semantics and restored complete EN/SQ translation
key parity. It changes presentation only: no booking, availability, auth, RLS,
staff-linking, notification-generation or billing-write behavior was changed.

Local production build, whitespace validation, button-semantic audit and
translation parity checks pass. Hold production QA until this grouped batch is
deployed; then verify one GBP, one EUR and one ALL service across the public
profile, confirmation, My Bookings, Services, Team and customer history.

## Final Cross-Role Visual Refinement

A final desktop and mobile inspection against Mirëbook's compact operating
principles found a small group of presentation issues rather than another
structural redesign need. The grouped follow-up:

- separates the Staff Today next-appointment label, customer and date so they
  cannot concatenate, and makes its count strip wrap safely
- keeps Staff Inbox filters compact on mobile instead of stacking three large
  equal-priority buttons
- gives the Explore search and clear actions an unambiguous full-width mobile
  row
- balances the signed-in customer mobile navigation while keeping Logout as a
  visible top-level action
- formats business Inbox appointment and update dates in the selected English
  or Albanian locale

Calendar, guided Setup, Account, public booking cards and the overall theme
were intentionally left structurally unchanged because their current versions
passed the visual inspection. This pass changes presentation only and does not
alter booking, availability, notification-generation, auth, RLS, staff-linking
or billing behavior.

## Final Release Order

1. Commit and deploy the latest website build.
2. Marketplace cleanup and empty-state QA are complete.
3. Manual appointment claim notification and cross-account QA are complete.
4. Reminder dry-run and controlled delivery/deduplication QA are complete.
5. EN/SQ interface and application transactional-email smoke are complete.
6. Remove or move future QA reminder fixtures from the launch monitoring
   window.
7. Publish the first reviewed genuine business.
8. Run one final customer booking against that genuine listing.

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
