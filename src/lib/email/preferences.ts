export type EmailPreferences = {
  email_booking_request_updates: boolean;
  email_booking_confirmations: boolean;
  email_booking_cancellations: boolean;
  email_booking_reminders: boolean;
  email_support_updates: boolean;
  email_new_booking_requests: boolean;
  email_instant_booking_confirmations: boolean;
  email_customer_cancellations: boolean;
  email_reschedule_updates: boolean;
  email_billing_updates: boolean;
  email_staff_booking_assignments: boolean;
  email_staff_booking_changes: boolean;
  email_staff_reminders: boolean;
};

export type EmailPreferenceKey = keyof EmailPreferences;

export const defaultEmailPreferences: EmailPreferences = {
  email_booking_request_updates: true,
  email_booking_confirmations: true,
  email_booking_cancellations: true,
  email_booking_reminders: true,
  email_support_updates: true,
  email_new_booking_requests: true,
  email_instant_booking_confirmations: true,
  email_customer_cancellations: true,
  email_reschedule_updates: true,
  email_billing_updates: true,
  email_staff_booking_assignments: true,
  email_staff_booking_changes: true,
  email_staff_reminders: true,
};

export function isPreferencesSchemaMissing(error: unknown) {
  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const text = `${candidate?.message || ""} ${candidate?.details || ""}`.toLowerCase();

  return (
    candidate?.code === "42P01" ||
    candidate?.code === "PGRST205" ||
    (text.includes("notification_email_preferences") &&
      (text.includes("does not exist") || text.includes("schema cache")))
  );
}

export async function loadServerEmailPreferences(
  supabaseAdmin: any,
  userId?: string | null,
) {
  if (!userId) {
    return {
      preferences: defaultEmailPreferences,
      source: "default" as const,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("notification_email_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (!isPreferencesSchemaMissing(error)) {
      console.warn("[email] Could not load email preferences", {
        code: error.code,
      });
    }

    return {
      preferences: defaultEmailPreferences,
      source: "default" as const,
    };
  }

  return {
    preferences: {
      ...defaultEmailPreferences,
      ...(data || {}),
    } as EmailPreferences,
    source: data ? ("stored" as const) : ("default" as const),
  };
}
