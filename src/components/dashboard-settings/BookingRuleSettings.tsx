import { useI18n } from "@/lib/useI18n";
import { Business, UpdateBusinessSetting } from "./dashboardSettingsTypes";
import {
  ADVANCE_OPTIONS,
  BUFFER_OPTIONS,
  INTERVAL_OPTIONS,
  NOTICE_OPTIONS,
} from "./settingsOptions";

type Props = {
  settings: Business;
  updateSetting: UpdateBusinessSetting;
};

export default function BookingRuleSettings({
  settings,
  updateSetting,
}: Props) {
  const { t } = useI18n();

  return (
    <>
      <label className="card settings-card settings-rule-field">
        <span>{t("dashboardSettings.slot.title", "Slot size")}</span>
        <select
          value={settings.booking_interval_minutes || 30}
          onChange={(e) =>
            updateSetting("booking_interval_minutes", Number(e.target.value))
          }
        >
          {INTERVAL_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} {t("common.minutes", "minutes")}
            </option>
          ))}
        </select>
      </label>

      <label className="card settings-card settings-rule-field">
        <span>{t("dashboardSettings.notice.title", "Minimum notice")}</span>
        <select
          value={settings.min_notice_minutes ?? 120}
          onChange={(e) =>
            updateSetting("min_notice_minutes", Number(e.target.value))
          }
        >
          {NOTICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="card settings-card settings-rule-field">
        <span>{t("dashboardSettings.advance.title", "Booking window")}</span>
        <select
          value={settings.max_advance_days ?? 60}
          onChange={(e) =>
            updateSetting("max_advance_days", Number(e.target.value))
          }
        >
          {ADVANCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="card settings-card settings-rule-field settings-buffer-field">
        <span>{t("dashboardSettings.buffers.title", "Buffers")}</span>

        <div className="settings-two-column">
          <label className="small muted">
            {t("dashboardSettings.buffers.before", "Before")}
            <select
              value={settings.buffer_before_minutes ?? 0}
              onChange={(e) =>
                updateSetting("buffer_before_minutes", Number(e.target.value))
              }
              style={{ marginTop: "0.35rem" }}
            >
              {BUFFER_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} {t("common.minutes", "minutes")}
                </option>
              ))}
            </select>
          </label>

          <label className="small muted">
            {t("dashboardSettings.buffers.after", "After")}
            <select
              value={settings.buffer_after_minutes ?? 0}
              onChange={(e) =>
                updateSetting("buffer_after_minutes", Number(e.target.value))
              }
              style={{ marginTop: "0.35rem" }}
            >
              {BUFFER_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} {t("common.minutes", "minutes")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <style jsx>{`
        .settings-rule-field {
          gap: 0.45rem;
          padding: 0.75rem !important;
        }

        .settings-rule-field > span {
          color: var(--text);
          font-size: 0.9rem;
          font-weight: 800;
        }

        .settings-buffer-field {
          grid-column: span 2;
        }

        @media (max-width: 720px) {
          .settings-buffer-field {
            grid-column: auto;
          }
        }
      `}</style>
    </>
  );
}
