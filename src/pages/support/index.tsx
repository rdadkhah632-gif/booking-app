import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleHelp,
  UsersRound,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import CustomerPortalStyles from "@/components/CustomerPortalStyles";
import SupportEntryStyles from "@/components/SupportEntryStyles";
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

  const showCustomerSupportHub = !checkingAdmin && !isAdmin;

  return (
    <main
      className={
        showCustomerSupportHub
          ? "marketplace-surface customer-portal-surface support-entry-surface"
          : undefined
      }
    >
      {showCustomerSupportHub && <CustomerPortalStyles />}
      <SupportEntryStyles />
      <AuthNav />

      <section
        className={
          showCustomerSupportHub
            ? "container customer-page-container"
            : "container support-operator-container"
        }
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
                  {t("support.operator.flowKicker", "Operational flow")}
                </p>
                <h2>
                  {t(
                    "support.operator.flowTitle",
                    "Support requests are connected to the operator inbox",
                  )}
                </h2>
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  {t(
                    "support.operator.flowBody",
                    "Customer, staff and business support forms create saved conversations and notify operators with a direct link to the ticket.",
                  )}
                </p>
              </div>
            </>
          )}

          {!checkingAdmin && !isAdmin && (
            <>
              <header className="support-entry-header">
                <p className="support-entry-kicker">
                  {t("support.kicker", "Mirëbook support")}
                </p>
                <h1 className="page-title">{t("support.title")}</h1>
                <p className="page-sub">
                  {t(
                    "support.stage8.subtitle",
                    "Choose the help route that matches what you are doing.",
                  )}
                </p>
              </header>

              <div className="support-entry-layout">
                <Link
                  href="/support/customer"
                  className="support-primary-route"
                >
                  <span className="support-route-icon support-route-icon-primary">
                    <CircleHelp aria-hidden="true" size={24} strokeWidth={2} />
                  </span>
                  <span className="support-primary-copy">
                    <span className="support-route-eyebrow">
                      {t("support.customer.kicker", "Customers")}
                    </span>
                    <strong>{t("support.customer.title")}</strong>
                    <span>
                      {t(
                        "support.entry.customerBody",
                        "Get help with bookings, changes, notifications and your customer account.",
                      )}
                    </span>
                  </span>
                  <span className="support-route-cta">
                    {t("nav.customerSupport")}
                    <ArrowRight aria-hidden="true" size={18} />
                  </span>
                </Link>

                <section className="support-work-routes">
                  <header>
                    <p className="support-route-eyebrow">
                      {t("support.work.kicker", "Using Mirëbook for work?")}
                    </p>
                    <h2>
                      {t("support.work.title", "Business and staff help")}
                    </h2>
                  </header>

                  <div className="support-work-grid">
                    <Link
                      href="/support/business"
                      className="support-work-link"
                    >
                      <span className="support-route-icon">
                        <BriefcaseBusiness
                          aria-hidden="true"
                          size={20}
                          strokeWidth={2}
                        />
                      </span>
                      <span className="support-work-copy">
                        <strong>{t("support.business.title")}</strong>
                        <small>
                          {t(
                            "support.entry.businessBody",
                            "Get help with setup, bookings, services, your team and membership.",
                          )}
                        </small>
                      </span>
                      <ArrowRight aria-hidden="true" size={18} />
                    </Link>

                    <Link href="/support/staff" className="support-work-link">
                      <span className="support-route-icon">
                        <UsersRound
                          aria-hidden="true"
                          size={20}
                          strokeWidth={2}
                        />
                      </span>
                      <span className="support-work-copy">
                        <strong>{t("support.staff.title")}</strong>
                        <small>
                          {t(
                            "support.entry.staffBody",
                            "Get help with your schedule, working hours, account link and assigned bookings.",
                          )}
                        </small>
                      </span>
                      <ArrowRight aria-hidden="true" size={18} />
                    </Link>
                  </div>
                </section>
              </div>

              <footer className="support-entry-footer">
                <Link href="/privacy">{t("common.privacy")}</Link>
                <Link href="/terms">{t("common.terms")}</Link>
                <Link href="/explore">{t("home.cta.explore")}</Link>
              </footer>
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

        @media (max-width: 640px) {
          .support-operator-actions,
          .support-operator-actions :global(.btn),
          .support-operator-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
