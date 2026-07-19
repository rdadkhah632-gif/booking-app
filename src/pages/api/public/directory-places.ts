import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const CATEGORY_KEYS = new Set([
  "beauty_grooming",
  "dental_health",
  "wellness_fitness",
  "events",
  "learning_lessons",
  "tours_activities",
  "rentals",
  "attractions",
  "food_drink",
  "lodging",
]);

type PublicDirectoryRow = {
  id: string;
  name: string;
  category_key: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code: string;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  claim_status: string;
  linked_business_id?: string | null;
  source: string;
  latitude: number;
  longitude: number;
  distance_meters?: number | null;
  total_count: number;
};

function cleanQuery(value: string | string[] | undefined, maxLength: number) {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" ? text.trim().slice(0, maxLength) : "";
}

function numberQuery(
  value: string | string[] | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function coordinateQuery(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== "string" || !text.trim()) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function missingDirectoryFunction(code?: string) {
  return ["42P01", "42703", "PGRST202", "PGRST205"].includes(code || "");
}

function haversineMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const fromRadians = radians(fromLatitude);
  const toRadians = radians(toLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromRadians) *
      Math.cos(toRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function attributionFor(source: string) {
  if (source === "overture") {
    return {
      label: "Overture Maps Foundation and listed data providers",
      url: "https://docs.overturemaps.org/attribution/",
    };
  }

  return {
    label: "Directory data source",
    url: null,
  };
}

function safeWebsite(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const query = cleanQuery(request.query.q, 100).replace(/[%_]/g, "");
  const requestedCategory = cleanQuery(request.query.category, 50);
  const category = CATEGORY_KEYS.has(requestedCategory)
    ? requestedCategory
    : "";
  const city = cleanQuery(request.query.city, 80);
  const limit = numberQuery(request.query.limit, 50, 1, 100);
  const offset = numberQuery(request.query.offset, 0, 0, 10_000);
  const latitude = coordinateQuery(request.query.latitude);
  const longitude = coordinateQuery(request.query.longitude);
  const radiusKm = numberQuery(request.query.radiusKm, 0, 0, 1_000);
  const hasLocation = latitude !== null || longitude !== null;

  if (
    hasLocation &&
    (latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180)
  ) {
    response.status(400).json({ error: "A valid latitude and longitude are required." });
    return;
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    response.status(503).json({ error: "Directory discovery is not configured." });
    return;
  }

  try {
    let { data, error } = await supabase.rpc(
      "mirebook_public_directory_discovery",
      {
        p_query: query || null,
        p_category: category || null,
        p_city: city || null,
        p_latitude: latitude,
        p_longitude: longitude,
        p_radius_meters: radiusKm > 0 ? radiusKm * 1_000 : null,
        p_limit: limit,
        p_offset: offset,
      },
    );

    if (error && missingDirectoryFunction(error.code)) {
      const fallback = await supabase.rpc("mirebook_public_directory_places", {
        p_query: query || null,
        p_category: category || null,
        p_city: city || null,
        p_limit: limit,
        p_offset: offset,
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (missingDirectoryFunction(error.code)) {
        response.status(503).json({
          error: "Directory discovery is not ready.",
        });
        return;
      }
      if (error.code === "22023") {
        response.status(400).json({ error: "Location search is invalid." });
        return;
      }
      throw error;
    }

    let rows = Array.isArray(data)
      ? (data as unknown as PublicDirectoryRow[])
      : [];
    if (latitude !== null && longitude !== null) {
      rows = rows
        .map((row) => ({
          ...row,
          distance_meters:
            typeof row.distance_meters === "number"
              ? row.distance_meters
              : haversineMeters(
                  latitude,
                  longitude,
                  row.latitude,
                  row.longitude,
                ),
        }))
        .sort(
          (left, right) =>
            (left.distance_meters || Number.POSITIVE_INFINITY) -
            (right.distance_meters || Number.POSITIVE_INFINITY),
        );
    }
    response.setHeader(
      "Cache-Control",
      hasLocation
        ? "private, no-store"
        : "public, s-maxage=300, stale-while-revalidate=600",
    );
    response.status(200).json({
      places: rows.map((row) => ({
        id: row.id,
        resultType: "directory_place",
        name: row.name,
        categoryKey: row.category_key,
        description: row.description || null,
        address: row.address || null,
        city: row.city || null,
        region: row.region || null,
        countryCode: row.country_code,
        postcode: row.postcode || null,
        phone: row.phone || null,
        website: safeWebsite(row.website),
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          precision: "approximately_10m",
        },
        bookable: false,
        claimable: row.claim_status === "unclaimed",
        linkedBusinessId: row.linked_business_id || null,
        distanceMeters:
          typeof row.distance_meters === "number"
            ? Math.round(row.distance_meters)
            : null,
        attribution: attributionFor(row.source),
      })),
      pagination: {
        total: Number(rows[0]?.total_count || 0),
        limit,
        offset,
      },
      nearbyApplied: latitude !== null && longitude !== null,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[public-directory] Could not load directory", code);
    response.status(500).json({ error: "Could not load directory places." });
  }
}
