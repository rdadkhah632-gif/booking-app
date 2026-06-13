# Mirebook AI Coding Agent Instructions

This repository is the Mirebook booking SaaS platform.

Before making code changes, always read:

1. `/sources/00_PROJECT_CONTEXT.md`
2. `/sources/01_STAGE_ACCOUNT_ROLE_STAFF_BUSINESS_FOUNDATION.md`
3. `/sources/01_STAGE_1_CLOSURE_QA.md`
4. The current active stage document, currently:
   `/sources/06_STAGE_ONBOARDING_VERIFICATION_EMAIL_LAUNCH_READINESS.md`

## Current Status

Stage 1 is complete.

Stage 1 covered:

- account identity
- role and capability separation
- staff-business linking
- staff-intent and invited staff flows
- owner-as-staff handling
- account settings persistence
- language preference persistence
- basic route protection

Stage 2 is complete with accepted minor follow-ups.

Stage 3 is complete with tracked minor follow-ups.

Stage 4 is complete with tracked follow-ups.

Stage 5 is complete with tracked follow-ups.

Stage 6 is active.

Stage 6 focuses on:

- final UI organization and role-specific onboarding
- email verification and email notification foundations
- notification preferences and appointment reminders
- founding-business offer tracking
- final launch readiness

## Working Rules

Start each task by checking repository status.

Protect Stage 1 foundations. Do not alter account identity, role/capability logic, staff-business linking, route protection or language preference persistence unless the current task clearly requires it.

Customer booking must not become a payment or checkout flow during Stage 6. Business subscription billing remains separate from customer appointment payments.

Use small grouped changes. After grouped edits, run formatting on changed files when a formatter is available, then run the build.

Before final response:

- summarize changed files
- summarize behavior changed
- list test/build result
- list risks or follow-up QA needed

## Translation Rules

Do not hardcode visible English text.

Use the project translation wrapper/pattern, usually:

```ts
t("key", "Fallback text")
```

If adding user-facing text:

- add the English key to `src/lib/i18n/en.ts`
- add the Albanian key to `src/lib/i18n/sq.ts`
- avoid duplicate keys
- follow the existing translation-file style

## Regression Rules

Do not reopen Stage 1 unless a fresh regression appears.

Known non-blocking follow-ups from Stage 1:

- older mixed translation strings remain in some areas
- staff workspace layout still uses staff top-nav rather than the business-style sidebar
