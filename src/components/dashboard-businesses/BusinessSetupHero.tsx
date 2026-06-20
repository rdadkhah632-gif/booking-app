import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

export default function BusinessSetupHero() {
  const { t } = useI18n();

  return (
    <div
      className="card"
      style={{
        marginBottom: "1.5rem",
        background:
          "linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08))",
        borderColor: "rgba(255,107,53,0.25)",
      }}
    >
      <div className="business-setup-hero-row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p className="small" style={{ color: "var(--accent)" }}>
            {t("dashboardBusinesses.hero.kicker", "Mirëbook setup")}
          </p>

          <h2
            style={{ fontFamily: "var(--font-display)", marginTop: "0.25rem" }}
          >
            {t(
              "dashboardBusinesses.hero.title",
              "Set up your business before customers book.",
            )}
          </h2>

          <p className="muted" style={{ marginTop: "0.6rem" }}>
            {t(
              "dashboardBusinesses.hero.body",
              "Most businesses only need one profile. Add services, team and hours, then publish when you are ready.",
            )}
          </p>
        </div>

        <div className="business-setup-hero-actions">
          <Link href="/dashboard/services" className="btn btn-ghost">
            {t("support.business.services", "Services")}
          </Link>

          <Link href="/dashboard/staff" className="btn btn-ghost">
            {t("support.business.staff", "Staff")}
          </Link>

          <Link href="/dashboard/availability" className="btn btn-ghost">
            {t("dashboardBusinesses.workingHours", "Working hours")}
          </Link>

          <Link href="/dashboard/settings" className="btn btn-ghost">
            {t("nav.settings", "Settings")}
          </Link>

          <Link href="/support/business" className="btn btn-ghost">
            {t("nav.businessSupport", "Business support")}
          </Link>

          <Link href="/dashboard/billing" className="btn btn-ghost">
            {t("home.trust.billing", "Billing")}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .business-setup-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .business-setup-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .business-setup-hero-actions,
          .business-setup-hero-actions :global(.btn),
          .business-setup-hero-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
