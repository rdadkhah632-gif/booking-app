import AuthNav from "@/components/AuthNav";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { Locale } from "@/lib/i18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import { safeInternalRedirect } from "@/lib/safeInternalRedirect";
import {
  getAuthAppUrl,
  getBusinessAppUrl,
  getCustomerAppUrl,
  isBusinessAppHostname,
} from "@/lib/appUrls";
import { detectRegionDefaults } from "@/lib/regionDefaults";

const CURRENCY_OPTIONS = [
  { value: "ALL", labelKey: "currency.all", fallback: "ALL - Albanian lek" },
  { value: "EUR", labelKey: "currency.eur", fallback: "EUR - Euro" },
  { value: "GBP", labelKey: "currency.gbp", fallback: "GBP - British pound" },
  { value: "USD", labelKey: "currency.usd", fallback: "USD - US dollar" },
];

const TIMEZONE_OPTIONS = [
  "Europe/Tirane",
  "Europe/London",
  "Europe/Rome",
  "Europe/Paris",
  "Europe/Berlin",
];

export default function RegisterPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const detectedRegion = detectRegionDefaults();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>(
    detectedRegion.locale,
  );
  const [role, setRole] = useState<"customer" | "business" | "staff">(
    "customer",
  );
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessCountry, setBusinessCountry] = useState(
    detectedRegion.country,
  );
  const [businessTimezone, setBusinessTimezone] = useState(
    detectedRegion.timezone,
  );
  const [businessCurrency, setBusinessCurrency] = useState(
    detectedRegion.currency,
  );
  const [ownerTakesBookings, setOwnerTakesBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isBusinessHostname, setIsBusinessHostname] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const safeRedirectTo = router.isReady
    ? safeInternalRedirect(router.query.redirectTo)
    : null;
  const loginUrl =
    role === "business"
      ? getBusinessAppUrl(
          `/login?product=business${
            safeRedirectTo?.startsWith("/claim/")
              ? `&redirectTo=${encodeURIComponent(safeRedirectTo)}`
              : ""
          }`,
        )
      : role === "staff"
        ? getBusinessAppUrl("/login?product=business")
        : getCustomerAppUrl("/login");
  const businessRegisterUrl = getBusinessAppUrl(
    `/register?accountType=business${
      safeRedirectTo?.startsWith("/claim/")
        ? `&redirectTo=${encodeURIComponent(safeRedirectTo)}`
        : ""
    }`,
  );
  const staffRegisterUrl = getBusinessAppUrl("/register?accountType=staff");
  const customerRegisterUrl = getCustomerAppUrl("/register");
  const isBusinessRegistrationSurface =
    isBusinessHostname || role === "business" || role === "staff";
  const isCustomerAppointmentReturn =
    !isBusinessRegistrationSurface &&
    Boolean(safeRedirectTo?.startsWith("/booking-confirmation"));

  function registrationRedirectForRole(
    value: string | null,
    accountRole: "customer" | "business" | "staff",
  ) {
    if (!value) return null;
    if (value.startsWith("/staff/invite?token=")) return value;
    if (accountRole === "business" && value.startsWith("/claim/")) {
      return value;
    }
    if (
      accountRole === "customer" &&
      (value.startsWith("/explore/") ||
        value.startsWith("/book/") ||
        value.startsWith("/my-bookings") ||
        value.startsWith("/booking-confirmation"))
    ) {
      return value;
    }

    return null;
  }

  async function redirectByRole(userId: string, fallbackEmail?: string) {
    const capabilities = await getAccountCapabilities(userId, fallbackEmail);
    const redirectTo = registrationRedirectForRole(
      safeInternalRedirect(router.query.redirectTo),
      role,
    );
    router.replace(redirectTo || capabilities.defaultRoute);
  }

  useEffect(() => {
    if (!router.isReady) return;
    if (
      !isBusinessHostname &&
      (router.query.accountType === "business" ||
        router.query.accountType === "staff")
    ) {
      const accountType = router.query.accountType;
      const targetParams = new URLSearchParams({ accountType });
      if (safeRedirectTo) {
        targetParams.set("redirectTo", safeRedirectTo);
      }

      const target = getBusinessAppUrl(`/register?${targetParams.toString()}`);
      const targetUrl = new URL(target, window.location.origin);
      if (targetUrl.href !== window.location.href) {
        window.location.assign(targetUrl.toString());
        return;
      }
    }

    if (router.query.accountType === "staff") {
      setRole("staff");
      return;
    }
    if (router.query.accountType === "business" || isBusinessHostname) {
      setRole("business");
    }
  }, [router.isReady, router.query.accountType, isBusinessHostname]);

  useEffect(() => {
    setIsBusinessHostname(isBusinessAppHostname(window.location.hostname));
  }, []);

  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await redirectByRole(session.user.id, session.user.email || undefined);
        return;
      }

      setCheckingSession(false);
    }

    if (!router.isReady) return;
    checkExistingSession();
  }, [router.isReady]);

  useEffect(() => {
    if (locale) {
      setPreferredLanguage(locale);
      return;
    }

    if (navigator.language.toLowerCase().startsWith("sq")) {
      setPreferredLanguage("sq");
      setLocale("sq");
    }
  }, [locale, setLocale]);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    await setLocale(preferredLanguage);
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();

    if (password.length < 6) {
      setError(
        t(
          "register.passwordTooShort",
          "Password must be at least 6 characters.",
        ),
      );
      setLoading(false);
      return;
    }

    if (role === "business") {
      if (!cleanFullName) {
        setError(t("register.fullNameRequired", "Full name is required."));
        setLoading(false);
        return;
      }

      if (!cleanPhone) {
        setError(
          t(
            "register.phoneRequired.business",
            "Your phone number is required for business accounts.",
          ),
        );
        setLoading(false);
        return;
      }

      if (!businessName.trim()) {
        setError(
          t("register.business.nameRequired", "Business name is required."),
        );
        setLoading(false);
        return;
      }

      if (!businessPhone.trim()) {
        setError(
          t("register.business.phoneRequired", "Business phone is required."),
        );
        setLoading(false);
        return;
      }

      if (!businessCategory.trim()) {
        setError(
          t(
            "register.business.categoryRequired",
            "Business category is required.",
          ),
        );
        setLoading(false);
        return;
      }

      if (!businessCity.trim()) {
        setError(
          t("register.business.cityRequired", "Business city is required."),
        );
        setLoading(false);
        return;
      }

      if (!businessCountry.trim()) {
        setError(
          t(
            "register.business.countryRequired",
            "Business country is required.",
          ),
        );
        setLoading(false);
        return;
      }
    }

    const redirectTo = registrationRedirectForRole(
      safeInternalRedirect(router.query.redirectTo),
      role,
    );
    const authProduct =
      role === "business" || role === "staff" ? "business" : "customer";
    const verificationPath = redirectTo
      ? `/login?verified=1&redirectTo=${encodeURIComponent(redirectTo)}${
          authProduct === "business" ? "&product=business" : ""
        }`
      : `/login?verified=1${
          authProduct === "business" ? "&product=business" : ""
        }`;
    const verificationRedirect = getAuthAppUrl(
      authProduct,
      verificationPath,
      window.location.origin,
    );

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: verificationRedirect,
        data: {
          // Keep staff sign-ups compatible with existing profile role constraints.
          // Staff intent is stored as account_mode='staff' and resolved by getAccountCapabilities.
          role: role === "staff" ? "customer" : role,
          account_mode: role,
          full_name: cleanFullName || null,
          phone: cleanPhone || null,
          preferred_language: preferredLanguage,
          pending_registration: true,
          pending_business:
            role === "business"
              ? {
                  name: businessName.trim(),
                  phone: businessPhone.trim(),
                  category: businessCategory.trim(),
                  city: businessCity.trim(),
                  country: businessCountry.trim(),
                  timezone: businessTimezone,
                  currency: businessCurrency,
                  ownerTakesBookings,
                }
              : null,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError(
        t(
          "register.error.noUser",
          "Account creation did not complete. Please try again.",
        ),
      );
      setLoading(false);
      return;
    }

    if (!data.session) {
      setVerificationEmail(cleanEmail);
      setMessage(
        t(
          "register.verification.required",
          "Account created. Check your email and verify your address before signing in. Your selected account setup will continue after verification.",
        ),
      );
      setLoading(false);
      return;
    }

    if (data.user) {
      const profileRole = role === "staff" ? "customer" : role;
      const { data: existingProfile, error: profileLookupError } =
        await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle<{ id: string }>();

      if (profileLookupError) {
        setError(profileLookupError.message);
        setLoading(false);
        return;
      }

      if (!existingProfile) {
        const { error: profileInsertError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            email: cleanEmail,
            role: profileRole,
            full_name: cleanFullName || null,
            phone: cleanPhone || null,
            preferred_language: preferredLanguage,
          });

        if (profileInsertError && profileInsertError.code !== "23505") {
          setError(profileInsertError.message);
          setLoading(false);
          return;
        }
      }

      const { error: languageError } = await supabase
        .from("profiles")
        .update({
          full_name: cleanFullName || null,
          phone: cleanPhone || null,
          preferred_language: preferredLanguage,
        })
        .eq("id", data.user.id);

      if (languageError) {
        setError(languageError.message);
        setLoading(false);
        return;
      }

      // staff invite linking now handled automatically elsewhere

      if (role === "business") {
        const { data: createdBusiness, error: businessError } = await supabase
          .from("businesses")
          .insert({
            user_id: data.user.id,
            name: businessName.trim(),
            phone: businessPhone.trim(),
            category: businessCategory.trim(),
            city: businessCity.trim(),
            country: businessCountry.trim(),
            timezone: businessTimezone,
            currency: businessCurrency,
            published: false,
          })
          .select("id")
          .single<{ id: string }>();

        if (businessError || !createdBusiness) {
          setError(
            businessError?.message ||
              t(
                "register.business.createError",
                "Could not create business profile.",
              ),
          );
          setLoading(false);
          return;
        }

        if (ownerTakesBookings) {
          const ownerName =
            cleanFullName ||
            cleanEmail.split("@")[0] ||
            t("staff.ownerSetup.defaultName", "Owner");
          const { error: ownerStaffError } = await supabase
            .from("staff_members")
            .insert({
              business_id: createdBusiness.id,
              user_id: data.user.id,
              name: ownerName,
              email: cleanEmail,
              phone: cleanPhone || businessPhone.trim() || null,
              role_title: t("staff.ownerSetup.defaultRole", "Owner"),
              permission_role: "staff",
              invite_status: "linked",
              active: true,
            });

          if (ownerStaffError) {
            setError(ownerStaffError.message);
            setLoading(false);
            return;
          }
        }
      }
    }

    const capabilities = await getAccountCapabilities(data.user.id, cleanEmail);
    const nextRoute = redirectTo || capabilities.defaultRoute;

    setLoading(false);

    setMessage(
      role === "business"
        ? t(
            "register.success.business",
            "Business account created. Redirecting to your dashboard...",
          )
        : role === "staff"
          ? t(
              "register.success.staff",
              "Staff account created. Redirecting to your staff area...",
            )
          : t(
              "register.success.customer",
              "Customer account created. Redirecting to your bookings...",
            ),
    );

    setTimeout(() => {
      router.replace(nextRoute);
    }, 900);

    return;
  }

  async function resendVerification() {
    if (!verificationEmail) return;

    setResendingVerification(true);
    setError(null);

    const safeRedirectTo = registrationRedirectForRole(
      safeInternalRedirect(router.query.redirectTo),
      role,
    );
    const authProduct =
      role === "business" || role === "staff" ? "business" : "customer";
    const verificationRedirect = new URL(
      getAuthAppUrl(
        authProduct,
        `/login?verified=1${
          authProduct === "business" ? "&product=business" : ""
        }`,
        window.location.origin,
      ),
    );
    if (safeRedirectTo) {
      verificationRedirect.searchParams.set("redirectTo", safeRedirectTo);
    }

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: verificationEmail,
      options: {
        emailRedirectTo: verificationRedirect.toString(),
      },
    });

    setResendingVerification(false);

    if (resendError) {
      setError(
        t(
          "verification.resendError",
          "Could not send the verification email. Try again in a moment.",
        ),
      );
      return;
    }

    setMessage(
      t(
        "register.verification.resent",
        "Verification email sent. Check your inbox and spam folder.",
      ),
    );
  }

  if (checkingSession) {
    return (
      <main>
        <AuthNav />
        <section className="auth-wrap">
          <div className="card">
            <p className="muted">
              {t("register.checkingSession", "Checking your account...")}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <AuthNav />

      <section className="auth-wrap">
        <div className="auth-card">
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              marginBottom: 8,
            }}
          >
            {role === "business"
              ? t(
                  "register.businessAccountTitle",
                  "Start with Mirëbook Business",
                )
              : role === "staff"
                ? t("register.staffAccountTitle", "Create your staff account")
                : t("register.title", "Create your Mirëbook account")}
          </h1>

          <p className="muted register-subtitle">
            {role === "business"
              ? t(
                  "register.businessAccountSubtitle",
                  "Create your account and starter business profile.",
                )
              : role === "staff"
                ? t(
                    "register.staffAccountSubtitle",
                    "Create a staff account for your Mirëbook Business workspace.",
                  )
                : t(
                    "register.customerAccountSubtitle",
                    "Create an account to book and manage appointments.",
                  )}
          </p>

          {isBusinessRegistrationSurface ? (
            <>
              <p className="small muted register-business-choice-title">
                {t(
                  "register.businessChoiceTitle",
                  "Choose how you are joining Mirëbook Business.",
                )}
              </p>
              <div className="register-role-grid register-role-grid-top register-role-grid-business">
                <button
                  type="button"
                  className="register-role-option"
                  onClick={() => setRole("business")}
                  aria-pressed={role === "business"}
                  style={{
                    background:
                      role === "business"
                        ? "var(--accent-dim)"
                        : "var(--surface-2)",
                    border:
                      role === "business"
                        ? "1px solid rgba(255,107,53,0.45)"
                        : "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--text)",
                    padding: "1rem",
                    textAlign: "left",
                  }}
                >
                  {role === "business" && (
                    <span className="register-role-selected">
                      {t("register.role.selected", "Selected")}
                    </span>
                  )}
                  <strong>{t("register.role.business", "Business")}</strong>
                  <p className="small muted">
                    {t(
                      "register.role.businessBody",
                      "Create your business profile, services, staff and booking setup.",
                    )}
                  </p>
                </button>

                <button
                  type="button"
                  className="register-role-option"
                  onClick={() => setRole("staff")}
                  aria-pressed={role === "staff"}
                  style={{
                    background:
                      role === "staff"
                        ? "var(--accent-dim)"
                        : "var(--surface-2)",
                    border:
                      role === "staff"
                        ? "1px solid rgba(255,107,53,0.45)"
                        : "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--text)",
                    padding: "1rem",
                    textAlign: "left",
                  }}
                >
                  {role === "staff" && (
                    <span className="register-role-selected">
                      {t("register.role.selected", "Selected")}
                    </span>
                  )}
                  <strong>{t("register.role.staff", "Staff")}</strong>
                  <p className="small muted">
                    {t(
                      "register.role.staffBody",
                      "Create a staff account. If a business has already invited this email, Mirëbook will link it automatically; otherwise you can wait for an invite.",
                    )}
                  </p>
                </button>
              </div>
              <p className="small muted register-customer-return">
                {t("register.customerReturn.body", "Looking to book services?")}{" "}
                <Link href={customerRegisterUrl}>
                  {t(
                    "register.customerReturn.link",
                    "Create a customer account",
                  )}
                </Link>
              </p>
            </>
          ) : (
              !isCustomerAppointmentReturn && (
                <div className="register-business-split-card">
                  <div>
                    <strong>
                      {t(
                        "register.businessSplit.title",
                        "Registering a business?",
                      )}
                    </strong>
                    <p className="small muted">
                      {t(
                        "register.businessSplit.body",
                        "Mirëbook Business has a separate setup flow for owners and invited staff.",
                      )}
                    </p>
                  </div>
                  <div className="register-business-split-actions">
                    <Link href={businessRegisterUrl} className="btn btn-ghost">
                      {t(
                        "register.businessSplit.businessCta",
                        "List your business",
                      )}
                    </Link>
                    <Link href={staffRegisterUrl} className="btn btn-ghost">
                      {t(
                        "register.businessSplit.staffCta",
                        "Joining as staff?",
                      )}
                    </Link>
                  </div>
                </div>
              )
          )}

          {role === "staff" && (
            <div className="card register-staff-notice">
              <p className="small" style={{ color: "var(--warning)" }}>
                {t("register.staffNotice.title", "Staff account linking")}
              </p>
              <p className="small muted" style={{ marginTop: "0.35rem" }}>
                {t(
                  "register.staffNotice.body",
                  "Use the email your business added. If it is not linked yet, your staff area will wait for the invite.",
                )}
              </p>
            </div>
          )}

          <form onSubmit={onRegister} className="form-grid">
            <label className="auth-field">
              <span>{t("register.emailLabel", "Email address")}</span>
              <input
                type="email"
                placeholder={t("register.emailPlaceholder", "you@example.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>{t("register.passwordLabel", "Password")}</span>
              <input
                type="password"
                placeholder={t(
                  "register.passwordPlaceholder",
                  "At least 6 characters",
                )}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <div className="register-profile-grid">
              <label className="auth-field">
                <span>
                  {t("register.fullNameLabel", "Full name")}
                  {role !== "business" && (
                    <em>{t("register.optional", "Optional")}</em>
                  )}
                </span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t(
                    "register.fullNamePlaceholder",
                    "Your full name",
                  )}
                  required={role === "business"}
                />
              </label>

              <label className="auth-field">
                <span>
                  {t("register.phoneLabel", "Phone number")}
                  {role !== "business" && (
                    <em>{t("register.optional", "Optional")}</em>
                  )}
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("register.phonePlaceholder", "Phone number")}
                  required={role === "business"}
                />
              </label>
            </div>

            {isBusinessRegistrationSurface && (
              <div className="register-role-mobile">
                <label
                  className="small muted"
                  style={{ display: "grid", gap: "0.4rem" }}
                >
                  {t("register.accountType", "Account type")}
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(
                        e.target.value as "customer" | "business" | "staff",
                      )
                    }
                  >
                    <option value="business">
                      {t("register.role.business", "Business")}
                    </option>
                    <option value="staff">
                      {t("register.role.staff", "Staff")}
                    </option>
                  </select>
                </label>
              </div>
            )}

            <label
              className="small muted"
              style={{ display: "grid", gap: "0.4rem" }}
            >
              {t("register.preferredLanguage", "Preferred language")}
              <select
                value={preferredLanguage}
                onChange={(e) => {
                  const nextLanguage = e.target.value as Locale;
                  setPreferredLanguage(nextLanguage);
                  setLocale(nextLanguage);
                }}
              >
                <option value="en">English</option>
                <option value="sq">Shqip</option>
              </select>
            </label>

            {role === "business" && (
              <div className="register-business-fields">
                <div>
                  <p className="small muted">
                    {t("register.business.kicker", "Business quick setup")}
                  </p>
                  <h3>
                    {t(
                      "register.business.title",
                      "Tell us about your business",
                    )}
                  </h3>
                  <p className="small muted" style={{ marginTop: "0.35rem" }}>
                    {t(
                      "register.business.body",
                      "You can add services, team and hours after signup.",
                    )}
                  </p>
                </div>

                <label className="auth-field">
                  <span>
                    {t("register.business.nameLabel", "Business name")}
                  </span>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t(
                      "register.business.namePlaceholder",
                      "Example: Studio Mira",
                    )}
                    required={role === "business"}
                  />
                </label>

                <label className="auth-field">
                  <span>
                    {t("register.business.phoneLabel", "Business phone")}
                  </span>
                  <input
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder={t(
                      "register.business.phonePlaceholder",
                      "Example: +355 69 123 4567",
                    )}
                    required={role === "business"}
                  />
                </label>

                <label className="auth-field">
                  <span>
                    {t("register.business.categoryLabel", "Business category")}
                  </span>
                  <select
                    className="register-category-select"
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                    required={role === "business"}
                  >
                    <option value="">
                      {t(
                        "register.business.categoryPlaceholder",
                        "Choose a category",
                      )}
                    </option>
                    <option value="Barber">
                      {t("categories.barber", "Barber")}
                    </option>
                    <option value="Hair salon">
                      {t("categories.hairSalon", "Hair salon")}
                    </option>
                    <option value="Nails">
                      {t("categories.nails", "Nails")}
                    </option>
                    <option value="Beauty">
                      {t("categories.beauty", "Beauty")}
                    </option>
                    <option value="Tattoo">
                      {t("categories.tattoo", "Tattoo")}
                    </option>
                    <option value="Pet grooming">
                      {t("categories.petGrooming", "Pet grooming")}
                    </option>
                    <option value="Other">
                      {t("categories.other", "Other")}
                    </option>
                  </select>
                </label>

                <div className="register-business-location-grid">
                  <label className="auth-field">
                    <span>{t("register.business.cityLabel", "City")}</span>
                    <input
                      value={businessCity}
                      onChange={(e) => setBusinessCity(e.target.value)}
                      placeholder={t(
                        "register.business.cityPlaceholder",
                        "Example: Tirana",
                      )}
                      required={role === "business"}
                    />
                  </label>
                </div>

                <div className="register-business-location-grid">
                  <label className="auth-field">
                    <span>
                      {t("register.business.timezoneLabel", "Timezone")}
                    </span>
                    <select
                      value={businessTimezone}
                      onChange={(e) => setBusinessTimezone(e.target.value)}
                    >
                      {TIMEZONE_OPTIONS.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="auth-field">
                    <span>
                      {t("register.business.currencyLabel", "Currency")}
                    </span>
                    <select
                      value={businessCurrency}
                      onChange={(e) => setBusinessCurrency(e.target.value)}
                    >
                      {CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency.value} value={currency.value}>
                          {t(currency.labelKey, currency.fallback)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="auth-field">
                  <span>{t("register.business.countryLabel", "Country")}</span>
                  <input
                    value={businessCountry}
                    onChange={(e) => setBusinessCountry(e.target.value)}
                    placeholder={t(
                      "register.business.countryPlaceholder",
                      "Example: Albania",
                    )}
                    required={role === "business"}
                  />
                </label>

                <label className="register-owner-staff-option">
                  <input
                    type="checkbox"
                    checked={ownerTakesBookings}
                    onChange={(event) =>
                      setOwnerTakesBookings(event.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      {t(
                        "register.business.ownerTakesBookings",
                        "I also take bookings myself",
                      )}
                    </strong>
                    <span className="small muted">
                      {t(
                        "register.business.ownerTakesBookingsBody",
                        "Add a linked staff profile for yourself.",
                      )}
                    </span>
                  </span>
                </label>
              </div>
            )}

            <p className="small muted register-legal-copy">
              {t(
                "register.legal.prefix",
                "By creating an account, you agree to Mirëbook’s",
              )}{" "}
              <Link href="/terms">{t("register.legal.terms", "Terms")}</Link>{" "}
              {t("register.legal.and", "and")}{" "}
              <Link href="/privacy">
                {t("register.legal.privacy", "Privacy Policy")}
              </Link>
              .
            </p>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-accent register-submit-button"
            >
              {loading
                ? t("register.creating", "Creating account...")
                : role === "business"
                  ? t("register.createBusiness", "Create business account")
                  : role === "staff"
                    ? t("register.createStaff", "Create staff account")
                    : t("register.createCustomer", "Create customer account")}
            </button>
          </form>

          {error && (
            <p style={{ color: "var(--danger)", marginTop: "1rem" }}>{error}</p>
          )}

          {message && (
            <div className="card register-verification-card">
              <p style={{ color: "var(--success)" }}>{message}</p>
              {verificationEmail && (
                <>
                  <p className="small muted">
                    {t(
                      "register.verification.softPolicy",
                      "Open the verification email on this device, then return to sign in. Check your spam folder if it does not arrive.",
                    )}
                  </p>
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
                </>
              )}
            </div>
          )}

          <div className="register-bottom-actions">
            <p className="small muted">
              {t("register.alreadyHaveAccount", "Already have an account?")}{" "}
              <Link href={loginUrl} style={{ color: "var(--accent)" }}>
                {t("register.loginLink", "Login")}
              </Link>
            </p>
          </div>
        </div>
      </section>
      <style jsx>{`
        .auth-card {
          max-width: 760px;
          margin: 0 auto;
        }

        .register-subtitle {
          margin-bottom: 1rem;
        }

        .register-role-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .register-role-grid-business {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 0.75rem;
        }

        .register-role-mobile {
          display: none;
        }

        .register-business-choice-title {
          margin: 0 0 0.65rem;
        }

        .register-business-split-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1.25rem;
          padding: 0.95rem;
          border: 1px solid rgba(255, 107, 53, 0.2);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.06);
        }

        .register-business-split-card p,
        .register-customer-return {
          margin: 0.35rem 0 0;
        }

        .register-business-split-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .register-customer-return {
          margin-bottom: 1.15rem;
        }

        .register-customer-return :global(a) {
          color: var(--accent);
          font-weight: 800;
        }

        .register-role-option {
          position: relative;
          display: grid;
          gap: 0.35rem;
          min-height: 132px;
          align-content: start;
          cursor: pointer;
        }

        .register-role-option:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .register-role-selected {
          width: fit-content;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          background: var(--accent);
          color: white;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .register-business-fields {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
          border: 1px solid rgba(255, 107, 53, 0.22);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.06);
        }

        .register-business-fields h3 {
          font-family: var(--font-display);
        }

        .auth-field {
          display: grid;
          gap: 0.42rem;
          color: var(--text);
          font-size: 0.86rem;
          font-weight: 700;
        }

        .auth-field input,
        .auth-field select {
          font-weight: 400;
        }

        .register-category-select {
          cursor: pointer;
          border-color: rgba(255, 107, 53, 0.32);
          background-color: var(--surface);
        }

        .register-business-location-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .register-profile-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .auth-field span {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .auth-field em {
          color: var(--text-muted);
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 700;
        }

        .register-owner-staff-option {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.85rem;
          border: 1px solid rgba(45, 212, 191, 0.22);
          border-radius: var(--radius);
          background: rgba(45, 212, 191, 0.06);
          color: var(--text);
        }

        .register-owner-staff-option input {
          margin-top: 0.2rem;
        }

        .register-owner-staff-option span {
          display: grid;
          gap: 0.25rem;
        }

        .register-role-explainer {
          margin-bottom: 1rem;
          background: var(--surface-2);
          border-color: rgba(255, 107, 53, 0.18);
        }

        .register-staff-notice {
          background: rgba(255, 190, 11, 0.08);
          border-color: rgba(255, 190, 11, 0.28);
          margin-bottom: 1rem;
        }

        .register-submit-button {
          width: 100%;
          justify-content: center;
        }

        .register-legal-copy {
          margin: 0;
          line-height: 1.6;
          text-align: center;
        }

        .register-legal-copy :global(a) {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 0.18rem;
        }

        .register-bottom-actions {
          display: grid;
          gap: 0.65rem;
          margin-top: 1.5rem;
        }

        .register-verification-card {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
          border-color: rgba(45, 212, 191, 0.3);
          background: rgba(45, 212, 191, 0.06);
        }

        @media (max-width: 760px) {
          .register-role-grid-top {
            display: none;
          }

          .auth-card {
            padding: 1.1rem;
          }

          .auth-card h1 {
            font-size: 1.55rem !important;
          }

          .register-role-mobile {
            display: block;
          }

          .register-business-split-card {
            grid-template-columns: 1fr;
          }

          .register-business-split-actions {
            justify-content: stretch;
          }

          .register-business-split-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .register-role-explainer,
          .register-staff-notice,
          .register-business-fields {
            padding: 0.85rem;
          }

          .register-business-location-grid {
            grid-template-columns: 1fr;
          }

          .register-profile-grid {
            grid-template-columns: 1fr;
          }

          .register-submit-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
