import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const EVENT_NAMES = new Set([
  "home_search_submitted",
  "home_suggestion_selected",
  "home_map_opened",
  "business_entry_opened",
  "explore_search_submitted",
  "explore_suggestion_selected",
  "explore_view_changed",
  "explore_kind_changed",
  "explore_map_result_selected",
  "explore_more_results",
  "explore_location_requested",
  "explore_location_resolved",
  "place_viewed",
  "place_website_opened",
  "place_directions_opened",
  "place_claim_opened",
  "business_viewed",
  "booking_started",
  "registration_viewed",
  "registration_submitted",
]);
const METADATA_KEYS = new Set([
  "surface",
  "selection",
  "queryPresent",
  "city",
  "category",
  "kind",
  "view",
  "resultType",
  "locationOutcome",
  "role",
  "authenticated",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalyticsBody = {
  eventName?: unknown;
  route?: unknown;
  locale?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  deviceCategory?: unknown;
  metadata?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanAttribution(value: unknown) {
  const clean = cleanText(value, 80)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || null;
}

function cleanRoute(value: unknown) {
  const route = cleanText(value, 180);
  if (!route.startsWith("/") || route.startsWith("//")) return "/";
  return route;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const metadata: Record<string, string | number | boolean> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (!METADATA_KEYS.has(key)) return;
    if (typeof item === "boolean" || typeof item === "number") {
      metadata[key] = item;
      return;
    }
    if (typeof item !== "string") return;
    const clean = item.trim().slice(0, 80);
    if (!clean || /@|\b\d{7,}\b/.test(clean)) return;
    metadata[key] = clean;
  });
  return metadata;
}

function trustedBrowserRequest(request: NextApiRequest) {
  const fetchSite = String(request.headers["sec-fetch-site"] || "");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const origin = String(request.headers.origin || "");
  const host = String(
    request.headers["x-forwarded-host"] || request.headers.host || "",
  );
  if (!origin || !host) return process.env.NODE_ENV !== "production";

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isAutomatedAgent(request: NextApiRequest) {
  const userAgent = String(request.headers["user-agent"] || "");
  return /bot|crawler|spider|headless|lighthouse|pagespeed/i.test(userAgent);
}

function isMissingAnalyticsSchema(error: { code?: string | null } | null) {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code || "");
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!trustedBrowserRequest(request)) {
    response.status(403).json({ error: "Analytics request rejected." });
    return;
  }

  if (isAutomatedAgent(request)) {
    response.status(202).json({ stored: false });
    return;
  }

  const body = (request.body || {}) as AnalyticsBody;
  const eventName = cleanText(body.eventName, 80);
  if (!EVENT_NAMES.has(eventName)) {
    response.status(400).json({ error: "Unknown analytics event." });
    return;
  }

  const entityType = ["directory_place", "business"].includes(
    String(body.entityType || ""),
  )
    ? String(body.entityType)
    : null;
  const entityId = cleanText(body.entityId, 40);
  const safeEntityId =
    entityType && UUID_PATTERN.test(entityId) ? entityId : null;
  const locale = body.locale === "sq" ? "sq" : "en";
  const deviceCategory = ["mobile", "tablet", "desktop"].includes(
    String(body.deviceCategory || ""),
  )
    ? String(body.deviceCategory)
    : "unknown";

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("site_analytics_events").insert({
      event_name: eventName,
      route: cleanRoute(body.route),
      locale,
      entity_type: entityType,
      entity_id: safeEntityId,
      source: cleanAttribution(body.source),
      medium: cleanAttribution(body.medium),
      campaign: cleanAttribution(body.campaign),
      device_category: deviceCategory,
      metadata: cleanMetadata(body.metadata),
    });

    if (error) {
      if (isMissingAnalyticsSchema(error)) {
        response.status(202).json({ stored: false });
        return;
      }
      throw error;
    }

    response.status(202).json({ stored: true });
  } catch (error) {
    console.error("[public-analytics-event] Event insert failed", error);
    response.status(202).json({ stored: false });
  }
}
