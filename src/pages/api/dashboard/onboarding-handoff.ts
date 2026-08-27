import { createHash } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { notifyDirectoryClaimSubmitted } from "@/lib/server/directoryClaimNotifications";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function rawHandoffToken(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,160}$/.test(value)
    ? value
    : "";
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const accessToken = bearerToken(request);
  const handoffToken = rawHandoffToken(request.body?.token);
  if (!accessToken || !handoffToken) {
    return response
      .status(400)
      .json({ error: "The prepared-profile link is invalid." });
  }

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return response
      .status(401)
      .json({ error: "Sign in to your Mirëbook Business account." });
  }
  if (!user.email_confirmed_at) {
    return response
      .status(403)
      .json({ error: "Verify your email before connecting this profile." });
  }

  const tokenHash = createHash("sha256").update(handoffToken).digest("hex");
  const { data, error } = await supabase.rpc(
    "mirebook_adopt_onboarding_profile_for_email",
    {
      p_user_id: user.id,
      p_token_hash: tokenHash,
    },
  );
  if (error) {
    const emailMismatch = error.message.includes(
      "verified email address this invitation was sent to",
    );
    return response.status(emailMismatch ? 403 : 400).json({
      error: emailMismatch
        ? "Sign in with the verified email address this invitation was sent to."
        : error.message,
      errorCode: emailMismatch ? "owner_email_mismatch" : "handoff_failed",
    });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.claim_id && result?.business_id && result?.case_id) {
    try {
      const [{ data: business }, { data: onboardingCase }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, name")
          .eq("id", result.business_id)
          .single<{ id: string; name: string }>(),
        supabase
          .from("business_onboarding_cases")
          .select("directory_place_id")
          .eq("id", result.case_id)
          .single<{ directory_place_id?: string | null }>(),
      ]);
      const placeId = onboardingCase?.directory_place_id || "";
      const { data: place } = placeId
        ? await supabase
            .from("directory_places")
            .select("id, name, public_name")
            .eq("id", placeId)
            .single<{
              id: string;
              name: string;
              public_name?: string | null;
            }>()
        : { data: null };
      if (business && place) {
        await notifyDirectoryClaimSubmitted({
          supabase,
          claimId: result.claim_id,
          claimantUserId: user.id,
          businessId: business.id,
          businessName: business.name,
          placeId: place.id,
          placeName: place.public_name || place.name,
        });
      }
    } catch (notificationError) {
      console.error(
        "[onboarding-handoff] Connected but claim notification failed",
        notificationError instanceof Error
          ? notificationError.name
          : "UnknownError",
      );
    }
  }

  return response.status(200).json({
    businessId: result?.business_id || null,
    claimId: result?.claim_id || null,
    importedServices: Number(result?.imported_services || 0),
    alreadyAdopted: Boolean(result?.already_adopted),
  });
}
