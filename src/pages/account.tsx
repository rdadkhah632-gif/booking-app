import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import { Locale } from "@/lib/i18n";

type Role = "customer" | "business" | "staff";

type Profile = {
  id: string;
  email: string;
  role: Role | string | null;
  full_name?: string | null;
  phone?: string | null;
  preferred_language?: Locale | string | null;
  is_admin?: boolean | null;
};

type BusinessRow = {
  id: string;
  name: string;
  published?: boolean | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  trial_ends_at?: string | null;
};

type StaffProfile = {
  id: string;
  business_id: string;
  name: string;
  email?: string | null;
  role_title?: string | null;
  permission_role?: string | null;
  invite_status?: string | null;
  business_name?: string | null;
};

type AccountStats = {
  bookings: number;
  unreadNotifications: number;
  businessNotifications: number;
  adminNotifications: number;
  pendingCustomerBookings: number;
  pendingBusinessActions: number;
};

type RegionInfo = {
  timezone: string;
  country: string;
  currency: string;
  locale: string;
};

function detectRegion(): RegionInfo {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
  const browserLocale =
    typeof navigator !== "undefined" ? navigator.language : "en-GB";

  if (
    timezone === "Europe/London" ||
    browserLocale.toLowerCase().includes("gb")
  ) {
    return {
      timezone,
      country: "United Kingdom",
      currency: "GBP",
      locale: browserLocale,
    };
  }

  if (
    timezone === "Europe/Tirane" ||
    browserLocale.toLowerCase().includes("sq")
  ) {
    return {
      timezone,
      country: "Albania",
      currency: "ALL",
      locale: browserLocale,
    };
  }

  if (
    timezone === "Europe/Rome" ||
    browserLocale.toLowerCase().includes("it")
  ) {
    return {
      timezone,
      country: "Italy",
      currency: "EUR",
      locale: browserLocale,
    };
  }

  return {
    timezone,
    country: "Auto-detected",
    currency: "Auto",
    locale: browserLocale,
  };
}

function pluralLabel(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export default function AccountPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownedBusinesses, setOwnedBusinesses] = useState<BusinessRow[]>([]);
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(
    null,
  );
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isStaffIntentAccount, setIsStaffIntentAccount] = useState(false);
  const [hasLinkedStaffProfile, setHasLinkedStaffProfile] = useState(false);
  const [stats, setStats] = useState<AccountStats>({
    bookings: 0,
    unreadNotifications: 0,
    businessNotifications: 0,
    adminNotifications: 0,
    pendingCustomerBookings: 0,
    pendingBusinessActions: 0,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [regionInfo, setRegionInfo] = useState<RegionInfo>({
    timezone: "Unknown",
    country: "Auto-detected",
    currency: "Auto",
    locale: "en-GB",
  });

  const ownsBusiness = ownedBusinesses.length > 0;
  const hasStaffAccess = hasLinkedStaffProfile || isStaffIntentAccount;
  const isAdmin = !!profile?.is_admin;
  const isStaffIntentOnly = isStaffIntentAccount && !hasLinkedStaffProfile;
  const isCustomerOnly = !ownsBusiness && !hasStaffAccess && !isAdmin;

  const primaryAccountMode = useMemo(() => {
    if (isAdmin) return t("account.access.operator", "Operator");
    if (ownsBusiness)
      return t("account.access.businessOwner", "Business owner");
    if (hasLinkedStaffProfile) return t("account.access.staff", "Staff member");
    if (isStaffIntentAccount)
      return t("account.access.staffIntent", "Staff account");
    return t("account.access.customer", "Customer");
  }, [isAdmin, ownsBusiness, hasLinkedStaffProfile, isStaffIntentAccount, t]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setRegionInfo(detectRegion());

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, role, full_name, phone, preferred_language, is_admin")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profileData) {
      setError(
        profileError?.message ||
          t("account.error.loadProfile", "Could not load account profile."),
      );
      setLoading(false);
      return;
    }

    const capabilities = await getAccountCapabilities(
      session.user.id,
      session.user.email,
    );

    const currentProfile = profileData as Profile;
    const profileLanguage: Locale =
      currentProfile.preferred_language === "sq" ? "sq" : "en";

    setProfile(currentProfile);
    setFullName(currentProfile.full_name || "");
    setPhone(currentProfile.phone || "");
    setPreferredLanguage(profileLanguage);

    const loadedBusinesses = capabilities.ownedBusinesses as BusinessRow[];
    setOwnedBusinesses(loadedBusinesses);
    setPrimaryBusinessId(capabilities.primaryBusinessId);
    setIsStaffIntentAccount(capabilities.isStaffIntent);
    setHasLinkedStaffProfile(capabilities.hasLinkedStaffProfile);

    let resolvedStaffProfile: StaffProfile | null =
      (capabilities.linkedStaffProfiles[0] as StaffProfile | undefined) || null;

    setStaffProfile(resolvedStaffProfile);
    await loadStats(
      session.user.id,
      loadedBusinesses.map((business) => business.id),
      !!currentProfile.is_admin,
    );
    setLoading(false);
  }

  async function loadStats(
    userId: string,
    businessIds: string[],
    adminUser: boolean,
  ) {
    const { data: customerBookings } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("customer_user_id", userId)
      .limit(200);

    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, audience, read_at")
      .eq("user_id", userId)
      .limit(200);

    let pendingBusinessActions = 0;

    if (businessIds.length > 0) {
      const { count: pendingBookingsCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("business_id", businessIds)
        .eq("status", "pending");

      const { data: pendingRequests } = await supabase
        .from("booking_requests")
        .select("booking_id")
        .in("business_id", businessIds)
        .eq("status", "pending");

      const uniquePendingReschedules = new Set(
        (pendingRequests || []).map((request) => request.booking_id),
      ).size;
      pendingBusinessActions =
        (pendingBookingsCount || 0) + uniquePendingReschedules;
    }

    let adminNotifications = 0;

    if (adminUser) {
      const { count: adminUnreadCount } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("audience", "admin")
        .is("read_at", null);

      adminNotifications = adminUnreadCount || 0;
    }

    const notificationRows = notifications || [];
    const bookingRows = customerBookings || [];

    setStats({
      bookings: bookingRows.length,
      unreadNotifications: notificationRows.filter((row: any) => !row.read_at)
        .length,
      businessNotifications: notificationRows.filter(
        (row: any) => !row.read_at && row.audience === "business",
      ).length,
      adminNotifications,
      pendingCustomerBookings: bookingRows.filter(
        (row: any) => row.status === "pending",
      ).length,
      pendingBusinessActions,
    });
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    setPreferredLanguage(locale);
  }, [locale]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    if (!profile) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        preferred_language: preferredLanguage,
      })
      .eq("id", profile.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    await setLocale(preferredLanguage);
    setMessage(t("account.saveSuccess", "Mirëbook account details updated."));
    await loadProfile();
    setSaving(false);
  }

  async function sendPasswordReset() {
    if (!profile?.email) return;

    setResettingPassword(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      profile.email,
      {
        redirectTo: `${window.location.origin}/login`,
      },
    );

    setResettingPassword(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage(
      t(
        "account.passwordResetSent",
        "Password reset email sent. Check your inbox to continue.",
      ),
    );
  }

  function publicBusinessHref() {
    return primaryBusinessId
      ? `/explore/${primaryBusinessId}`
      : "/dashboard/businesses";
  }

  function staffBusinessName() {
    return (
      staffProfile?.business_name ||
      t("account.linkedBusiness", "Linked business")
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "42px 24px 80px" }}>
        {loading && (
          <div className="card">
            <p className="muted">
              {t("account.loading", "Loading your Mirëbook account...")}
            </p>
          </div>
        )}

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

        {!loading && profile && (
          <div className="account-page-shell">
            <div className="account-header">
              <div>
                <h1 className="page-title">
                  {t("account.pageTitle", "My account")}
                </h1>
                <p className="page-sub account-header-subtitle">
                  {t(
                    "account.pageSubtitle",
                    "Manage your login details, language, security and account-specific Mirëbook settings.",
                  )}
                </p>
              </div>

              <div className="account-header-actions">
                <Link href="/support" className="btn btn-ghost">
                  {t("nav.support", "Support")}
                </Link>
                <button onClick={logout} className="btn btn-danger">
                  {t("auth.logout", "Log out")}
                </button>
              </div>
            </div>

            {message && (
              <div
                className="card"
                style={{
                  borderColor: "rgba(45,212,191,0.35)",
                  background: "rgba(45,212,191,0.06)",
                }}
              >
                <p style={{ color: "var(--success)" }}>{message}</p>
              </div>
            )}

            <form
              onSubmit={saveProfile}
              className="card account-form-card account-primary-card"
            >
              <div className="account-card-heading">
                <h2>{t("account.personalDetails", "Personal details")}</h2>
                <p className="small muted">
                  {ownsBusiness
                    ? t(
                        "account.accountOnlyBusinessBody",
                        "These settings belong to your owner login. Business profile details, services, staff and booking rules stay in Business settings.",
                      )
                    : hasStaffAccess
                      ? t(
                          "account.accountOnlyStaffBody",
                          "These settings belong to your staff login. If no business is linked yet, your staff workspace will stay limited until a matching invite is connected.",
                        )
                      : t(
                          "account.accountOnlyCustomerBody",
                          "These settings belong to your customer login and are used for bookings, notifications and support conversations.",
                        )}
                </p>
              </div>

              <div className="account-form-grid">
                <div>
                  <label className="small muted">
                    {t("account.fullName", "Full name")}
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t(
                      "account.fullNamePlaceholder",
                      "Your full name",
                    )}
                  />
                </div>

                <div>
                  <label className="small muted">
                    {t("common.phone", "Phone")}
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("account.phonePlaceholder", "Phone number")}
                  />
                </div>

                <div>
                  <label className="small muted">
                    {t("account.email", "Email")}
                  </label>
                  <input value={profile.email} disabled />
                  <p className="small muted account-field-help">
                    {t(
                      "account.emailChangeBody",
                      "Email changes require confirmation. Use password reset or contact support if this email is wrong.",
                    )}
                  </p>
                </div>

                <div>
                  <label className="small muted">
                    {t("account.languagePreference", "Language preference")}
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) =>
                      setPreferredLanguage(e.target.value as Locale)
                    }
                  >
                    <option value="en">
                      {t("language.english", "English")}
                    </option>
                    <option value="sq">
                      {t("language.albanian", "Albanian")}
                    </option>
                  </select>
                  <p className="small muted account-field-help">
                    {t(
                      "account.languageBody",
                      "This language is saved to your account and used across translated Mirëbook pages when you sign in.",
                    )}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-accent account-save-button"
              >
                {saving
                  ? t("account.saving", "Saving...")
                  : t("account.saveChanges", "Save changes")}
              </button>
            </form>

            <div className="grid-2 account-settings-grid">
              <div className="card account-security-card">
                <div className="account-card-heading">
                  <p className="small muted">
                    {t("account.security.kicker", "Security")}
                  </p>
                  <h3>{t("account.security.title", "Password and login")}</h3>
                  <p className="small muted">
                    {t(
                      "account.security.body",
                      "Send a password reset email to your login address. This is safer than changing passwords directly inside the account page.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={sendPasswordReset}
                  disabled={resettingPassword}
                >
                  {resettingPassword
                    ? t("account.security.sending", "Sending reset...")
                    : t(
                        "account.security.resetPassword",
                        "Send password reset",
                      )}
                </button>
              </div>

              <div className="card account-region-card">
                <div className="account-card-heading">
                  <p className="small muted">
                    {t("account.region.kicker", "Detected region")}
                  </p>
                  <h3>{regionInfo.country}</h3>
                  <p className="small muted">
                    {t(
                      "account.region.body",
                      "Mirëbook uses your browser region as a smart default for timezone, currency and future localisation features.",
                    )}
                  </p>
                </div>
                <div className="account-region-grid">
                  <span>{regionInfo.timezone}</span>
                  <span>{regionInfo.currency}</span>
                  <span>{regionInfo.locale}</span>
                </div>
              </div>
            </div>

            {ownsBusiness && (
              <div className="card account-business-settings-card">
                <h3>
                  {t(
                    "account.businessSettingsTitle",
                    "Need to change your business setup?",
                  )}
                </h3>
                <p className="small muted">
                  {t(
                    "account.businessSettingsBody",
                    "Use Business settings for booking rules, approval mode, policies, billing, services, staff and public business details.",
                  )}
                </p>
                <Link
                  href="/dashboard/settings"
                  className="btn btn-ghost"
                  style={{ marginTop: 0 }}
                >
                  {t("dashboardSettings.pageTitle", "Business settings")}
                </Link>
              </div>
            )}

            {isAdmin && (
              <div className="card operator-account-card">
                <div className="operator-account-row">
                  <div className="account-card-heading">
                    <h2>
                      {t("account.operator.title", "Mirëbook operator tools")}
                    </h2>
                    <p className="small muted">
                      {t(
                        "account.operator.body",
                        "Use this for business onboarding, trial access, pricing, account lookup and platform notifications. Customer and business dashboards are separate.",
                      )}
                    </p>
                  </div>

                  <div className="operator-account-actions">
                    <Link href="/admin" className="btn btn-accent">
                      {t("account.operator.dashboard", "Operator dashboard")}
                    </Link>
                    <Link href="/admin/businesses" className="btn btn-ghost">
                      {t("dashboardBusinesses.stats.businesses", "Businesses")}
                    </Link>
                    <Link href="/admin/users" className="btn btn-ghost">
                      {t("account.operator.users", "Users")}
                    </Link>
                    <Link href="/admin/notifications" className="btn btn-ghost">
                      {t("dashboardHome.openNotifications", "Notifications")}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid-2 account-summary-grid">
              <div className="card account-role-card">
                <strong>{primaryAccountMode}</strong>
                <p className="small muted">
                  {isAdmin
                    ? t(
                        "account.operatorSummaryBody",
                        "Operator access is for platform management, support inbox, business onboarding and account lookup.",
                      )
                    : ownsBusiness
                      ? t(
                          "account.businessSummaryBody",
                          "Owner access lets you manage business setup, bookings, services, staff, publishing and support conversations.",
                        )
                      : hasStaffAccess
                        ? t(
                            "account.staffSummaryBody",
                            "Staff access lets you view your staff workspace. Linked staff can see assigned bookings, calendar, availability, notifications and support conversations.",
                          )
                        : t(
                            "account.customerSummaryBody",
                            "Customer access lets you book services, manage appointments, receive notifications and contact support.",
                          )}
                </p>
              </div>

              {isCustomerOnly && (
                <div className="card">
                  <strong>
                    {pluralLabel(
                      stats.bookings,
                      t("account.bookingSingular", "booking"),
                      t("account.bookingPlural", "bookings"),
                    )}
                  </strong>
                  <p className="small muted">
                    {pluralLabel(
                      stats.pendingCustomerBookings,
                      t("account.pendingBookingSingular", "pending booking"),
                      t("account.pendingBookingPlural", "pending bookings"),
                    )}
                    .
                  </p>
                  <Link
                    href="/my-bookings"
                    className="btn btn-ghost"
                    style={{ marginTop: "0.75rem" }}
                  >
                    {t("nav.myBookings", "My bookings")}
                  </Link>
                </div>
              )}

              {ownsBusiness && (
                <div
                  className="card"
                  style={{ borderColor: "rgba(45,212,191,0.25)" }}
                >
                  <strong>
                    {pluralLabel(
                      ownedBusinesses.length,
                      t("account.businessProfile", "business profile"),
                    )}
                  </strong>
                  <p className="small muted">
                    {pluralLabel(
                      stats.pendingBusinessActions,
                      t("account.businessAction", "business action"),
                    )}{" "}
                    {t("account.currentlyPending", "currently pending.")}
                  </p>
                  <div className="account-card-actions">
                    <Link href="/dashboard" className="btn btn-accent">
                      {t("dashboardHome.title", "Business overview")}
                    </Link>
                    <Link
                      href="/dashboard/businesses"
                      className="btn btn-ghost"
                    >
                      {t("account.manageBusinessProfiles", "Manage businesses")}
                    </Link>
                  </div>
                </div>
              )}

              {hasStaffAccess && (
                <div
                  className="card"
                  style={{ borderColor: "rgba(45,212,191,0.25)" }}
                >
                  <strong>
                    {hasLinkedStaffProfile
                      ? t("account.linkedStaffProfile", "Linked staff profile")
                      : t("account.staffIntentProfile", "Staff account")}
                  </strong>
                  <p className="small muted">
                    {hasLinkedStaffProfile
                      ? `${staffProfile?.name} · ${staffProfile?.role_title || staffProfile?.permission_role || t("account.access.staff", "Staff")} ${t("account.at", "at")} ${staffBusinessName()}`
                      : t(
                          "account.staffIntentUnlinkedBody",
                          "This login is set up as a staff account, but it is not connected to a business staff profile yet. Ask the business to invite this exact email, then refresh your staff workspace.",
                        )}
                  </p>
                  <div className="account-card-actions">
                    <Link href="/staff" className="btn btn-accent">
                      {hasLinkedStaffProfile
                        ? t("staff.schedule.title", "My schedule")
                        : t("staff.unlinked.title", "No business linked yet")}
                    </Link>
                    {hasLinkedStaffProfile && (
                      <Link
                        href="/staff/availability"
                        className="btn btn-ghost"
                      >
                        {t(
                          "staff.actions.updateAvailability",
                          "Update availability",
                        )}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {!hasStaffAccess && !isCustomerOnly && (
                <div className="card">
                  <strong>
                    {t("dashboardStaff.card.notLinked", "Not linked")}
                  </strong>
                  <p className="small muted">
                    {t(
                      "account.staffAccessBody",
                      "Staff access appears here only when a business links this login to a staff profile, or when the account was registered as staff.",
                    )}
                  </p>
                </div>
              )}

              <div className="card">
                <strong>
                  {stats.unreadNotifications + stats.adminNotifications}{" "}
                  {t("account.unread", "unread")}
                </strong>
                <p className="small muted">
                  {isAdmin
                    ? `${stats.adminNotifications} ${t("account.operatorNotice", "operator notice")}${stats.adminNotifications === 1 ? "" : "s"}.`
                    : ownsBusiness
                      ? `${stats.businessNotifications} ${t("account.businessNotice", "business notice")}${stats.businessNotifications === 1 ? "" : "s"}.`
                      : hasStaffAccess
                        ? t(
                            "account.staffNotificationsBody",
                            "Staff workspace updates appear here once your account is linked to a business profile.",
                          )
                        : t(
                            "account.customerNotificationsBody",
                            "Customer booking updates appear here.",
                          )}
                </p>
                <Link
                  href={
                    hasStaffAccess ? "/staff/notifications" : "/notifications"
                  }
                  className="btn btn-ghost"
                  style={{ marginTop: "0.75rem" }}
                >
                  {t("nav.notifications", "Notifications")}
                </Link>
              </div>
            </div>

            <div className="card support-card">
              <div className="account-card-heading">
                <h2>{t("nav.support", "Support")}</h2>
                <p className="small muted">
                  {t(
                    "account.supportBody",
                    "Customer, business and staff support routes are separated. Your saved language preference will be used across translated Mirëbook pages.",
                  )}
                </p>
              </div>

              <div className="workspace-actions">
                <Link
                  href={hasStaffAccess ? "/support/staff" : "/support"}
                  className="btn btn-ghost"
                >
                  {t("account.contactSupport", "Contact support")}
                </Link>
                <Link
                  href={hasStaffAccess ? "/support/staff" : "/support/messages"}
                  className="btn btn-ghost"
                >
                  {t(
                    "support.customer.allConversations",
                    "All support messages",
                  )}
                </Link>
                <span
                  className="language-pill"
                  title={t("account.savedLanguage", "Saved account language")}
                >
                  {preferredLanguage === "sq" ? "SQ" : "EN"}
                </span>
                <button onClick={logout} className="btn btn-danger">
                  {t("auth.logout", "Log out")}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .account-page-shell {
          max-width: 1040px;
          margin: 0 auto;
          display: grid;
          gap: 1.1rem;
        }

        .account-header-subtitle {
          margin-top: 0.45rem;
        }

        .account-card-heading {
          display: grid;
          gap: 0.45rem;
        }

        .account-card-heading h2,
        .account-card-heading h3,
        .account-card-heading p {
          margin-top: 0;
        }

        .account-card-heading h2 {
          font-family: var(--font-display);
        }

        .account-header,
        .operator-account-row,
        .support-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .account-header-actions,
        .operator-account-actions,
        .workspace-actions,
        .account-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .account-summary-grid {
          align-items: stretch;
        }

        .account-settings-grid {
          align-items: stretch;
        }

        .account-security-card,
        .account-region-card,
        .account-role-card {
          display: grid;
          gap: 0.75rem;
        }

        .account-summary-grid :global(.card),
        .account-settings-grid :global(.card) {
          display: grid;
          gap: 0.75rem;
        }

        .account-summary-grid p,
        .account-settings-grid p,
        .support-card p,
        .account-form-card p {
          margin-top: 0;
        }

        .account-region-grid {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .account-region-grid span {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
          color: var(--text-muted);
          padding: 0.25rem 0.65rem;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .operator-account-card {
          border-color: rgba(255, 107, 53, 0.28);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.08),
            rgba(45, 212, 191, 0.04)
          );
        }

        .account-form-card {
          display: grid;
          gap: 0.95rem;
        }

        .account-primary-card {
          border-color: rgba(45, 212, 191, 0.25);
        }

        .account-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem 1rem;
          align-items: start;
        }

        .account-form-grid input,
        .account-form-grid select {
          width: 100%;
          margin-top: 0.35rem;
        }

        .account-field-help {
          margin-top: 0.3rem;
        }

        .account-save-button {
          justify-self: flex-start;
        }

        .account-business-settings-card {
          display: grid;
          gap: 0.55rem;
          border-color: rgba(255, 107, 53, 0.25);
        }

        .account-business-settings-card h3,
        .account-business-settings-card p {
          margin-top: 0;
        }

        .support-card {
          border-color: rgba(255, 190, 11, 0.22);
        }

        .language-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.2rem;
          height: 2.35rem;
          padding: 0 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 700;
        }

        @media (max-width: 700px) {
          .account-header,
          .operator-account-row,
          .support-card {
            display: grid;
          }

          .account-header-actions,
          .operator-account-actions,
          .workspace-actions,
          .account-card-actions,
          .account-header-actions :global(.btn),
          .operator-account-actions :global(.btn),
          .workspace-actions :global(.btn),
          .account-card-actions :global(.btn),
          .account-header-actions button,
          .operator-account-actions a,
          .workspace-actions a,
          .workspace-actions button,
          .account-card-actions a,
          .account-security-card button {
            width: 100%;
            justify-content: center;
          }

          .account-form-grid {
            grid-template-columns: 1fr;
          }

          .account-save-button {
            width: 100%;
            justify-content: center;
          }

          .language-pill {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
