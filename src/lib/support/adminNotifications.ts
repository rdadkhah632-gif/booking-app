import { supabase } from "@/lib/supabaseClient";

type SupportAdminNotificationEvent = "support_created" | "support_reply";

type SupportAdminNotificationRequest = {
  supportMessageId: string;
  event: SupportAdminNotificationEvent;
  summary?: string;
};

export async function requestSupportAdminNotification({
  supportMessageId,
  event,
  summary,
}: SupportAdminNotificationRequest) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  try {
    await fetch("/api/support/admin-notification", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        supportMessageId,
        event,
        summary,
      }),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Could not request support admin notification", error);
    }
  }
}
