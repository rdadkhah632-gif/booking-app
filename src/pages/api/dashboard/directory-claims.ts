import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_TYPES = new Set([
  "domain_email",
  "business_phone",
  "business_document",
  "other",
]);

type OwnedBusiness = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  published?: boolean | null;
};

type ClaimRow = {
  id: string;
  directory_place_id: string;
  business_id: string;
  status: string;
  evidence_type: string;
  evidence_value_masked?: string | null;
  claimant_message?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
};

type DirectoryPlaceRow = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code: string;
  phone?: string | null;
  website?: string | null;
  listing_status: string;
  claim_status: string;
  linked_business_id?: string | null;
};

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function bodyText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function queryText(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}

function normalise(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchReasons(place: DirectoryPlaceRow, business: OwnedBusiness) {
  const reasons: string[] = [];
  const placeName = normalise(place.name);
  const businessName = normalise(business.name);
  const placeTokens = new Set(placeName.split(" ").filter((token) => token.length > 2));
  const sharedNameToken = businessName
    .split(" ")
    .some((token) => token.length > 2 && placeTokens.has(token));

  if (placeName && businessName && (placeName === businessName || sharedNameToken)) {
    reasons.push("name");
  }
  if (normalise(place.city) && normalise(place.city) === normalise(business.city)) {
    reasons.push("city");
  }
  const placePhone = (place.phone || "").replace(/\D/g, "").slice(-7);
  const businessPhone = (business.phone || "").replace(/\D/g, "").slice(-7);
  if (placePhone.length >= 7 && placePhone === businessPhone) reasons.push("phone");
  return reasons;
}

function maskEvidence(params: {
  evidenceType: string;
  evidenceValue: string;
  userEmail?: string | null;
}) {
  if (params.evidenceType === "domain_email") {
    const domain = params.userEmail?.split("@")[1]?.toLowerCase() || "";
    return domain ? `@${domain}` : null;
  }
  if (params.evidenceType === "business_phone") {
    const digits = params.evidenceValue.replace(/\D/g, "");
    return digits.length >= 4 ? `Ends in ${digits.slice(-4)}` : null;
  }
  if (params.evidenceType === "business_document") {
    return "Document described by claimant";
  }
  return "Additional evidence described by claimant";
}

async function requireUser(request: NextApiRequest) {
  const token = bearerToken(request);
  if (!token) return null;
  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  return error || !user ? null : { supabase, user };
}

async function ownedBusinesses(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, address, city, country, phone, published")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<OwnedBusiness[]>();
  if (error) throw error;
  return data || [];
}

async function loadPlace(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  placeId: string,
) {
  const { data, error } = await supabase
    .from("directory_places")
    .select(
      "id, name, address, city, region, country_code, phone, website, listing_status, claim_status, linked_business_id",
    )
    .eq("id", placeId)
    .maybeSingle<DirectoryPlaceRow>();
  if (error) throw error;
  return data;
}

async function handleGet(
  request: NextApiRequest,
  response: NextApiResponse,
  auth: NonNullable<Awaited<ReturnType<typeof requireUser>>>,
) {
  const placeId = queryText(request.query.placeId);
  const businessesPromise = ownedBusinesses(auth.supabase, auth.user.id);
  const claimsPromise = auth.supabase
    .from("business_claims")
    .select(
      "id, directory_place_id, business_id, status, evidence_type, evidence_value_masked, claimant_message, review_notes, created_at, updated_at",
    )
    .eq("claimant_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .returns<ClaimRow[]>();
  const placePromise = UUID_PATTERN.test(placeId)
    ? loadPlace(auth.supabase, placeId)
    : Promise.resolve(null);
  const [businesses, claimsResult, place] = await Promise.all([
    businessesPromise,
    claimsPromise,
    placePromise,
  ]);
  if (claimsResult.error) throw claimsResult.error;

  if (placeId && !UUID_PATTERN.test(placeId)) {
    response.status(400).json({ error: "A valid place is required." });
    return;
  }
  if (placeId && (!place || place.listing_status !== "active")) {
    response.status(404).json({ error: "This place is not available." });
    return;
  }

  response.status(200).json({
    place: place
      ? {
          id: place.id,
          name: place.name,
          address: place.address || null,
          city: place.city || null,
          region: place.region || null,
          countryCode: place.country_code,
          phone: place.phone || null,
          website: place.website || null,
          claimable:
            place.claim_status === "unclaimed" && !place.linked_business_id,
        }
      : null,
    businesses: businesses.map((business) => ({
      ...business,
      matchReasons: place ? matchReasons(place, business) : [],
    })),
    claims: claimsResult.data || [],
    currentClaim: place
      ? (claimsResult.data || []).find(
          (claim) => claim.directory_place_id === place.id,
        ) || null
      : null,
  });
}

async function handlePost(
  request: NextApiRequest,
  response: NextApiResponse,
  auth: NonNullable<Awaited<ReturnType<typeof requireUser>>>,
) {
  const body = (request.body || {}) as Record<string, unknown>;
  const placeId = bodyText(body.placeId, 50);
  const businessId = bodyText(body.businessId, 50);
  const evidenceType = bodyText(body.evidenceType, 40);
  const evidenceValue = bodyText(body.evidenceValue, 120);
  const claimantMessage = bodyText(body.claimantMessage, 1_500);

  if (!UUID_PATTERN.test(placeId) || !UUID_PATTERN.test(businessId)) {
    response.status(400).json({ error: "Choose a valid place and business." });
    return;
  }
  if (!EVIDENCE_TYPES.has(evidenceType)) {
    response.status(400).json({ error: "Choose how Mirëbook can verify ownership." });
    return;
  }
  if (evidenceType === "business_phone" && evidenceValue.replace(/\D/g, "").length < 4) {
    response.status(400).json({ error: "Add the business phone number." });
    return;
  }
  if (claimantMessage.length < 20) {
    response.status(400).json({ error: "Add a short explanation of your connection to this business." });
    return;
  }

  const maskedEvidence = maskEvidence({
    evidenceType,
    evidenceValue,
    userEmail: auth.user.email,
  });
  const { data, error } = await auth.supabase.rpc(
    "mirebook_submit_business_claim",
    {
      p_place_id: placeId,
      p_business_id: businessId,
      p_claimant_user_id: auth.user.id,
      p_evidence_type: evidenceType,
      p_evidence_value_masked: maskedEvidence,
      p_claimant_message: claimantMessage,
    },
  );

  if (error) {
    if (["42P01", "42703", "PGRST202", "PGRST205"].includes(error.code || "")) {
      response.status(503).json({ error: "The ownership claim workflow is not ready." });
      return;
    }
    if (["22023", "23505", "42501", "P0002"].includes(error.code || "")) {
      response.status(error.code === "P0002" ? 404 : 400).json({
        error: error.message || "The claim could not be submitted.",
      });
      return;
    }
    throw error;
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
    const auth = await requireUser(request);
    if (!auth) {
      response.status(401).json({ error: "Sign in with a Mirëbook Business account." });
      return;
    }
    if (request.method === "GET") {
      await handleGet(request, response, auth);
      return;
    }
    await handlePost(request, response, auth);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[directory-claims] Request failed", code);
    response.status(500).json({ error: "Ownership claims are temporarily unavailable." });
  }
}
