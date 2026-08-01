import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
  type AppContext,
} from "@/lib/server/app-api/context";

type AccountDeletionBody = {
  confirmationEmail?: unknown;
};

type ActiveDeletionRequest = {
  id: string;
  status: "pending" | "processing";
  target_completion_at: string;
};

const DEFAULT_COMPLETION_DAYS = 30;

function normalizedEmail(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().slice(0, 320)
    : "";
}

function completionDays() {
  const configured = Number.parseInt(
    process.env.ACCOUNT_DELETION_COMPLETION_DAYS || "",
    10,
  );
  return Number.isFinite(configured) && configured >= 1 && configured <= 30
    ? configured
    : DEFAULT_COMPLETION_DAYS;
}

function deletionMessage(language: string | null | undefined, days: number) {
  return language === "sq"
    ? `Kërkesa u pranua. Llogaria dhe të dhënat që nuk kërkohet ligjërisht të ruhen do të fshihen brenda ${days} ditësh. Do të merrni konfirmim me email kur të përfundojë.`
    : `Request accepted. Your account and data that we are not legally required to retain will be deleted within ${days} days. We will email you when it is complete.`;
}

function missingDeletionContract(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message?.toLowerCase() || "";
  return (
    ["42P01", "PGRST205"].includes(error.code || "") ||
    message.includes("account_deletion_requests")
  );
}

function deletionContext(context: AppContext) {
  return {
    isAdmin: context.isAdmin,
    canUseBusiness: context.canUseBusiness,
    canUseStaff: context.canUseStaff,
    ownedBusinessCount: context.ownedBusinesses.length,
    linkedStaffProfileCount: context.linkedStaffProfiles.length,
  };
}

function acceptedResponse(
  response: NextApiResponse,
  context: AppContext,
  request: ActiveDeletionRequest,
  days: number,
) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json({
    status: "scheduled",
    message: deletionMessage(context.profile?.preferred_language, days),
    scheduledFor: request.target_completion_at,
  });
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "DELETE") {
    response.setHeader("Allow", "DELETE");
    return errorResponse(
      response,
      405,
      "method_not_allowed",
      "Method not allowed",
    );
  }

  try {
    const context = await loadAppContext(request);
    const body = (request.body || {}) as AccountDeletionBody;
    const confirmationEmail = normalizedEmail(body.confirmationEmail);
    const accountEmail = normalizedEmail(context.user.email);

    if (!confirmationEmail || confirmationEmail !== accountEmail) {
      return errorResponse(
        response,
        400,
        "confirmation_email_mismatch",
        context.profile?.preferred_language === "sq"
          ? "Shkruani email-in e saktë të llogarisë"
          : "Enter the exact email for this account",
      );
    }

    const days = completionDays();
    const { data: existing, error: existingError } = await context.supabaseAdmin
      .from("account_deletion_requests")
      .select("id, status, target_completion_at")
      .eq("user_id", context.user.id)
      .in("status", ["pending", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle<ActiveDeletionRequest>();

    if (existingError) {
      if (missingDeletionContract(existingError)) {
        return errorResponse(
          response,
          503,
          "account_deletion_not_configured",
          context.profile?.preferred_language === "sq"
            ? "Fshirja e llogarisë po konfigurohet. Asnjë e dhënë e llogarisë nuk u ndryshua."
            : "Account deletion is being configured. No account data was changed.",
        );
      }
      throw existingError;
    }

    if (existing) {
      return acceptedResponse(response, context, existing, days);
    }

    const targetCompletion = new Date(
      Date.now() + days * 24 * 60 * 60 * 1_000,
    ).toISOString();
    const { data: created, error: createError } = await context.supabaseAdmin
      .from("account_deletion_requests")
      .insert({
        user_id: context.user.id,
        source_app: "ios_native",
        status: "pending",
        confirmation_method: "exact_email",
        target_completion_at: targetCompletion,
        account_context: deletionContext(context),
      })
      .select("id, status, target_completion_at")
      .single<ActiveDeletionRequest>();

    if (createError) {
      if (missingDeletionContract(createError)) {
        return errorResponse(
          response,
          503,
          "account_deletion_not_configured",
          context.profile?.preferred_language === "sq"
            ? "Fshirja e llogarisë po konfigurohet. Asnjë e dhënë e llogarisë nuk u ndryshua."
            : "Account deletion is being configured. No account data was changed.",
        );
      }

      if (createError.code === "23505") {
        const { data: concurrentRequest, error: concurrentError } =
          await context.supabaseAdmin
            .from("account_deletion_requests")
            .select("id, status, target_completion_at")
            .eq("user_id", context.user.id)
            .in("status", ["pending", "processing"])
            .limit(1)
            .maybeSingle<ActiveDeletionRequest>();

        if (!concurrentError && concurrentRequest) {
          return acceptedResponse(
            response,
            context,
            concurrentRequest,
            days,
          );
        }
      }
      throw createError;
    }

    return acceptedResponse(response, context, created, days);
  } catch (error) {
    const details = error as { statusCode?: number; code?: string };
    if (details.statusCode) return handleAppApiError(response, error);
    console.error("[account-deletion] Request failed", {
      code: details.code || "unknown",
    });
    return errorResponse(
      response,
      500,
      "account_deletion_failed",
      "Account deletion could not be scheduled. No account data was changed.",
    );
  }
}
