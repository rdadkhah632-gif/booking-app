import { useI18n } from "@/lib/useI18n";
import { Business, UpdateBusinessSetting } from "./dashboardSettingsTypes";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "./settingsOptions";

type Props = {
  settings: Business;
  updateSetting: UpdateBusinessSetting;
};

export default function RegionSettings({ settings, updateSetting }: Props) {
  const { t } = useI18n();

  return (
    <div className="card settings-card">
      <h2 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
        {t("dashboardSettings.region.title", "Region")}
      </h2>

      <div className="settings-two-column">
        <label className="small muted">
          {t("dashboardSettings.region.timezone", "Timezone")}
          <select
            value={settings.timezone || "Europe/London"}
            onChange={(e) => updateSetting("timezone", e.target.value)}
            style={{ marginTop: "0.35rem" }}
          >
            {TIMEZONE_OPTIONS.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </label>

        <label className="small muted">
          {t("dashboardSettings.region.currency", "Currency")}
          <select
            value={settings.currency || "GBP"}
            onChange={(e) => updateSetting("currency", e.target.value)}
            style={{ marginTop: "0.35rem" }}
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
