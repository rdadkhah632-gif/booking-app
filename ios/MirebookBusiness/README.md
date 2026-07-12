# Mirëbook Business iOS

Native SwiftUI scaffold for the Mirëbook business/staff operations app.

## Backend Configuration

Tracked defaults live in `Config/Base.xcconfig`. Local simulator values should
live in `Config/Local.xcconfig`, which is git-ignored.

Generate the local config from the repo `.env.local` with:

```sh
scripts/ios-config-from-env.sh
```

For day-to-day simulator testing, start the local backend with:

```sh
scripts/ios-test-backend.sh
```

This regenerates `Config/Local.xcconfig` first, then starts the existing
Next.js web/API server. Keep that terminal running while the native app is open.

The native app expects:

- `MIREBOOK_API_BASE_URL`: Mirëbook web/API origin, usually
  `NEXT_PUBLIC_APP_URL`
- `MIREBOOK_SUPABASE_URL`: public Supabase project URL
- `MIREBOOK_SUPABASE_ANON_KEY`: public Supabase anon key

Simulator defaults can be overridden without changing the web app by adding
`MIREBOOK_IOS_API_BASE_URL`, `MIREBOOK_IOS_SUPABASE_URL` or
`MIREBOOK_IOS_SUPABASE_ANON_KEY` to `.env.local`.

For a production-backed iOS test build, generate the local Xcode config with:

```sh
MIREBOOK_IOS_API_BASE_URL=https://business.mirebook.com scripts/ios-config-from-env.sh
```

Use this for existing-account login, Calendar and Inbox QA. Existing-account
login tolerates `POST /api/app/complete-registration` being absent in
production. Native sign-up still requires that route to be deployed; until then,
use existing QA business/staff accounts.

Do not put service-role keys, Stripe secrets or production-only secrets into the
iOS config.

## Current QA Target

The configured simulator build can launch to the login screen. Authenticated QA
needs a safe business-owner or staff test account for the selected backend
target, then the app can validate:

- native sign-in
- `/api/app/session-context`
- `/api/app/calendar`
- `/api/app/inbox`
