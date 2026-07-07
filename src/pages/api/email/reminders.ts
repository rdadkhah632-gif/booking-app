import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { loadServerEmailPreferences } from "@/lib/email/preferences";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import { appointmentReminderEmailTemplate } from "@/lib/email/templates";
import { getAppBaseUrl } from "@/lib/server/appBaseUrl";
import { Locale } from "@/lib/i18n";

type ReminderBooking = {
  id: string;
  business_id: string;
  service_id?: string | null;
  staff_member_id?: string | null;
  customer_user_id?: string | null;
  customer_email?: string | null;
  start_at: string;
  status: string;
};

type ReminderCustomerProfile = {
  email?: string | null;
  preferred_language?: string | null;
};

function requestSecret(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const header = req.headers["x-reminder-secret"];
  return Array.isArray(header) ? header[0] || "" : header || "";
}

function configuredReminderSecrets() {
  return [
    process.env.REMINDER_CRON_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));
}

function localeFromProfile(profile?: ReminderCustomerProfile | null): Locale {
  return profile?.preferred_language === "sq" ? "sq" : "en";
}

function isReminderSchemaMissing(error: unknown) {
  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const text =
    `${candidate?.message || ""} ${candidate?.details || ""}`.toLowerCase();

  return (
    candidate?.code === "42P01" ||
    candidate?.code === "PGRST205" ||
    (text.includes("appointment_reminder_deliveries") &&
      (text.includes("does not exist") || text.includes("schema cache")))
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredSecrets = configuredReminderSecrets();
  if (configuredSecrets.length === 0) {
    return res.status(503).json({
      error: "Reminder processing is not configured",
      sent: 0,
    });
  }

  if (!configuredSecrets.includes(requestSecret(req))) {
    return res.status(401).json({ error: "Invalid reminder secret" });
  }

  const appUrl = getAppBaseUrl();
  if (!appUrl) {
    return res.status(503).json({
      error: "Reminder links require a valid application URL",
      sent: 0,
    });
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    return res.status(503).json({
      error: "Reminder processing requires Supabase service-role access",
      sent: 0,
    });
  }
  const { error: reminderSchemaError } = await supabaseAdmin
    .from("appointment_reminder_deliveries")
    .select("id")
    .limit(1);

  if (reminderSchemaError) {
    if (isReminderSchemaMissing(reminderSchemaError)) {
      return res.status(503).json({
        error: "Reminder SQL has not been installed",
        sqlRequired:
          "sources/sql/06_notification_email_preferences_and_reminders.sql",
        sent: 0,
      });
    }

    return res.status(500).json({
      error: "Could not verify reminder storage",
      sent: 0,
    });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, business_id, service_id, staff_member_id, customer_user_id, customer_email, start_at, status",
    )
    .eq("status", "confirmed")
    .gte("start_at", windowStart.toISOString())
    .lt("start_at", windowEnd.toISOString())
    .order("start_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[reminders] Could not load due bookings", {
      code: error.code,
    });
    return res.status(500).json({ error: "Could not load due reminders" });
  }

  const summary = {
    due: (data || []).length,
    sent: 0,
    skippedProvider: 0,
    skippedPreference: 0,
    skippedDuplicate: 0,
    missingRecipient: 0,
    failed: 0,
  };

  for (const booking of (data || []) as ReminderBooking[]) {
    if (!booking.customer_user_id) {
      summary.missingRecipient += 1;
      continue;
    }

    const { preferences } = await loadServerEmailPreferences(
      supabaseAdmin,
      booking.customer_user_id,
    );

    if (!preferences.email_booking_reminders) {
      summary.skippedPreference += 1;
      continue;
    }

    const { data: claim, error: claimError } = await supabaseAdmin
      .from("appointment_reminder_deliveries")
      .insert({
        booking_id: booking.id,
        recipient_user_id: booking.customer_user_id,
        reminder_type: "customer_24h",
        status: "processing",
      })
      .select("id")
      .single<{ id: string }>();

    if (claimError || !claim) {
      if (isReminderSchemaMissing(claimError)) {
        return res.status(503).json({
          error: "Reminder SQL has not been installed",
          sqlRequired:
            "sources/sql/06_notification_email_preferences_and_reminders.sql",
          ...summary,
        });
      }

      if ((claimError as { code?: string })?.code === "23505") {
        summary.skippedDuplicate += 1;
        continue;
      }

      summary.failed += 1;
      continue;
    }

    const [
      { data: business },
      { data: service },
      { data: staff },
      { data: customerProfile },
    ] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select("name")
        .eq("id", booking.business_id)
        .maybeSingle<{ name?: string | null }>(),
      booking.service_id
        ? supabaseAdmin
            .from("services")
            .select("name")
            .eq("id", booking.service_id)
            .maybeSingle<{ name?: string | null }>()
        : Promise.resolve({ data: null }),
      booking.staff_member_id
        ? supabaseAdmin
            .from("staff_members")
            .select("name")
            .eq("id", booking.staff_member_id)
            .maybeSingle<{ name?: string | null }>()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("profiles")
        .select("email, preferred_language")
        .eq("id", booking.customer_user_id)
        .maybeSingle<ReminderCustomerProfile>(),
    ]);

    const recipientEmail =
      booking.customer_email || customerProfile?.email || "";

    const result = await sendTransactionalEmail(
      appointmentReminderEmailTemplate({
        recipientEmail,
        businessName: business?.name,
        serviceName: service?.name,
        staffName: staff?.name,
        startAt: booking.start_at,
        actionUrl: `${appUrl}/booking-confirmation?id=${booking.id}`,
        locale: localeFromProfile(customerProfile),
        preferenceEnabled: preferences.email_booking_reminders,
      }),
    );

    if (result.status === "sent") {
      summary.sent += 1;
      await supabaseAdmin
        .from("appointment_reminder_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", claim.id);
      continue;
    }

    if (
      result.status === "skipped" &&
      ["provider_disabled", "unsupported_provider"].includes(result.reason)
    ) {
      summary.skippedProvider += 1;
      await supabaseAdmin
        .from("appointment_reminder_deliveries")
        .delete()
        .eq("id", claim.id);
      continue;
    }

    if (result.status === "skipped" && result.reason === "recipient_missing") {
      summary.missingRecipient += 1;
    } else {
      summary.failed += 1;
    }

    await supabaseAdmin
      .from("appointment_reminder_deliveries")
      .delete()
      .eq("id", claim.id);
  }

  return res.status(200).json({
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    provider: process.env.EMAIL_PROVIDER || "disabled",
    ...summary,
  });
}
