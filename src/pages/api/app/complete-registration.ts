import type { NextApiRequest, NextApiResponse } from "next";
import {
  bearerToken,
  errorResponse,
  handleAppApiError,
} from "@/lib/server/app-api/context";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type PendingBusiness = {
  name?: string;
  phone?: string;
  category?: string;
  city?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  ownerTakesBookings?: boolean;
};

function stringMetadata(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pendingBusinessMetadata(value: unknown): PendingBusiness {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PendingBusiness;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const token = bearerToken(req);
    if (!token) {
      return errorResponse(res, 401, "auth_required", "Authentication required");
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse(res, 401, "invalid_session", "Invalid session");
    }

    const metadata = user.user_metadata || {};
    if (!metadata.pending_registration) {
      return res.status(200).json({});
    }

    const accountMode =
      metadata.account_mode === "business"
        ? "business"
        : metadata.account_mode === "staff"
          ? "staff"
          : "customer";
    const profileRole = accountMode === "business" ? "business" : "customer";
    const email = user.email?.trim().toLowerCase() || "";
    const fullName = stringMetadata(metadata.full_name);
    const phone = stringMetadata(metadata.phone);
    const preferredLanguage = metadata.preferred_language === "sq" ? "sq" : "en";

    const { data: existingProfile, error: profileLookupError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle<{ id: string }>();

    if (profileLookupError) throw profileLookupError;

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          email,
          role: profileRole,
          full_name: fullName || null,
          phone: phone || null,
          preferred_language: preferredLanguage,
        });

      if (profileError) throw profileError;
    } else {
      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: fullName || null,
          phone: phone || null,
          preferred_language: preferredLanguage,
        })
        .eq("id", user.id);

      if (profileUpdateError) throw profileUpdateError;
    }

    if (accountMode === "business") {
      const pendingBusiness = pendingBusinessMetadata(metadata.pending_business);

      const hasPendingBusinessDetails = Boolean(
        pendingBusiness.name &&
          pendingBusiness.phone &&
          pendingBusiness.category &&
          pendingBusiness.city &&
          pendingBusiness.country,
      );

      if (!hasPendingBusinessDetails) {
        return errorResponse(
          res,
          400,
          "pending_business_incomplete",
          "Pending business registration is incomplete",
        );
      }

      const { data: existingBusiness, error: existingBusinessError } =
        await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle<{ id: string }>();

      if (existingBusinessError) throw existingBusinessError;

      let businessId = existingBusiness?.id || null;

      if (!businessId) {
        const { data: createdBusiness, error: businessError } =
          await supabaseAdmin
            .from("businesses")
            .insert({
              user_id: user.id,
              name: pendingBusiness.name,
              phone: pendingBusiness.phone,
              category: pendingBusiness.category,
              city: pendingBusiness.city,
              country: pendingBusiness.country,
              timezone: pendingBusiness.timezone || "Europe/London",
              currency: pendingBusiness.currency || "GBP",
              published: false,
            })
            .select("id")
            .single<{ id: string }>();

        if (businessError) throw businessError;
        businessId = createdBusiness.id;
      }

      if (pendingBusiness.ownerTakesBookings && businessId) {
        const { data: existingOwnerStaff, error: ownerStaffLookupError } =
          await supabaseAdmin
            .from("staff_members")
            .select("id")
            .eq("business_id", businessId)
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle<{ id: string }>();

        if (ownerStaffLookupError) throw ownerStaffLookupError;

        if (!existingOwnerStaff) {
          const { error: ownerStaffError } = await supabaseAdmin
            .from("staff_members")
            .insert({
              business_id: businessId,
              user_id: user.id,
              name: fullName || email.split("@")[0] || "Owner",
              email,
              phone: phone || pendingBusiness.phone || null,
              role_title: preferredLanguage === "sq" ? "Pronar" : "Owner",
              permission_role: "staff",
              invite_status: "linked",
              active: true,
            });

          if (ownerStaffError) throw ownerStaffError;
        }
      }
    }

    const { error: clearError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...metadata,
          pending_registration: false,
          pending_business: null,
        },
      },
    );

    if (clearError) throw clearError;

    return res.status(200).json({});
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
