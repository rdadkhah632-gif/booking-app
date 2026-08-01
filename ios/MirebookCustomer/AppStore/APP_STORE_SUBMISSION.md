# Mirëbook Customer App Store Submission

This file is the repository-side handoff for the first customer iOS submission.
It does not replace the final legal, App Store Connect or paid-team checks.

## App identity

- App name: `Mirëbook`
- Suggested subtitle: `Discover and book nearby`
- Bundle ID: `com.mirebook.ios.customer`
- Version: `1.0.0`
- Build: `3`
- Primary category: Lifestyle
- Minimum iOS version: iOS 17
- Encryption answer: the app uses only exempt system HTTPS encryption;
  `ITSAppUsesNonExemptEncryption` is `false`
- Privacy policy: `https://mirebook.com/privacy`
- Support: `https://mirebook.com/support`
- Terms: `https://mirebook.com/terms`

Confirm the app name and subtitle are available in App Store Connect before
using them as final metadata.

## Review notes template

Replace every bracketed value before submission.

```text
Mirëbook is a guest-first service discovery and appointment-booking app.

Guest review:
1. Launch the app. Explore is available without an account.
2. Open [PUBLISHED QA BUSINESS NAME].
3. Review its services, staff and location.

Account review:
Email: [ACTIVE REVIEW CUSTOMER EMAIL]
Password: [ACTIVE REVIEW CUSTOMER PASSWORD]

The review account has a future booking and one in-app notification. Use the
Bookings tab to inspect the appointment. Use Account > Notifications to open
the notification and return to booking detail.

Account deletion:
Account > Delete account > enter the exact review-account email > Delete my
account. The request is queued for completion within 30 days. Do not submit the
deletion request until the rest of the account-only review is complete.

Location is requested only after the reviewer taps "Use my location". City and
text search remain available if permission is denied.

Notification permission is requested only after the signed-in reviewer enables
push notifications in Account > Notification preferences.

Customer appointments are not a payment or checkout flow. Mirëbook does not
collect payment-card details or sell a customer subscription in this app.
Business subscription billing is a separate product.

Backend/API access required: https://mirebook.com
Support contact during review: [MONITORED REVIEW CONTACT]
```

## App Review readiness

- [x] `com.mirebook.ios.customer` is registered to Apple team `42V884483P`.
- [x] Push Notifications is enabled for the App ID and distribution profile.
- [ ] A signed Release archive validates in Xcode Organizer.
- [ ] A published, bookable QA business is visible to guests.
- [ ] The review customer is verified, active and has known credentials.
- [ ] The review customer has a future booking and notification.
- [ ] The production API is available for the entire review window.
- [ ] Account-deletion queue RLS and idempotency QA have passed.
- [ ] An operator owns the 30-day deletion-completion process and confirmation
  email.
- [ ] Privacy policy describes account, booking, location, notification and
  deletion handling.
- [ ] Screenshots show real native guest and signed-in functionality.
- [ ] App Store icon, screenshots and metadata contain no test account data.
- [ ] Physical-device location, push, VoiceOver and poor-network QA have passed.

Apple requires an active demo account or a fully featured demo mode for
account-only behavior, and review notes must describe new functionality
specifically:
`https://developer.apple.com/app-store/review/guidelines/`.

Apple's account-deletion guidance is recorded at:
`https://developer.apple.com/support/offering-account-deletion-in-your-app`.

## Archive sequence

1. In Apple Developer, confirm `com.mirebook.ios.customer` and Push
   Notifications.
2. In Xcode, select the `MirebookCustomer` scheme and `Any iOS Device`.
3. Confirm enrolled team `42V884483P`, automatic signing and Release
   configuration.
4. Increment `CURRENT_PROJECT_VERSION` for every uploaded build.
5. Run `Scripts/validate-release.sh`. It must pass the live production API
   contract check; do not upload when a required route is missing or returns a
   non-JSON response.
6. Choose Product > Archive.
7. In Organizer, run Validate App before distributing to TestFlight.

The repository can create an unsigned structural archive, but only an enrolled
Apple Developer Program team can create and validate the distributable signed
archive.

Current local signing check (1 August 2026): the paid-team Apple Development and
Apple Distribution identities are installed, the app target selects enrolled
team `42V884483P`, and Apple accepted the permanent
`com.mirebook.ios.customer` identifier. The generated store profile contains
the production Push entitlement. The final local export is signed by
`Apple Distribution: Reza Dadkhah (42V884483P)`; both its executable and
embedded profile contain `aps-environment=production`; `get-task-allow` is
false; and strict signature verification passes. Builds `1.0.0 (1)` and
`1.0.0 (2)` were uploaded successfully, and build 2 is assigned to the
`Internal QA` TestFlight group. Build `1.0.0 (3)` was uploaded successfully on
1 August 2026, completed processing and is assigned to `Internal QA`.

Production API release gate (added 1 August 2026):

- `npm run verify:customer-ios-production` probes every public and authenticated
  server route required by the native customer app without using credentials or
  changing data.
- Protected routes must return JSON `401` to the anonymous probe. A `404`, HTML
  response or accidental anonymous success fails the release gate.
- `Scripts/validate-release.sh` runs the production probe automatically, so an
  iOS release cannot pass repository validation against an incomplete backend.

Historical local-development follow-up (25 July 2026): Debug omitted the APNs
entitlement and Push preference, and automatic Personal Team signing succeeded
for the former `com.mirebook.customer` identity. That profile was for local
device testing only and is not the configuration used for archive/TestFlight.

The deterministic guest and customer fixtures are valid UI-test evidence, but
their `Mirëbook Test Studio` content must not be used in final App Store
screenshots. Capture the submission set from release-safe production or seeded
review data after signing is unblocked.
