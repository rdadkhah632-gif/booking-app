# Mirebook Project Context

Mirebook is a multi-tenant booking SaaS platform built with Next.js and Supabase.

Target users:

- customers booking services
- staff delivering services
- business owners managing services, staff and bookings
- platform admin

Launch geography/product direction:

- initial focus includes Albania and the UK
- international expansion should remain possible
- English and Albanian language support are important

Product model:

- customers discover businesses and book appointments
- businesses manage profiles, services, staff, availability and bookings
- staff can see assigned bookings and manage staff availability where allowed
- business subscription billing is separate from the customer booking journey
- customer booking should not require a Mirebook checkout step during the current stage

Core product loop:

1. A business creates a profile.
2. The business adds services.
3. The business links or creates staff.
4. Staff/business availability is configured.
5. A customer discovers the business.
6. The customer selects a service, staff preference and time.
7. A booking is created as either pending approval or confirmed, depending on business settings.
8. Customer, business and staff users can see the right booking status and next action.

Important code areas:

- public marketplace: `src/pages/explore/index.tsx`
- public business profile: `src/pages/explore/[businessId].tsx`
- direct booking page: `src/pages/book/[businessId].tsx`
- customer bookings: `src/pages/my-bookings.tsx`
- business booking manager: `src/pages/dashboard/bookings.tsx`
- staff workspace: `src/pages/staff/index.tsx`, `src/pages/staff/calendar.tsx`, `src/pages/staff/availability.tsx`
- business setup: `src/pages/dashboard/businesses.tsx`, `src/pages/dashboard/services.tsx`, `src/pages/dashboard/staff.tsx`, `src/pages/dashboard/availability.tsx`, `src/pages/dashboard/settings.tsx`
- notifications/action centre: `src/pages/notifications.tsx`, `src/pages/dashboard/notifications.tsx`, `src/pages/staff/notifications.tsx`
- account and capabilities: `src/pages/account.tsx`, `src/lib/accountCapabilities.ts`
- translations: `src/lib/i18n/en.ts`, `src/lib/i18n/sq.ts`

General quality bar:

- keep role and access behavior clear
- keep booking states understandable
- keep public booking free of billing confusion
- keep visible text translatable
- prefer small, testable changes over broad rewrites

