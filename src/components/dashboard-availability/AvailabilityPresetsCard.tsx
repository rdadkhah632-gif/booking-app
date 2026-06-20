import { useI18n } from "@/lib/useI18n";

type Props = {
  onApplyWeekdayPreset: () => void;
  onApplyExtendedPreset: () => void;
  onCloseAllDays: () => void;
};

export default function AvailabilityPresetsCard({
  onApplyWeekdayPreset,
  onApplyExtendedPreset,
  onCloseAllDays,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="availability-preset-card">
      <div className="availability-preset-row">
        <div>
          <strong>
            {t("dashboardAvailability.presets.compactTitle", "Quick presets")}
          </strong>

          <p className="small muted">
            {t(
              "dashboardAvailability.presets.body",
              "Presets fill the week below. Save when you are done.",
            )}
          </p>
        </div>

        <div className="availability-preset-actions">
          <button
            type="button"
            onClick={onApplyWeekdayPreset}
            className="btn btn-ghost"
          >
            {t("dashboardAvailability.presets.weekday", "Mon-Fri 9-5")}
          </button>

          <button
            type="button"
            onClick={onApplyExtendedPreset}
            className="btn btn-ghost"
          >
            {t("dashboardAvailability.presets.extended", "Mon-Sat 9-7")}
          </button>

          <button
            type="button"
            onClick={onCloseAllDays}
            className="btn btn-danger close-all-preset"
          >
            {t("dashboardAvailability.presets.closeAll", "Close all days")}
          </button>
        </div>
      </div>

      <style jsx>{`
        .availability-preset-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .availability-preset-card {
          margin-bottom: 0.85rem;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.02);
        }

        .availability-preset-actions {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .availability-preset-card p {
          margin: 0.15rem 0 0;
        }

        @media (max-width: 640px) {
          .availability-preset-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }

          .availability-preset-actions :global(.btn),
          .availability-preset-actions button {
            min-width: 0;
            justify-content: center;
          }

          .close-all-preset {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  );
}
