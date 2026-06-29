import { useI18n } from "@/lib/useI18n";
import { AvailabilityRow } from "./dashboardAvailabilityTypes";

type Props = {
  row: AvailabilityRow;
  index: number;
  dayLabel: string;
  updateRow: (
    index: number,
    field: keyof AvailabilityRow,
    value: string | boolean,
  ) => void;
};

export default function AvailabilityDayRow({
  row,
  index,
  dayLabel,
  updateRow,
}: Props) {
  const { t } = useI18n();
  const invalid = !row.is_closed && row.start_time >= row.end_time;

  return (
    <div
      className="availability-day-row"
      style={{
        borderColor: invalid
          ? "rgba(255,77,109,0.35)"
          : row.is_closed
            ? "rgba(255,190,11,0.20)"
            : "var(--border)",
        opacity: row.is_closed ? 0.78 : 1,
      }}
    >
      <div className="availability-day-header">
        <div>
          <strong>{dayLabel}</strong>
          {invalid && (
            <p className="small" style={{ color: "var(--danger)" }}>
              {t("dashboardAvailability.day.invalid", "Invalid time range")}
            </p>
          )}
        </div>
      </div>

      <label
        className={`availability-status-pill ${row.is_closed ? "closed" : "open"}`}
      >
        <input
          type="checkbox"
          checked={!row.is_closed}
          onChange={(e) => updateRow(index, "is_closed", !e.target.checked)}
        />
        <span>
          {row.is_closed
            ? t("dashboardAvailability.day.closed", "Closed")
            : t("dashboardAvailability.day.open", "Open")}
        </span>
      </label>

      {!row.is_closed ? (
        <div className="availability-time-editor">
          <div className="availability-time-grid">
            <label className="small muted">
              {t("dashboardAvailability.day.start", "Start")}
              <input
                type="time"
                value={row.start_time}
                onChange={(e) => updateRow(index, "start_time", e.target.value)}
              />
            </label>

            <label className="small muted">
              {t("dashboardAvailability.day.end", "End")}
              <input
                type="time"
                value={row.end_time}
                onChange={(e) => updateRow(index, "end_time", e.target.value)}
              />
            </label>
          </div>
        </div>
      ) : (
        <p className="small muted availability-closed-copy">
          {t("dashboardAvailability.day.closedBody", "Closed to customers.")}
        </p>
      )}

      <style jsx>{`
        .availability-day-row {
          display: grid;
          grid-template-columns: minmax(8rem, 1fr) auto minmax(14rem, 1.25fr);
          gap: 0.75rem;
          align-items: center;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }

        .availability-day-header {
          min-width: 0;
        }

        .availability-day-header p,
        .availability-closed-copy {
          margin-top: 0.35rem;
        }

        .availability-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          min-width: 92px;
          padding: 0.45rem 0.65rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1;
          white-space: nowrap;
        }

        .availability-status-pill.open {
          color: var(--success);
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.08);
        }

        .availability-status-pill.closed {
          color: var(--text-muted);
        }

        .availability-status-pill input {
          width: 1rem;
          height: 1rem;
          flex: 0 0 auto;
        }

        .availability-time-editor {
          display: grid;
        }

        .availability-time-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.55rem;
        }

        .availability-time-grid input {
          margin-top: 0.35rem;
          width: 100%;
        }

        .availability-closed-copy {
          margin: 0;
          max-width: 32ch;
        }

        @media (max-width: 700px) {
          .availability-day-row {
            grid-template-columns: 1fr auto;
          }

          .availability-time-editor,
          .availability-time-grid {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .availability-time-grid input {
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}
