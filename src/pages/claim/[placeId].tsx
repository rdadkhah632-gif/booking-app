import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Check, Clock3, ShieldCheck } from "lucide-react";
import AuthNav from "@/components/AuthNav";
import { getBusinessAppUrl } from "@/lib/appUrls";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type ClaimPlace = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode: string;
  phone?: string | null;
  website?: string | null;
  claimable: boolean;
};

type OwnedBusiness = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  published?: boolean | null;
  matchReasons: string[];
};

type Claim = {
  id: string;
  directory_place_id: string;
  business_id: string;
  status: string;
  evidence_type: string;
  evidence_value_masked?: string | null;
  claimant_message?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
};

type ClaimContext = {
  place: ClaimPlace;
  businesses: OwnedBusiness[];
  currentClaim: Claim | null;
};

const EVIDENCE_TYPES = [
  "domain_email",
  "business_phone",
  "business_document",
  "other",
] as const;

export default function ClaimDirectoryPlacePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [context, setContext] = useState<ClaimContext | null>(null);
  const [publicPlace, setPublicPlace] = useState<ClaimPlace | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [evidenceType, setEvidenceType] = useState<(typeof EVIDENCE_TYPES)[number]>("domain_email");
  const [evidenceValue, setEvidenceValue] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const placeId = typeof router.query.placeId === "string" ? router.query.placeId : "";
  const returnPath = placeId ? `/claim/${placeId}` : "/claim";
  const loginUrl = `/login?product=business&redirectTo=${encodeURIComponent(returnPath)}`;
  const registerUrl = `/register?accountType=business&redirectTo=${encodeURIComponent(returnPath)}`;

  async function loadClaimContext() {
    if (!placeId) return;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSignedIn(Boolean(session));
      setSessionChecked(true);

      if (!session) {
        const response = await fetch(
          `/api/public/directory-place?id=${encodeURIComponent(placeId)}`,
        );
        const payload = (await response.json()) as { place?: ClaimPlace };
        if (!response.ok || !payload.place) throw new Error("not_found");
        setPublicPlace(payload.place);
        setContext(null);
        return;
      }

      const response = await fetch(
        `/api/dashboard/directory-claims?placeId=${encodeURIComponent(placeId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      const payload = (await response.json()) as ClaimContext & { error?: string };
      if (!response.ok) throw new Error(payload.error || "load_failed");
      setContext(payload);
      setPublicPlace(payload.place);
      setBusinessId((current) => current || payload.businesses[0]?.id || "");
      if (payload.currentClaim?.status === "needs_more_info") {
        setEvidenceType(
          EVIDENCE_TYPES.includes(payload.currentClaim.evidence_type as (typeof EVIDENCE_TYPES)[number])
            ? (payload.currentClaim.evidence_type as (typeof EVIDENCE_TYPES)[number])
            : "other",
        );
        setMessage(payload.currentClaim.claimant_message || "");
      }
    } catch {
      setError(
        t(
          "directory.claim.error.load",
          "This ownership claim could not be loaded. Return to Explore and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady || !placeId) return;
    if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
      const target = getBusinessAppUrl(returnPath);
      const targetUrl = new URL(target, window.location.origin);
      if (targetUrl.hostname !== window.location.hostname) {
        window.location.assign(targetUrl.toString());
        return;
      }
    }
    void loadClaimContext();
  }, [router.isReady, placeId]);

  const selectedBusiness = useMemo(
    () => context?.businesses.find((business) => business.id === businessId) || null,
    [businessId, context?.businesses],
  );
  const currentClaim = context?.currentClaim || null;
  const isOpenClaim = currentClaim && ["pending", "needs_more_info"].includes(currentClaim.status);
  const canSubmit = Boolean(
    businessId &&
      message.trim().length >= 20 &&
      confirmed &&
      (!currentClaim || currentClaim.status === "needs_more_info" || currentClaim.status === "rejected"),
  );

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      pending: t("directory.claim.status.pending", "Under review"),
      needs_more_info: t("directory.claim.status.moreInfo", "More information needed"),
      approved: t("directory.claim.status.approved", "Ownership approved"),
      rejected: t("directory.claim.status.rejected", "Not approved"),
      withdrawn: t("directory.claim.status.withdrawn", "Withdrawn"),
    };
    return labels[status] || status;
  }

  function evidenceLabel(value: string) {
    const labels: Record<string, string> = {
      domain_email: t("directory.claim.evidence.email", "Business email domain"),
      business_phone: t("directory.claim.evidence.phone", "Business phone"),
      business_document: t("directory.claim.evidence.document", "Business document"),
      other: t("directory.claim.evidence.other", "Other evidence"),
    };
    return labels[value] || value;
  }

  function matchReasonLabel(value: string) {
    const labels: Record<string, string> = {
      name: t("directory.claim.match.name", "Similar name"),
      city: t("directory.claim.match.city", "Same city"),
      phone: t("directory.claim.match.phone", "Matching phone"),
    };
    return labels[value] || value;
  }

  async function switchAccount() {
    setSwitchingAccount(true);
    setError(null);

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(
        t(
          "directory.claim.error.switchAccount",
          "This account could not be signed out. Try again from Account.",
        ),
      );
      setSwitchingAccount(false);
      return;
    }

    window.location.assign(loginUrl);
  }

  async function submitClaim(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !placeId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("signed_out");
      const response = await fetch("/api/dashboard/directory-claims", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId,
          businessId,
          evidenceType,
          evidenceValue,
          claimantMessage: message,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "submit_failed");
      setSuccess(
        t(
          "directory.claim.success",
          "Claim submitted. Mirëbook will review the ownership evidence before linking anything.",
        ),
      );
      setConfirmed(false);
      await loadClaimContext();
    } catch {
      setError(
        t(
          "directory.claim.error.submit",
          "The claim could not be submitted. Check the details and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const place = context?.place || publicPlace;

  return (
    <main className="claim-page">
      <Head>
        <title>{t("directory.claim.metaTitle", "Claim a place | Mirëbook Business")}</title>
      </Head>
      <AuthNav />

      <section className="container claim-shell">
        {loading || !sessionChecked ? (
          <div className="claim-state">{t("directory.claim.loading", "Loading ownership claim...")}</div>
        ) : !place ? (
          <div className="claim-state">{t("directory.claim.unavailable", "This place is not available to claim.")}</div>
        ) : (
          <>
            <header className="claim-header">
              <div>
                <span>{t("directory.claim.kicker", "Business ownership")}</span>
                <h1>{t("directory.claim.title", "Claim this place")}</h1>
                <p>{t("directory.claim.subtitle", "Connect a reviewed directory listing to the Mirëbook business you own.")}</p>
              </div>
              <div className="claim-place">
                <Building2 size={20} aria-hidden="true" />
                <div><strong>{place.name}</strong><span>{[place.address, place.city].filter(Boolean).join(", ")}</span></div>
              </div>
            </header>

            <div className="claim-safety">
              <ShieldCheck size={21} aria-hidden="true" />
              <div>
                <strong>{t("directory.claim.safetyTitle", "Every claim is reviewed")}</strong>
                <span>{t("directory.claim.safetyBody", "Matching names or addresses only help you choose a profile. They never approve ownership automatically.")}</span>
              </div>
            </div>

            {error && <div className="claim-message is-error">{error}</div>}
            {success && <div className="claim-message is-success">{success}</div>}

            {!signedIn ? (
              <section className="claim-auth">
                <h2>{t("directory.claim.authTitle", "Continue with Mirëbook Business")}</h2>
                <p>{t("directory.claim.authBody", "Sign in to an existing Business account, or create one. This place will stay attached to the return journey.")}</p>
                <div>
                  <Link href={loginUrl} className="btn btn-accent">{t("directory.claim.signIn", "Business sign in")}</Link>
                  <Link href={registerUrl} className="btn btn-ghost">{t("directory.claim.create", "Create Business account")}</Link>
                </div>
              </section>
            ) : context?.businesses.length === 0 ? (
              <section className="claim-auth">
                <h2>{t("directory.claim.noBusinessTitle", "A Business profile is required")}</h2>
                <p>{t("directory.claim.noBusinessBody", "This signed-in account does not own a Mirëbook business. Use a Business account or start business setup first.")}</p>
                <div>
                  <Link href="/dashboard/businesses" className="btn btn-accent">{t("directory.claim.openSetup", "Open Business setup")}</Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={switchingAccount}
                    onClick={() => void switchAccount()}
                  >
                    {t("directory.claim.switchAccount", "Use another account")}
                  </button>
                </div>
              </section>
            ) : currentClaim?.status === "approved" ? (
              <section className="claim-result is-approved">
                <BadgeCheck size={30} aria-hidden="true" />
                <h2>{statusLabel(currentClaim.status)}</h2>
                <p>{t("directory.claim.approvedBody", "The directory place is linked to your business. Finish or review your existing setup before publishing it for bookings.")}</p>
                <Link href="/dashboard/businesses" className="btn btn-accent">{t("directory.claim.continueSetup", "Continue in Setup")}</Link>
              </section>
            ) : currentClaim?.status === "pending" ? (
              <section className="claim-result">
                <Clock3 size={30} aria-hidden="true" />
                <h2>{statusLabel(currentClaim.status)}</h2>
                <p>{t("directory.claim.pendingBody", "Mirëbook has your request. The listing remains unchanged while the operator checks the evidence.")}</p>
                <span>{new Date(currentClaim.created_at).toLocaleDateString()}</span>
              </section>
            ) : (
              <form className="claim-form" onSubmit={submitClaim}>
                {isOpenClaim && currentClaim?.review_notes && (
                  <div className="claim-review-note">
                    <strong>{statusLabel(currentClaim.status)}</strong>
                    <span>{currentClaim.review_notes}</span>
                  </div>
                )}
                {currentClaim?.status === "rejected" && (
                  <div className="claim-review-note">
                    <strong>{statusLabel(currentClaim.status)}</strong>
                    <span>{currentClaim.review_notes || t("directory.claim.rejectedBody", "The evidence did not confirm ownership. You may submit a new request with clearer information.")}</span>
                  </div>
                )}

                <section className="claim-section">
                  <div className="claim-section-number">1</div>
                  <div className="claim-section-content">
                    <h2>{t("directory.claim.businessTitle", "Choose your business")}</h2>
                    <p>{t("directory.claim.businessBody", "Suggestions are based on basic similarities only. Select the profile you actually own.")}</p>
                    <div className="claim-businesses">
                      {context.businesses.map((business) => (
                        <label key={business.id} className={businessId === business.id ? "is-selected" : ""}>
                          <input type="radio" name="business" value={business.id} checked={businessId === business.id} onChange={() => setBusinessId(business.id)} />
                          <span className="claim-business-main"><strong>{business.name}</strong><small>{[business.address, business.city].filter(Boolean).join(", ")}</small></span>
                          {business.matchReasons.length > 0 && (
                            <span className="claim-match-list">{business.matchReasons.map(matchReasonLabel).join(" · ")}</span>
                          )}
                        </label>
                      ))}
                    </div>
                    {selectedBusiness && selectedBusiness.matchReasons.length === 0 && (
                      <p className="claim-neutral-note">{t("directory.claim.noMatch", "No obvious match was found. You can still submit evidence for manual review.")}</p>
                    )}
                  </div>
                </section>

                <section className="claim-section">
                  <div className="claim-section-number">2</div>
                  <div className="claim-section-content">
                    <h2>{t("directory.claim.evidenceTitle", "Show your connection")}</h2>
                    <label className="claim-field">
                      <span>{t("directory.claim.evidenceLabel", "Evidence type")}</span>
                      <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as (typeof EVIDENCE_TYPES)[number])}>
                        {EVIDENCE_TYPES.map((value) => <option key={value} value={value}>{evidenceLabel(value)}</option>)}
                      </select>
                    </label>
                    {evidenceType === "business_phone" && (
                      <label className="claim-field">
                        <span>{t("directory.claim.phoneLabel", "Business phone number")}</span>
                        <input type="tel" value={evidenceValue} onChange={(event) => setEvidenceValue(event.target.value)} autoComplete="tel" />
                        <small>{t("directory.claim.phonePrivacy", "Only the final four digits are stored in the claim record.")}</small>
                      </label>
                    )}
                    <label className="claim-field">
                      <span>{t("directory.claim.messageLabel", "How are you connected to this business?")}</span>
                      <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={1500} placeholder={t("directory.claim.messagePlaceholder", "Explain your role and what Mirëbook can check.")} />
                      <small>{message.trim().length}/1500</small>
                    </label>
                  </div>
                </section>

                <label className="claim-confirm">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  <span><Check size={16} aria-hidden="true" />{t("directory.claim.confirm", "I confirm that I am authorised to represent this business and that the information is accurate.")}</span>
                </label>

                <button type="submit" className="btn btn-accent" disabled={!canSubmit || saving}>
                  {saving ? t("directory.claim.submitting", "Submitting...") : currentClaim?.status === "needs_more_info" ? t("directory.claim.resubmit", "Send additional information") : t("directory.claim.submit", "Submit for review")}
                </button>
              </form>
            )}
          </>
        )}
      </section>

      <style jsx>{`
        .claim-shell { max-width: 980px; padding-top: 2rem; padding-bottom: 4rem; }
        .claim-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
        .claim-header > div:first-child > span { color: var(--accent); font-size: .76rem; font-weight: 800; text-transform: uppercase; }
        .claim-header h1 { margin: .2rem 0 .35rem; font-size: clamp(2rem, 5vw, 3.5rem); }
        .claim-header p { margin: 0; max-width: 56ch; color: var(--text-muted); }
        .claim-place { min-width: min(100%, 300px); display: flex; gap: .7rem; align-items: flex-start; padding: .8rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
        .claim-place > :global(svg) { flex: 0 0 auto; color: var(--accent); }
        .claim-place div { min-width: 0; display: grid; gap: .2rem; }
        .claim-place strong, .claim-place span { overflow-wrap: anywhere; }
        .claim-place span { color: var(--text-muted); font-size: .8rem; }
        .claim-safety { display: flex; gap: .75rem; align-items: flex-start; margin: 1.25rem 0; padding: .85rem 1rem; border: 1px solid rgba(45, 212, 191, .28); border-radius: 8px; background: rgba(45, 212, 191, .07); }
        .claim-safety > :global(svg) { color: var(--success); flex: 0 0 auto; }
        .claim-safety div { display: grid; gap: .15rem; }
        .claim-safety span { color: var(--text-muted); font-size: .85rem; }
        .claim-auth, .claim-result { max-width: 640px; margin: 2rem auto 0; padding: 1.2rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); text-align: center; }
        .claim-auth h2, .claim-result h2 { margin: .2rem 0 .45rem; }
        .claim-auth p, .claim-result p { color: var(--text-muted); }
        .claim-auth > div { display: flex; justify-content: center; flex-wrap: wrap; gap: .65rem; }
        .claim-result > :global(svg) { color: var(--accent); }
        .claim-result.is-approved > :global(svg) { color: var(--success); }
        .claim-result > span { display: block; margin-top: .75rem; color: var(--text-muted); font-size: .8rem; }
        .claim-form { display: grid; gap: 1.25rem; margin-top: 1.5rem; }
        .claim-section { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: .85rem; padding: 1.1rem 0; border-bottom: 1px solid var(--border); }
        .claim-section-number { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: #101018; font-weight: 900; }
        .claim-section-content { min-width: 0; }
        .claim-section h2 { margin: .05rem 0 .25rem; font-size: 1.2rem; }
        .claim-section p { margin: 0 0 .9rem; color: var(--text-muted); }
        .claim-businesses { display: grid; gap: .55rem; }
        .claim-businesses label { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .7rem; padding: .8rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
        .claim-businesses label.is-selected { border-color: rgba(255, 107, 53, .55); background: var(--accent-dim); }
        .claim-business-main { min-width: 0; display: grid; gap: .14rem; }
        .claim-business-main small { color: var(--text-muted); overflow-wrap: anywhere; }
        .claim-match-list { color: var(--success); font-size: .72rem; text-align: right; }
        .claim-field { display: grid; gap: .38rem; margin-top: .8rem; }
        .claim-field > span { font-weight: 750; }
        .claim-field small, .claim-neutral-note { color: var(--text-muted); font-size: .76rem; }
        .claim-field textarea { resize: vertical; min-height: 110px; }
        .claim-confirm { display: flex; gap: .7rem; align-items: flex-start; padding: .85rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
        .claim-confirm input { margin-top: .2rem; }
        .claim-confirm span { display: flex; gap: .45rem; align-items: flex-start; font-size: .86rem; }
        .claim-confirm span > :global(svg) { color: var(--success); flex: 0 0 auto; }
        .claim-form > :global(.btn) { justify-self: end; min-width: 190px; }
        .claim-review-note, .claim-message { display: grid; gap: .25rem; padding: .8rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
        .claim-review-note span { color: var(--text-muted); }
        .claim-message.is-error { color: var(--danger); border-color: rgba(255, 77, 109, .35); }
        .claim-message.is-success { color: var(--success); border-color: rgba(45, 212, 191, .35); }
        .claim-state { min-height: 45vh; display: grid; place-content: center; text-align: center; color: var(--text-muted); }
        @media (max-width: 700px) {
          .claim-shell { padding-top: 1.25rem; }
          .claim-header { display: grid; gap: 1rem; }
          .claim-place { min-width: 0; }
          .claim-businesses label { grid-template-columns: auto minmax(0, 1fr); }
          .claim-match-list { grid-column: 2; text-align: left; }
          .claim-form > :global(.btn) { width: 100%; justify-self: stretch; }
        }
      `}</style>
    </main>
  );
}
