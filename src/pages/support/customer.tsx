import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { requestTransactionalEmail } from "@/lib/email/client";
import { requestSupportAdminNotification } from "@/lib/support/adminNotifications";

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
};

const CUSTOMER_SUBJECT_KEYS = [
  "support.customer.subject.pending",
  "support.customer.subject.cancel",
  "support.customer.subject.noResponse",
  "support.customer.subject.wrongDetails",
  "support.customer.subject.account",
  "support.customer.subject.notifications",
  "support.customer.subject.other",
];

export default function CustomerSupportPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(CUSTOMER_SUBJECT_KEYS[0]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login?redirectTo=/support/customer");
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      setError(
        t(
          "support.customer.contextError",
          "We could not load your customer account for support. Please refresh and try again.",
        ),
      );
      setLoading(false);
      return;
    }

    if (data) {
      setProfile(data);
      setName(data.full_name || "");
      setEmail(data.email || "");
    }

    setLoading(false);
  }

  async function submitSupportMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!profile) {
      setError(t("support.customer.loginRequired"));
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setError(t("support.customer.validation"));
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    setCreatedTicketId(null);

    const ticketSubject = t(subject).trim();
    const ticketMessage = message.trim();
    const ticketPriority =
      subject === "support.customer.subject.noResponse" ? "high" : "normal";

    const { data: insertedTicket, error: insertError } = await supabase
      .from("support_messages")
      .insert({
        user_id: profile.id,
        account_type: "customer",
        name: name.trim() || profile.full_name || null,
        email: email.trim() || profile.email || null,
        category: "customer_support",
        subject: ticketSubject,
        message: ticketMessage,
        status: "open",
        priority: ticketPriority,
      })
      .select("id")
      .single();

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const ticketId = insertedTicket?.id || null;
    setCreatedTicketId(ticketId);

    if (ticketId) {
      void requestSupportAdminNotification({
        supportMessageId: ticketId,
        event: "support_created",
        summary: `${ticketSubject} · ${name.trim() || profile.full_name || profile.email || "Customer"}`,
      });
      void requestTransactionalEmail({
        event: "support_created",
        supportMessageId: ticketId,
      });
    }

    setSuccess(t("support.customer.success"));
    setMessage("");
    setSubject(CUSTOMER_SUBJECT_KEYS[0]);
  }

  return (
    <main>
      <AuthNav />

      <section
        className="container"
        style={{ paddingTop: 24, paddingBottom: 56 }}
      >
        <div className="support-shell">
          <div className="card support-hero">
            <h1 className="page-title">{t("support.customer.heroTitle")}</h1>
            <p className="page-sub" style={{ marginTop: "0.6rem" }}>
              {t(
                "support.customer.heroBody",
                "Get help with your customer bookings, appointment requests, cancellations, notifications or account details.",
              )}
            </p>
            <div className="support-hero-actions">
              <Link href="/support/messages" className="btn btn-accent">
                {t("support.customer.myMessages", "My support messages")}
              </Link>
            </div>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">{t("support.customer.loading")}</p>
            </div>
          )}

          {error && (
            <div
              className="card"
              style={{ borderColor: "rgba(255,77,109,0.35)" }}
            >
              <p style={{ color: "var(--danger)" }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="card support-success-card">
              <p style={{ color: "var(--success)" }}>{success}</p>
              <p className="small muted" style={{ marginTop: "0.4rem" }}>
                {t(
                  "support.customer.successBody",
                  "Your message is now saved as a support conversation. Mirëbook support will reply there.",
                )}
              </p>
              <div className="support-success-actions">
                {createdTicketId && (
                  <Link
                    href={`/support/messages/${createdTicketId}`}
                    className="btn btn-accent"
                  >
                    {t(
                      "support.customer.viewConversation",
                      "View conversation",
                    )}
                  </Link>
                )}
                <Link href="/support/messages" className="btn btn-ghost">
                  {t(
                    "support.customer.allConversations",
                    "All support messages",
                  )}
                </Link>
              </div>
            </div>
          )}

          {!loading && profile && (
            <div className="support-grid">
              <form
                onSubmit={submitSupportMessage}
                className="card support-form-card"
              >
                <div>
                  <h2>{t("support.customer.formTitle")}</h2>
                </div>

                <div className="support-form-grid">
                  <div>
                    <label className="small muted">{t("common.name")}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("support.customer.namePlaceholder")}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>

                  <div>
                    <label className="small muted">{t("common.email")}</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("support.customer.emailPlaceholder")}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("support.customer.subjectLabel")}
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      style={{ marginTop: "0.4rem" }}
                    >
                      {CUSTOMER_SUBJECT_KEYS.map((item) => (
                        <option key={item} value={item}>
                          {t(item)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("support.customer.messageLabel")}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("support.customer.messagePlaceholder")}
                      rows={5}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>
                </div>

                <p className="small muted support-submit-note">
                  {t(
                    "support.customer.beforeSending.body",
                    "Include the business name, appointment date and what you expected to happen.",
                  )}
                </p>

                <button
                  type="submit"
                  className="btn btn-accent"
                  disabled={sending}
                >
                  {sending
                    ? t("support.customer.sending")
                    : t("support.customer.sendButton")}
                </button>
              </form>

              <div className="card support-side-card">
                <h2>{t("support.customer.quickActions")}</h2>

                <div className="support-link-list">
                  <Link href="/support/messages" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>
                        {t(
                          "support.customer.myMessages",
                          "My support messages",
                        )}
                      </strong>
                      <small>
                        {t(
                          "support.customer.myMessagesBody",
                          "Read support replies and continue conversations.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/my-bookings" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("nav.myBookings")}</strong>
                      <small>{t("support.customer.bookingsBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/notifications" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("nav.notifications")}</strong>
                      <small>{t("support.customer.notificationsBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .support-shell {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          gap: 0.75rem;
        }

        .support-hero {
          padding: 0.95rem 1rem;
          background: rgba(255, 107, 53, 0.08);
          border-color: rgba(255, 107, 53, 0.25);
        }

        .support-hero-actions,
        .support-success-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .support-success-card {
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.06);
        }

        .support-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
          gap: 0.8rem;
          align-items: start;
        }

        .support-form-card,
        .support-side-card {
          display: grid;
          gap: 0.78rem;
        }

        .support-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.72rem 0.85rem;
        }

        .full-span {
          grid-column: 1 / -1;
        }

        .support-submit-note {
          margin: -0.15rem 0 0;
        }

        .support-link-list {
          display: grid;
          gap: 0.55rem;
        }

        .support-link-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.72rem 0.78rem;
        }

        .support-link-copy {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 0.28rem;
          min-width: 0;
          text-align: left;
        }

        .support-link-copy strong {
          display: block;
          line-height: 1.2;
        }

        .support-link-copy small {
          display: block;
          color: var(--text-muted);
          line-height: 1.35;
        }

        @media (max-width: 860px) {
          .support-grid,
          .support-form-grid {
            grid-template-columns: 1fr;
          }

          .support-hero-actions,
          .support-hero-actions :global(.btn),
          .support-success-actions,
          .support-success-actions :global(.btn),
          .support-form-card button {
            width: 100%;
            justify-content: center;
          }

          .support-link-row {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}
