import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type NotificationRequest = {
  supportMessageId?: unknown;
  event?: unknown;
  summary?: unknown;
};

type SupportMessage = {
  id: string;
  user_id?: string | null;
  account_type?: string | null;
  subject?: string | null;
  name?: string | null;
  email?: string | null;
};

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function accountLabel(accountType?: string | null) {
  const value = accountType?.trim().toLowerCase();
  if (value === "business") return "business";
  if (value === "staff") return "staff";
  return "customer";
}

function notificationType(event: string, accountType?: string | null) {
  if (event === "support_reply") return "support_reply_user";

  const label = accountLabel(accountType);
  if (label === "business") return "support_request_business";
  if (label === "staff") return "support_request_staff";
  return "support_request";
}

function notificationTitle(event: string, accountType?: string | null) {
  if (event === "support_reply") return "User replied to support ticket";

  const label = accountLabel(accountType);
  if (label === "business") return "New business support request";
  if (label === "staff") return "New staff support request";
  return "New customer support request";
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const token = bearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const body = (request.body || {}) as NotificationRequest;
  const supportMessageId = cleanText(body.supportMessageId);
  const event = cleanText(body.event);
  const summary = cleanText(body.summary).slice(0, 280);

  if (
    !supportMessageId ||
    !["support_created", "support_reply"].includes(event)
  ) {
    response.status(400).json({ error: "Invalid support notification." });
    return;
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      response.status(401).json({ error: "Invalid session." });
      return;
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_messages")
      .select("id, user_id, account_type, subject, name, email")
      .eq("id", supportMessageId)
      .maybeSingle<SupportMessage>();

    if (ticketError) throw ticketError;
    if (!ticket) {
      response.status(404).json({ error: "Support message not found." });
      return;
    }

    if (ticket.user_id !== user.id) {
      response.status(403).json({ error: "Support message not permitted." });
      return;
    }

    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (adminsError) throw adminsError;

    if (!admins?.length) {
      response.status(200).json({ notified: 0 });
      return;
    }

    const requester =
      ticket.name?.trim() || ticket.email?.trim() || "Mirëbook user";
    const fallbackSummary =
      event === "support_reply"
        ? requester
        : `${ticket.subject || "Support request"} · ${requester}`;
    const message = summary || fallbackSummary;

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(
        admins.map((admin) => ({
          user_id: admin.id,
          title: notificationTitle(event, ticket.account_type),
          body: message,
          type: notificationType(event, ticket.account_type),
          action_url: `/admin/support?ticketId=${ticket.id}`,
        })),
      );

    if (insertError) throw insertError;

    response.status(200).json({ notified: admins.length });
  } catch (error) {
    console.error("[support-admin-notification] Request failed", error);
    response.status(500).json({ error: "Could not notify Mirëbook support." });
  }
}
