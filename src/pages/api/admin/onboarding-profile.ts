import { createHash, randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getBusinessAppUrl } from "@/lib/appUrls";
import type {
  PreparedBusinessProfile,
  PreparedProfileDraft,
  PreparedServiceDraft,
} from "@/lib/onboardingPreparedProfile";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCIES = new Set(["ALL", "EUR", "GBP", "USD"]);
const BOOKING_TYPES = new Set(["appointment", "group"]);

type DraftRow = {
  case_id: string;
  profile: PreparedBusinessProfile;
  services: PreparedServiceDraft[];
  intended_owner_email?: string | null;
  handoff_issued_at?: string | null;
  handoff_expires_at?: string | null;
  adopted_at?: string | null;
  adopted_business_id?: string | null;
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

function cleanEmail(value: unknown) {
  return cleanText(value, 320).toLowerCase();
}

function cleanHttpsUrl(value: unknown) {
  const candidate = cleanText(value, 1200);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanBoolean(value: unknown) {
  return value === true;
}

function cleanNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function safeProfile(value: unknown): PreparedBusinessProfile {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const currency = cleanText(input.currency, 3).toUpperCase();
  return {
    name: cleanText(input.name, 160),
    description: cleanText(input.description, 1200),
    imageUrl: cleanHttpsUrl(input.imageUrl),
    phone: cleanText(input.phone, 40),
    address: cleanText(input.address, 240),
    city: cleanText(input.city, 100),
    country: cleanText(input.country, 100) || "Albania",
    category: cleanText(input.category, 80),
    timezone: cleanText(input.timezone, 80) || "Europe/Tirane",
    currency: CURRENCIES.has(currency)
      ? (currency as PreparedBusinessProfile["currency"])
      : "ALL",
    ownerTakesBookings: cleanBoolean(input.ownerTakesBookings),
  };
}

function safeServices(value: unknown): PreparedServiceDraft[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((item, index) => {
    const input =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const bookingType = cleanText(input.bookingType, 20).toLowerCase();
    const type = BOOKING_TYPES.has(bookingType)
      ? (bookingType as PreparedServiceDraft["bookingType"])
      : "appointment";
    const privateBookingEnabled =
      type === "group" && cleanBoolean(input.privateBookingEnabled);
    return {
      id: cleanText(input.id, 100) || `prepared-${index + 1}`,
      name: cleanText(input.name, 160),
      description: cleanText(input.description, 800),
      imageUrl: cleanHttpsUrl(input.imageUrl),
      durationMinutes: Math.round(
        cleanNumber(input.durationMinutes, 30, 5, 10080),
      ),
      price: cleanNumber(input.price, 0, 0, 1_000_000),
      priceKnown: cleanBoolean(input.priceKnown),
      bookingType: type,
      groupCapacity:
        type === "group"
          ? Math.round(cleanNumber(input.groupCapacity, 1, 1, 200))
          : null,
      privateBookingEnabled,
      privatePrice: privateBookingEnabled
        ? cleanNumber(input.privatePrice, 0, 0, 1_000_000)
        : null,
    };
  });
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_admin?: boolean | null }>();
  return profile?.is_admin ? { supabase, user } : null;
}

function serialize(row: DraftRow): PreparedProfileDraft {
  return {
    caseId: row.case_id,
    profile: safeProfile(row.profile),
    services: safeServices(row.services),
    intendedOwnerEmail: row.intended_owner_email,
    handoffIssuedAt: row.handoff_issued_at,
    handoffExpiresAt: row.handoff_expires_at,
    adoptedAt: row.adopted_at,
    adoptedBusinessId: row.adopted_business_id,
  };
}

function isMissingSchema(error: { code?: string | null } | null) {
  return ["42P01", "42703", "PGRST202", "PGRST205"].includes(error?.code || "");
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!request.method || !["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const context = await requireAdmin(request);
  if (!context)
    return response.status(403).json({ error: "Admin access required." });

  const caseId = cleanText(
    request.method === "GET" ? request.query.caseId : request.body?.caseId,
    80,
  );
  if (!UUID_PATTERN.test(caseId)) {
    return response
      .status(400)
      .json({ error: "Choose a valid onboarding case." });
  }

  if (request.method === "GET") {
    const [draftResult, mediaVersionResult] = await Promise.all([
      context.supabase
        .from("business_onboarding_profile_drafts")
        .select(
          "case_id, profile, services, intended_owner_email, handoff_issued_at, handoff_expires_at, adopted_at, adopted_business_id",
        )
        .eq("case_id", caseId)
        .maybeSingle<DraftRow>(),
      context.supabase.rpc("mirebook_prepared_media_handoff_version"),
    ]);
    const { data, error } = draftResult;
    if (error) {
      if (isMissingSchema(error)) {
        return response
          .status(200)
          .json({ storageAvailable: false, sqlRequired: "44", draft: null });
      }
      return response
        .status(500)
        .json({ error: "The prepared profile could not be loaded." });
    }
    if (
      mediaVersionResult.error &&
      !isMissingSchema(mediaVersionResult.error)
    ) {
      return response
        .status(500)
        .json({ error: "The prepared-media status could not be checked." });
    }
    return response.status(200).json({
      storageAvailable: true,
      mediaHandoffAvailable:
        !mediaVersionResult.error && Number(mediaVersionResult.data) >= 1,
      draft: data ? serialize(data) : null,
    });
  }

  const action = cleanText(request.body?.action, 30) || "save";
  if (action === "save") {
    const profile = safeProfile(request.body?.profile);
    const services = safeServices(request.body?.services);
    if (
      profile.name.length < 2 ||
      profile.city.length < 2 ||
      profile.category.length < 2
    ) {
      return response
        .status(400)
        .json({ error: "Add the prepared business name, category and city." });
    }
    if (services.some((service) => service.name.length < 2)) {
      return response
        .status(400)
        .json({ error: "Every prepared service needs a name." });
    }

    const hasPreparedMedia = Boolean(
      profile.imageUrl || services.some((service) => service.imageUrl),
    );
    if (hasPreparedMedia) {
      const mediaVersionResult = await context.supabase.rpc(
        "mirebook_prepared_media_handoff_version",
      );
      if (mediaVersionResult.error || Number(mediaVersionResult.data) < 1) {
        return response.status(409).json({
          error:
            "Prepared photo handoff is not enabled. Apply the current media-handoff migration first.",
        });
      }
      const { data: onboardingCase, error: caseError } = await context.supabase
        .from("business_onboarding_cases")
        .select("profile_media_permission")
        .eq("id", caseId)
        .maybeSingle<{ profile_media_permission?: boolean | null }>();
      if (caseError) {
        return response
          .status(500)
          .json({
            error: "The profile-media permission could not be checked.",
          });
      }
      if (!onboardingCase?.profile_media_permission) {
        return response.status(400).json({
          error:
            "Record profile-media permission before adding prepared photos.",
        });
      }
    }

    const { data, error } = await context.supabase.rpc(
      "mirebook_save_onboarding_profile_draft",
      {
        p_actor_user_id: context.user.id,
        p_case_id: caseId,
        p_profile: profile,
        p_services: services,
      },
    );
    if (error) {
      if (isMissingSchema(error)) {
        return response
          .status(409)
          .json({ error: "Run SQL 43 to enable prepared owner handoff." });
      }
      return response.status(400).json({ error: error.message });
    }
    const row = (Array.isArray(data) ? data[0] : data) as DraftRow | null;
    return response.status(200).json({ draft: row ? serialize(row) : null });
  }

  if (action === "issue") {
    const ownerEmail = cleanEmail(request.body?.ownerEmail);
    if (!EMAIL_PATTERN.test(ownerEmail)) {
      return response.status(400).json({
        error: "Add the owner's valid email before creating the secure link.",
      });
    }
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await context.supabase.rpc(
      "mirebook_issue_email_bound_onboarding_handoff",
      {
        p_actor_user_id: context.user.id,
        p_case_id: caseId,
        p_owner_email: ownerEmail,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
      },
    );
    if (error) {
      if (isMissingSchema(error)) {
        return response
          .status(409)
          .json({ error: "Run SQL 44 to enable email-bound owner handoff." });
      }
      return response.status(400).json({ error: error.message });
    }
    const row = (Array.isArray(data) ? data[0] : data) as DraftRow | null;
    return response.status(200).json({
      draft: row ? serialize(row) : null,
      handoffUrl: getBusinessAppUrl(`/join/${rawToken}`),
    });
  }

  return response
    .status(400)
    .json({ error: "Choose a valid prepared-profile action." });
}
