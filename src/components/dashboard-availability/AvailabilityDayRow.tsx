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
      className="card availability-day-row"
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
      </div>

      {!row.is_closed ? (
        <div className="availability-time-editor">
          <div className="availability-time-range">
            <span>{row.start_time}</span>
            <span aria-hidden="true">→</span>
            <span>{row.end_time}</span>
          </div>

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
          gap: 0.7rem;
          align-content: start;
          padding: 0.85rem !important;
        }

        .availability-day-header {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
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
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.65rem;
          align-items: end;
        }

        .availability-time-range {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          width: fit-content;
          padding: 0.4rem 0.65rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          font-weight: 800;
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
          max-width: 32ch;
        }

        @media (max-width: 520px) {
          .availability-day-header {
            align-items: center;
          }

          .availability-time-editor {
            grid-template-columns: 1fr;
          }

          .availability-time-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
