import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import {
  AuthProduct,
  getBusinessAppUrl,
  getCustomerAppUrl,
  isBusinessAppHostname,
} from "@/lib/appUrls";

type RecoveryState = "checking" | "ready" | "invalid" | "complete";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [isBusinessHostname, setIsBusinessHostname] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product: AuthProduct =
    router.query.product === "business" || isBusinessHostname
      ? "business"
      : "customer";
  const loginUrl =
    product === "business"
      ? getBusinessAppUrl("/login?product=business")
      : getCustomerAppUrl("/login");
  const forgotPasswordUrl =
    product === "business"
      ? getBusinessAppUrl("/forgot-password?product=business")
      : getCustomerAppUrl("/forgot-password");

  useEffect(() => {
    setIsBusinessHostname(isBusinessAppHostname(window.location.hostname));
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    let active = true;

    async function prepareRecovery() {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const queryError =
        typeof router.query.error_description === "string"
          ? router.query.error_description
          : null;
      const recoveryError = queryError || hashParams.get("error_description");

      if (recoveryError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[reset-password] Recovery link was rejected", {
            message: recoveryError.replace(/\+/g, " "),
          });
        }
        if (active) {
          setError(null);
          setRecoveryState("invalid");
        }
        return;
      }

      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      if (existingSession) {
        if (active) setRecoveryState("ready");
        return;
      }

      if (typeof router.query.code === "string") {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(router.query.code);
        if (exchangeError) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[reset-password] Recovery code exchange failed", {
              message: exchangeError.message,
            });
          }
          if (active) {
            setError(null);
            setRecoveryState("invalid");
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active) {
        setRecoveryState(session ? "ready" : "invalid");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") {
        setRecoveryState("ready");
        setError(null);
      }
    });

    prepareRecovery();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router.isReady, router.query.code, router.query.error_description]);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(
        t(
          "resetPassword.error.length",
          "Use at least 8 characters for your new password.",
        ),
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        t(
          "resetPassword.error.match",
          "The password confirmation does not match.",
        ),
      );
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[reset-password] Password update failed", {
          message: updateError.message,
        });
      }
      setSaving(false);
      setError(
        t(
          "resetPassword.error.update",
          "Could not update your password. Request a new reset link and try again.",
        ),
      );
      return;
    }

    await supabase.auth.signOut();
    setSaving(false);
    setRecoveryState("complete");
  }

  return (
    <main>
      <AuthNav />
      <section className="auth-wrap">
        <div className="auth-card password-auth-card">
          <p className="small muted">
            {product === "business"
              ? t("resetPassword.businessKicker", "Mirëbook Business security")
              : t("resetPassword.kicker", "Account security")}
          </p>

          {recoveryState === "checking" && (
            <>
              <h1>{t("resetPassword.checkingTitle", "Checking reset link")}</h1>
              <p className="muted">
                {t(
                  "resetPassword.checkingBody",
                  "Mirëbook is verifying the secure recovery session.",
                )}
              </p>
            </>
          )}

          {recoveryState === "ready" && (
            <>
              <h1>{t("resetPassword.title", "Choose a new password")}</h1>
              <p className="muted">
                {t(
                  "resetPassword.body",
                  "Enter and confirm a new password for your Mirëbook login.",
                )}
              </p>
              <form onSubmit={updatePassword} className="form-grid">
                <label className="password-auth-field">
                  <span>
                    {t("resetPassword.passwordLabel", "New password")}
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="password-auth-field">
                  <span>
                    {t(
                      "resetPassword.confirmPasswordLabel",
                      "Confirm new password",
                    )}
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-accent"
                  disabled={saving}
                >
                  {saving
                    ? t("resetPassword.saving", "Updating password...")
                    : t("resetPassword.submit", "Update password")}
                </button>
              </form>
            </>
          )}

          {recoveryState === "invalid" && (
            <>
              <h1>
                {t(
                  "resetPassword.invalidTitle",
                  "This reset link is not active",
                )}
              </h1>
              <p className="muted">
                {t(
                  "resetPassword.invalidBody",
                  "The link may have expired or already been used. Request a new password reset email.",
                )}
              </p>
              <Link href={forgotPasswordUrl} className="btn btn-accent">
                {t("resetPassword.requestAgain", "Request another reset link")}
              </Link>
            </>
          )}

          {recoveryState === "complete" && (
            <>
              <h1>{t("resetPassword.completeTitle", "Password updated")}</h1>
              <p className="muted">
                {t(
                  "resetPassword.completeBody",
                  "Your password has been changed. Sign in again with the new password.",
                )}
              </p>
              <Link href={loginUrl} className="btn btn-accent">
                {t("resetPassword.login", "Continue to login")}
              </Link>
            </>
          )}

          {error && <p className="password-auth-error">{error}</p>}
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

        .password-auth-error {
          color: var(--danger);
        }
      `}</style>
    </main>
  );
}
