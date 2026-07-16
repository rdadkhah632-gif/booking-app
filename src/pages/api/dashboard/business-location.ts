import type { NextApiRequest, NextApiResponse } from "next";
import {
  GeocodingError,
  geocodeBusinessAddress,
  renderBusinessLocationMap,
} from "@/lib/server/mapboxGeocoding";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type BusinessRow = {
  id: string;
  user_id: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

type LocationRow = {
  business_id: string;
  formatted_address: string;
  provider: string;
  provider_place_id?: string | null;
  location_precision: string;
  verification_status: string;
  verified_at?: string | null;
  updated_at: string;
};

type LocationRequest = {
  businessId?: string;
  action?: "preview" | "map_preview" | "confirm";
  providerPlaceId?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value?: string | string[] | null) {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return typeof value === "string" ? value.trim() : "";
}

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function errorResponse(
  res: NextApiResponse,
  status: number,
  code: string,
  error: string,
) {
  return res.status(status).json({ code, error });
}

function publicLocation(row?: LocationRow | null) {
  if (!row) {
    return {
      verificationStatus: "not_configured",
      formattedAddress: null,
      provider: null,
      precision: null,
      verifiedAt: null,
      updatedAt: null,
    };
  }

  return {
    verificationStatus: row.verification_status,
    formattedAddress: row.formatted_address,
    provider: row.provider,
    precision: row.location_precision,
    verifiedAt: row.verified_at || null,
    updatedAt: row.updated_at,
  };
}

function geocodingErrorResponse(res: NextApiResponse, error: unknown) {
  if (!(error instanceof GeocodingError)) {
    return errorResponse(
      res,
      503,
      "geocoding_unavailable",
      "Business location verification is temporarily unavailable.",
    );
  }

  const status =
    error.code === "address_incomplete"
      ? 400
      : error.code === "location_not_found"
        ? 404
        : 503;
  return errorResponse(res, status, error.code, error.message);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  res.setHeader("Cache-Control", "no-store");

  const token = bearerToken(req);
  if (!token) {
    return errorResponse(res, 401, "auth_required", "Authentication required");
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    return errorResponse(
      res,
      500,
      "server_not_configured",
      "Business location verification is not configured.",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return errorResponse(res, 401, "invalid_session", "Invalid session");
  }

  const request = (req.body || {}) as LocationRequest;
  const businessId = cleanText(
    req.method === "GET" ? req.query.businessId : request.businessId,
  );

  if (!businessId || !UUID_PATTERN.test(businessId)) {
    return errorResponse(
      res,
      400,
      "business_required",
      "A business is required.",
    );
  }

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, user_id, address, city, country")
    .eq("id", businessId)
    .maybeSingle<BusinessRow>();

  if (businessError) {
    console.error(
      "[business-location] business lookup failed",
      businessError.code,
    );
    return errorResponse(
      res,
      500,
      "business_lookup_failed",
      "The business could not be loaded.",
    );
  }

  if (!business || business.user_id !== user.id) {
    return errorResponse(
      res,
      403,
      "forbidden",
      "Business location access is not permitted.",
    );
  }

  if (req.method === "GET") {
    const { data: location, error: locationError } = await supabaseAdmin
      .from("business_locations")
      .select(
        "business_id, formatted_address, provider, provider_place_id, location_precision, verification_status, verified_at, updated_at",
      )
      .eq("business_id", businessId)
      .maybeSingle<LocationRow>();

    if (locationError) {
      console.error(
        "[business-location] location status lookup failed",
        locationError.code,
      );
      return errorResponse(
        res,
        503,
        "location_storage_unavailable",
        "Business location storage is not available.",
      );
    }

    return res
      .status(200)
      .json({ ok: true, location: publicLocation(location) });
  }

  if (request.action === "preview") {
    try {
      const candidates = await geocodeBusinessAddress({
        address: business.address,
        city: business.city,
        country: business.country,
        permanent: false,
      });

      return res.status(200).json({
        ok: true,
        candidates: candidates.map((candidate) => ({
          providerPlaceId: candidate.providerPlaceId,
          formattedAddress: candidate.formattedAddress,
          precision: candidate.precision,
        })),
      });
    } catch (error) {
      return geocodingErrorResponse(res, error);
    }
  }

  if (request.action === "map_preview") {
    const providerPlaceId = cleanText(request.providerPlaceId);
    if (!providerPlaceId || providerPlaceId.length > 500) {
      return errorResponse(
        res,
        400,
        "candidate_required",
        "Choose a location before previewing the map.",
      );
    }

    try {
      const candidates = await geocodeBusinessAddress({
        address: business.address,
        city: business.city,
        country: business.country,
        permanent: false,
      });
      const candidate = candidates.find(
        (item) => item.providerPlaceId === providerPlaceId,
      );

      if (!candidate) {
        return errorResponse(
          res,
          409,
          "candidate_changed",
          "The address results changed. Search again and choose a location.",
        );
      }

      const mapImageDataUrl = await renderBusinessLocationMap(candidate);
      return res.status(200).json({ ok: true, mapImageDataUrl });
    } catch (error) {
      return geocodingErrorResponse(res, error);
    }
  }

  if (request.action === "confirm") {
    const providerPlaceId = cleanText(request.providerPlaceId);
    if (!providerPlaceId || providerPlaceId.length > 500) {
      return errorResponse(
        res,
        400,
        "candidate_required",
        "Choose a location before confirming.",
      );
    }

    let candidate;
    try {
      const candidates = await geocodeBusinessAddress({
        address: business.address,
        city: business.city,
        country: business.country,
        permanent: true,
      });
      candidate = candidates.find(
        (item) => item.providerPlaceId === providerPlaceId,
      );
    } catch (error) {
      return geocodingErrorResponse(res, error);
    }

    if (!candidate) {
      return errorResponse(
        res,
        409,
        "candidate_changed",
        "The address results changed. Search again and confirm a location.",
      );
    }

    const verifiedAt = new Date().toISOString();
    const { data: savedLocation, error: saveError } = await supabaseAdmin
      .from("business_locations")
      .upsert(
        {
          business_id: businessId,
          location: `SRID=4326;POINT(${candidate.longitude} ${candidate.latitude})`,
          formatted_address: candidate.formattedAddress,
          provider: "mapbox",
          provider_place_id: candidate.providerPlaceId,
          location_precision: candidate.precision,
          verification_status: "verified",
          verified_at: verifiedAt,
        },
        { onConflict: "business_id" },
      )
      .select(
        "business_id, formatted_address, provider, provider_place_id, location_precision, verification_status, verified_at, updated_at",
      )
      .single<LocationRow>();

    if (saveError) {
      console.error("[business-location] location save failed", saveError.code);
      return errorResponse(
        res,
        503,
        "location_save_failed",
        "The location could not be saved.",
      );
    }

    return res.status(200).json({
      ok: true,
      location: publicLocation(savedLocation),
    });
  }

  return errorResponse(
    res,
    400,
    "invalid_action",
    "Choose a valid location action.",
  );
}
