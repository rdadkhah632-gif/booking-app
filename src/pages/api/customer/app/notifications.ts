import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import {
  defaultEmailPreferences,
  isPreferencesSchemaMissing,
  loadServerEmailPreferences,
} from "@/lib/email/preferences";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_TOKEN_PATTERN = /^[0-9a-f]{32,512}$/i;
const CUSTOMER_IOS_BUNDLE_ID = "com.mirebook.ios.customer";
const CUSTOMER_PREFERENCE_KEYS = [
  "email_booking_request_updates",
  "email_booking_confirmations",
  "email_booking_cancellations",
  "email_booking_reminders",
  "email_support_updates",
] as const;

type CustomerPreferenceKey = (typeof CUSTOMER_PREFERENCE_KEYS)[number];
type NotificationAction =
  | "mark_read"
  | "mark_all_read"
  | "save_preferences"
  | "register_push"
  | "unregister_push";

type ActionBody = {
  action?: unknown;
  notificationId?: unknown;
  preferences?: unknown;
  installationId?: unknown;
  deviceToken?: unknown;
  environment?: unknown;
  language?: unknown;
};

function cleanText(value: unknown, maxLength = 512) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function missingPushContract(
  error: { code?: string; message?: string } | null,
) {
  const message = error?.message?.toLowerCase() || "";
  return (
    ["42P01", "PGRST205"].includes(error?.code || "") ||
    message.includes("customer_push_devices")
  );
}

function customerPreferences(
  preferences: typeof defaultEmailPreferences,
): Record<CustomerPreferenceKey, boolean> {
  return {
    email_booking_request_updates: preferences.email_booking_request_updates,
    email_booking_confirmations: preferences.email_booking_confirmations,
    email_booking_cancellations: preferences.email_booking_cancellations,
    email_booking_reminders: preferences.email_booking_reminders,
    email_support_updates: preferences.email_support_updates,
  };
}

function parsePreferences(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    CUSTOMER_PREFERENCE_KEYS.some((key) => typeof candidate[key] !== "boolean")
  ) {
    return null;
  }
  return Object.fromEntries(
    CUSTOMER_PREFERENCE_KEYS.map((key) => [key, candidate[key]]),
  ) as Record<CustomerPreferenceKey, boolean>;
}

async function loadNotifications(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  const context = await loadAppContext(request);
  const [{ data, error }, preferenceResult] = await Promise.all([
    context.supabaseAdmin
      .from("notifications")
      .select(
        "id, booking_id, booking_request_id, audience, type, title, message, action_url, read_at, created_at",
      )
      .eq("user_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    loadServerEmailPreferences(context.supabaseAdmin, context.user.id),
  ]);

  if (error) throw error;
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json({
    notifications: data || [],
    preferences: customerPreferences(preferenceResult.preferences),
    preferencesSource: preferenceResult.source,
  });
}

async function performAction(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  const context = await loadAppContext(request);
  const body = (request.body || {}) as ActionBody;
  const action = cleanText(body.action, 50) as NotificationAction;

  if (action === "mark_read") {
    const notificationId = cleanText(body.notificationId, 36);
    if (!UUID_PATTERN.test(notificationId)) {
      return errorResponse(
        response,
        400,
        "invalid_notification",
        "Choose a valid notification",
      );
    }
    const readAt = new Date().toISOString();
    const { data, error } = await context.supabaseAdmin
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId)
      .eq("user_id", context.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return errorResponse(
        response,
        404,
        "notification_not_found",
        "Notification not found",
      );
    }
    return response.status(200).json({ action, readAt });
  }

  if (action === "mark_all_read") {
    const readAt = new Date().toISOString();
    const { data, error } = await context.supabaseAdmin
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", context.user.id)
      .is("read_at", null)
      .select("id");
    if (error) throw error;
    return response
      .status(200)
      .json({ action, readAt, updated: data?.length || 0 });
  }

  if (action === "save_preferences") {
    const preferences = parsePreferences(body.preferences);
    if (!preferences) {
      return errorResponse(
        response,
        400,
        "invalid_preferences",
        "Choose valid email preferences",
      );
    }
    const { error } = await context.supabaseAdmin
      .from("notification_email_preferences")
      .upsert(
        { user_id: context.user.id, ...preferences },
        { onConflict: "user_id" },
      );
    if (error) {
      if (isPreferencesSchemaMissing(error)) {
        return errorResponse(
          response,
          503,
          "preferences_not_available",
          "Email preferences are not available yet",
        );
      }
      throw error;
    }
    return response.status(200).json({ action, preferences });
  }

  if (action === "register_push") {
    const installationId = cleanText(body.installationId, 36);
    const deviceToken = cleanText(body.deviceToken).toLowerCase();
    const environment =
      body.environment === "production" ? "production" : "sandbox";
    const language = body.language === "sq" ? "sq" : "en";
    if (
      !UUID_PATTERN.test(installationId) ||
      !DEVICE_TOKEN_PATTERN.test(deviceToken)
    ) {
      return errorResponse(
        response,
        400,
        "invalid_push_registration",
        "Push registration is invalid",
      );
    }

    const { error } = await context.supabaseAdmin
      .from("customer_push_devices")
      .upsert(
        {
          user_id: context.user.id,
          installation_id: installationId,
          device_token: deviceToken,
          platform: "ios",
          app_bundle_id: CUSTOMER_IOS_BUNDLE_ID,
          apns_environment: environment,
          preferred_language: language,
          enabled: true,
          disabled_at: null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "app_bundle_id,installation_id" },
      );
    if (error) {
      if (missingPushContract(error)) {
        return errorResponse(
          response,
          503,
          "push_contract_not_installed",
          "Device alerts are not configured yet",
        );
      }
      throw error;
    }
    return response.status(200).json({ action, status: "registered" });
  }

  if (action === "unregister_push") {
    const installationId = cleanText(body.installationId, 36);
    if (!UUID_PATTERN.test(installationId)) {
      return errorResponse(
        response,
        400,
        "invalid_push_registration",
        "Push registration is invalid",
      );
    }
    const { error } = await context.supabaseAdmin
      .from("customer_push_devices")
      .update({
        enabled: false,
        disabled_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .eq("app_bundle_id", CUSTOMER_IOS_BUNDLE_ID)
      .eq("installation_id", installationId)
      .eq("user_id", context.user.id);
    if (error) {
      if (missingPushContract(error)) {
        return errorResponse(
          response,
          503,
          "push_contract_not_installed",
          "Device alerts are not configured yet",
        );
      }
      throw error;
    }
    return response.status(200).json({ action, status: "unregistered" });
  }

  return errorResponse(
    response,
    400,
    "invalid_action",
    "Choose a valid notification action",
  );
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (!["GET", "POST"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST");
    return errorResponse(
      response,
      405,
      "method_not_allowed",
      "Method not allowed",
    );
  }

  try {
    return request.method === "GET"
      ? await loadNotifications(request, response)
      : await performAction(request, response);
  } catch (error) {
    const details = error as { statusCode?: number; code?: string };
    if (details.statusCode) return handleAppApiError(response, error);
    console.error("[customer-notifications] Request failed", {
      code: details.code || "unknown",
    });
    return errorResponse(
      response,
      500,
      "notifications_unavailable",
      "Notifications could not be updated",
    );
  }
}
