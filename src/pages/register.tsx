import AuthNav from "@/components/AuthNav";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { Locale } from "@/lib/i18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

export default function RegisterPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.language.toLowerCase().startsWith("sq")
    )
      return "sq";
    return "en";
  });
  const [role, setRole] = useState<"customer" | "business" | "staff">(
    "customer",
  );
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessCountry, setBusinessCountry] = useState("Albania");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  async function redirectByRole(userId: string, fallbackEmail?: string) {
    const capabilities = await getAccountCapabilities(userId, fallbackEmail);
    router.replace(capabilities.defaultRoute);
  }

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

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          role: role === "staff" ? "customer" : role,
          account_mode: role,
          preferred_language: preferredLanguage,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: cleanEmail,
          role: role === "staff" ? "customer" : role,
          preferred_language: preferredLanguage,
        },
        { onConflict: "id" },
      );

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (role === "staff") {
        const { data: matchingStaff, error: staffLookupError } = await supabase
          .from("staff_members")
          .select("id, business_id, name, email, invite_status")
          .eq("email", cleanEmail)
          .is("user_id", null)
          .limit(1)
          .maybeSingle();

        if (staffLookupError) {
          setError(staffLookupError.message);
          setLoading(false);
          return;
        }

        if (!matchingStaff) {
          setError(
            t(
              "register.noStaffInvite",
              "No staff profile was found for this email. Ask the business to add this exact email to their staff list, then try again.",
            ),
          );
          setLoading(false);
          return;
        }

        const { error: staffLinkError } = await supabase
          .from("staff_members")
          .update({
            user_id: data.user.id,
            invite_status: "linked",
          })
          .eq("id", matchingStaff.id);

        if (staffLinkError) {
          setError(staffLinkError.message);
          setLoading(false);
          return;
        }
      }

      if (role === "business") {
        const { error: businessError } = await supabase
          .from("businesses")
          .insert({
            user_id: data.user.id,
            name: businessName.trim(),
            phone: businessPhone.trim(),
            category: businessCategory.trim(),
            city: businessCity.trim(),
            country: businessCountry.trim(),
            published: false,
          });

        if (businessError) {
          setError(businessError.message);
          setLoading(false);
          return;
        }
      }
    }

    const capabilities = await getAccountCapabilities(data.user.id, cleanEmail);
    const nextRoute = capabilities.defaultRoute;

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
          <p className="small muted" style={{ marginBottom: "0.5rem" }}>
            {t("register.kicker", "Create account")}
          </p>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              marginBottom: 8,
            }}
          >
            {t("register.title", "Create your Mirëbook account")}
          </h1>

          <p className="muted register-subtitle">
            {t(
              "register.subtitle",
              "Choose how you will use Mirëbook. Customers book services, staff manage assigned appointments, and businesses manage setup and bookings.",
            )}
          </p>

          <div className="register-context-strip">
            <span>{t("nav.role.customer", "Customer")}</span>
            <span>{t("nav.role.staff", "Staff")}</span>
            <span>{t("nav.role.business", "Business")}</span>
          </div>

          <div className="register-role-grid register-role-grid-top">
            <button
              type="button"
              onClick={() => setRole("customer")}
              style={{
                background:
                  role === "customer"
                    ? "var(--accent-dim)"
                    : "var(--surface-2)",
                border:
                  role === "customer"
                    ? "1px solid rgba(255,107,53,0.45)"
                    : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text)",
                padding: "1rem",
                textAlign: "left",
              }}
            >
              <strong>{t("register.role.customer", "Customer")}</strong>
              <p className="small muted">
                {t(
                  "register.role.customerBody",
                  "Book services and manage your own appointments.",
                )}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRole("business")}
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
              onClick={() => setRole("staff")}
              style={{
                background:
                  role === "staff" ? "var(--accent-dim)" : "var(--surface-2)",
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
              <strong>{t("register.role.staff", "Staff")}</strong>
              <p className="small muted">
                {t(
                  "register.role.staffBody",
                  "Join a business that has already added your email to its staff list.",
                )}
              </p>
            </button>
          </div>

          <div className="card register-role-explainer">
            <p className="small muted">
              {t("register.roleExplainer.kicker", "Account type guide")}
            </p>
            <strong>
              {role === "business"
                ? t(
                    "register.roleExplainer.businessTitle",
                    "Business owner account",
                  )
                : role === "staff"
                  ? t("register.roleExplainer.staffTitle", "Staff account")
                  : t(
                      "register.roleExplainer.customerTitle",
                      "Customer account",
                    )}
            </strong>
            <p className="small muted" style={{ marginTop: "0.35rem" }}>
              {role === "business"
                ? t(
                    "register.roleExplainer.businessBody",
                    "Use this if you own or manage a business and need to set up services, staff, availability and customer bookings.",
                  )
                : role === "staff"
                  ? t(
                      "register.roleExplainer.staffBody",
                      "Use this only if a business has already added this exact email to their staff list. Otherwise choose Customer or ask the business owner to invite you first.",
                    )
                  : t(
                      "register.roleExplainer.customerBody",
                      "Use this if you want to find businesses, book services and manage your appointments.",
                    )}
            </p>
          </div>

          {role === "staff" && (
            <div className="card register-staff-notice">
              <p className="small" style={{ color: "var(--warning)" }}>
                {t("register.staffNotice.title", "Staff account linking")}
              </p>
              <p className="small muted" style={{ marginTop: "0.35rem" }}>
                {t(
                  "register.staffNotice.body",
                  "Use the exact email your business added to their staff list. Mirëbook will check and link your staff profile after your account is created.",
                )}
              </p>
              <p className="small muted" style={{ marginTop: "0.35rem" }}>
                {t(
                  "register.staffNotice.noInvite",
                  "If no staff profile is found, ask the business owner to add your email first, then register again.",
                )}
              </p>
            </div>
          )}

          <form onSubmit={onRegister} className="form-grid">
            <input
              type="email"
              placeholder={t("register.emailPlaceholder", "Email address")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder={t("register.passwordPlaceholder", "Password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="register-role-mobile">
              <label
                className="small muted"
                style={{ display: "grid", gap: "0.4rem" }}
              >
                {t("register.accountType", "Account type")}
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "customer" | "business" | "staff")
                  }
                >
                  <option value="customer">
                    {t("register.role.customer", "Customer")}
                  </option>
                  <option value="business">
                    {t("register.role.business", "Business")}
                  </option>
                  <option value="staff">
                    {t("register.role.staff", "Staff")}
                  </option>
                </select>
              </label>
            </div>

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
                      "These details create your starter business profile. You can complete services, staff, images and opening hours after signing in.",
                    )}
                  </p>
                </div>

                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t(
                    "register.business.namePlaceholder",
                    "Business name",
                  )}
                  required={role === "business"}
                />

                <input
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder={t(
                    "register.business.phonePlaceholder",
                    "Business phone",
                  )}
                  required={role === "business"}
                />

                <select
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  required={role === "business"}
                >
                  <option value="">
                    {t(
                      "register.business.categoryPlaceholder",
                      "Choose business category",
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

                <div className="register-business-location-grid">
                  <input
                    value={businessCity}
                    onChange={(e) => setBusinessCity(e.target.value)}
                    placeholder={t("register.business.cityPlaceholder", "City")}
                    required={role === "business"}
                  />

                  <input
                    value={businessCountry}
                    onChange={(e) => setBusinessCountry(e.target.value)}
                    placeholder={t(
                      "register.business.countryPlaceholder",
                      "Country",
                    )}
                    required={role === "business"}
                  />
                </div>
              </div>
            )}

            <div className="register-next-step-card">
              <p className="small muted">
                {t("register.nextStep.kicker", "After registration")}
              </p>
              <p className="small muted">
                {role === "business"
                  ? t(
                      "register.nextStep.business",
                      "You will go to your business dashboard to finish services, staff, availability and publishing.",
                    )
                  : role === "staff"
                    ? t(
                        "register.nextStep.staff",
                        "If your email matches an invited staff profile, you will go to your staff workspace.",
                      )
                    : t(
                        "register.nextStep.customer",
                        "You will go to your bookings page and can start exploring services.",
                      )}
              </p>
            </div>

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
            <p style={{ color: "var(--success)", marginTop: "1rem" }}>
              {message}
            </p>
          )}

          <div className="register-bottom-actions">
            <p className="small muted">
              {t("register.alreadyHaveAccount", "Already have an account?")}{" "}
              <Link href="/login" style={{ color: "var(--accent)" }}>
                {t("register.loginLink", "Login")}
              </Link>
            </p>
            <p className="small muted">
              {t(
                "register.helperText",
                "Not sure which account type to choose? Customers book services, businesses manage the platform setup, and staff need an invite from a business.",
              )}
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

        .register-context-strip {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }

        .register-context-strip span {
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 0.25rem 0.6rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          background: var(--surface-2);
        }

        .register-role-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .register-role-mobile {
          display: none;
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

        .register-business-location-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
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

        .register-next-step-card {
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: var(--radius);
          padding: 0.85rem;
          background: rgba(45, 212, 191, 0.06);
        }

        .register-submit-button {
          width: 100%;
          justify-content: center;
        }

        .register-bottom-actions {
          display: grid;
          gap: 0.65rem;
          margin-top: 1.5rem;
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

          .register-role-explainer,
          .register-staff-notice,
          .register-business-fields,
          .register-next-step-card {
            padding: 0.85rem;
          }

          .register-business-location-grid {
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
