# Stage 2 - Booking Flow, Business Setup and Operational Readiness

Status: active.

Stage 2 answers:

> Can a real customer book a real service with the right staff, and can the business, staff and customer manage that booking clearly?

## Goal

Make the full booking loop feel reliable and launchable.

## Pass Standard

A customer can discover a business, understand services, select the correct staff/time, place a booking, and customer/business/staff users can all see the correct booking status and next action without confusion.

Stage 2 must protect Stage 1 foundations.

## Scope

Stage 2 focuses on:

1. Public booking journey
2. Service, staff and availability connection
3. Booking request vs instant confirmation clarity
4. Business booking manager
5. Customer My Bookings
6. Staff assigned bookings and schedule
7. Booking status consistency
8. Notifications/action centre basics
9. Business setup readiness accuracy
10. Final translation cleanup on booking and business pages

## Non-Goals

Do not add customer checkout, deposits or payment collection.

Do not change billing unless explicitly requested.

Do not rewrite Stage 1 role/capability/account logic unless a verified Stage 2 bug requires it.

Do not turn Stage 2 into broad visual polish. Focus on the booking loop and operational clarity.

## Suggested Batch 1 - Booking Flow Map

Before editing booking behavior, map the current files and flow for:

- Explore marketplace
- Public business page
- Service selection
- Staff selection
- Availability slot generation
- Booking creation
- Booking confirmation
- Customer My Bookings
- Business booking manager
- Staff assigned bookings and schedule
- Notifications and pending actions

Output:

- relevant file list
- current booking state flow
- current risks
- first recommended implementation batch

## Suggested Batch 2 - Request vs Instant Confirmation Clarity

Make it clear to customers whether they are:

- sending a booking request that needs business approval
- creating an instantly confirmed booking

The same distinction should be visible later in:

- booking confirmation
- customer My Bookings
- business booking manager
- staff views where relevant
- notifications/action centre where relevant

## Suggested Batch 3 - Service/Staff/Availability Integrity

Check that booking choices stay consistent:

- selected service is active and belongs to the business
- selected staff member is active and belongs to the business
- selected staff can perform the selected service where service assignment exists
- selected time is generated from configured availability
- unavailable or stale slots do not create confusing bookings

## Suggested Batch 4 - Operational Views

Improve clarity and consistency in:

- business booking manager
- customer My Bookings
- staff schedule/assigned bookings
- booking status badges and next-action language
- pending approvals and reschedule requests

## Batch 2/3 Closure - Booking Flow Clarity and Operational Status Guidance

Status: pass with minor copy follow-up completed.

Confirmed:

- Request-mode booking flow works.
- Instant-confirmation booking flow works.
- Customer confirmation page matches status.
- Business pending bookings show Needs approval and correct actions.
- Staff pending bookings show Awaiting business approval with no staff action required.
- Empty/unavailable states are clearer.
- Stage 1 role/account routing did not regress.

Minor follow-up completed:

- Customer My Bookings summary card used older "Waiting approval" wording.
- Replaced the customer-facing summary/stat wording with "Request sent" to match Batch 1 wording.

Next recommended batch:

Stage 2 Batch 4 - Booking action reliability and stale-slot handling.

Plan before editing. This batch is more technical and should test or harden:

- selected slot becomes unavailable before submit
- overlapping booking prevention messaging
- accept/decline success/failure feedback
- booking state updates after business action
- customer/staff/business views refreshing correctly
- duplicate notification/action surfaces

## Batch 4 Closure - Booking Reliability, Stale Slot Handling and Action Feedback

Status: pass.

Confirmed:

- Public booking submit re-checks selected service, staff/service assignment and current pending/confirmed booking overlap before insert.
- Stale selected slots are blocked with "This time is no longer available. Please choose another time."
- Booking submit ignores duplicate clicks while loading.
- Business accept, decline, cancel and complete actions ignore duplicate clicks while processing.
- Business actions now guard against stale status changes and show a clear refresh message when the booking is no longer actionable.
- Declined bookings now remain distinct from cancelled bookings across business/customer/staff touched views.
- Customer history includes declined bookings and customer lifecycle copy explains declined requests.
- Staff history includes declined bookings so declined requests are not treated as active upcoming work.
- Customer and business notification surfaces touched in this batch include declined booking updates consistently.
- Stage 1 role/account/routing logic was not changed.
- `npm run build` passed.

Follow-up QA:

- Manually simulate two sessions selecting the same slot and confirm the first stale submit is blocked cleanly.
- Confirm the database accepts `declined` as a booking status in production data.
- Re-test business accept/decline from both dashboard bookings and dashboard notifications.

## Suggested Batch 5 - Business Setup Readiness

Make readiness checks accurately reflect whether a business can be booked:

- profile exists and is publishable
- at least one active service exists
- at least one active staff member exists
- availability is configured
- booking approval/instant-confirmation settings are understandable
- public profile messaging matches actual readiness

## Suggested Batch 6 - Translation Cleanup

Clean visible hardcoded English on booking/business pages touched during Stage 2.

Use:

```ts
t("key", "Fallback text")
```

Add keys to both:

- `src/lib/i18n/en.ts`
- `src/lib/i18n/sq.ts`

## QA Standard

Each implementation batch should end with:

- formatting on changed files where available
- `npm run build`
- changed file summary
- behavior summary
- risk/follow-up QA notes

Manual QA should include:

- customer can browse marketplace
- customer can open a business profile
- customer can select service/staff/time
- customer understands request vs instant confirmation before submitting
- customer can see booking in My Bookings
- business can see and act on booking
- staff can see assigned booking where applicable
- booking status labels are consistent across views
- EN/SQ text does not visibly regress on touched pages
