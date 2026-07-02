import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type SupportReplyRequest = {
  supportMessageId?: unknown;
  message?: unknown;
};

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function cleanMessage(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 5000) : "";
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

  const body = (request.body || {}) as SupportReplyRequest;
  const supportMessageId =
    typeof body.supportMessageId === "string"
      ? body.supportMessageId.trim()
      : "";
  const message = cleanMessage(body.message);

  if (!supportMessageId || !message) {
    response.status(400).json({ error: "Reply message required." });
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
      .select("id, user_id, status")
      .eq("id", supportMessageId)
      .maybeSingle<{
        id: string;
        user_id?: string | null;
        status?: string | null;
      }>();

    if (ticketError) throw ticketError;
    if (!ticket || ticket.user_id !== user.id) {
      response.status(404).json({ error: "Support conversation not found." });
      return;
    }

    if (["resolved", "closed"].includes(String(ticket.status || ""))) {
      response.status(409).json({ error: "Support conversation is closed." });
      return;
    }

    const now = new Date().toISOString();
    const { data: reply, error: replyError } = await supabaseAdmin
      .from("support_replies")
      .insert({
        support_message_id: ticket.id,
        sender_id: user.id,
        sender_role: "user",
        message,
      })
      .select("id")
      .single<{ id: string }>();

    if (replyError) throw replyError;

    const { error: updateError } = await supabaseAdmin
      .from("support_messages")
      .update({ status: "open", updated_at: now })
      .eq("id", ticket.id);

    if (updateError) throw updateError;

    response.status(200).json({ replyId: reply.id });
  } catch (error) {
    console.error("[support-reply] Request failed", error);
    response.status(500).json({ error: "Could not send support reply." });
  }
}
