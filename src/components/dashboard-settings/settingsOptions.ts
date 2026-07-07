import { Business } from "./dashboardSettingsTypes";

export const INTERVAL_OPTIONS = [15, 30, 45, 60];

export const NOTICE_OPTIONS = [
  { label: "No minimum notice", value: 0 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "12 hours", value: 720 },
  { label: "24 hours", value: 1440 },
  { label: "48 hours", value: 2880 },
];

export const ADVANCE_OPTIONS = [
  { label: "2 weeks", value: 14 },
  { label: "1 month", value: 30 },
  { label: "2 months", value: 60 },
  { label: "3 months", value: 90 },
  { label: "6 months", value: 180 },
];

export const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60];

export const TIMEZONE_OPTIONS = [
  "Europe/London",
  "Europe/Tirane",
  "Europe/Rome",
  "Europe/Paris",
  "Europe/Berlin",
];

export const CURRENCY_OPTIONS = [
  { label: "Lek (ALL)", value: "ALL" },
  { label: "Euro (EUR)", value: "EUR" },
  { label: "Pound (GBP)", value: "GBP" },
  { label: "Dollar (USD)", value: "USD" },
];

export function defaultSettings(business: Business): Business {
  return {
    ...business,
    auto_accept_bookings: business.auto_accept_bookings ?? false,
    booking_interval_minutes: business.booking_interval_minutes ?? 30,
    min_notice_minutes: business.min_notice_minutes ?? 120,
    max_advance_days: business.max_advance_days ?? 60,
    buffer_before_minutes: business.buffer_before_minutes ?? 0,
    buffer_after_minutes: business.buffer_after_minutes ?? 0,
    cancellation_policy:
      business.cancellation_policy ||
      "Customers can cancel by contacting the business. Online cancellation rules will be added soon.",
    reschedule_policy:
      business.reschedule_policy ||
      "Customers can request a new time from My Bookings. The business can accept or decline the request.",
    timezone: business.timezone || "Europe/London",
    currency: business.currency || "GBP",
  };
}
