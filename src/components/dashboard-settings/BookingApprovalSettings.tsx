import { useI18n } from "@/lib/useI18n";
import { Business, UpdateBusinessSetting } from "./dashboardSettingsTypes";

type Props = {
  settings: Business;
  approvalModeLabel: string;
  updateSetting: UpdateBusinessSetting;
};

export default function BookingApprovalSettings({
  settings,
  approvalModeLabel,
  updateSetting,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="card settings-card settings-approval-card">
      <div>
        <p className="small muted">
          {t("dashboardSettings.approval.kicker", "Booking approval")}
        </p>

        <h2 style={{ fontFamily: "var(--font-display)", marginTop: "0.25rem" }}>
          {t("dashboardSettings.approval.title", "Confirmation mode")}
        </h2>
      </div>

      <div
        className="settings-mode-grid"
        role="radiogroup"
        aria-label={t("dashboardSettings.approval.title", "Confirmation mode")}
      >
        <button
          type="button"
          className={
            settings.auto_accept_bookings
              ? "settings-mode-card settings-mode-card-active"
              : "settings-mode-card"
          }
          onClick={() => updateSetting("auto_accept_bookings", true)}
          role="radio"
          aria-checked={Boolean(settings.auto_accept_bookings)}
        >
          <span className="settings-mode-title">
            {t(
              "dashboardSettings.approval.instantTitle",
              "Instant confirmation",
            )}
          </span>
          <span className="small muted">
            {t(
              "dashboardSettings.approval.instantBody",
              "Customers get a confirmed booking as soon as they pick an available slot.",
            )}
          </span>
        </button>

        <button
          type="button"
          className={
            !settings.auto_accept_bookings
              ? "settings-mode-card settings-mode-card-active"
              : "settings-mode-card"
          }
          onClick={() => updateSetting("auto_accept_bookings", false)}
          role="radio"
          aria-checked={!settings.auto_accept_bookings}
        >
          <span className="settings-mode-title">
            {t("dashboardSettings.approval.manualTitle", "Manual approval")}
          </span>
          <span className="small muted">
            {t(
              "dashboardSettings.approval.manualBody",
              "New bookings appear in Needs action until the business accepts or declines them.",
            )}
          </span>
        </button>
      </div>

      <div className="settings-current-mode">
        <p className="small muted">
          {t("dashboardSettings.approval.currentMode", "Current mode")}
        </p>
        <strong>{approvalModeLabel}</strong>
      </div>

      <style jsx>{`
        .settings-mode-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
        }

        .settings-mode-card {
          display: grid;
          gap: 0.35rem;
          min-height: 0;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          font: inherit;
          text-align: left;
          cursor: pointer;
          appearance: none;
        }

        .settings-mode-card:hover {
          border-color: rgba(255, 107, 53, 0.38);
        }

        .settings-mode-card-active {
          border-color: var(--accent);
          background: var(--accent-dim);
          box-shadow: inset 3px 0 0 var(--accent);
        }

        .settings-mode-title {
          color: var(--text);
          font-size: 0.95rem;
          font-weight: 800;
        }

        .settings-current-mode {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 0.6rem 0 0;
          border-top: 1px solid var(--border);
        }

        .settings-current-mode p {
          margin: 0;
        }

        @media (max-width: 640px) {
          .settings-mode-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
