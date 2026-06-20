import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import BusinessSettingsActions from "@/components/dashboard-settings/BusinessSettingsActions";
import BookingApprovalSettings from "@/components/dashboard-settings/BookingApprovalSettings";
import BookingRuleSettings from "@/components/dashboard-settings/BookingRuleSettings";
import PolicySettings from "@/components/dashboard-settings/PolicySettings";
import RegionSettings from "@/components/dashboard-settings/RegionSettings";
import { Business } from "@/components/dashboard-settings/dashboardSettingsTypes";
import { defaultSettings } from "@/components/dashboard-settings/settingsOptions";
import { useI18n } from "@/lib/useI18n";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardSettingsPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [settings, setSettings] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedBusiness = useMemo(() => {
    return (
      businesses.find((business) => business.id === selectedBusinessId) || null
    );
  }, [businesses, selectedBusinessId]);

  const approvalModeLabel = settings?.auto_accept_bookings
    ? t("dashboardSettings.approval.instantTitle", "Instant confirmation")
    : t("dashboardSettings.approval.manualTitle", "Manual approval");

  async function loadSettings() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/dashboard/settings");
        return;
      }

      const { data, error } = await supabase
        .from("businesses")
        .select(
          `
          id,
          name,
          published,
          auto_accept_bookings,
          booking_interval_minutes,
          min_notice_minutes,
          max_advance_days,
          buffer_before_minutes,
          buffer_after_minutes,
          cancellation_policy,
          reschedule_policy,
          timezone,
          currency
        `,
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const ownedBusinesses = (data || []) as Business[];
      setBusinesses(ownedBusinesses);

      const queryBusinessId =
        typeof router.query.businessId === "string"
          ? router.query.businessId
          : "";

      const nextSelectedBusiness =
        ownedBusinesses.find((business) => business.id === queryBusinessId) ||
        ownedBusinesses[0] ||
        null;

      if (nextSelectedBusiness) {
        setSelectedBusinessId(nextSelectedBusiness.id);
        setSettings(defaultSettings(nextSelectedBusiness));
      } else {
        setSelectedBusinessId("");
        setSettings(null);
      }

      setLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "dashboardSettings.error.load",
            "Could not load business settings.",
          ),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadSettings();
  }, [router.isReady]);

  function updateSetting<K extends keyof Business>(key: K, value: Business[K]) {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: value,
      };
    });
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      auto_accept_bookings: settings.auto_accept_bookings ?? false,
      booking_interval_minutes: settings.booking_interval_minutes ?? 30,
      min_notice_minutes: settings.min_notice_minutes ?? 120,
      max_advance_days: settings.max_advance_days ?? 60,
      buffer_before_minutes: settings.buffer_before_minutes ?? 0,
      buffer_after_minutes: settings.buffer_after_minutes ?? 0,
      cancellation_policy: settings.cancellation_policy?.trim() || null,
      reschedule_policy: settings.reschedule_policy?.trim() || null,
      timezone: settings.timezone || "Europe/London",
      currency: settings.currency || "GBP",
    };

    const { error } = await supabase
      .from("businesses")
      .update(payload)
      .eq("id", settings.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      `${settings.name} ${t("dashboardSettings.success.saved", "settings saved.")} ${
        settings.auto_accept_bookings
          ? t(
              "dashboardSettings.success.instant",
              "New bookings will confirm instantly.",
            )
          : t(
              "dashboardSettings.success.manual",
              "New bookings will go to Needs action for approval.",
            )
      }`,
    );
    await loadSettings();
  }

  return (
    <DashboardLayout
      title={t("dashboardSettings.pageTitle", "Booking rules")}
      subtitle={
        selectedBusiness
          ? selectedBusiness.name
          : t("dashboardSettings.pageSubtitle", "Set appointment rules.")
      }
    >
      {loading && (
        <div className="card">
          <p className="muted">
            {t(
              "dashboardSettings.loading",
              "Loading Mirëbook business settings...",
            )}
          </p>
        </div>
      )}

      {!loading && businesses.length === 0 && (
        <p className="more-inline-notice">
          {t(
            "dashboardSettings.empty.body",
            "Booking rules become available after you create a Mirëbook business profile.",
          )}
        </p>
      )}

      {!loading && businesses.length > 0 && settings && (
        <>
          {error && (
            <div
              className="card"
              style={{
                borderColor: "rgba(255,77,109,0.35)",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "var(--danger)" }}>{error}</p>
            </div>
          )}

          {success && (
            <div
              className="card"
              style={{
                borderColor: "rgba(45,212,191,0.35)",
                background: "rgba(45,212,191,0.06)",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "var(--success)" }}>{success}</p>
            </div>
          )}

          {businesses.length > 1 && (
            <div
              className="card"
              style={{
                borderColor: "rgba(255,190,11,0.28)",
                marginBottom: "1rem",
              }}
            >
              <p className="small muted">
                {t(
                  "dashboardSettings.multiBusinessNotice",
                  "This account has more than one business. Mirëbook is using your primary business for this launch version. Contact support if this needs changing.",
                )}
              </p>
            </div>
          )}

          <div className="settings-grid">
            <BookingApprovalSettings
              settings={settings}
              approvalModeLabel={approvalModeLabel}
              updateSetting={updateSetting}
            />

            <BookingRuleSettings
              settings={settings}
              updateSetting={updateSetting}
            />

            <RegionSettings settings={settings} updateSetting={updateSetting} />
          </div>

          <PolicySettings settings={settings} updateSetting={updateSetting} />

          <BusinessSettingsActions
            selectedBusiness={selectedBusiness}
            saving={saving}
            onSave={saveSettings}
          />
        </>
      )}

      <style jsx>{`
        .more-inline-notice {
          margin: 0 0 1.5rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        :global(.settings-card) {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        :global(.settings-card h2),
        :global(.settings-card p) {
          margin-bottom: 0;
        }

        :global(.settings-two-column) {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        :global(.settings-approval-card) {
          grid-column: 1 / -1;
        }

        :global(.settings-card select),
        :global(.settings-card textarea) {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          color-scheme: dark;
        }

        :global(.settings-card select) {
          min-height: 2.75rem;
          padding: 0.65rem 0.75rem;
        }

        @media (max-width: 640px) {
          .settings-tools-grid {
            grid-template-columns: 1fr;
          }

          .settings-tool-link {
            min-height: 0;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
