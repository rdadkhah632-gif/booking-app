import { useEffect, useState } from "react";
import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import { supabase } from "@/lib/supabaseClient";

export default function SupportPage() {
  const { t } = useI18n();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  async function checkAdminStatus() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setCheckingAdmin(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    setIsAdmin(Boolean(profile?.is_admin));
    setCheckingAdmin(false);
  }

  return (
    <main>
      <AuthNav />

      <section
        className="container"
        style={{ paddingTop: 42, paddingBottom: 72 }}
      >
        <div className="support-shell">
          {checkingAdmin && (
            <div className="card">
              <p className="muted">{t("common.loading", "Loading...")}</p>
            </div>
          )}

          {!checkingAdmin && isAdmin && (
            <>
              <div className="card support-operator-hero">
                <p className="small" style={{ color: "var(--accent)" }}>
                  Mirëbook operator
                </p>
                <h1 className="page-title">Support inbox</h1>
                <p className="page-sub" style={{ marginTop: "0.6rem" }}>
                  Review customer, staff and business help requests from the
                  admin inbox. This view is for operator support work, not
                  normal customer support.
                </p>
                <div className="support-operator-actions">
                  <Link href="/admin/support" className="btn btn-accent">
                    Open support inbox
                  </Link>
                  <Link href="/admin/users" className="btn btn-ghost">
                    User lookup
                  </Link>
                  <Link href="/admin/notifications" className="btn btn-ghost">
                    Operator notices
                  </Link>
                </div>
              </div>

              <div className="grid-3">
                <Link
                  href="/admin/support"
                  className="card support-operator-card"
                >
                  <p className="small muted">Inbox</p>
                  <h2>Support requests</h2>
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    Read, reply, prioritise and resolve customer, staff and
                    business support tickets.
                  </p>
                </Link>

                <Link
                  href="/admin/users"
                  className="card support-operator-card"
                >
                  <p className="small muted">Context</p>
                  <h2>User lookup</h2>
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    Check the user account, role, business links and staff links
                    before replying.
                  </p>
                </Link>

                <Link
                  href="/admin/notifications"
                  className="card support-operator-card"
                >
                  <p className="small muted">Follow-up</p>
                  <h2>Operator notices</h2>
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    Send platform notices or follow-up updates when a support
                    issue affects a user group.
                  </p>
                </Link>
              </div>

              <div className="card support-operator-note">
                <p className="small muted">
                  {t('support.operator.flowKicker', 'Operational flow')}
                </p>
                <h2>
                  {t(
                    'support.operator.flowTitle',
                    'Support requests are connected to the operator inbox',
                  )}
                </h2>
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  {t(
                    'support.operator.flowBody',
                    'Customer, staff and business support forms create saved conversations and notify operators with a direct link to the ticket.',
                  )}
                </p>
              </div>
            </>
          )}

          {!checkingAdmin && !isAdmin && (
            <>
              <div className="card support-hero">
                <p className="small" style={{ color: "var(--accent)" }}>
                  {t("support.kicker", "Mirëbook support")}
                </p>
                <h1 className="page-title">{t("support.title")}</h1>
                <p className="page-sub" style={{ marginTop: "0.6rem" }}>
                  {t("support.subtitle")}
                </p>
              </div>

              <div className="support-route-grid">
                <Link
                  href="/support/customer"
                  className="card support-route-card"
                >
                  <p className="small muted">
                    {t("support.customer.kicker", "Customers")}
                  </p>
                  <h2>{t("support.customer.title")}</h2>
                  <p className="muted small" style={{ marginTop: "0.5rem" }}>
                    {t("support.customer.body")}
                  </p>
                  <span
                    className="btn btn-accent"
                    style={{ marginTop: "1rem" }}
                  >
                    {t("nav.customerSupport")}
                  </span>
                </Link>

                <Link
                  href="/support/business"
                  className="card support-route-card"
                >
                  <p className="small muted">
                    {t("support.business.kicker", "Businesses")}
                  </p>
                  <h2>{t("support.business.title")}</h2>
                  <p className="muted small" style={{ marginTop: "0.5rem" }}>
                    {t("support.business.body")}
                  </p>
                  <span
                    className="btn btn-accent"
                    style={{ marginTop: "1rem" }}
                  >
                    {t("nav.businessSupport")}
                  </span>
                </Link>

                <Link href="/support/staff" className="card support-route-card">
                  <p className="small muted">
                    {t("support.staff.kicker", "Staff")}
                  </p>
                  <h2>{t("support.staff.title")}</h2>
                  <p className="muted small" style={{ marginTop: "0.5rem" }}>
                    {t("support.staff.body")}
                  </p>
                  <span
                    className="btn btn-accent"
                    style={{ marginTop: "1rem" }}
                  >
                    {t("support.staff.title")}
                  </span>
                </Link>
              </div>

              <div className="grid-2">
                <div className="card support-content">
                  <div>
                    <p className="small muted">
                      {t("support.quickLinks.kicker", "Common account routes")}
                    </p>
                    <h2>{t("support.quickLinks.title", "Quick links")}</h2>
                  </div>

                  <div className="support-link-list">
                    <Link href="/my-bookings" className="support-link-row">
                      <span>
                        <strong>{t("nav.myBookings")}</strong>
                        <small>
                          {t(
                            "support.quickLinks.myBookingsBody",
                            "Track customer appointments, pending requests and reschedules.",
                          )}
                        </small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <Link
                      href="/dashboard/businesses"
                      className="support-link-row"
                    >
                      <span>
                        <strong>
                          {t(
                            "support.quickLinks.businessSetup",
                            "Business setup",
                          )}
                        </strong>
                        <small>
                          {t(
                            "support.quickLinks.businessSetupBody",
                            "Manage business profile, services, staff, hours and publishing.",
                          )}
                        </small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <Link href="/staff" className="support-link-row">
                      <span>
                        <strong>
                          {t(
                            "support.quickLinks.staffWorkspace",
                            "Staff workspace",
                          )}
                        </strong>
                        <small>
                          {t(
                            "support.quickLinks.staffWorkspaceBody",
                            "View staff schedule and access staff availability tools.",
                          )}
                        </small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <Link href="/account" className="support-link-row">
                      <span>
                        <strong>{t("nav.account")}</strong>
                        <small>
                          {t(
                            "support.quickLinks.accountBody",
                            "Update name, phone and open your connected workspaces.",
                          )}
                        </small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>

                <div className="card support-content">
                  <div>
                    <p className="small muted">
                      {t("support.inboxStatus.kicker", "Before launch")}
                    </p>
                    <h2>
                      {t("support.inboxStatus.title", "Support inbox status")}
                    </h2>
                  </div>

                  <div className="support-note-box">
                    <p>
                      {t(
                        "support.inboxStatus.body",
                        "Mirëbook support is split into role-specific flows. New support forms create tickets that can be reviewed, replied to and closed from the admin area.",
                      )}
                    </p>
                  </div>

                  <div className="support-contact-actions">
                    <Link href="/privacy" className="btn btn-ghost">
                      {t("common.privacy")}
                    </Link>

                    <Link href="/terms" className="btn btn-ghost">
                      {t("common.terms")}
                    </Link>

                    <Link href="/explore" className="btn btn-accent">
                      {t("home.cta.explore")}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card support-faq-card">
                <div>
                  <p className="small muted">
                    {t("support.faq.kicker", "Common questions")}
                  </p>
                  <h2>
                    {t("support.faq.title", "Frequently asked questions")}
                  </h2>
                </div>

                <div className="support-faq-list">
                  <div className="support-faq-item">
                    <h3>
                      {t(
                        "support.faq.pendingTitle",
                        "My booking is pending. What does that mean?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "support.faq.pendingBody",
                        "Some businesses use manual approval. Your booking request has been sent to the business and is not confirmed until they accept it. You can track it from My Bookings or Notifications.",
                      )}
                    </p>
                  </div>

                  <div className="support-faq-item">
                    <h3>
                      {t(
                        "support.faq.paymentsTitle",
                        "Can customers pay through Mirëbook?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "support.faq.paymentsBody",
                        "Not currently. Customers use Mirëbook to book and manage appointments. The first commercial billing model is business subscription billing, where businesses pay a monthly fee to use the platform.",
                      )}
                    </p>
                  </div>

                  <div className="support-faq-item">
                    <h3>
                      {t(
                        "support.faq.businessReadyTitle",
                        "How does a business get ready for customers?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "support.faq.businessReadyBody",
                        "A business should complete its profile, add services, assign staff, set working hours and choose booking settings before publishing. The setup hub shows what still needs attention.",
                      )}
                    </p>
                  </div>

                  <div className="support-faq-item">
                    <h3>
                      {t(
                        "support.faq.staffAccessTitle",
                        "How does staff access work?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "support.faq.staffAccessBody",
                        "A business owner adds a staff member and their email. When that person registers or logs in with the same email, Mirëbook can link their account to the staff profile.",
                      )}
                    </p>
                  </div>

                  <div className="support-faq-item">
                    <h3>
                      {t(
                        "support.faq.countriesTitle",
                        "Will Mirëbook support Albania and other countries?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "support.faq.countriesBody",
                        "Yes. Mirëbook is being prepared for Albanian and international markets. Region, currency and language support will expand as the platform moves closer to launch.",
                      )}
                    </p>
                  </div>

                  <div className="support-faq-item">
                    <h3>
                      {t(
                        "support.faq.mobileAppTitle",
                        "Will there be a mobile app?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "support.faq.mobileAppBody",
                        "The current product is being built as a web platform first, with future app-store readiness in mind. The goal is to make the routes, layout, account flow and settings suitable for a later app version.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </>
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

        .support-operator-hero {
          border-color: rgba(45, 212, 191, 0.28);
          background: linear-gradient(
            135deg,
            rgba(45, 212, 191, 0.1),
            rgba(255, 107, 53, 0.08)
          );
        }

        .support-operator-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .support-operator-card {
          transition:
            border-color 0.2s,
            transform 0.2s;
        }

        .support-operator-card:hover {
          border-color: rgba(45, 212, 191, 0.35);
          transform: translateY(-1px);
        }

        .support-operator-note {
          border-color: rgba(255, 190, 11, 0.28);
          background: rgba(255, 190, 11, 0.06);
        }

        .support-route-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .support-route-card {
          display: flex;
          flex-direction: column;
          min-height: 240px;
          transition:
            transform 0.2s,
            border-color 0.2s;
        }

        .support-route-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 107, 53, 0.35);
        }

        .support-content,
        .support-faq-card {
          display: grid;
          gap: 1rem;
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
          border: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .support-link-row small {
          display: block;
          margin-top: 0.2rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .support-note-box,
        .support-faq-item {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .support-note-box p,
        .support-faq-item p {
          color: var(--text-muted);
          line-height: 1.65;
        }

        .support-faq-list {
          display: grid;
          gap: 0.85rem;
        }

        .support-faq-item h3 {
          margin-bottom: 0.4rem;
        }

        .support-contact-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 860px) {
          .support-route-grid {
            grid-template-columns: 1fr;
          }

          .support-route-card {
            min-height: auto;
          }

          .support-link-row {
            width: 100%;
          }
        }

        @media (max-width: 640px) {
          .support-operator-actions,
          .support-operator-actions :global(.btn),
          .support-operator-actions a,
          .support-contact-actions,
          .support-contact-actions :global(.btn),
          .support-contact-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
