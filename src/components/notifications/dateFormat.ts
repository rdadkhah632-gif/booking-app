import { formatLocalizedDate, Locale } from "@/lib/i18n";

export function formatCustomerDateTime(
  value?: string | null,
  locale: Locale = "en",
) {
  if (!value) return "";

  return formatLocalizedDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCustomerNotificationText(value?: string | null) {
  return (value || "").replace(/\b(\d{1,2}:\d{2}):\d{2}\b/g, "$1");
}
