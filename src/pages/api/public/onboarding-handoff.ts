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

  return response.status(200).json({
    profile: data.profile,
    services: (data.services || []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
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
