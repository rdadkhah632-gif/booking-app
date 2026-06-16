import { useI18n } from "@/lib/useI18n";
import { Business } from "./dashboardSettingsTypes";

type Props = {
  selectedBusiness: Business | null;
  settings: Business;
  settingsReadyScore: number;
  approvalModeLabel: string;
  settingSummary: string;
};

export default function BusinessSettingsSummary({
  selectedBusiness,
  settings,
  settingsReadyScore,
  approvalModeLabel,
  settingSummary,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
      <div className="card">
        <p className="small muted">
          {t("dashboardSettings.summary.selectedBusiness", "Selected business")}
        </p>

        <h3>{selectedBusiness?.name || t("common.business", "Business")}</h3>

        <p className="muted small">
          {selectedBusiness?.published
            ? t("dashboardSettings.summary.published", "Published on Mirëbook")
            : t("dashboardSettings.summary.draft", "Hidden / draft")}
        </p>

        <p className="muted small" style={{ marginTop: "0.35rem" }}>
          {approvalModeLabel}
        </p>
      </div>

      <div className="card">
        <p className="small muted">
          {t("dashboardSettings.summary.readiness", "Rules status")}
        </p>

        <h3>{settingsReadyScore}%</h3>

        <p className="muted small">
          {t(
            "dashboardSettings.summary.readinessBody",
            "Booking rules and policies filled in",
          )}
        </p>
      </div>

      <div className="card">
        <p className="small muted">
          {t("dashboardSettings.summary.currentRules", "Current rules")}
        </p>

        <h3 style={{ fontSize: "1rem" }}>{settingSummary}</h3>

        <p className="muted small">
          {t(
            "dashboardSettings.summary.currentRulesBody",
            "Used by public booking and reschedule flows",
          )}
        </p>
      </div>
    </div>
  );
}
