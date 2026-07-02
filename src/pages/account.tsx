import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import { Locale } from "@/lib/i18n";
import {
  EmailPreferences,
  defaultEmailPreferences,
  isPreferencesSchemaMissing,
} from "@/lib/email/preferences";
import {
  EmailVerificationState,
  getEmailVerificationState,
} from "@/lib/email/verification";
import { getAuthAppUrl, isBusinessAppHostname } from "@/lib/appUrls";

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

export default function AccountPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownedBusinesses, setOwnedBusinesses] = useState<BusinessRow[]>([]);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isStaffIntentAccount, setIsStaffIntentAccount] = useState(false);
  const [hasLinkedStaffProfile, setHasLinkedStaffProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [emailVerificationState, setEmailVerificationState] =
    useState<EmailVerificationState>("unknown");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(
    defaultEmailPreferences,
  );
  const [preferencesState, setPreferencesState] = useState<
    "loading" | "available" | "schema_missing"
  >("loading");
  const [savingPreferences, setSavingPreferences] = useState(false);
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

    setEmailVerificationState(getEmailVerificationState(session.user));

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
    setIsStaffIntentAccount(capabilities.isStaffIntent);
    setHasLinkedStaffProfile(capabilities.hasLinkedStaffProfile);

    let resolvedStaffProfile: StaffProfile | null =
      (capabilities.linkedStaffProfiles[0] as StaffProfile | undefined) || null;

    setStaffProfile(resolvedStaffProfile);
    await loadEmailPreferences(session.user.id);
    setLoading(false);
  }

  async function loadEmailPreferences(userId: string) {
    const { data, error: preferencesError } = await supabase
      .from("notification_email_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (preferencesError) {
      setEmailPreferences(defaultEmailPreferences);
      if (isPreferencesSchemaMissing(preferencesError)) {
        setPreferencesState("schema_missing");
      } else {
        setPreferencesState("available");
        setError(
          t(
            "account.emailPreferences.loadError",
            "Could not load saved email preferences. Safe defaults are shown.",
          ),
        );
      }
      return;
    }

    setEmailPreferences({
      ...defaultEmailPreferences,
      ...(data || {}),
    } as EmailPreferences);
    setPreferencesState("available");
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

    const authProduct =
      ownsBusiness ||
      hasStaffAccess ||
      isBusinessAppHostname(window.location.hostname)
        ? "business"
        : "customer";
    const resetRedirect = getAuthAppUrl(
      authProduct,
      `/reset-password?product=${authProduct}`,
      window.location.origin,
    );

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      profile.email,
      {
        redirectTo: resetRedirect,
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
        "Password reset request accepted. Check your inbox and spam folder to continue.",
      ),
    );
  }

  async function resendVerification() {
    if (!profile?.email || emailVerificationState !== "unverified") return;

    setResendingVerification(true);
    setError(null);
    setMessage(null);

    const authProduct =
      ownsBusiness ||
      hasStaffAccess ||
      isBusinessAppHostname(window.location.hostname)
        ? "business"
        : "customer";
    const verificationRedirect = getAuthAppUrl(
      authProduct,
      `/login?verified=1${
        authProduct === "business" ? "&product=business" : ""
      }`,
      window.location.origin,
    );

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: profile.email,
      options: {
        emailRedirectTo: verificationRedirect,
      },
    });

    setResendingVerification(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage(
      t(
        "account.verification.resent",
        "Verification email sent. Check your inbox and spam folder.",
      ),
    );
  }

  function updateEmailPreference(
    key: keyof EmailPreferences,
    checked: boolean,
  ) {
    setEmailPreferences((current) => ({
      ...current,
      [key]: checked,
    }));
  }

  async function saveEmailPreferences() {
    if (!profile) return;

    setSavingPreferences(true);
    setError(null);
    setMessage(null);

    const { error: saveError } = await supabase
      .from("notification_email_preferences")
      .upsert(
        {
          user_id: profile.id,
          ...emailPreferences,
        },
        { onConflict: "user_id" },
      );

    setSavingPreferences(false);

    if (saveError) {
      if (isPreferencesSchemaMissing(saveError)) {
        setPreferencesState("schema_missing");
        setError(
          t(
            "account.emailPreferences.schemaMissingError",
            "Email preferences are not available yet.",
          ),
        );
        return;
      }

      setError(
        saveError.message ||
          t(
            "account.emailPreferences.saveError",
            "Could not save email preferences.",
          ),
      );
      return;
    }

    setPreferencesState("available");
    setMessage(
      t(
        "account.emailPreferences.saved",
        "Email preferences saved. In-app notifications remain enabled.",
      ),
    );
  }

  function staffBusinessName() {
    return (
      staffProfile?.business_name ||
      t("account.linkedBusiness", "Linked business")
    );
  }

  const emailIsVerified = emailVerificationState === "verified";
  const emailIsUnverified = emailVerificationState === "unverified";

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "30px 24px 72px" }}>
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
                    "Personal details, language and security.",
                  )}
                </p>
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

            <div
              className={`card account-verification-card ${
                emailIsVerified
                  ? "account-verification-card-verified"
                  : emailIsUnverified
                    ? "account-verification-card-unverified"
                    : "account-verification-card-unknown"
              }`}
            >
              <div className="account-card-heading">
                <h2>
                  {emailIsVerified
                    ? t("account.verification.verified", "Email verified")
                    : emailIsUnverified
                      ? t(
                          "account.verification.unverified",
                          "Verification pending",
                        )
                      : t(
                          "account.verification.unknown",
                          "Verification status unavailable",
                        )}
                </h2>
                <p className="small muted">
                  {emailIsVerified
                    ? t(
                        "account.verification.verifiedBody",
                        "This email is linked to your Mirëbook account.",
                      )
                    : emailIsUnverified
                      ? t(
                          "account.verification.unverifiedBody",
                          "This email has not been confirmed yet. Check your inbox or send another verification email.",
                        )
                      : t(
                          "account.verification.unknownBody",
                          "Mirëbook could not confirm the current email status.",
                        )}
                </p>
              </div>
              {emailIsUnverified && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resendVerification}
                  disabled={resendingVerification}
                >
                  {resendingVerification
                    ? t(
                        "verification.resending",
                        "Sending verification email...",
                      )
                    : t("verification.resend", "Resend verification email")}
                </button>
              )}
            </div>

            <details className="account-details-panel account-email-preferences">
              <summary>
                <span>
                  <strong>
                    {t("account.emailPreferences.title", "Email updates")}
                  </strong>
                  <small>
                    {t(
                      "account.emailPreferences.body",
                      "Choose which email updates you want.",
                    )}
                  </small>
                </span>
              </summary>

              <div className="account-details-body">
                {preferencesState === "schema_missing" && (
                  <div className="account-preferences-notice">
                    <strong>
                      {t(
                        "account.emailPreferences.setupRequired",
                        "Email preferences unavailable",
                      )}
                    </strong>
                    <p className="small muted">
                      {t(
                        "account.emailPreferences.setupRequiredBody",
                        "These settings are not available yet. Important booking emails remain on.",
                      )}
                    </p>
                  </div>
                )}

                <div className="account-preference-groups">
                  {isCustomerOnly && (
                    <div className="account-preference-group">
                      <h3>
                        {t(
                          "account.emailPreferences.customerTitle",
                          "Customer booking emails",
                        )}
                      </h3>
                      <label className="account-preference-toggle">
                        <input
                          type="checkbox"
                          checked={
                            emailPreferences.email_booking_request_updates &&
                            emailPreferences.email_booking_confirmations &&
                            emailPreferences.email_booking_cancellations
                          }
                          onChange={(event) => {
                            const checked = event.target.checked;
                            updateEmailPreference(
                              "email_booking_request_updates",
                              checked,
                            );
                            updateEmailPreference(
                              "email_booking_confirmations",
                              checked,
                            );
                            updateEmailPreference(
                              "email_booking_cancellations",
                              checked,
                            );
                          }}
                        />
                        <span>
                          <strong>
                            {t(
                              "account.emailPreferences.bookingUpdates",
                              "Booking updates",
                            )}
                          </strong>
                          <span className="small muted">
                            {t(
                              "account.emailPreferences.bookingUpdatesBody",
                              "Requests, confirmations, declines and cancellations.",
                            )}
                          </span>
                        </span>
                      </label>
                      <label className="account-preference-toggle">
                        <input
                          type="checkbox"
                          checked={emailPreferences.email_booking_reminders}
                          onChange={(event) =>
                            updateEmailPreference(
                              "email_booking_reminders",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>
                            {t(
                              "account.emailPreferences.reminders",
                              "Appointment reminders",
                            )}
                          </strong>
                          <span className="small muted">
                            {t(
                              "account.emailPreferences.remindersBody",
                              "A planned email about 24 hours before confirmed appointments.",
                            )}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  {ownsBusiness && (
                    <div className="account-preference-group">
                      <h3>
                        {t(
                          "account.emailPreferences.businessTitle",
                          "Business owner emails",
                        )}
                      </h3>
                      <label className="account-preference-toggle">
                        <input
                          type="checkbox"
                          checked={
                            emailPreferences.email_new_booking_requests &&
                            emailPreferences.email_instant_booking_confirmations &&
                            emailPreferences.email_customer_cancellations &&
                            emailPreferences.email_reschedule_updates
                          }
                          onChange={(event) => {
                            const checked = event.target.checked;
                            updateEmailPreference(
                              "email_new_booking_requests",
                              checked,
                            );
                            updateEmailPreference(
                              "email_instant_booking_confirmations",
                              checked,
                            );
                            updateEmailPreference(
                              "email_customer_cancellations",
                              checked,
                            );
                            updateEmailPreference(
                              "email_reschedule_updates",
                              checked,
                            );
                          }}
                        />
                        <span>
                          <strong>
                            {t(
                              "account.emailPreferences.businessBookings",
                              "Business booking updates",
                            )}
                          </strong>
                          <span className="small muted">
                            {t(
                              "account.emailPreferences.businessBookingsBody",
                              "New requests, instant confirmations, cancellations and reschedules.",
                            )}
                          </span>
                        </span>
                      </label>
                      <label className="account-preference-toggle">
                        <input
                          type="checkbox"
                          checked={emailPreferences.email_billing_updates}
                          onChange={(event) =>
                            updateEmailPreference(
                              "email_billing_updates",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>
                            {t(
                              "account.emailPreferences.billing",
                              "Billing updates",
                            )}
                          </strong>
                          <span className="small muted">
                            {t(
                              "account.emailPreferences.billingBody",
                              "Membership and payment updates.",
                            )}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  {hasStaffAccess && (
                    <div className="account-preference-group">
                      <h3>
                        {t(
                          "account.emailPreferences.staffTitle",
                          "Staff emails",
                        )}
                      </h3>
                      <label className="account-preference-toggle">
                        <input
                          type="checkbox"
                          checked={
                            emailPreferences.email_staff_booking_assignments &&
                            emailPreferences.email_staff_booking_changes
                          }
                          onChange={(event) => {
                            const checked = event.target.checked;
                            updateEmailPreference(
                              "email_staff_booking_assignments",
                              checked,
                            );
                            updateEmailPreference(
                              "email_staff_booking_changes",
                              checked,
                            );
                          }}
                        />
                        <span>
                          <strong>
                            {t(
                              "account.emailPreferences.staffBookings",
                              "Assigned booking updates",
                            )}
                          </strong>
                          <span className="small muted">
                            {t(
                              "account.emailPreferences.staffBookingsBody",
                              "Assignments, confirmations, cancellations and schedule changes.",
                            )}
                          </span>
                        </span>
                      </label>
                      <label className="account-preference-toggle">
                        <input
                          type="checkbox"
                          checked={emailPreferences.email_staff_reminders}
                          onChange={(event) =>
                            updateEmailPreference(
                              "email_staff_reminders",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>
                            {t(
                              "account.emailPreferences.staffReminders",
                              "Staff reminders",
                            )}
                          </strong>
                          <span className="small muted">
                            {t(
                              "account.emailPreferences.staffRemindersBody",
                              "Reminder emails for assigned appointments.",
                            )}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="account-preference-group">
                    <h3>
                      {t(
                        "account.emailPreferences.supportTitle",
                        "Support emails",
                      )}
                    </h3>
                    <label className="account-preference-toggle">
                      <input
                        type="checkbox"
                        checked={emailPreferences.email_support_updates}
                        onChange={(event) =>
                          updateEmailPreference(
                            "email_support_updates",
                            event.target.checked,
                          )
                        }
                      />
                      <span>
                        <strong>
                          {t(
                            "account.emailPreferences.support",
                            "Support updates",
                          )}
                        </strong>
                        <span className="small muted">
                          {t(
                            "account.emailPreferences.supportBody",
                            "Replies from Mirëbook support.",
                          )}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-accent account-preferences-save"
                  onClick={saveEmailPreferences}
                  disabled={
                    savingPreferences ||
                    preferencesState === "loading" ||
                    preferencesState === "schema_missing"
                  }
                >
                  {savingPreferences
                    ? t(
                        "account.emailPreferences.saving",
                        "Saving email preferences...",
                      )
                    : t(
                        "account.emailPreferences.save",
                        "Save email preferences",
                      )}
                </button>
              </div>
            </details>

            <form
              onSubmit={saveProfile}
              className="card account-form-card account-primary-card"
            >
              <div className="account-card-heading">
                <h2>{t("account.personalDetails", "Personal details")}</h2>
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
                      "Contact support if this email is wrong.",
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
                      "Saved across translated Mirëbook pages.",
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
                  <h3>{t("account.security.title", "Password and login")}</h3>
                  <p className="small muted">
                    {t(
                      "account.security.body",
                      "Send a secure reset link to your login email.",
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
                  <h3>{t("account.region.kicker", "Region")}</h3>
                  <p className="small muted">{regionInfo.country}</p>
                </div>
                <div className="account-region-grid">
                  <span>{regionInfo.timezone}</span>
                  <span>{regionInfo.currency}</span>
                  <span>{regionInfo.locale}</span>
                </div>
              </div>
            </div>

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
          </div>
        )}
      </section>

      <style jsx>{`
        .account-page-shell {
          max-width: 1040px;
          margin: 0 auto;
          display: grid;
          gap: 0.85rem;
        }

        .account-header-subtitle {
          margin-top: 0.45rem;
        }

        .account-card-heading {
          display: grid;
          gap: 0.32rem;
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
        .operator-account-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .operator-account-actions {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .account-header {
          order: 1;
        }

        .account-verification-card {
          order: 2;
        }

        .account-form-card {
          order: 3;
        }

        .account-settings-grid {
          order: 4;
        }

        .account-email-preferences {
          order: 5;
        }

        .operator-account-card {
          order: 6;
        }

        .account-details-panel {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          overflow: hidden;
        }

        .account-details-panel summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.9rem 1rem;
          cursor: pointer;
          list-style: none;
        }

        .account-details-panel summary::-webkit-details-marker {
          display: none;
        }

        .account-details-panel summary span {
          display: grid;
          gap: 0.18rem;
        }

        .account-details-panel summary small {
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .account-details-panel summary::after {
          content: "+";
          color: var(--accent);
          font-size: 1.2rem;
          font-weight: 800;
        }

        .account-details-panel[open] summary::after {
          content: "−";
        }

        .account-details-body {
          display: grid;
          gap: 0.8rem;
          padding: 0 1rem 1rem;
        }

        .account-settings-grid {
          align-items: stretch;
        }

        .account-security-card,
        .account-region-card {
          display: grid;
          gap: 0.55rem;
        }

        .account-settings-grid :global(.card) {
          display: grid;
          gap: 0.55rem;
        }

        .account-settings-grid p,
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
          gap: 0.8rem;
        }

        .account-verification-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          padding: 0.8rem 1rem;
        }

        .account-verification-card .account-card-heading {
          gap: 0.16rem;
        }

        .account-verification-card h2 {
          font-size: 1.05rem;
        }

        .account-verification-card p {
          margin: 0;
        }

        .account-verification-card-verified {
          border-color: rgba(45, 212, 191, 0.3);
          background: rgba(45, 212, 191, 0.06);
        }

        .account-verification-card-unverified {
          border-color: rgba(255, 190, 11, 0.3);
          background: rgba(255, 190, 11, 0.07);
        }

        .account-verification-card-unknown {
          border-color: var(--border);
          background: var(--surface-2);
        }

        .account-email-preferences {
          display: block;
        }

        .account-preferences-notice {
          display: grid;
          gap: 0.35rem;
          padding: 0.85rem;
          border: 1px solid rgba(255, 190, 11, 0.28);
          border-radius: var(--radius);
          background: rgba(255, 190, 11, 0.07);
        }

        .account-preference-groups {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
        }

        .account-preference-group {
          display: grid;
          gap: 0.55rem;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          align-content: start;
        }

        .account-preference-toggle {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.55rem;
          align-items: flex-start;
          color: var(--text);
        }

        .account-preference-toggle input {
          margin-top: 0.25rem;
        }

        .account-preference-toggle span {
          display: grid;
          gap: 0.12rem;
        }

        .account-preference-toggle .small {
          font-size: 0.78rem;
          line-height: 1.32;
        }

        .account-preferences-save {
          justify-self: flex-start;
        }

        .account-primary-card {
          border-color: rgba(45, 212, 191, 0.25);
        }

        .account-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem 0.85rem;
          align-items: start;
        }

        .account-form-grid input,
        .account-form-grid select {
          min-width: 0;
          width: 100%;
          margin-top: 0.35rem;
        }

        .account-form-grid input:disabled {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .account-field-help {
          margin-top: 0.3rem;
        }

        .account-save-button {
          justify-self: flex-start;
        }

        @media (max-width: 700px) {
          .account-header,
          .operator-account-row {
            display: grid;
          }

          .account-page-shell {
            gap: 0.7rem;
          }

          .account-details-panel summary {
            padding: 0.85rem;
          }

          .account-details-body {
            padding: 0 0.85rem 0.85rem;
          }

          .operator-account-actions,
          .operator-account-actions :global(.btn),
          .operator-account-actions a,
          .account-security-card button {
            width: 100%;
            justify-content: center;
          }

          .account-verification-card,
          .account-verification-card button {
            width: 100%;
          }

          .account-verification-card button {
            justify-content: center;
          }

          .account-form-grid {
            grid-template-columns: 1fr;
          }

          .account-form-grid input,
          .account-form-grid select {
            font-size: 0.9rem;
          }

          .account-preference-groups {
            grid-template-columns: 1fr;
          }

          .account-preferences-save {
            width: 100%;
            justify-content: center;
          }

          .account-save-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
