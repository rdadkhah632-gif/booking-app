import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
};

type AdminProfile = {
  id: string;
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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login?redirectTo=/support/customer");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setProfile(data);
      setName(data.full_name || "");
      setEmail(data.email || "");
    }

    setLoading(false);
  }

  async function notifyAdmins(ticketId: string, title: string, body: string) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (!admins || admins.length === 0) return;

    await supabase.from("notifications").insert(
      admins.map((admin: AdminProfile) => ({
        user_id: admin.id,
        title,
        body,
        type: "support_request",
        action_url: `/admin/support`,
      })),
    );
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
      await notifyAdmins(
        ticketId,
        t(
          "support.customer.adminNotificationTitle",
          "New customer support request",
        ),
        `${ticketSubject} · ${name.trim() || profile.full_name || profile.email || "Customer"}`,
      );
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
        style={{ paddingTop: 42, paddingBottom: 72 }}
      >
        <div className="support-shell">
          <div className="card support-hero">
            <p className="small" style={{ color: "var(--accent)" }}>
              {t("nav.customerSupport")}
            </p>
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
              <Link href="/my-bookings" className="btn btn-ghost">
                {t("nav.myBookings", "My bookings")}
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

          {!loading && (
            <div className="support-grid">
              <form
                onSubmit={submitSupportMessage}
                className="card support-form-card"
              >
                <div>
                  <p className="small muted">
                    {t("support.customer.formKicker")}
                  </p>
                  <h2>{t("support.customer.formTitle")}</h2>
                  <p className="small muted" style={{ marginTop: "0.35rem" }}>
                    {t(
                      "support.customer.formBody",
                      "This creates a customer support conversation. Replies from Mirëbook support will appear in your support messages.",
                    )}
                  </p>
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
                      rows={7}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>
                </div>

                <div className="support-submit-note">
                  <p className="small muted">
                    {t(
                      "support.customer.beforeSending.kicker",
                      "Before sending",
                    )}
                  </p>
                  <p className="small muted">
                    {t(
                      "support.customer.beforeSending.body",
                      "Include the business name, appointment date, service and what you expected to happen. This helps support trace the booking faster.",
                    )}
                  </p>
                </div>

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
                <p className="small muted">
                  {t("support.customer.linksKicker")}
                </p>
                <h2>{t("support.customer.quickActions")}</h2>

                <div className="support-link-list">
                  <Link href="/my-bookings" className="support-link-row">
                    <span>
                      <strong>{t("nav.myBookings")}</strong>
                      <small>{t("support.customer.bookingsBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/notifications" className="support-link-row">
                    <span>
                      <strong>{t("nav.notifications")}</strong>
                      <small>{t("support.customer.notificationsBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/support/messages" className="support-link-row">
                    <span>
                      <strong>
                        {t(
                          "support.customer.myMessages",
                          "My support messages",
                        )}
                      </strong>
                      <small>
                        {t(
                          "support.customer.myMessagesBody",
                          "Read replies from Mirëbook support and continue conversations.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/explore" className="support-link-row">
                    <span>
                      <strong>{t("nav.explore")}</strong>
                      <small>{t("support.customer.exploreBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/account" className="support-link-row">
                    <span>
                      <strong>{t("nav.account")}</strong>
                      <small>{t("support.customer.accountBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="support-customer-guide">
                  <p className="small muted">
                    {t(
                      "support.customer.guide.kicker",
                      "Customer support guide",
                    )}
                  </p>
                  <div className="support-guide-list">
                    <div>
                      <strong>
                        {t(
                          "support.customer.guide.pendingTitle",
                          "Booking still pending",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.customer.guide.pendingBody",
                          "The business must approve some bookings before they become confirmed appointments.",
                        )}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {t(
                          "support.customer.guide.changeTitle",
                          "Need to change a time",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.customer.guide.changeBody",
                          "Use My bookings first. If the business has not responded, send support the booking date and business name.",
                        )}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {t(
                          "support.customer.guide.notificationsTitle",
                          "Missing notifications",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.customer.guide.notificationsBody",
                          "Check Notifications and your account email first, then message support if the booking status looks wrong.",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .support-shell {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .support-hero {
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.12),
            rgba(45, 212, 191, 0.08)
          );
          border-color: rgba(255, 107, 53, 0.25);
        }

        .support-hero-actions,
        .support-success-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .support-success-card {
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.06);
        }

        .support-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          gap: 1rem;
          align-items: start;
        }

        .support-form-card,
        .support-side-card {
          display: grid;
          gap: 1rem;
        }

        .support-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .full-span {
          grid-column: 1 / -1;
        }

        .support-submit-note {
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: var(--radius);
          padding: 0.85rem;
          background: rgba(45, 212, 191, 0.06);
        }

        .support-link-list {
          display: grid;
          gap: 0.75rem;
        }

        .support-link-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .support-link-row small {
          display: block;
          margin-top: 0.2rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .support-customer-guide {
          border-top: 1px solid var(--border);
          padding-top: 1rem;
          display: grid;
          gap: 0.75rem;
        }

        .support-guide-list {
          display: grid;
          gap: 0.75rem;
        }

        .support-guide-list div {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
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
          }
        }
      `}</style>
    </main>
  );
}
