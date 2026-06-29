import { useI18n } from "@/lib/useI18n";
import { Business, UpdateBusinessSetting } from "./dashboardSettingsTypes";

type Props = {
  settings: Business;
  updateSetting: UpdateBusinessSetting;
};

export default function PolicySettings({ settings, updateSetting }: Props) {
  const { t } = useI18n();

  return (
    <div className="grid-2 settings-policy-grid">
      <div className="card settings-card">
        <h2 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
          {t("dashboardSettings.cancellation.title", "Cancellation")}
        </h2>

        <textarea
          value={settings.cancellation_policy || ""}
          onChange={(e) => updateSetting("cancellation_policy", e.target.value)}
          rows={3}
          placeholder={t(
            "dashboardSettings.cancellation.placeholder",
            "Example: Customers can cancel up to 24 hours before their appointment.",
          )}
        />
      </div>

      <div className="card settings-card">
        <h2 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
          {t("dashboardSettings.reschedule.title", "Reschedule")}
        </h2>

        <textarea
          value={settings.reschedule_policy || ""}
          onChange={(e) => updateSetting("reschedule_policy", e.target.value)}
          rows={3}
          placeholder={t(
            "dashboardSettings.reschedule.placeholder",
            "Example: Customers can request a new time. The business must approve the change.",
          )}
        />
      </div>

      <style jsx>{`
        .settings-policy-grid {
          margin-top: 0.85rem;
        }
      `}</style>
    </div>
  );
}
