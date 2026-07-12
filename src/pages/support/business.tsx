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
};

type Business = {
  id: string;
  name: string;
  published?: boolean | null;
  subscription_status?: string | null;
};

const BUSINESS_SUBJECT_KEYS = [
  "support.business.subject.setup",
  "support.business.subject.services",
  "support.business.subject.approval",
  "support.business.subject.customerBooking",
  "support.business.subject.subscription",
  "support.business.subject.imageUpload",
  "support.business.subject.account",
  "support.business.subject.other",
];

export default function BusinessSupportPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(BUSINESS_SUBJECT_KEYS[0]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  useEffect(() => {
    loadContext();
  }, []);

  async function loadContext() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login?redirectTo=/support/business");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      setError(
        t(
          "support.business.contextError",
          "We could not load your business account for support. Please refresh and try again.",
        ),
      );
      setLoading(false);
      return;
    }

    if (profileData) {
      setProfile(profileData);
      setName(profileData.full_name || "");
      setEmail(profileData.email || "");
    }

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, published, subscription_status")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (businessError) {
      setError(
        t(
          "support.business.contextError",
          "We could not load your business account for support. Please refresh and try again.",
        ),
      );
      setLoading(false);
      return;
    }

    const rows = (businessData || []) as Business[];
    setBusinesses(rows);
    setBusinessId(rows[0]?.id || "");

    setLoading(false);
  }

  async function submitSupportMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!profile) {
      setError(t("support.business.loginRequired"));
      return;
    }

    if (!message.trim()) {
      setError(
        t(
          "support.validation.messageRequired",
          "Write a message before sending.",
        ),
      );
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    setCreatedTicketId(null);

    const selectedBusiness =
      businesses.find((business) => business.id === businessId) || null;
    const ticketSubject = t(subject).trim();
    const ticketMessage = message.trim();
    const ticketPriority =
      subject === "support.business.subject.approval" ||
      subject === "support.business.subject.subscription"
        ? "high"
        : "normal";

    const { data: insertedTicket, error: insertError } = await supabase
      .from("support_messages")
      .insert({
        user_id: profile.id,
        business_id: businessId || null,
        account_type: "business",
        name: name.trim() || profile.full_name || null,
        email: email.trim() || profile.email || null,
        category: "business_support",
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
        summary: `${ticketSubject} · ${selectedBusiness?.name || name.trim() || profile.email || "Business owner"}`,
      });
      void requestTransactionalEmail({
        event: "support_created",
        supportMessageId: ticketId,
      });
    }

    setSuccess(t("support.business.success"));
    setMessage("");
    setSubject(BUSINESS_SUBJECT_KEYS[0]);
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
            <h1 className="page-title">{t("support.business.heroTitle")}</h1>
            <p className="page-sub" style={{ marginTop: "0.6rem" }}>
              {t(
                "support.business.heroBody",
                "Get help with business setup, services, staff, bookings, publishing, billing or account access.",
              )}
            </p>
            <div className="support-hero-actions">
              <Link href="/support/messages" className="btn btn-accent">
                {t("support.business.myMessages", "Business support messages")}
              </Link>
              <Link href="/dashboard" className="btn btn-ghost">
                {t("dashboardHome.title", "Business overview")}
              </Link>
            </div>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">{t("support.business.loading")}</p>
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
                  "support.business.successBody",
                  "Your message is now saved as a business support conversation. Mirëbook support will reply there.",
                )}
              </p>
              <div className="support-success-actions">
                {createdTicketId && (
                  <Link
                    href={`/support/messages/${createdTicketId}`}
                    className="btn btn-accent"
                  >
                    {t(
                      "support.business.viewConversation",
                      "View conversation",
                    )}
                  </Link>
                )}
                <Link href="/support/messages" className="btn btn-ghost">
                  {t(
                    "support.business.allConversations",
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
                  <h2>{t("support.business.formTitle")}</h2>
                </div>

                <div className="support-form-grid">
                  <div>
                    <label className="small muted">{t("common.name")}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("support.business.namePlaceholder")}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>

                  <div>
                    <label className="small muted">{t("common.email")}</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("support.business.emailPlaceholder")}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("common.business")}
                    </label>
                    <select
                      value={businessId}
                      onChange={(e) => setBusinessId(e.target.value)}
                      style={{ marginTop: "0.4rem" }}
                    >
                      {businesses.length === 0 && (
                        <option value="">
                          {t("support.business.noBusiness")}
                        </option>
                      )}
                      {businesses.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name} ·{" "}
                          {business.published
                            ? t("support.business.status.published")
                            : t("support.business.status.draft")}{" "}
                          ·{" "}
                          {business.subscription_status ||
                            t("support.business.status.trial")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("support.business.subjectLabel")}
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      style={{ marginTop: "0.4rem" }}
                    >
                      {BUSINESS_SUBJECT_KEYS.map((item) => (
                        <option key={item} value={item}>
                          {t(item)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("support.business.messageLabel")}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("support.business.messagePlaceholder")}
                      rows={5}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>
                </div>

                <div className="support-submit-note">
                  <p className="small muted">
                    {t(
                      "support.business.beforeSending.body",
                      "Include the affected business, service, staff member, booking date or setup area so support can trace it faster.",
                    )}
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn btn-accent"
                  disabled={sending}
                >
                  {sending
                    ? t("support.business.sending")
                    : t("support.business.sendButton")}
                </button>
              </form>

              <div className="card support-side-card">
                <h2>{t("support.business.quickActions")}</h2>

                <div className="support-link-list">
                  <Link
                    href="/dashboard/businesses"
                    className="support-link-row"
                  >
                    <span className="support-link-copy">
                      <strong>{t("support.business.setupHub")}</strong>
                      <small>{t("support.business.setupHubBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/dashboard/bookings" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("support.business.bookings")}</strong>
                      <small>{t("support.business.bookingsBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/dashboard/services" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("support.business.services")}</strong>
                      <small>{t("support.business.servicesBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/dashboard/staff" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("support.business.staff")}</strong>
                      <small>{t("support.business.staffBody")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/support/messages" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>
                        {t(
                          "support.business.myMessages",
                          "Business support messages",
                        )}
                      </strong>
                      <small>
                        {t(
                          "support.business.myMessagesBody",
                          "Read support replies and continue business support conversations.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <details className="support-business-guide">
                  <summary>
                    {t(
                      "support.business.guide.kicker",
                      "Business support guide",
                    )}
                  </summary>
                  <div className="support-guide-list">
                    <div>
                      <strong>
                        {t(
                          "support.business.guide.setupTitle",
                          "Setup or publishing issue",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.business.guide.setupBody",
                          "Check your business profile, services, staff assignments and working hours before raising a setup issue.",
                        )}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {t(
                          "support.business.guide.bookingTitle",
                          "Customer booking issue",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.business.guide.bookingBody",
                          "Include the customer name, service, date and current booking status so support can trace the problem.",
                        )}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {t(
                          "support.business.guide.billingTitle",
                          "Billing or trial question",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.business.guide.billingBody",
                          "Mention your business name, trial/subscription state and what you expected to happen.",
                        )}
                      </p>
                    </div>
                  </div>
                </details>
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
          gap: 0.75rem;
        }

        .support-hero {
          padding: 0.95rem 1rem;
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
          margin-top: 0.75rem;
        }

        .support-success-card {
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.06);
        }

        .support-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          gap: 0.85rem;
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
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: var(--radius);
          padding: 0.65rem 0.75rem;
          background: rgba(45, 212, 191, 0.06);
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

        .support-business-guide {
          border-top: 1px solid var(--border);
          padding-top: 0.75rem;
          display: grid;
          gap: 0.6rem;
        }

        .support-business-guide summary {
          cursor: pointer;
          color: var(--text);
          font-weight: 800;
          list-style: none;
        }

        .support-business-guide summary::-webkit-details-marker {
          display: none;
        }

        .support-business-guide summary::after {
          content: " +";
          color: var(--accent);
        }

        .support-business-guide[open] summary::after {
          content: " -";
        }

        .support-guide-list {
          display: grid;
          gap: 0.55rem;
        }

        .support-guide-list div {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.68rem;
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
          .support-form-card button,
          .support-link-row {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}
