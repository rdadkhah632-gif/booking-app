import { createHash } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type {
  PreparedBusinessProfile,
  PreparedServiceDraft,
} from "@/lib/onboardingPreparedProfile";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type DraftRow = {
  case_id: string;
  profile: PreparedBusinessProfile;
  services: PreparedServiceDraft[];
  handoff_expires_at: string;
  adopted_at?: string | null;
};

function tokenValue(value: string | string[] | undefined) {
  const token = Array.isArray(value) ? value[0] : value || "";
  return /^[A-Za-z0-9_-]{32,160}$/.test(token) ? token : "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeHttpsUrl(value: unknown) {
  const candidate = cleanText(value, 1200);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const token = tokenValue(request.query.token);
  if (!token)
    return response.status(404).json({ error: "Prepared profile not found." });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_onboarding_profile_drafts")
    .select("case_id, profile, services, handoff_expires_at, adopted_at")
    .eq("handoff_token_hash", tokenHash)
    .gt("handoff_expires_at", new Date().toISOString())
    .is("adopted_at", null)
    .maybeSingle<DraftRow>();

  if (error || !data) {
    return response.status(404).json({ error: "Prepared profile not found." });
  }

  const { data: onboardingCase, error: caseError } = await supabase
    .from("business_onboarding_cases")
    .select("profile_media_permission")
    .eq("id", data.case_id)
    .maybeSingle<{ profile_media_permission?: boolean | null }>();
  if (caseError || !onboardingCase) {
    return response.status(404).json({ error: "Prepared profile not found." });
  }
  const mediaAllowed = onboardingCase.profile_media_permission === true;

  return response.status(200).json({
    profile: {
      name: cleanText(data.profile.name, 160),
      description: cleanText(data.profile.description, 1200),
      imageUrl: mediaAllowed ? safeHttpsUrl(data.profile.imageUrl) : "",
      phone: cleanText(data.profile.phone, 40),
      address: cleanText(data.profile.address, 240),
      city: cleanText(data.profile.city, 100),
      country: cleanText(data.profile.country, 100),
      category: cleanText(data.profile.category, 80),
      timezone: cleanText(data.profile.timezone, 80),
      currency: data.profile.currency,
      ownerTakesBookings: data.profile.ownerTakesBookings === true,
    },
    services: (data.services || []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      imageUrl: mediaAllowed ? safeHttpsUrl(service.imageUrl) : "",
      durationMinutes: service.durationMinutes,
      price: service.price,
      priceKnown: service.priceKnown,
      bookingType: service.bookingType,
      groupCapacity: service.groupCapacity,
      privateBookingEnabled: service.privateBookingEnabled,
      privatePrice: service.privatePrice,
    })),
    expiresAt: data.handoff_expires_at,
  });
}
