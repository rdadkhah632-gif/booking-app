import type { NextApiRequest, NextApiResponse } from "next";
import {
  GeocodingError,
  renderBusinessLocationMap,
} from "@/lib/server/mapboxGeocoding";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = [
  "needs_review",
  "active",
  "hidden",
  "closed",
  "duplicate",
] as const;
const ACTIONS = [
  "approve",
  "hide",
  "close",
  "return_to_review",
  "mark_duplicate",
] as const;
const CATEGORY_KEYS = [
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
] as const;
const LAUNCH_CITIES = [
  "Tiranë",
  "Durrës",
  "Vlorë",
  "Sarandë",
  "Shkodër",
  "Korçë",
  "Himarë",
  "Berat",
  "Gjirokastër",
] as const;

type DirectoryStatus = (typeof STATUSES)[number];
type DirectoryAction = (typeof ACTIONS)[number];

type CoverageGroupRow = {
  city: string;
  category_key: string;
  listing_status: DirectoryStatus;
  place_count: number | string;
};

type CoverageItem = {
  key: string;
  approved: number;
  needsReview: number;
};

type DirectoryPlaceRow = {
  id: string;
  source: string;
  source_place_id: string;
  source_version?: string | null;
  name: string;
  category_key: string;
  source_category?: string | null;
  source_category_ids?: string[] | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code: string;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  social_urls?: string[] | null;
  source_confidence?: number | null;
  source_operating_status?: string | null;
  source_updated_at?: string | null;
  source_attribution?: Record<string, unknown> | null;
  source_fingerprint?: string | null;
  listing_status: DirectoryStatus;
  claim_status: string;
  linked_business_id?: string | null;
  duplicate_of_place_id?: string | null;
  first_imported_at: string;
  last_imported_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  directory_place_id: string;
  reviewer_id: string;
  action: DirectoryAction;
  from_status: DirectoryStatus;
  to_status: DirectoryStatus;
  notes?: string | null;
  duplicate_of_place_id?: string | null;
  source_fingerprint?: string | null;
  created_at: string;
};

type ReviewBody = {
  placeId?: unknown;
  action?: unknown;
  notes?: unknown;
  duplicateOfPlaceId?: unknown;
};

const PLACE_SELECT = `
  id,
  source,
  source_place_id,
  source_version,
  name,
  category_key,
  source_category,
  source_category_ids,
  description,
  address,
  city,
  region,
  country_code,
  postcode,
  phone,
  website,
  email,
  social_urls,
  source_confidence,
  source_operating_status,
  source_updated_at,
  source_attribution,
  source_fingerprint,
  listing_status,
  claim_status,
  linked_business_id,
  duplicate_of_place_id,
  first_imported_at,
  last_imported_at,
  updated_at
`;

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function cleanQuery(value: string | string[] | undefined, maxLength = 100) {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" ? text.trim().slice(0, maxLength) : "";
}

function cleanBodyText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

function isMissingDirectorySchema(error: { code?: string } | null) {
  return ["42P01", "42703", "PGRST202", "PGRST205"].includes(
    error?.code || "",
  );
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
  return { supabase, user };
}

async function statusCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const results = await Promise.all(
    STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .from("directory_places")
        .select("id", { count: "exact", head: true })
        .eq("listing_status", status);
      if (error) throw error;
      return [status, count || 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<DirectoryStatus, number>;
}

async function launchCoverage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .rpc("mirebook_admin_directory_launch_coverage")
    .returns<CoverageGroupRow[]>();

  if (error) {
    if (isMissingDirectorySchema(error)) {
      return {
        available: false,
        cities: [] as CoverageItem[],
        categories: [] as CoverageItem[],
      };
    }
    throw error;
  }

  const rows = (Array.isArray(data) ? data : []) as CoverageGroupRow[];
  const totalsFor = (
    key: string,
    matches: (row: CoverageGroupRow) => boolean,
  ): CoverageItem => {
    let approved = 0;
    let needsReview = 0;
    for (const row of rows) {
      if (!matches(row)) continue;
      const count = Number(row.place_count) || 0;
      if (row.listing_status === "active") approved += count;
      if (row.listing_status === "needs_review") needsReview += count;
    }
    return { key, approved, needsReview };
  };

  return {
    available: true,
    cities: LAUNCH_CITIES.map((city) =>
      totalsFor(
        city,
        (row) => row.city.localeCompare(city, "sq", { sensitivity: "base" }) === 0,
      ),
    ),
    categories: CATEGORY_KEYS.map((category) =>
      totalsFor(category, (row) => row.category_key === category),
    ),
  };
}

async function handleList(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const requestedStatus = cleanQuery(request.query.status, 30);
  const status = STATUSES.includes(requestedStatus as DirectoryStatus)
    ? (requestedStatus as DirectoryStatus)
    : "needs_review";
  const category = cleanQuery(request.query.category, 50);
  const city = cleanQuery(request.query.city, 80);
  const search = cleanQuery(request.query.search, 100).replace(/[%_]/g, "");
  const limit = numberQuery(request.query.limit, 50, 1, 100);
  const offset = numberQuery(request.query.offset, 0, 0, 10_000);

  let query = admin.supabase
    .from("directory_places")
    .select(PLACE_SELECT, { count: "exact" })
    .eq("listing_status", status);

  if (category && CATEGORY_KEYS.includes(category as (typeof CATEGORY_KEYS)[number])) {
    query = query.eq("category_key", category);
  }
  if (city) query = query.ilike("city", city);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error, count } = await query
    .order("source_confidence", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1)
    .returns<DirectoryPlaceRow[]>();

  if (error) {
    if (isMissingDirectorySchema(error)) {
      response.status(503).json({
        error: "Directory review storage is not ready.",
        sqlRequired: [
          "19_albania_discovery_directory_foundation.sql",
          "20_directory_review_and_public_api_foundation.sql",
        ],
      });
      return;
    }
    throw error;
  }

  const places = data || [];
  const placeIds = places.map((place) => place.id);
  let latestReviewByPlace: Record<string, ReviewRow> = {};

  if (placeIds.length > 0) {
    const { data: reviews, error: reviewError } = await admin.supabase
      .from("directory_place_reviews")
      .select(
        "id, directory_place_id, reviewer_id, action, from_status, to_status, notes, duplicate_of_place_id, source_fingerprint, created_at",
      )
      .in("directory_place_id", placeIds)
      .order("created_at", { ascending: false })
      .returns<ReviewRow[]>();
    if (reviewError) throw reviewError;

    latestReviewByPlace = (reviews || []).reduce<Record<string, ReviewRow>>(
      (map, review) => {
        if (!map[review.directory_place_id]) {
          map[review.directory_place_id] = review;
        }
        return map;
      },
      {},
    );
  }

  const [counts, coverage] = await Promise.all([
    statusCounts(admin.supabase),
    launchCoverage(admin.supabase),
  ]);

  response.status(200).json({
    places: places.map((place) => ({
      ...place,
      latestReview: latestReviewByPlace[place.id] || null,
    })),
    counts,
    coverage,
    pagination: { total: count || 0, limit, offset },
  });
}

async function handleMapPreview(
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
  placeId: string,
) {
  const { data, error } = await admin.supabase
    .rpc("mirebook_admin_directory_place_location", { p_place_id: placeId })
    .maybeSingle<{ latitude: number; longitude: number }>();

  if (error) {
    if (isMissingDirectorySchema(error)) {
      response.status(503).json({ error: "Directory map review is not ready." });
      return;
    }
    throw error;
  }
  if (!data) {
    response.status(404).json({ error: "Directory place was not found." });
    return;
  }

  try {
    const mapImage = await renderBusinessLocationMap({
      providerPlaceId: placeId,
      formattedAddress: "Directory review location",
      latitude: data.latitude,
      longitude: data.longitude,
      precision: "approximate",
    });
    response.status(200).json({ mapImage });
  } catch (error) {
    if (error instanceof GeocodingError) {
      response.status(503).json({ error: error.message });
      return;
    }
    throw error;
  }
}

async function handleAction(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const body = (request.body || {}) as ReviewBody;
  const placeId = cleanBodyText(body.placeId, 50);
  const action = cleanBodyText(body.action, 30);
  const notes = cleanBodyText(body.notes, 1_000);
  const duplicateOfPlaceId = cleanBodyText(body.duplicateOfPlaceId, 50);

  if (!UUID_PATTERN.test(placeId)) {
    response.status(400).json({ error: "A valid directory place is required." });
    return;
  }

  if (action === "map_preview") {
    await handleMapPreview(response, admin, placeId);
    return;
  }

  if (!ACTIONS.includes(action as DirectoryAction)) {
    response.status(400).json({ error: "Review action is invalid." });
    return;
  }
  const reviewAction = action as DirectoryAction;

  if (["hide", "close", "mark_duplicate"].includes(reviewAction) && !notes) {
    response.status(400).json({ error: "Add a short review note." });
    return;
  }
  if (reviewAction === "mark_duplicate" && !UUID_PATTERN.test(duplicateOfPlaceId)) {
    response.status(400).json({ error: "Choose a canonical directory place." });
    return;
  }

  const { data, error } = await admin.supabase.rpc(
    "mirebook_review_directory_place",
    {
      p_place_id: placeId,
      p_action: reviewAction,
      p_reviewer_id: admin.user.id,
      p_notes: notes || null,
      p_duplicate_of_place_id:
        reviewAction === "mark_duplicate" ? duplicateOfPlaceId : null,
    },
  );

  if (error) {
    if (isMissingDirectorySchema(error)) {
      response.status(503).json({ error: "Directory review SQL is not ready." });
      return;
    }
    if (["22023", "23505", "42501", "P0002"].includes(error.code || "")) {
      response.status(error.code === "P0002" ? 404 : 400).json({
        error: error.message || "The review action could not be completed.",
      });
      return;
    }
    throw error;
  }

  response.status(200).json({ ok: true, review: data?.[0] || null });
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (!request.method || !["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  response.setHeader("Cache-Control", "no-store");

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      response.status(403).json({ error: "Admin access required." });
      return;
    }

    if (request.method === "GET") {
      await handleList(request, response, admin);
      return;
    }

    await handleAction(request, response, admin);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[admin-directory] Request failed", code);
    response.status(500).json({ error: "Directory review is temporarily unavailable." });
  }
}
