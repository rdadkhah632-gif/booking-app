import { useI18n } from "@/lib/useI18n";

export default function BusinessSetupHero() {
  const { t } = useI18n();
  const steps = [
    t("dashboardBusinesses.hero.stepProfile", "Create profile"),
    t("dashboardBusinesses.hero.stepService", "Add service"),
    t("dashboardBusinesses.hero.stepHours", "Set hours"),
    t("dashboardBusinesses.hero.stepPreview", "Preview and publish"),
  ];

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
              "Create the business customers can book.",
            )}
          </h2>

          <p className="muted" style={{ marginTop: "0.6rem" }}>
            {t(
              "dashboardBusinesses.hero.body",
              "Start with the basics, add one service and set working hours. You can refine the rest later.",
            )}
          </p>
        </div>

        <div className="business-setup-hero-steps">
          {steps.map((step, index) => (
            <span key={step}>
              <strong>{index + 1}</strong>
              {step}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .business-setup-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1.25rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .business-setup-hero-steps {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          min-width: min(100%, 360px);
        }

        .business-setup-hero-steps span {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          min-width: 0;
          padding: 0.55rem 0.65rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          background: rgba(7, 11, 19, 0.28);
          color: var(--text);
          font-size: 0.84rem;
          font-weight: 800;
        }

        .business-setup-hero-steps strong {
          display: inline-flex;
          width: 1.45rem;
          height: 1.45rem;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--accent-dim);
          color: var(--accent);
          font-size: 0.78rem;
        }

        @media (max-width: 640px) {
          .business-setup-hero-steps {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
