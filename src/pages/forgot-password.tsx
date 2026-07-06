import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import {
  AuthProduct,
  getAuthAppUrl,
  getBusinessAppUrl,
  getCustomerAppUrl,
  isBusinessAppHostname,
} from "@/lib/appUrls";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [isBusinessHostname, setIsBusinessHostname] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const product: AuthProduct =
    router.query.product === "business" || isBusinessHostname
      ? "business"
      : "customer";
  const loginUrl =
    product === "business"
      ? getBusinessAppUrl("/login?product=business")
      : getCustomerAppUrl("/login");

  useEffect(() => {
    setIsBusinessHostname(isBusinessAppHostname(window.location.hostname));
  }, []);

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    setMessage(
      t(
        "forgotPassword.success",
        "Password reset request accepted. Check your inbox and spam folder for the secure link.",
      ),
    );

    const resetRedirect = getAuthAppUrl(
      product,
      `/reset-password?product=${product}`,
      window.location.origin,
    );

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: resetRedirect },
      );
      if (resetError && process.env.NODE_ENV !== "production") {
        console.warn("[forgot-password] Reset request was not accepted", {
          message: resetError.message,
        });
      }
    } catch (resetError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[forgot-password] Reset request was not accepted", {
          message:
            resetError instanceof Error ? resetError.message : "Unknown error",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <AuthNav />
      <section className="auth-wrap">
        <div className="auth-card password-auth-card">
          <p className="small muted">
            {product === "business"
              ? t("forgotPassword.businessKicker", "Mirëbook Business security")
              : t("forgotPassword.kicker", "Account security")}
          </p>
          <h1>{t("forgotPassword.title", "Reset your password")}</h1>
          <p className="muted">
            {product === "business"
              ? t(
                  "forgotPassword.businessBody",
                  "Enter the email used for your business or staff login. The reset link will return you to Mirëbook Business.",
                )
              : t(
                  "forgotPassword.body",
                  "Enter your Mirëbook email and we will send a secure password reset link.",
                )}
          </p>

          <form onSubmit={requestPasswordReset} className="form-grid">
            <label className="password-auth-field">
              <span>{t("forgotPassword.emailLabel", "Email address")}</span>
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t(
                  "forgotPassword.emailPlaceholder",
                  "you@example.com",
                )}
                required
              />
            </label>
            <button type="submit" className="btn btn-accent" disabled={loading}>
              {loading
                ? t("forgotPassword.sending", "Sending reset link...")
                : t("forgotPassword.submit", "Send password reset link")}
            </button>
          </form>

          {message && <p className="password-auth-success">{message}</p>}

          <Link href={loginUrl} className="password-auth-back">
            {t("forgotPassword.backToLogin", "Back to login")}
          </Link>
        </div>
      </section>
      <style jsx>{`
        .password-auth-card {
          display: grid;
          gap: 1rem;
          max-width: 520px;
        }

        .password-auth-card h1,
        .password-auth-card p {
          margin: 0;
        }

        .password-auth-field {
          display: grid;
          gap: 0.42rem;
          color: var(--text);
          font-size: 0.86rem;
          font-weight: 700;
        }

        .password-auth-field input {
          font-weight: 400;
        }

        .password-auth-success {
          color: var(--success);
        }

        :global(.password-auth-back) {
          color: var(--accent);
          font-weight: 800;
          width: fit-content;
        }
      `}</style>
    </main>
  );
}
