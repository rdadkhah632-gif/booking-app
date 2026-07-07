import { Locale } from "@/lib/i18n";

export type RegionDefaults = {
  timezone: string;
  country: string;
  currency: string;
  locale: Locale;
};

export const DEFAULT_REGION: RegionDefaults = {
  timezone: "Europe/London",
  country: "United Kingdom",
  currency: "GBP",
  locale: "en",
};

function browserLocaleCode(): string {
  if (typeof navigator === "undefined") return "en-GB";
  return navigator.language || navigator.languages?.[0] || "en-GB";
}

export function detectRegionDefaults(): RegionDefaults {
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
      : "";
  const localeCode = browserLocaleCode().toLowerCase();

  if (
    timezone === "Europe/Tirane" ||
    localeCode.startsWith("sq") ||
    localeCode.includes("-al")
  ) {
    return {
      timezone: timezone || "Europe/Tirane",
      country: "Albania",
      currency: "ALL",
      locale: "sq",
    };
  }

  if (
    timezone === "Europe/Rome" ||
    timezone === "Europe/Paris" ||
    timezone === "Europe/Berlin" ||
    localeCode.startsWith("it") ||
    localeCode.startsWith("fr") ||
    localeCode.startsWith("de")
  ) {
    return {
      timezone: timezone || "Europe/Rome",
      country: "Italy",
      currency: "EUR",
      locale: "en",
    };
  }

  if (
    timezone === "Europe/London" ||
    localeCode.includes("-gb") ||
    localeCode.includes("-uk")
  ) {
    return {
      timezone: timezone || DEFAULT_REGION.timezone,
      country: "United Kingdom",
      currency: "GBP",
      locale: "en",
    };
  }

  return {
    ...DEFAULT_REGION,
    timezone: timezone || DEFAULT_REGION.timezone,
  };
}
