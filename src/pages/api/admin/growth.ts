import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type AnalyticsEventRow = {
  id: string;
  event_name: string;
  route: string;
  locale: "en" | "sq";
  entity_type?: "directory_place" | "business" | null;
  entity_id?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  device_category: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  role?: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  business_id?: string | null;
  status?: string | null;
  created_at: string;
};

const VALID_DAY_RANGES = new Set([7, 30, 90]);

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function isMissingAnalyticsSchema(error: { code?: string | null } | null) {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code || "");
}

async function requireAdmin(request: NextApiRequest) {
  const token = bearerToken(request);
  if (!token) return null;

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_admin?: boolean | null }>();
  if (profileError || !profile?.is_admin) return null;
  return { supabase };
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = key(row);
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return counts;
}

function sortedCounts(counts: Map<string, number>, limit = 10) {
  return Array.from(counts, ([key, count]) => ({ key, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    )
    .slice(0, limit);
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      response.status(403).json({ error: "Admin access required." });
      return;
    }

    const requestedDays = Number(
      Array.isArray(request.query.days)
        ? request.query.days[0]
        : request.query.days,
    );
    const days = VALID_DAY_RANGES.has(requestedDays) ? requestedDays : 30;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startIso = start.toISOString();

    const [eventResult, profileResult, bookingResult] = await Promise.all([
      admin.supabase
        .from("site_analytics_events")
        .select(
          "id, event_name, route, locale, entity_type, entity_id, source, medium, campaign, device_category, metadata, created_at",
        )
        .gte("created_at", startIso)
        .order("created_at", { ascending: false })
        .limit(10_000)
        .returns<AnalyticsEventRow[]>(),
      admin.supabase
        .from("profiles")
        .select("id, role, created_at")
        .gte("created_at", startIso)
        .order("created_at", { ascending: false })
        .limit(5_000)
        .returns<ProfileRow[]>(),
      admin.supabase
        .from("bookings")
        .select("id, business_id, status, created_at")
        .gte("created_at", startIso)
        .order("created_at", { ascending: false })
        .limit(10_000)
        .returns<BookingRow[]>(),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (bookingResult.error) throw bookingResult.error;

    const storageAvailable = !eventResult.error;
    if (eventResult.error && !isMissingAnalyticsSchema(eventResult.error)) {
      throw eventResult.error;
    }

    const events = storageAvailable ? eventResult.data || [] : [];
    const profiles = profileResult.data || [];
    const bookings = bookingResult.data || [];
    const staffResult = profiles.length
      ? await admin.supabase
          .from("staff_members")
          .select("user_id")
          .in(
            "user_id",
            profiles.map((profile) => profile.id),
          )
          .not("user_id", "is", null)
      : { data: [] as Array<{ user_id?: string | null }>, error: null };
    if (staffResult.error) throw staffResult.error;
    const staffLinkedIds = new Set(
      (staffResult.data || []).flatMap((row) =>
        row.user_id ? [row.user_id] : [],
      ),
    );

    const contentViews = events.filter((event) =>
      ["place_viewed", "business_viewed"].includes(event.event_name),
    );
    const entityIds = Array.from(
      new Set(
        contentViews.flatMap((event) =>
          event.entity_id ? [event.entity_id] : [],
        ),
      ),
    );
    const placeIds = Array.from(
      new Set(
        contentViews.flatMap((event) =>
          event.entity_type === "directory_place" && event.entity_id
            ? [event.entity_id]
            : [],
        ),
      ),
    );
    const businessIds = Array.from(
      new Set(
        contentViews.flatMap((event) =>
          event.entity_type === "business" && event.entity_id
            ? [event.entity_id]
            : [],
        ),
      ),
    );

    const [placesResult, businessesResult] = await Promise.all([
      placeIds.length
        ? admin.supabase
            .from("directory_places")
            .select("id, name, public_name")
            .in("id", placeIds)
        : Promise.resolve({ data: [], error: null }),
      businessIds.length
        ? admin.supabase
            .from("businesses")
            .select("id, name")
            .in("id", businessIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (placesResult.error) throw placesResult.error;
    if (businessesResult.error) throw businessesResult.error;

    const entityLabels = new Map<string, string>();
    (placesResult.data || []).forEach((place) => {
      entityLabels.set(
        place.id,
        place.public_name || place.name || "Local place",
      );
    });
    (businessesResult.data || []).forEach((business) => {
      entityLabels.set(business.id, business.name || "Business");
    });
    entityIds.forEach((id) => {
      if (!entityLabels.has(id)) entityLabels.set(id, "Unavailable listing");
    });

    const eventCounts = countBy(events, (event) => event.event_name);
    const sourceCounts = countBy(events, (event) => event.source || "direct");
    const campaignCounts = countBy(
      events.filter((event) => event.campaign),
      (event) => `${event.source || "direct"}|${event.campaign}`,
    );
    const deviceCounts = countBy(events, (event) => event.device_category);
    const contentCounts = countBy(
      contentViews.filter((event) => event.entity_id),
      (event) => `${event.entity_type}:${event.entity_id}`,
    );

    const dailyMap = new Map<
      string,
      { date: string; interactions: number; accounts: number; bookings: number }
    >();
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      const key = date.toISOString().slice(0, 10);
      dailyMap.set(key, {
        date: key,
        interactions: 0,
        accounts: 0,
        bookings: 0,
      });
    }
    events.forEach((event) => {
      const row = dailyMap.get(dateKey(event.created_at));
      if (row) row.interactions += 1;
    });
    profiles.forEach((profile) => {
      const row = dailyMap.get(dateKey(profile.created_at));
      if (row) row.accounts += 1;
    });
    bookings.forEach((booking) => {
      const row = dailyMap.get(dateKey(booking.created_at));
      if (row) row.bookings += 1;
    });

    response.status(200).json({
      days,
      generatedAt: new Date().toISOString(),
      storageAvailable,
      sqlRequired: storageAvailable ? null : "39_launch_site_analytics.sql",
      summary: {
        interactions: events.length,
        contentViews: contentViews.length,
        accountCreated: profiles.length,
        bookingCreated: bookings.length,
        claimInterest: eventCounts.get("place_claim_opened") || 0,
        registrationStarted: eventCounts.get("registration_submitted") || 0,
        bookingStarted: eventCounts.get("booking_started") || 0,
      },
      accountRoles: {
        customer: profiles.filter((profile) => profile.role !== "business")
          .length,
        business: profiles.filter((profile) => profile.role === "business")
          .length,
        staffLinked: profiles.filter((profile) =>
          staffLinkedIds.has(profile.id),
        ).length,
      },
      events: sortedCounts(eventCounts, 20),
      sources: sortedCounts(sourceCounts, 12),
      campaigns: sortedCounts(campaignCounts, 12).map((item) => {
        const [source, campaign] = item.key.split("|");
        return { source, campaign, count: item.count };
      }),
      devices: sortedCounts(deviceCounts, 4),
      topContent: sortedCounts(contentCounts, 12).map((item) => {
        const separator = item.key.indexOf(":");
        const entityType = item.key.slice(0, separator);
        const entityId = item.key.slice(separator + 1);
        return {
          entityType,
          entityId,
          label: entityLabels.get(entityId) || "Unavailable listing",
          count: item.count,
        };
      }),
      daily: Array.from(dailyMap.values()),
      recent: events.slice(0, 20).map((event) => ({
        id: event.id,
        eventName: event.event_name,
        route: event.route,
        source: event.source || null,
        campaign: event.campaign || null,
        deviceCategory: event.device_category,
        entityType: event.entity_type || null,
        entityId: event.entity_id || null,
        entityLabel: event.entity_id
          ? entityLabels.get(event.entity_id) || "Unavailable listing"
          : null,
        createdAt: event.created_at,
      })),
    });
  } catch (error) {
    console.error("[admin-growth] Analytics load failed", error);
    response.status(500).json({ error: "Could not load growth analytics." });
  }
}
