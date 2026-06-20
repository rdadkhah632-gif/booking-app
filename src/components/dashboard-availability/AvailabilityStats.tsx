import { useI18n } from "@/lib/useI18n";
import { AvailabilityStats as AvailabilityStatsType } from "./dashboardAvailabilityTypes";

type Props = {
  stats: AvailabilityStatsType;
};

function formatHours(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export default function AvailabilityStats({ stats }: Props) {
  const { t } = useI18n();

  return (
    <div
      className="availability-stats-grid"
      style={{ marginBottom: "1.25rem" }}
    >
      <div className="card availability-stat-card">
        <h3>{stats.openDays}</h3>
        <strong>
          {t("dashboardAvailability.stats.openDays", "Open days")}
        </strong>
        <p className="muted small">
          {t(
            "dashboardAvailability.stats.openDaysBody",
            "Business days customers can book.",
          )}
        </p>
      </div>

      <div className="card availability-stat-card">
        <h3>{stats.closedDays}</h3>
        <strong>
          {t("dashboardAvailability.stats.closedDays", "Closed days")}
        </strong>
        <p className="muted small">
          {t(
            "dashboardAvailability.stats.closedDaysBody",
            "Hidden from new customer bookings.",
          )}
        </p>
      </div>

      <div className="card availability-stat-card">
        <h3>{formatHours(stats.totalHours)} hrs</h3>
        <strong>
          {t("dashboardAvailability.stats.weeklyHours", "Weekly availability")}
        </strong>
        <p className="muted small">
          {t(
            "dashboardAvailability.stats.weeklyHoursBody",
            "Estimated weekly opening hours.",
          )}
        </p>
      </div>

      <div
        className="card availability-stat-card"
        style={{
          borderColor:
            stats.invalidDays > 0 ? "rgba(255,77,109,0.35)" : "var(--border)",
        }}
      >
        <h3>{stats.invalidDays}</h3>
        <strong>
          {t("dashboardAvailability.stats.invalidDays", "Invalid days")}
        </strong>
        <p className="muted small">
          {t(
            "dashboardAvailability.stats.invalidDaysBody",
            "Open days where start time is not before end time.",
          )}
        </p>
      </div>

      <div
        className="card availability-stat-card"
        style={{
          borderColor: stats.ready
            ? "rgba(45,212,191,0.25)"
            : "rgba(255,190,11,0.35)",
        }}
      >
        <h3>
          {stats.ready
            ? t("dashboardBusinesses.ready", "Ready")
            : t("dashboardBusinesses.needsWork", "Needs work")}
        </h3>
        <strong>{t("dashboardAvailability.stats.status", "Status")}</strong>
        <p className="muted small">
          {t(
            "dashboardAvailability.stats.statusBody",
            "At least one valid open day helps Mirëbook generate customer booking dates.",
          )}
        </p>
      </div>

      <style jsx>{`
        .availability-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 1rem;
        }

        .availability-stat-card {
          display: grid;
          gap: 0.55rem;
          align-content: start;
        }

        .availability-stat-card h3,
        .availability-stat-card p {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
