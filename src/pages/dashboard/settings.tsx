import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import BusinessSettingsActions from "@/components/dashboard-settings/BusinessSettingsActions";
import BusinessSettingsHeader from "@/components/dashboard-settings/BusinessSettingsHeader";
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
  const [ownerStaffBusinessIds, setOwnerStaffBusinessIds] = useState<string[]>(
    [],
  );

  const selectedBusiness = useMemo(() => {
    return (
      businesses.find((business) => business.id === selectedBusinessId) || null
    );
  }, [businesses, selectedBusinessId]);

  const ownerIsBookableStaff = selectedBusinessId
    ? ownerStaffBusinessIds.includes(selectedBusinessId)
    : false;

  const selectedBusinessPublicHref = settings
    ? `/explore/${settings.id}`
    : "/dashboard/businesses";

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

      const businessIds = ownedBusinesses.map((business) => business.id);

      if (businessIds.length > 0) {
        const { data: ownerStaffRows, error: ownerStaffError } = await supabase
          .from("staff_members")
          .select("business_id")
          .eq("user_id", session.user.id)
          .in("business_id", businessIds);

        if (ownerStaffError) throw ownerStaffError;

        setOwnerStaffBusinessIds(
          (ownerStaffRows || [])
            .map((row: { business_id?: string | null }) => row.business_id)
            .filter(Boolean) as string[],
        );
      } else {
        setOwnerStaffBusinessIds([]);
      }

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

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <DashboardLayout
      title={t("dashboardLayout.nav.more", "More")}
      subtitle={t(
        "dashboardSettings.more.subtitle",
        "Business setup, booking settings, reports, billing, support and account tools.",
      )}
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

      {!loading && (
        <div className="more-sections">
          <section className="more-section">
            <div className="more-section-heading">
              <h2>
                {t("dashboardSettings.more.setupTitle", "Business setup")}
              </h2>
              <p className="small muted">
                {t(
                  "dashboardSettings.more.setupSectionBody",
                  "Manage the profile and hours customers use when booking.",
                )}
              </p>
            </div>
            <div className="settings-tools-grid">
              <Link href="/dashboard/businesses" className="settings-tool-link">
                <strong>
                  {t("dashboardLayout.nav.setupHub", "Business setup hub")}
                </strong>
                <span>
                  {t(
                    "dashboardSettings.more.setupBody",
                    "Manage the public profile, readiness and publishing.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              <Link
                href="/dashboard/availability"
                className="settings-tool-link"
              >
                <strong>
                  {t("dashboardSettings.tools.availability", "Availability")}
                </strong>
                <span>
                  {t(
                    "dashboardSettings.tools.availabilityBody",
                    "Set business-wide opening days and hours.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              <Link
                href={selectedBusinessPublicHref}
                className="settings-tool-link"
              >
                <strong>{t("account.publicPage", "Public page")}</strong>
                <span>
                  {t(
                    "dashboardSettings.more.publicPageBody",
                    "Preview the profile and booking journey customers see.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
            </div>
          </section>

          <section className="more-section">
            <div className="more-section-heading">
              <h2>
                {t(
                  "dashboardSettings.more.operationsTitle",
                  "Business operations",
                )}
              </h2>
              <p className="small muted">
                {t(
                  "dashboardSettings.more.operationsBody",
                  "Review updates and performance outside daily booking work.",
                )}
              </p>
            </div>
            <div className="settings-tools-grid">
              <Link
                href="/dashboard/notifications"
                className="settings-tool-link"
              >
                <strong>
                  {t(
                    "dashboardSettings.more.notifications",
                    "Business notifications",
                  )}
                </strong>
                <span>
                  {t(
                    "dashboardSettings.more.notificationsBody",
                    "Review business updates, then use Bookings for appointment actions.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              <Link href="/dashboard/analytics" className="settings-tool-link">
                <strong>{t("dashboardHome.viewAnalytics", "Analytics")}</strong>
                <span>
                  {t(
                    "dashboardSettings.more.analyticsBody",
                    "Review booking activity and service trends.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              {ownerIsBookableStaff && (
                <Link
                  href="/staff"
                  className="settings-tool-link settings-tool-link-owner"
                >
                  <strong>
                    {t("dashboardSettings.more.myWork", "My staff work")}
                  </strong>
                  <span>
                    {t(
                      "dashboardSettings.more.myWorkBody",
                      "Open your personal schedule and staff availability.",
                    )}
                  </span>
                  <em>{t("common.open", "Open")}</em>
                </Link>
              )}
            </div>
          </section>

          <section className="more-section">
            <div className="more-section-heading">
              <h2>
                {t(
                  "dashboardSettings.more.accountTitle",
                  "Account and billing",
                )}
              </h2>
              <p className="small muted">
                {t(
                  "dashboardSettings.more.accountSectionBody",
                  "Manage the subscription, personal account and support.",
                )}
              </p>
            </div>
            <div className="settings-tools-grid">
              <Link href="/dashboard/billing" className="settings-tool-link">
                <strong>
                  {t("dashboardSettings.tools.billing", "Billing")}
                </strong>
                <span>
                  {t(
                    "dashboardSettings.tools.billingBody",
                    "View plan, trial and payment settings.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              <Link href="/account" className="settings-tool-link">
                <strong>
                  {t("dashboardLayout.nav.accountSettings", "My account")}
                </strong>
                <span>
                  {t(
                    "dashboardSettings.more.accountBody",
                    "Manage personal details, language, security and email preferences.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              <Link href="/support/business" className="settings-tool-link">
                <strong>
                  {t("dashboardSettings.tools.support", "Business support")}
                </strong>
                <span>
                  {t(
                    "dashboardSettings.tools.supportBody",
                    "Get help with setup, bookings or account changes.",
                  )}
                </span>
                <em>{t("common.open", "Open")}</em>
              </Link>
              <button
                type="button"
                className="settings-tool-link settings-tool-button"
                onClick={logout}
              >
                <strong>{t("auth.logout", "Log out")}</strong>
                <span>
                  {t(
                    "dashboardSettings.more.logoutBody",
                    "End this Mirëbook Business session on this device.",
                  )}
                </span>
                <em>{t("auth.logout", "Log out")}</em>
              </button>
            </div>
          </section>
        </div>
      )}

      {!loading && businesses.length === 0 && (
        <p className="more-inline-notice">
          {t(
            "dashboardSettings.empty.body",
            "Business settings become available after you create a Mirëbook business profile.",
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

          <BusinessSettingsHeader selectedBusiness={selectedBusiness} />

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

          <div className="settings-section-heading">
            <h2>
              {t(
                "dashboardSettings.bookingSection.title",
                "Rules and policies",
              )}
            </h2>
            <p className="small muted" style={{ marginTop: "0.35rem" }}>
              {t(
                "dashboardSettings.bookingSection.body",
                "Control how customers book, how far ahead they can book, and what happens when they need to cancel or reschedule.",
              )}
            </p>
          </div>

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
        .settings-section-heading {
          margin: 1.5rem 0 0.85rem;
          padding-top: 0.25rem;
        }

        .settings-section-heading h2 {
          font-family: var(--font-display);
          margin-top: 0;
        }
        .more-sections {
          display: grid;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .more-section {
          display: grid;
          gap: 0.9rem;
        }

        .more-section + .more-section {
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        .more-section-heading {
          display: grid;
          gap: 0.3rem;
        }

        .more-section-heading h2,
        .more-section-heading p {
          margin: 0;
        }

        .more-inline-notice {
          margin: -0.75rem 0 1.5rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .settings-tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .settings-tool-link {
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 0.65rem;
          min-height: 10rem;
          padding: 1.1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          color: var(--text);
          text-decoration: none;
          text-align: left;
        }

        .settings-tool-link:hover {
          border-color: rgba(255, 107, 53, 0.35);
        }

        .settings-tool-button {
          width: 100%;
          font: inherit;
          cursor: pointer;
        }

        .settings-tool-link-owner {
          border-color: rgba(45, 212, 191, 0.28);
          background: rgba(45, 212, 191, 0.06);
        }

        .settings-tool-link span {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .settings-tool-link em {
          color: var(--accent);
          font-size: 0.82rem;
          font-style: normal;
          font-weight: 800;
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
