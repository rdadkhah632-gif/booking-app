import { track } from "@vercel/analytics";

export type SiteAnalyticsEventName =
  | "home_search_submitted"
  | "home_suggestion_selected"
  | "home_map_opened"
  | "business_entry_opened"
  | "explore_search_submitted"
  | "explore_suggestion_selected"
  | "explore_view_changed"
  | "explore_kind_changed"
  | "explore_map_result_selected"
  | "explore_more_results"
  | "explore_location_requested"
  | "explore_location_resolved"
  | "place_viewed"
  | "place_website_opened"
  | "place_directions_opened"
  | "place_claim_opened"
  | "business_viewed"
  | "booking_started"
  | "registration_viewed"
  | "registration_submitted";

type AnalyticsMetadataValue = string | number | boolean | null;

type AnalyticsOptions = {
  entityType?: "directory_place" | "business";
  entityId?: string;
  locale?: "en" | "sq";
  metadata?: Record<string, AnalyticsMetadataValue | undefined>;
};

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
};

const ATTRIBUTION_KEY = "mirebook.analytics.attribution.v1";

function cleanAttributionValue(value: string | null) {
  const clean = (value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || undefined;
}

function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const incoming: Attribution = {
    source: cleanAttributionValue(
      params.get("utm_source") || params.get("source"),
    ),
    medium: cleanAttributionValue(
      params.get("utm_medium") || params.get("medium"),
    ),
    campaign: cleanAttributionValue(
      params.get("utm_campaign") || params.get("campaign"),
    ),
  };

  try {
    if (incoming.source || incoming.medium || incoming.campaign) {
      window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(incoming));
      return incoming;
    }

    const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Attribution;
    return {
      source: cleanAttributionValue(parsed.source || null),
      medium: cleanAttributionValue(parsed.medium || null),
      campaign: cleanAttributionValue(parsed.campaign || null),
    };
  } catch {
    return incoming;
  }
}

function analyticsAllowed() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const privacyNavigator = navigator as Navigator & {
    globalPrivacyControl?: boolean;
  };
  return navigator.doNotTrack !== "1" && !privacyNavigator.globalPrivacyControl;
}

function deviceCategory() {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth < 640) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

function analyticsRoute(pathname: string) {
  if (/^\/places\/[^/]+$/.test(pathname)) return "/places/[placeId]";
  if (/^\/explore\/[^/]+$/.test(pathname)) {
    return "/explore/[businessId]";
  }
  return pathname.slice(0, 180) || "/";
}

export function recordSiteEvent(
  eventName: SiteAnalyticsEventName,
  options: AnalyticsOptions = {},
) {
  if (!analyticsAllowed()) return;

  const attribution = readAttribution();
  const metadata = Object.fromEntries(
    Object.entries(options.metadata || {}).filter(
      ([, value]) => value !== undefined,
    ),
  ) as Record<string, AnalyticsMetadataValue>;
  const route = analyticsRoute(window.location.pathname);
  const payload = {
    eventName,
    route,
    locale: options.locale,
    entityType: options.entityType,
    entityId: options.entityId,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    deviceCategory: deviceCategory(),
    metadata,
  };

  try {
    track(eventName, {
      route,
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(attribution.source ? { source: attribution.source } : {}),
      ...(attribution.campaign ? { campaign: attribution.campaign } : {}),
      ...metadata,
    });
  } catch {
    // First-party reporting below remains available when Vercel events are not.
  }

  void fetch("/api/public/analytics-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt a customer action.
  });
}
