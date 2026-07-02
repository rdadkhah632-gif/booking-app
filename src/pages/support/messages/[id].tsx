import AuthNav from "@/components/AuthNav";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { requestSupportAdminNotification } from "@/lib/support/adminNotifications";

type SupportMessage = {
  id: string;
  user_id?: string | null;
  business_id?: string | null;
  subject?: string | null;
  category?: string | null;
  message?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupportReply = {
  id: string;
  support_message_id: string;
  sender_role?: string | null;
  message: string;
  created_at?: string | null;
};

function statusLabel(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string,
) {
  const value = String(status || "open").toLowerCase();

  if (value === "open") return t("support.status.open", "Open");
  if (value === "waiting" || value === "waiting_for_user") {
    return t("support.status.waitingForUser", "Waiting for user");
  }
  if (value === "in_review" || value === "in_progress") {
    return t("support.status.inProgress", "In progress");
  }
  if (value === "resolved") return t("support.status.resolved", "Resolved");
  if (value === "closed") return t("support.status.closed", "Closed");
  if (value === "normal") return t("support.priority.normal", "Normal");
  if (value === "high") return t("support.priority.high", "High");
  if (value === "urgent") return t("support.priority.urgent", "Urgent");

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

export default function SupportThreadPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = router.query;

  const [ticket, setTicket] = useState<SupportMessage | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    loadThread(id);
  }, [id]);

  async function loadThread(ticketId: string) {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = `/login?redirectTo=/support/messages/${ticketId}`;
      return;
    }

    setCurrentUserId(session.user.id);

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_messages")
      .select("*")
      .eq("id", ticketId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (ticketError || !ticketData) {
      setError(
        ticketError?.message ||
          t("support.thread.notFound", "Support conversation not found."),
      );
      setLoading(false);
      return;
    }

    setTicket(ticketData as SupportMessage);

    const { data: replyData, error: replyError } = await supabase
      .from("support_replies")
      .select("*")
      .eq("support_message_id", ticketId)
      .order("created_at", { ascending: true });

    if (replyError) {
      setError(replyError.message);
      setLoading(false);
      return;
    }

    setReplies((replyData || []) as SupportReply[]);
    setLoading(false);
  }

  const isResolved = useMemo(() => {
    return ["resolved", "closed"].includes(String(ticket?.status || ""));
  }, [ticket]);

  const unknownDate = t("support.messages.unknownDate", "Unknown date");

  async function sendReply() {
    if (!ticket || !replyBody.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const text = replyBody.trim();

    const { error: replyError } = await supabase
      .from("support_replies")
      .insert({
        support_message_id: ticket.id,
        sender_id: currentUserId,
        sender_role: "user",
        message: text,
      });

    if (replyError) {
      setSaving(false);
      setError(replyError.message);
      return;
    }

    await supabase
      .from("support_messages")
      .update({ status: "open" })
      .eq("id", ticket.id)
      .eq("user_id", currentUserId);

    void requestSupportAdminNotification({
      supportMessageId: ticket.id,
      event: "support_reply",
      summary: text.length > 120 ? `${text.slice(0, 117)}...` : text,
    });

    setReplyBody("");
    setSaving(false);
    setSuccess(
      t(
        "support.thread.replySent",
        "Reply sent. Mirëbook support has been notified.",
      ),
    );
    await loadThread(ticket.id);
  }

  if (loading) {
    return (
      <main>
        <AuthNav />
        <section
          className="container"
          style={{ paddingTop: 42, paddingBottom: 72 }}
        >
          <div className="card">
            <p className="muted">
              {t("support.thread.loading", "Loading support conversation...")}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <AuthNav />

      <section
        className="container"
        style={{ paddingTop: 42, paddingBottom: 72 }}
      >
        <div className="support-thread-shell">
          <div className="support-thread-header">
            <div>
              <p className="small" style={{ color: "var(--accent)" }}>
                {t("support.thread.kicker", "Support conversation")}
              </p>
              <h1 className="page-title">
                {ticket?.subject ||
                  ticket?.category ||
                  t("support.messages.requestFallback", "Support request")}
              </h1>
              <p className="page-sub" style={{ marginTop: "0.5rem" }}>
                {t(
                  "support.thread.subtitle",
                  "View replies from Mirëbook support and send follow-up information in the same conversation.",
                )}
              </p>
            </div>

            <div className="support-thread-actions">
              <Link href="/support/messages" className="btn btn-ghost">
                {t("support.thread.allMessages", "All messages")}
              </Link>
              <Link href="/support" className="btn btn-ghost">
                {t("support.messages.supportHub", "Support hub")}
              </Link>
            </div>
          </div>

          {error && (
            <div
              className="card"
              style={{ borderColor: "rgba(255,77,109,0.35)" }}
            >
              <p style={{ color: "var(--danger)" }}>{error}</p>
            </div>
          )}

          {success && (
            <div
              className="card"
              style={{
                borderColor: "rgba(45,212,191,0.35)",
                background: "rgba(45,212,191,0.06)",
              }}
            >
              <p style={{ color: "var(--success)" }}>{success}</p>
            </div>
          )}

          {ticket && (
            <>
              <div className="support-status-strip">
                <div>
                  <p className="small muted">
                    {t("support.thread.status", "Status")}
                  </p>
                  <strong>{statusLabel(ticket.status, t)}</strong>
                </div>
                <div>
                  <p className="small muted">
                    {t("support.thread.priority", "Priority")}
                  </p>
                  <strong>{statusLabel(ticket.priority || "normal", t)}</strong>
                </div>
                <div>
                  <p className="small muted">
                    {t("support.messages.created", "Created")}
                  </p>
                  <strong>{formatDate(ticket.created_at, unknownDate)}</strong>
                </div>
                <div>
                  <p className="small muted">
                    {t("support.messages.updated", "Updated")}
                  </p>
                  <strong>
                    {formatDate(
                      ticket.updated_at || ticket.created_at,
                      unknownDate,
                    )}
                  </strong>
                </div>
              </div>

              <div className="card support-thread-card">
                <div className="support-message user">
                  <p className="small muted">
                    {t(
                      "support.thread.originalMessage",
                      "Your original message",
                    )}{" "}
                    · {formatDate(ticket.created_at, unknownDate)}
                  </p>
                  <p>
                    {ticket.message ||
                      t(
                        "support.thread.noMessageBody",
                        "No message body provided.",
                      )}
                  </p>
                </div>

                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={
                      reply.sender_role === "admin"
                        ? "support-message admin"
                        : "support-message user"
                    }
                  >
                    <p className="small muted">
                      {reply.sender_role === "admin"
                        ? t(
                            "support.thread.mirebookSupport",
                            "Mirëbook support",
                          )
                        : t("support.thread.you", "You")}{" "}
                      · {formatDate(reply.created_at, unknownDate)}
                    </p>
                    <p>{reply.message}</p>
                  </div>
                ))}
              </div>

              <div
                className={
                  isResolved
                    ? "card support-reply-card resolved"
                    : "card support-reply-card"
                }
              >
                <p className="small muted">
                  {isResolved
                    ? t(
                        "support.thread.resolvedConversation",
                        "Resolved conversation",
                      )
                    : t("support.thread.replyToSupport", "Reply to support")}
                </p>
                {isResolved ? (
                  <>
                    <h3>
                      {t(
                        "support.thread.resolvedTitle",
                        "This ticket is marked as resolved",
                      )}
                    </h3>
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                      {t(
                        "support.thread.resolvedBody",
                        "Start a new support request if you need help with a different issue.",
                      )}
                    </p>
                    <Link
                      href="/support"
                      className="btn btn-accent"
                      style={{ marginTop: "1rem" }}
                    >
                      {t(
                        "support.thread.startNewRequest",
                        "Start new support request",
                      )}
                    </Link>
                  </>
                ) : (
                  <>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={5}
                      placeholder={t(
                        "support.thread.replyPlaceholder",
                        "Add more details or reply to Mirëbook support...",
                      )}
                    />
                    <div className="support-reply-actions">
                      <button
                        type="button"
                        className="btn btn-accent"
                        onClick={sendReply}
                        disabled={saving || !replyBody.trim()}
                      >
                        {saving
                          ? t("support.thread.sending", "Sending...")
                          : t("support.thread.sendReply", "Send reply")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .support-thread-shell {
          max-width: 920px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .support-thread-header,
        .support-thread-actions,
        .support-reply-actions {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .support-status-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .support-status-strip div {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .support-thread-card {
          display: grid;
          gap: 0.85rem;
        }

        .support-message {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
          display: grid;
          gap: 0.35rem;
        }

        .support-message.user {
          background: var(--surface-2);
          border-color: rgba(255, 107, 53, 0.22);
        }

        .support-message.admin {
          background: rgba(45, 212, 191, 0.06);
          border-color: rgba(45, 212, 191, 0.28);
        }

        .support-reply-card {
          display: grid;
          gap: 0.75rem;
        }

        .support-reply-card.resolved {
          border-color: rgba(45, 212, 191, 0.28);
          background: rgba(45, 212, 191, 0.06);
        }

        textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-2);
          color: var(--text);
          padding: 0.85rem;
        }

        @media (max-width: 640px) {
          .support-thread-header,
          .support-thread-actions {
            display: grid;
          }

          .support-status-strip {
            grid-template-columns: 1fr;
          }

          .support-thread-actions,
          .support-thread-actions :global(.btn),
          .support-thread-actions a,
          .support-reply-actions,
          .support-reply-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
