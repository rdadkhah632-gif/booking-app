# Mirëbook Business iOS

Native SwiftUI scaffold for the Mirëbook business/staff operations app.

## Backend Configuration

Tracked defaults live in `Config/Base.xcconfig`. Local simulator values should
live in `Config/Local.xcconfig`, which is git-ignored.

Generate the local config from the repo `.env.local` with:

```sh
scripts/ios-config-from-env.sh
```

The native app expects:

- `MIREBOOK_API_BASE_URL`: Mirëbook web/API origin, usually
  `NEXT_PUBLIC_APP_URL`
- `MIREBOOK_SUPABASE_URL`: public Supabase project URL
- `MIREBOOK_SUPABASE_ANON_KEY`: public Supabase anon key

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
