import { ownershipClaimEmailTemplate } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import type { TransactionalEmailResult } from "@/lib/email/types";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;
type ClaimLocale = "en" | "sq";
type ClaimStatus =
  | "submitted"
  | "needs_more_info"
  | "approved"
  | "rejected";

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  preferred_language?: string | null;
};

const CLAIM_NOTIFICATION_COPY: Record<
  ClaimLocale,
  {
    adminTitle: string;
    adminMessage: (businessName: string, placeName: string) => string;
    owner: Record<
      ClaimStatus,
      {
        title: string;
        message: (placeName: string) => string;
      }
    >;
  }
> = {
  en: {
    adminTitle: "Ownership claim needs review",
    adminMessage: (businessName, placeName) =>
      `${businessName} submitted an ownership claim for ${placeName}.`,
    owner: {
      submitted: {
        title: "Ownership claim received",
        message: (placeName) =>
          `Mirëbook is reviewing your ownership request for ${placeName}.`,
      },
      needs_more_info: {
        title: "Ownership information needed",
        message: (placeName) =>
          `Open your ${placeName} request and add the information from the review note.`,
      },
      approved: {
        title: "Ownership claim approved",
        message: (placeName) =>
          `${placeName} is linked to your business. Complete Setup before publishing.`,
      },
      rejected: {
        title: "Ownership claim not approved",
        message: (placeName) =>
          `Open the ${placeName} request to review the decision.`,
      },
    },
  },
  sq: {
    adminTitle: "Pretendim pronësie për shqyrtim",
    adminMessage: (businessName, placeName) =>
      `${businessName} dërgoi një pretendim pronësie për ${placeName}.`,
    owner: {
      submitted: {
        title: "Pretendimi i pronësisë u mor",
        message: (placeName) =>
          `Mirëbook po shqyrton kërkesën tënde të pronësisë për ${placeName}.`,
      },
      needs_more_info: {
        title: "Nevojiten të dhëna pronësie",
        message: (placeName) =>
          `Hap kërkesën për ${placeName} dhe shto të dhënat nga shënimi i shqyrtimit.`,
      },
      approved: {
        title: "Pretendimi i pronësisë u miratua",
        message: (placeName) =>
          `${placeName} është lidhur me biznesin tënd. Përfundo Konfigurimin përpara publikimit.`,
      },
      rejected: {
        title: "Pretendimi i pronësisë nuk u miratua",
        message: (placeName) =>
          `Hap kërkesën për ${placeName} për të parë vendimin.`,
      },
    },
  },
};

function localeFor(profile?: ProfileRow | null): ClaimLocale {
  return profile?.preferred_language === "sq" ? "sq" : "en";
}

function absoluteUrl(kind: "customer" | "business", path: string) {
  const configured =
    kind === "business"
      ? process.env.NEXT_PUBLIC_BUSINESS_APP_URL?.trim()
      : process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fallback =
    process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
  const origin = configured || fallback;
  if (!origin) return null;

  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

async function ownerProfile(supabase: SupabaseAdmin, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, preferred_language")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  return data;
}

async function adminProfiles(supabase: SupabaseAdmin) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, preferred_language")
    .eq("is_admin", true)
    .returns<ProfileRow[]>();
  if (error) throw error;
  return data || [];
}

async function insertNotifications(
  supabase: SupabaseAdmin,
  rows: Record<string, unknown>[],
) {
  if (!rows.length) return;
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
}

export async function notifyDirectoryClaimSubmitted(params: {
  supabase: SupabaseAdmin;
  claimId: string;
  claimantUserId: string;
  businessId: string;
  businessName: string;
  placeId: string;
  placeName: string;
}) {
  const [claimant, admins] = await Promise.all([
    ownerProfile(params.supabase, params.claimantUserId),
    adminProfiles(params.supabase),
  ]);
  const ownerLocale = localeFor(claimant);
  const ownerCopy = CLAIM_NOTIFICATION_COPY[ownerLocale].owner.submitted;
  const ownerPath = `/claim/${params.placeId}`;
  const adminPath = `/admin/directory-claims?claimId=${params.claimId}`;

  await insertNotifications(params.supabase, [
    {
      user_id: params.claimantUserId,
      business_id: params.businessId,
      audience: "business",
      type: "directory_claim_submitted",
      title: ownerCopy.title,
      message: ownerCopy.message(params.placeName),
      action_url: ownerPath,
    },
    ...admins.map((admin) => {
      const copy = CLAIM_NOTIFICATION_COPY[localeFor(admin)];
      return {
        user_id: admin.id,
        audience: "admin",
        type: "directory_claim_submitted",
        title: copy.adminTitle,
        message: copy.adminMessage(params.businessName, params.placeName),
        action_url: adminPath,
      };
    }),
  ]);

  const deliveries: Promise<TransactionalEmailResult>[] = [];
  const ownerActionUrl = absoluteUrl("business", ownerPath);
  if (claimant?.email && ownerActionUrl) {
    deliveries.push(
      sendTransactionalEmail(
        ownershipClaimEmailTemplate({
          recipientEmail: claimant.email,
          recipientRole: "owner",
          status: "submitted",
          placeName: params.placeName,
          businessName: params.businessName,
          actionUrl: ownerActionUrl,
          locale: ownerLocale,
        }),
      ),
    );
  }

  const operatorEmail = process.env.SUPPORT_ADMIN_EMAIL?.trim();
  const operatorActionUrl = absoluteUrl("customer", adminPath);
  if (operatorEmail && operatorActionUrl) {
    deliveries.push(
      sendTransactionalEmail(
        ownershipClaimEmailTemplate({
          recipientEmail: operatorEmail,
          recipientRole: "operator",
          status: "submitted",
          placeName: params.placeName,
          businessName: params.businessName,
          actionUrl: operatorActionUrl,
          locale: "en",
        }),
      ),
    );
  }

  await Promise.all(deliveries);
}

export async function notifyDirectoryClaimReviewed(params: {
  supabase: SupabaseAdmin;
  claimantUserId: string;
  businessId: string;
  businessName: string;
  placeId: string;
  placeName: string;
  status: Exclude<ClaimStatus, "submitted">;
  reviewNote?: string | null;
}) {
  const claimant = await ownerProfile(params.supabase, params.claimantUserId);
  const locale = localeFor(claimant);
  const copy = CLAIM_NOTIFICATION_COPY[locale].owner[params.status];
  const actionPath =
    params.status === "approved"
      ? "/dashboard/businesses"
      : `/claim/${params.placeId}`;

  await insertNotifications(params.supabase, [
    {
      user_id: params.claimantUserId,
      business_id: params.businessId,
      audience: "business",
      type: `directory_claim_${params.status}`,
      title: copy.title,
      message: copy.message(params.placeName),
      action_url: actionPath,
    },
  ]);

  const actionUrl = absoluteUrl("business", actionPath);
  if (!claimant?.email || !actionUrl) return;

  await sendTransactionalEmail(
    ownershipClaimEmailTemplate({
      recipientEmail: claimant.email,
      recipientRole: "owner",
      status: params.status,
      placeName: params.placeName,
      businessName: params.businessName,
      actionUrl,
      reviewNote: params.reviewNote,
      locale,
    }),
  );
}
