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
const MEDIA_FILTERS = ["with_photo", "missing_photo"] as const;
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
type MediaFilter = (typeof MEDIA_FILTERS)[number];

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

type MediaCoverage = {
  available: boolean;
  total: number;
  withPhoto: number;
  missingPhoto: number;
  cities: MediaCoverageItem[];
  categories: MediaCoverageItem[];
  priority: MediaPriorityItem[];
};

type MediaCoverageItem = {
  key: string;
  total: number;
  withPhoto: number;
  missingPhoto: number;
};

type MediaPriorityReason =
  | "city_gap"
  | "category_gap"
  | "booking_category"
  | "contact_ready"
  | "high_confidence";

type MediaPriorityItem = {
  id: string;
  name: string;
  city: string;
  categoryKey: string;
  score: number;
  reasons: MediaPriorityReason[];
};

type MediaCoverageRow = {
  id: string;
  name: string;
  city?: string | null;
  category_key: string;
  image_url?: string | null;
  editorial_description_en?: string | null;
  editorial_description_sq?: string | null;
  phone?: string | null;
  website?: string | null;
  source_confidence?: number | null;
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
  editorial_description_en?: string | null;
  editorial_description_sq?: string | null;
  image_url?: string | null;
  image_alt_en?: string | null;
  image_alt_sq?: string | null;
  image_attribution_label?: string | null;
  image_attribution_url?: string | null;
  image_rights_note?: string | null;
  content_updated_by?: string | null;
  content_updated_at?: string | null;
  public_facts_reviewed?: boolean | null;
  public_name?: string | null;
  public_category_key?: string | null;
  public_address?: string | null;
  public_postcode?: string | null;
  public_phone?: string | null;
  public_website?: string | null;
  public_facts_source_url?: string | null;
  public_facts_note?: string | null;
  public_facts_updated_by?: string | null;
  public_facts_updated_at?: string | null;
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
  descriptionEn?: unknown;
  descriptionSq?: unknown;
  imageUrl?: unknown;
  imageAltEn?: unknown;
  imageAltSq?: unknown;
  imageAttributionLabel?: unknown;
  imageAttributionUrl?: unknown;
  imageRightsNote?: unknown;
  rightsConfirmed?: unknown;
  factsReviewed?: unknown;
  publicName?: unknown;
  publicCategoryKey?: unknown;
  publicAddress?: unknown;
  publicPostcode?: unknown;
  publicPhone?: unknown;
  publicWebsite?: unknown;
  publicFactsSourceUrl?: unknown;
  publicFactsNote?: unknown;
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

const CONTENT_SELECT = `
  id,
  editorial_description_en,
  editorial_description_sq,
  image_url,
  image_alt_en,
  image_alt_sq,
  image_attribution_label,
  image_attribution_url,
  image_rights_note,
  content_updated_by,
  content_updated_at
`;

const PUBLIC_FACTS_SELECT = `
  id,
  public_facts_reviewed,
  public_name,
  public_category_key,
  public_address,
  public_postcode,
  public_phone,
  public_website,
  public_facts_source_url,
  public_facts_note,
  public_facts_updated_by,
  public_facts_updated_at
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

function safeHttpsUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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
  return ["42P01", "42703", "PGRST202", "PGRST205"].includes(error?.code || "");
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
        (row) =>
          row.city.localeCompare(city, "sq", { sensitivity: "base" }) === 0,
      ),
    ),
    categories: CATEGORY_KEYS.map((category) =>
      totalsFor(category, (row) => row.category_key === category),
    ),
  };
}

async function approvedMediaCoverage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<MediaCoverage> {
  const { data, error } = await supabase
    .from("directory_places")
    .select(
      "id, name, city, category_key, image_url, editorial_description_en, editorial_description_sq, phone, website, source_confidence",
    )
    .eq("listing_status", "active")
    .returns<MediaCoverageRow[]>();

  if (error) {
    if (isMissingDirectorySchema(error)) {
      return {
        available: false,
        total: 0,
        withPhoto: 0,
        missingPhoto: 0,
        cities: [],
        categories: [],
        priority: [],
      };
    }
    throw error;
  }

  const rows = data || [];
  const coverageFor = (
    keys: string[],
    keyFor: (row: MediaCoverageRow) => string,
  ) =>
    keys.map<MediaCoverageItem>((key) => {
      const matchingRows = rows.filter((row) => keyFor(row) === key);
      const withPhoto = matchingRows.filter((row) => row.image_url).length;
      return {
        key,
        total: matchingRows.length,
        withPhoto,
        missingPhoto: matchingRows.length - withPhoto,
      };
    });

  const cityKeys = Array.from(
    new Set(rows.flatMap((row) => (row.city ? [row.city] : []))),
  ).sort((left, right) => left.localeCompare(right, "sq"));
  const cities = coverageFor(cityKeys, (row) => row.city || "");
  const categories = coverageFor(
    [...CATEGORY_KEYS],
    (row) => row.category_key,
  );
  const cityCoverage = Object.fromEntries(
    cities.map((item) => [item.key, item]),
  );
  const categoryCoverage = Object.fromEntries(
    categories.map((item) => [item.key, item]),
  );
  const appointmentFriendlyCategories = new Set([
    "beauty_grooming",
    "dental_health",
    "wellness_fitness",
    "learning_lessons",
    "tours_activities",
    "rentals",
    "events",
  ]);

  const ranked = rows
    .filter((row) => !row.image_url)
    .map((row) => {
      const city = row.city || "Albania";
      const cityItem = cityCoverage[city];
      const categoryItem = categoryCoverage[row.category_key];
      const cityGap = cityItem
        ? cityItem.missingPhoto / Math.max(1, cityItem.total)
        : 1;
      const categoryGap = categoryItem
        ? categoryItem.missingPhoto / Math.max(1, categoryItem.total)
        : 1;
      const reasons: MediaPriorityReason[] = [];

      if (!cityItem || cityItem.withPhoto === 0 || cityGap >= 0.8) {
        reasons.push("city_gap");
      }
      if (
        !categoryItem ||
        categoryItem.withPhoto === 0 ||
        categoryGap >= 0.8
      ) {
        reasons.push("category_gap");
      }
      if (appointmentFriendlyCategories.has(row.category_key)) {
        reasons.push("booking_category");
      }
      if (row.phone || row.website) reasons.push("contact_ready");
      if ((row.source_confidence || 0) >= 0.9) {
        reasons.push("high_confidence");
      }

      const score = Math.round(
        cityGap * 30 +
          categoryGap * 25 +
          (appointmentFriendlyCategories.has(row.category_key) ? 15 : 0) +
          (row.phone || row.website ? 10 : 0) +
          (row.editorial_description_en && row.editorial_description_sq
            ? 8
            : 0) +
          (row.source_confidence || 0) * 12,
      );

      return {
        id: row.id,
        name: row.name,
        city,
        categoryKey: row.category_key,
        score,
        reasons: reasons.slice(0, 3),
      } satisfies MediaPriorityItem;
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.name.localeCompare(right.name, "sq"),
    );

  const priority: MediaPriorityItem[] = [];
  const citySelections = new Map<string, number>();
  const categorySelections = new Map<string, number>();
  for (const place of ranked) {
    if (priority.length >= 12) break;
    if ((citySelections.get(place.city) || 0) >= 2) continue;
    if ((categorySelections.get(place.categoryKey) || 0) >= 4) continue;
    priority.push(place);
    citySelections.set(place.city, (citySelections.get(place.city) || 0) + 1);
    categorySelections.set(
      place.categoryKey,
      (categorySelections.get(place.categoryKey) || 0) + 1,
    );
  }

  for (const place of ranked) {
    if (priority.length >= 12) break;
    if (priority.some((item) => item.id === place.id)) continue;
    priority.push(place);
  }

  const total = rows.length;
  const withPhoto = rows.filter((row) => row.image_url).length;
  return {
    available: true,
    total,
    withPhoto,
    missingPhoto: Math.max(0, total - withPhoto),
    cities,
    categories,
    priority,
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
  const requestedMedia = cleanQuery(request.query.media, 30);
  const media = MEDIA_FILTERS.includes(requestedMedia as MediaFilter)
    ? (requestedMedia as MediaFilter)
    : "";
  const limit = numberQuery(request.query.limit, 50, 1, 100);
  const offset = numberQuery(request.query.offset, 0, 0, 10_000);

  let query = admin.supabase
    .from("directory_places")
    .select(PLACE_SELECT, { count: "exact" })
    .eq("listing_status", status);

  if (
    category &&
    CATEGORY_KEYS.includes(category as (typeof CATEGORY_KEYS)[number])
  ) {
    query = query.eq("category_key", category);
  }
  if (city) query = query.ilike("city", city);
  if (search) query = query.ilike("name", `%${search}%`);
  if (media === "with_photo") query = query.not("image_url", "is", null);
  if (media === "missing_photo") query = query.is("image_url", null);

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
  let contentEditingAvailable = true;
  let factsEditingAvailable = true;
  let editorialContentByPlace: Record<string, Partial<DirectoryPlaceRow>> = {};
  let publicFactsByPlace: Record<string, Partial<DirectoryPlaceRow>> = {};

  const contentQuery = admin.supabase
    .from("directory_places")
    .select(CONTENT_SELECT);
  const editorialRequest =
    placeIds.length > 0
      ? contentQuery.in("id", placeIds).returns<DirectoryPlaceRow[]>()
      : contentQuery.limit(1).returns<DirectoryPlaceRow[]>();
  const publicFactsQuery = admin.supabase
    .from("directory_places")
    .select(PUBLIC_FACTS_SELECT);
  const publicFactsRequest =
    placeIds.length > 0
      ? publicFactsQuery.in("id", placeIds).returns<DirectoryPlaceRow[]>()
      : publicFactsQuery.limit(1).returns<DirectoryPlaceRow[]>();
  const reviewRequest =
    placeIds.length > 0
      ? admin.supabase
          .from("directory_place_reviews")
          .select(
            "id, directory_place_id, reviewer_id, action, from_status, to_status, notes, duplicate_of_place_id, source_fingerprint, created_at",
          )
          .in("directory_place_id", placeIds)
          .order("created_at", { ascending: false })
          .returns<ReviewRow[]>()
      : Promise.resolve({ data: [] as ReviewRow[], error: null });

  const [
    { data: editorialRows, error: editorialError },
    { data: publicFactsRows, error: publicFactsError },
    { data: reviews, error: reviewError },
    counts,
    coverage,
    mediaCoverage,
  ] = await Promise.all([
    editorialRequest,
    publicFactsRequest,
    reviewRequest,
    statusCounts(admin.supabase),
    launchCoverage(admin.supabase),
    approvedMediaCoverage(admin.supabase),
  ]);

  if (editorialError) {
    if (isMissingDirectorySchema(editorialError)) {
      contentEditingAvailable = false;
    } else {
      throw editorialError;
    }
  } else {
    editorialContentByPlace = (editorialRows || []).reduce<
      Record<string, Partial<DirectoryPlaceRow>>
    >((content, row) => {
      content[row.id] = row;
      return content;
    }, {});
  }

  if (publicFactsError) {
    if (isMissingDirectorySchema(publicFactsError)) {
      factsEditingAvailable = false;
    } else {
      throw publicFactsError;
    }
  } else {
    publicFactsByPlace = (publicFactsRows || []).reduce<
      Record<string, Partial<DirectoryPlaceRow>>
    >((facts, row) => {
      facts[row.id] = row;
      return facts;
    }, {});
  }

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

  response.status(200).json({
    places: places.map((place) => ({
      ...place,
      ...(editorialContentByPlace[place.id] || {}),
      ...(publicFactsByPlace[place.id] || {}),
      latestReview: latestReviewByPlace[place.id] || null,
    })),
    counts,
    coverage,
    mediaCoverage,
    contentEditingAvailable,
    factsEditingAvailable,
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
      response
        .status(503)
        .json({ error: "Directory map review is not ready." });
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
    response
      .status(400)
      .json({ error: "A valid directory place is required." });
    return;
  }

  if (action === "map_preview") {
    await handleMapPreview(response, admin, placeId);
    return;
  }

  if (action === "save_content") {
    const descriptionEn = cleanBodyText(body.descriptionEn, 600);
    const descriptionSq = cleanBodyText(body.descriptionSq, 600);
    const imageUrlInput = cleanBodyText(body.imageUrl, 1_200);
    const imageAltEn = cleanBodyText(body.imageAltEn, 180);
    const imageAltSq = cleanBodyText(body.imageAltSq, 180);
    const imageAttributionLabel = cleanBodyText(
      body.imageAttributionLabel,
      180,
    );
    const imageAttributionUrlInput = cleanBodyText(
      body.imageAttributionUrl,
      1_200,
    );
    const imageRightsNote = cleanBodyText(body.imageRightsNote, 500);
    const imageUrl = safeHttpsUrl(imageUrlInput);
    const imageAttributionUrl = safeHttpsUrl(imageAttributionUrlInput);

    if (imageUrlInput && !imageUrl) {
      response.status(400).json({ error: "Use a secure HTTPS image URL." });
      return;
    }
    if (imageAttributionUrlInput && !imageAttributionUrl) {
      response
        .status(400)
        .json({ error: "Use a secure HTTPS attribution URL." });
      return;
    }
    if (
      imageUrl &&
      (!imageAttributionLabel ||
        !imageRightsNote ||
        (!imageAltEn && !imageAltSq))
    ) {
      response.status(400).json({
        error:
          "Add image alt text, a public credit and a private permission or licence note.",
      });
      return;
    }
    if (imageUrl && body.rightsConfirmed !== true) {
      response.status(400).json({
        error: "Confirm that Mirëbook may use this image before saving.",
      });
      return;
    }

    const { data, error } = await admin.supabase
      .from("directory_places")
      .update({
        editorial_description_en: descriptionEn || null,
        editorial_description_sq: descriptionSq || null,
        image_url: imageUrl,
        image_alt_en: imageUrl ? imageAltEn || null : null,
        image_alt_sq: imageUrl ? imageAltSq || null : null,
        image_attribution_label: imageUrl
          ? imageAttributionLabel || null
          : null,
        image_attribution_url: imageUrl ? imageAttributionUrl : null,
        image_rights_note: imageUrl ? imageRightsNote || null : null,
        content_updated_by: admin.user.id,
        content_updated_at: new Date().toISOString(),
      })
      .eq("id", placeId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      if (isMissingDirectorySchema(error)) {
        response.status(503).json({
          error: "Reviewed directory content is temporarily unavailable.",
        });
        return;
      }
      if (["22001", "23514"].includes(error.code || "")) {
        response.status(400).json({
          error: "The description or image details are not valid.",
        });
        return;
      }
      throw error;
    }
    if (!data) {
      response.status(404).json({ error: "Directory place was not found." });
      return;
    }

    response.status(200).json({ ok: true });
    return;
  }

  if (action === "save_public_facts") {
    const factsReviewed = body.factsReviewed === true;
    const publicName = cleanBodyText(body.publicName, 180);
    const publicCategoryKey = cleanBodyText(body.publicCategoryKey, 50);
    const publicAddress = cleanBodyText(body.publicAddress, 500);
    const publicPostcode = cleanBodyText(body.publicPostcode, 40);
    const publicPhone = cleanBodyText(body.publicPhone, 80);
    const publicWebsiteInput = cleanBodyText(body.publicWebsite, 1_200);
    const publicFactsSourceUrlInput = cleanBodyText(
      body.publicFactsSourceUrl,
      1_200,
    );
    const publicFactsNote = cleanBodyText(body.publicFactsNote, 1_000);
    const publicWebsite = safeHttpsUrl(publicWebsiteInput);
    const publicFactsSourceUrl = safeHttpsUrl(publicFactsSourceUrlInput);

    if (
      factsReviewed &&
      (!publicName ||
        !CATEGORY_KEYS.includes(
          publicCategoryKey as (typeof CATEGORY_KEYS)[number],
        ) ||
        !publicFactsSourceUrl ||
        !publicFactsNote)
    ) {
      response.status(400).json({
        error:
          "Add a public name, category, secure evidence URL and private verification note.",
      });
      return;
    }
    if (publicWebsiteInput && !publicWebsite) {
      response.status(400).json({
        error: "Use a secure HTTPS public website URL.",
      });
      return;
    }
    if (publicFactsSourceUrlInput && !publicFactsSourceUrl) {
      response.status(400).json({
        error: "Use a secure HTTPS verification source URL.",
      });
      return;
    }

    const reviewedFacts = factsReviewed
      ? {
          public_facts_reviewed: true,
          public_name: publicName,
          public_category_key: publicCategoryKey,
          public_address: publicAddress || null,
          public_postcode: publicPostcode || null,
          public_phone: publicPhone || null,
          public_website: publicWebsite,
          public_facts_source_url: publicFactsSourceUrl,
          public_facts_note: publicFactsNote,
          public_facts_updated_by: admin.user.id,
          public_facts_updated_at: new Date().toISOString(),
        }
      : {
          public_facts_reviewed: false,
          public_name: null,
          public_category_key: null,
          public_address: null,
          public_postcode: null,
          public_phone: null,
          public_website: null,
          public_facts_source_url: null,
          public_facts_note: null,
          public_facts_updated_by: admin.user.id,
          public_facts_updated_at: new Date().toISOString(),
        };

    const { data, error } = await admin.supabase
      .from("directory_places")
      .update(reviewedFacts)
      .eq("id", placeId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      if (isMissingDirectorySchema(error)) {
        response.status(503).json({
          error: "Reviewed public details are temporarily unavailable.",
        });
        return;
      }
      if (["22001", "23514"].includes(error.code || "")) {
        response.status(400).json({
          error: "The reviewed public details are not valid.",
        });
        return;
      }
      throw error;
    }
    if (!data) {
      response.status(404).json({ error: "Directory place was not found." });
      return;
    }

    response.status(200).json({ ok: true });
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
  if (
    reviewAction === "mark_duplicate" &&
    !UUID_PATTERN.test(duplicateOfPlaceId)
  ) {
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
      response
        .status(503)
        .json({ error: "Directory review SQL is not ready." });
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
    response
      .status(500)
      .json({ error: "Directory review is temporarily unavailable." });
  }
}
