import { useI18n } from "@/lib/useI18n";
import { Business } from "./dashboardSettingsTypes";

type Props = {
  selectedBusiness: Business | null;
};

export default function BusinessSettingsHeader({ selectedBusiness }: Props) {
  const { t } = useI18n();

  return (
    <div className="settings-editor-header">
      <div>
        <p className="small" style={{ color: "var(--accent)" }}>
          {t("dashboardSettings.kicker", "Business settings")}
        </p>

        <h2 style={{ fontFamily: "var(--font-display)", marginTop: "0.25rem" }}>
          {t("dashboardSettings.title", "Booking rules")}
        </h2>

        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {selectedBusiness
            ? `${t("dashboardSettings.subtitleSelected", "Choose appointment approval and customer policy wording for")} ${selectedBusiness.name}.`
            : t(
                "dashboardSettings.subtitle",
                "Choose appointment approval and customer policy wording.",
              )}
        </p>
      </div>

      <style jsx>{`
        .settings-editor-header {
          margin: 2rem 0 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        .settings-editor-header h2,
        .settings-editor-header p {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
