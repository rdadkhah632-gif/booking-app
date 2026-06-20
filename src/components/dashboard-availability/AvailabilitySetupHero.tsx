import { useI18n } from "@/lib/useI18n";
import { Business } from "./dashboardAvailabilityTypes";

type Props = {
  business: Business;
};

export default function AvailabilitySetupHero({ business }: Props) {
  const { t } = useI18n();

  return (
    <div className="card availability-summary-card">
      <div className="availability-hero-row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p className="small muted">
            {t("dashboardAvailability.hero.kicker", "Working hours")}
          </p>

          <h3 style={{ marginTop: "0.25rem" }}>{business.name}</h3>

          <p className="small muted" style={{ marginTop: "0.35rem" }}>
            {t(
              "dashboardAvailability.hero.body",
              "These are the general hours customers can book. Team member hours can narrow individual schedules.",
            )}
          </p>
        </div>
      </div>

      <style jsx>{`
        .availability-summary-card {
          margin-bottom: 1rem;
          padding: 1rem 1.1rem;
        }

        .availability-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
