import type { NextApiRequest, NextApiResponse } from "next";
import { notifyDirectoryClaimReviewed } from "@/lib/server/directoryClaimNotifications";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = [
  "pending",
  "needs_more_info",
  "approved",
  "rejected",
  "withdrawn",
] as const;
const ACTIONS = ["approve", "request_more_info", "reject"] as const;

type ClaimStatus = (typeof STATUSES)[number];
type ClaimAction = (typeof ACTIONS)[number];

type CompetingClaim = {
  claimant_user_id: string;
  business_id: string;
  business_name: string;
};

type ClaimRow = {
  id: string;
  directory_place_id: string;
  business_id: string;
  claimant_user_id: string;
  status: ClaimStatus;
  evidence_type: string;
  evidence_value_masked?: string | null;
  claimant_message?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
};

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanQuery(value: string | string[] | undefined, maxLength = 80) {
  return cleanText(Array.isArray(value) ? value[0] : value, maxLength);
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

async function requireAdmin(request: NextApiRequest) {
  const token = bearerToken(request);
  if (!token) return null;
  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_admin?: boolean | null }>();
  return profileError || !profile?.is_admin ? null : { supabase, user };
}

async function statusCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const rows = await Promise.all(
    STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .from("business_claims")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw error;
      return [status, count || 0] as const;
    }),
  );
  return Object.fromEntries(rows);
}

async function handleGet(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const requestedStatus = cleanQuery(request.query.status, 30);
  const status = STATUSES.includes(requestedStatus as ClaimStatus)
    ? (requestedStatus as ClaimStatus)
    : "pending";
  const limit = numberQuery(request.query.limit, 50, 1, 100);
  const offset = numberQuery(request.query.offset, 0, 0, 10_000);

  const { data, error, count } = await admin.supabase
    .from("business_claims")
    .select(
      "id, directory_place_id, business_id, claimant_user_id, status, evidence_type, evidence_value_masked, claimant_message, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1)
    .returns<ClaimRow[]>();

  if (error) {
    if (["42P01", "42703", "PGRST205"].includes(error.code || "")) {
      response.status(503).json({
        error: "Business claim storage is not ready.",
        sqlRequired: ["24_directory_business_claim_workflow.sql"],
      });
      return;
    }
    throw error;
  }

  const claims = data || [];
  const placeIds = Array.from(
    new Set(claims.map((claim) => claim.directory_place_id)),
  );
  const businessIds = Array.from(
    new Set(claims.map((claim) => claim.business_id)),
  );
  const userIds = Array.from(
    new Set(claims.map((claim) => claim.claimant_user_id)),
  );
  const [placesResult, businessesResult, profilesResult] = await Promise.all([
    placeIds.length
      ? admin.supabase
          .from("directory_places")
          .select("id, name, address, city, region, country_code, phone, website, listing_status, claim_status, linked_business_id")
          .in("id", placeIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? admin.supabase
          .from("businesses")
          .select("id, user_id, name, address, city, country, phone, published")
          .in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (placesResult.error) throw placesResult.error;
  if (businessesResult.error) throw businessesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const places = new Map((placesResult.data || []).map((row) => [row.id, row]));
  const businesses = new Map(
    (businessesResult.data || []).map((row) => [row.id, row]),
  );
  const profiles = new Map(
    (profilesResult.data || []).map((row) => [row.id, row]),
  );

  response.status(200).json({
    claims: claims.map((claim) => ({
      ...claim,
      place: places.get(claim.directory_place_id) || null,
      business: businesses.get(claim.business_id) || null,
      claimant: profiles.get(claim.claimant_user_id) || null,
    })),
    counts: await statusCounts(admin.supabase),
    pagination: { total: count || 0, limit, offset },
  });
}

async function handlePost(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const body = (request.body || {}) as Record<string, unknown>;
  const claimId = cleanText(body.claimId, 50);
  const action = cleanText(body.action, 30) as ClaimAction;
  const notes = cleanText(body.notes, 1_500);

  if (!UUID_PATTERN.test(claimId)) {
    response.status(400).json({ error: "Choose a valid ownership claim." });
    return;
  }
  if (!ACTIONS.includes(action)) {
    response.status(400).json({ error: "Choose a valid review decision." });
    return;
  }
  if (action !== "approve" && !notes) {
    response.status(400).json({ error: "Add a note for the business owner." });
    return;
  }

  const { data: claimBeforeReview, error: claimBeforeReviewError } =
    await admin.supabase
      .from("business_claims")
      .select("id, directory_place_id, business_id, claimant_user_id, status")
      .eq("id", claimId)
      .maybeSingle<{
        id: string;
        directory_place_id: string;
        business_id: string;
        claimant_user_id: string;
        status: ClaimStatus;
      }>();
  if (claimBeforeReviewError) throw claimBeforeReviewError;
  if (!claimBeforeReview) {
    response.status(404).json({ error: "Business claim was not found." });
    return;
  }

  const [
    { data: place, error: placeError },
    { data: business, error: businessError },
  ] = await Promise.all([
      admin.supabase
        .from("directory_places")
        .select("id, name")
        .eq("id", claimBeforeReview.directory_place_id)
        .maybeSingle<{ id: string; name: string }>(),
      admin.supabase
        .from("businesses")
        .select("id, name")
        .eq("id", claimBeforeReview.business_id)
        .maybeSingle<{ id: string; name: string }>(),
    ]);
  if (placeError) throw placeError;
  if (businessError) throw businessError;
  if (!place || !business) {
    response.status(409).json({
      error: "The claim no longer has a valid place and business.",
    });
    return;
  }

  let competingClaims: CompetingClaim[] = [];
  if (action === "approve") {
    const { data: competingRows, error: competingError } = await admin.supabase
      .from("business_claims")
      .select("claimant_user_id, business_id")
      .eq("directory_place_id", claimBeforeReview.directory_place_id)
      .neq("id", claimId)
      .in("status", ["pending", "needs_more_info"])
      .returns<
        Array<{
          claimant_user_id: string;
          business_id: string;
        }>
      >();
    if (competingError) throw competingError;

    const competingBusinessIds = Array.from(
      new Set((competingRows || []).map((claim) => claim.business_id)),
    );
    const { data: competingBusinesses, error: competingBusinessesError } =
      competingBusinessIds.length
        ? await admin.supabase
            .from("businesses")
            .select("id, name")
            .in("id", competingBusinessIds)
            .returns<Array<{ id: string; name: string }>>()
        : { data: [] as Array<{ id: string; name: string }>, error: null };
    if (competingBusinessesError) throw competingBusinessesError;

    const businessNames = new Map(
      (competingBusinesses || []).map((item) => [item.id, item.name]),
    );
    competingClaims = (competingRows || [])
      .map((claim) => ({
        ...claim,
        business_name: businessNames.get(claim.business_id) || "",
      }))
      .filter((claim) => claim.business_name);
  }

  const { data, error } = await admin.supabase.rpc(
    "mirebook_review_business_claim",
    {
      p_claim_id: claimId,
      p_action: action,
      p_reviewer_id: admin.user.id,
      p_notes: notes || null,
    },
  );
  if (error) {
    if (["42P01", "42703", "PGRST202", "PGRST205"].includes(error.code || "")) {
      response.status(503).json({ error: "Business claim review is not ready." });
      return;
    }
    if (["22023", "23505", "42501", "P0002"].includes(error.code || "")) {
      response.status(error.code === "P0002" ? 404 : 400).json({
        error: error.message || "The claim could not be reviewed.",
      });
      return;
    }
    throw error;
  }

  try {
    await Promise.all([
      notifyDirectoryClaimReviewed({
        supabase: admin.supabase,
        claimantUserId: claimBeforeReview.claimant_user_id,
        businessId: business.id,
        businessName: business.name,
        placeId: place.id,
        placeName: place.name,
        status:
          action === "approve"
            ? "approved"
            : action === "request_more_info"
              ? "needs_more_info"
              : "rejected",
        reviewNote: notes || null,
      }),
      ...competingClaims.map((claim) =>
        notifyDirectoryClaimReviewed({
          supabase: admin.supabase,
          claimantUserId: claim.claimant_user_id,
          businessId: claim.business_id,
          businessName: claim.business_name,
          placeId: place.id,
          placeName: place.name,
          status: "rejected",
        }),
      ),
    ]);
  } catch (notificationError) {
    console.error(
      "[admin-directory-claims] Review saved but notification delivery failed",
      notificationError instanceof Error
        ? notificationError.name
        : "UnknownError",
    );
  }

  response.status(200).json({ ok: true, claim: data?.[0] || null });
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
      await handleGet(request, response, admin);
      return;
    }
    await handlePost(request, response, admin);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[admin-directory-claims] Request failed", code);
    response.status(500).json({ error: "Ownership claim review is temporarily unavailable." });
  }
}
