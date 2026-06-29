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
    <div className="availability-summary-strip">
      <span
        className={`availability-status-dot ${stats.ready ? "ready" : "needs-work"}`}
      >
        {stats.ready
          ? t("dashboardBusinesses.ready", "Ready")
          : t("dashboardBusinesses.needsWork", "Needs work")}
      </span>
      <span>
        <strong>{stats.openDays}</strong>{" "}
        {t("dashboardAvailability.stats.openDays", "Open days")}
      </span>
      <span>
        <strong>{stats.closedDays}</strong>{" "}
        {t("dashboardAvailability.stats.closedDays", "Closed days")}
      </span>
      <span>
        <strong>{formatHours(stats.totalHours)}</strong>{" "}
        {t("dashboardAvailability.stats.weeklyHoursShort", "hours/week")}
      </span>
      {stats.invalidDays > 0 && (
        <span className="availability-invalid-chip">
          <strong>{stats.invalidDays}</strong>{" "}
          {t("dashboardAvailability.stats.invalidDays", "Invalid days")}
        </span>
      )}

      <style jsx>{`
        .availability-summary-strip {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          flex-wrap: wrap;
          margin-bottom: 0.7rem;
          padding: 0.65rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .availability-summary-strip span {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          min-height: 2rem;
          padding: 0.32rem 0.65rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .availability-summary-strip strong {
          color: var(--text);
        }

        .availability-status-dot.ready {
          border-color: rgba(45, 212, 191, 0.32);
          background: rgba(45, 212, 191, 0.08);
          color: var(--success);
        }

        .availability-status-dot.needs-work,
        .availability-invalid-chip {
          border-color: rgba(255, 190, 11, 0.32);
          background: rgba(255, 190, 11, 0.08);
          color: var(--warning);
        }

        @media (max-width: 560px) {
          .availability-summary-strip {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .availability-summary-strip span {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
