import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type InviteState = "checking" | "ready" | "invalid" | "setup" | "linked";

export default function StaffInvitePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<InviteState>("checking");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = typeof router.query.token === "string" ? router.query.token : "";
  const returnPath = token
    ? `/staff/invite?token=${encodeURIComponent(token)}`
    : "/staff/invite";

  useEffect(() => {
    if (!router.isReady || !token) {
      if (router.isReady) setState("invalid");
      return;
    }

    async function loadInvite() {
      const [{ data: sessionData }, response] = await Promise.all([
        supabase.auth.getSession(),
        fetch(`/api/staff/invite?token=${encodeURIComponent(token)}`),
      ]);

      setSignedIn(Boolean(sessionData.session));
      if (response.status === 503) {
        setState("setup");
        return;
      }

      const payload = await response.json();
      if (!response.ok || !payload.valid) {
        setState("invalid");
        return;
      }

      setEmailHint(payload.invitedEmailHint || null);
      setState("ready");
    }

    void loadInvite();
  }, [router.isReady, token]);

  async function acceptInvite() {
    setWorking(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setWorking(false);
      setSignedIn(false);
      return;
    }

    const response = await fetch("/api/staff/invite", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();

    setWorking(false);
    if (!response.ok) {
      setError(
        response.status === 403
          ? t(
              "staffInvite.error.wrongEmail",
              "This invite was sent to a different email address. Sign in with the invited account.",
            )
          : t(
              "staffInvite.error.accept",
              "This invite could not be accepted. It may have expired or already been used.",
            ),
      );
      return;
    }

    setState("linked");
    setTimeout(() => router.replace("/staff"), 700);
  }

  return (
    <main>
      <AuthNav />
      <section
        className="container"
        style={{ paddingTop: 48, paddingBottom: 72 }}
      >
        <div className="card" style={{ maxWidth: 680, margin: "0 auto" }}>
          <p className="small muted">
            {t("staffInvite.kicker", "Staff invitation")}
          </p>
          <h1 className="page-title" style={{ marginTop: "0.45rem" }}>
            {state === "linked"
              ? t("staffInvite.linkedTitle", "Staff account linked")
              : t("staffInvite.title", "Join your Mirëbook staff workspace")}
          </h1>

          {state === "checking" && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              {t("staffInvite.checking", "Checking this invitation...")}
            </p>
          )}

          {state === "ready" && (
            <>
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                {t(
                  "staffInvite.readyBody",
                  "Accept this invitation using the email address it was sent to.",
                )}{" "}
                {emailHint ? `(${emailHint})` : ""}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  marginTop: "1.25rem",
                }}
              >
                {signedIn ? (
                  <button
                    className="btn btn-accent"
                    type="button"
                    onClick={acceptInvite}
                    disabled={working}
                  >
                    {working
                      ? t("staffInvite.accepting", "Accepting...")
                      : t("staffInvite.accept", "Accept invite")}
                  </button>
                ) : (
                  <>
                    <Link
                      className="btn btn-accent"
                      href={`/login?redirectTo=${encodeURIComponent(returnPath)}`}
                    >
                      {t("staffInvite.login", "Sign in to accept")}
                    </Link>
                    <Link
                      className="btn btn-ghost"
                      href={`/register?accountType=staff&redirectTo=${encodeURIComponent(returnPath)}`}
                    >
                      {t("staffInvite.register", "Create staff account")}
                    </Link>
                  </>
                )}
              </div>
            </>
          )}

          {state === "invalid" && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              {t(
                "staffInvite.invalid",
                "This invitation is invalid, expired or already used. Ask the business to send a new invite.",
              )}
            </p>
          )}

          {state === "setup" && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              {t(
                "staffInvite.setup",
                "Email invitation links are not active yet. You can still sign in with the invited email and use the existing staff linking flow.",
              )}
            </p>
          )}

          {state === "linked" && (
            <p style={{ color: "var(--success)", marginTop: "0.75rem" }}>
              {t(
                "staffInvite.linkedBody",
                "Your staff profile is linked. Opening your staff workspace...",
              )}
            </p>
          )}

          {error && (
            <p style={{ color: "var(--danger)", marginTop: "1rem" }}>{error}</p>
          )}
        </div>
      </section>
    </main>
  );
}
