import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Clock3, ShieldAlert, UserRound } from "lucide-react";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

const STATUSES = [
  "pending",
  "needs_more_info",
  "approved",
  "rejected",
  "withdrawn",
] as const;
type ClaimStatus = (typeof STATUSES)[number];
type ClaimAction = "approve" | "request_more_info" | "reject";

type Claim = {
  id: string;
  directory_place_id: string;
  business_id: string;
  claimant_user_id: string;
  status: ClaimStatus;
  evidence_type: string;
  evidence_value_masked?: string | null;
  claimant_message?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
  place?: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    website?: string | null;
    listing_status: string;
    claim_status: string;
  } | null;
  business?: {
    id: string;
    user_id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    published?: boolean | null;
  } | null;
  claimant?: {
    id: string;
    email?: string | null;
    full_name?: string | null;
  } | null;
};

type ClaimPayload = {
  claims: Claim[];
  counts: Record<ClaimStatus, number>;
  pagination: { total: number; limit: number; offset: number };
};

export default function AdminDirectoryClaimsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [status, setStatus] = useState<ClaimStatus>("pending");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [counts, setCounts] = useState<Record<ClaimStatus, number>>({
    pending: 0,
    needs_more_info: 0,
    approved: 0,
    rejected: 0,
    withdrawn: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<ClaimAction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.id === selectedId) || claims[0] || null,
    [claims, selectedId],
  );

  function statusLabel(value: string) {
    const labels: Record<string, string> = {
      pending: t("admin.claims.status.pending", "Pending"),
      needs_more_info: t("admin.claims.status.moreInfo", "More information"),
      approved: t("admin.claims.status.approved", "Approved"),
      rejected: t("admin.claims.status.rejected", "Rejected"),
      withdrawn: t("admin.claims.status.withdrawn", "Withdrawn"),
    };
    return labels[value] || value;
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

  async function loadClaims(nextStatus = status) {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?redirectTo=/admin/directory-claims");
        return;
      }
      const response = await fetch(
        `/api/admin/directory-claims?status=${encodeURIComponent(nextStatus)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      const payload = (await response.json()) as ClaimPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "load_failed");
      setClaims(payload.claims || []);
      setCounts(payload.counts);
      setSelectedId((current) =>
        payload.claims.some((claim) => claim.id === current)
          ? current
          : payload.claims[0]?.id || null,
      );
    } catch {
      setError(
        t("admin.claims.error.load", "Ownership claims could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClaims(status);
  }, [status]);

  function beginReview(action: ClaimAction) {
    setReviewAction(action);
    setReviewNotes("");
    setError(null);
    setSuccess(null);
  }

  async function saveReview() {
    if (!selectedClaim || !reviewAction) return;
    if (reviewAction !== "approve" && !reviewNotes.trim()) {
      setError(t("admin.claims.error.note", "Add a note for the business owner."));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("signed_out");
      const response = await fetch("/api/admin/directory-claims", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimId: selectedClaim.id,
          action: reviewAction,
          notes: reviewNotes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "review_failed");
      setSuccess(t("admin.claims.success", "Ownership claim review saved."));
      setReviewAction(null);
      setReviewNotes("");
      await loadClaims(status);
    } catch {
      setError(t("admin.claims.error.save", "The review decision could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-claims-page">
      <Head><title>{t("admin.claims.metaTitle", "Ownership claims | Mirëbook")}</title></Head>
      <AuthNav contextRole="admin" />
      <section className="container admin-claims-shell">
        <header className="admin-claims-header">
          <div>
            <span>{t("admin.claims.kicker", "Marketplace ownership")}</span>
            <h1>{t("admin.claims.title", "Ownership claims")}</h1>
            <p>{t("admin.claims.subtitle", "Review evidence before linking a directory place to an owner-managed Mirëbook business.")}</p>
          </div>
          <Link href="/admin/directory" className="btn btn-ghost">{t("admin.claims.directory", "Directory review")}</Link>
        </header>

        <div className="admin-claims-safety">
          <ShieldAlert size={20} aria-hidden="true" />
          <span>{t("admin.claims.safety", "Approval links records only. It does not publish the business, make it bookable or bypass Setup readiness.")}</span>
        </div>

        <div className="admin-claim-statuses" role="tablist" aria-label={t("admin.claims.statuses", "Claim statuses")}>
          {STATUSES.map((value) => (
            <button key={value} type="button" role="tab" aria-selected={status === value} className={status === value ? "is-active" : ""} onClick={() => setStatus(value)}>
              <strong>{counts[value] || 0}</strong><span>{statusLabel(value)}</span>
            </button>
          ))}
        </div>

        {error && <div className="admin-claim-message is-error">{error}</div>}
        {success && <div className="admin-claim-message is-success">{success}</div>}

        <div className="admin-claims-workspace">
          <section className="admin-claims-list">
            <header><strong>{statusLabel(status)}</strong><span>{claims.length} {t("admin.claims.results", "claims")}</span></header>
            {loading ? (
              <div className="admin-claims-empty">{t("admin.claims.loading", "Loading claims...")}</div>
            ) : claims.length === 0 ? (
              <div className="admin-claims-empty"><BadgeCheck size={27} aria-hidden="true" /><strong>{t("admin.claims.empty", "No claims in this view")}</strong></div>
            ) : (
              <div className="admin-claim-rows">
                {claims.map((claim) => (
                  <button key={claim.id} type="button" className={selectedClaim?.id === claim.id ? "is-selected" : ""} onClick={() => { setSelectedId(claim.id); setReviewAction(null); }}>
                    <span><strong>{claim.place?.name || t("admin.claims.unknownPlace", "Unknown place")}</strong><small>{claim.business?.name || t("admin.claims.unknownBusiness", "Unknown business")}</small></span>
                    <time>{new Date(claim.created_at).toLocaleDateString()}</time>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="admin-claim-detail">
            {!selectedClaim ? (
              <div className="admin-claims-empty">{t("admin.claims.select", "Select a claim to review its evidence.")}</div>
            ) : (
              <>
                <header className="admin-claim-detail-header">
                  <div><span>{statusLabel(selectedClaim.status)}</span><h2>{selectedClaim.place?.name}</h2></div>
                  <Clock3 size={20} aria-hidden="true" />
                </header>

                <div className="admin-claim-compare">
                  <article>
                    <Building2 size={20} aria-hidden="true" />
                    <span>{t("admin.claims.directoryPlace", "Directory place")}</span>
                    <strong>{selectedClaim.place?.name || "-"}</strong>
                    <small>{[selectedClaim.place?.address, selectedClaim.place?.city].filter(Boolean).join(", ") || "-"}</small>
                    <small>{selectedClaim.place?.phone || "-"}</small>
                  </article>
                  <article>
                    <BadgeCheck size={20} aria-hidden="true" />
                    <span>{t("admin.claims.mirebookBusiness", "Mirëbook business")}</span>
                    <strong>{selectedClaim.business?.name || "-"}</strong>
                    <small>{[selectedClaim.business?.address, selectedClaim.business?.city].filter(Boolean).join(", ") || "-"}</small>
                    <small>{selectedClaim.business?.phone || "-"}</small>
                    <small>{selectedClaim.business?.published ? t("admin.claims.published", "Published") : t("admin.claims.draft", "Draft")}</small>
                  </article>
                </div>

                <dl className="admin-claim-facts">
                  <div><dt><UserRound size={17} aria-hidden="true" />{t("admin.claims.claimant", "Claimant")}</dt><dd>{selectedClaim.claimant?.full_name || selectedClaim.claimant?.email || "-"}<small>{selectedClaim.claimant?.email}</small></dd></div>
                  <div><dt>{t("admin.claims.evidence", "Evidence")}</dt><dd>{evidenceLabel(selectedClaim.evidence_type)}<small>{selectedClaim.evidence_value_masked || t("admin.claims.noMaskedValue", "No additional stored value")}</small></dd></div>
                  <div><dt>{t("admin.claims.message", "Claimant explanation")}</dt><dd>{selectedClaim.claimant_message || "-"}</dd></div>
                  {selectedClaim.review_notes && <div><dt>{t("admin.claims.previousNote", "Review note")}</dt><dd>{selectedClaim.review_notes}</dd></div>}
                </dl>

                {["pending", "needs_more_info"].includes(selectedClaim.status) && (
                  <div className="admin-claim-actions">
                    <button type="button" className="btn btn-accent" onClick={() => beginReview("approve")}>{t("admin.claims.approve", "Approve ownership")}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => beginReview("request_more_info")}>{t("admin.claims.moreInfo", "Request more information")}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => beginReview("reject")}>{t("admin.claims.reject", "Reject claim")}</button>
                  </div>
                )}

                {reviewAction && (
                  <div className="admin-claim-confirmation">
                    <strong>{reviewAction === "approve" ? t("admin.claims.confirmApprove", "Approve this ownership claim?") : reviewAction === "request_more_info" ? t("admin.claims.confirmMoreInfo", "What should the owner provide?") : t("admin.claims.confirmReject", "Why is this claim being rejected?")}</strong>
                    <textarea rows={4} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder={reviewAction === "approve" ? t("admin.claims.approveNote", "Optional internal review note") : t("admin.claims.ownerNote", "Clear note shown to the business owner")} />
                    <div><button type="button" className="btn btn-accent" onClick={saveReview} disabled={saving}>{saving ? t("admin.claims.saving", "Saving...") : t("admin.claims.confirm", "Confirm decision")}</button><button type="button" className="btn btn-ghost" onClick={() => setReviewAction(null)}>{t("common.cancel", "Cancel")}</button></div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      <style jsx>{`
        .admin-claims-shell { padding-top: 2rem; padding-bottom: 4rem; }
        .admin-claims-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem; }
        .admin-claims-header span { color: var(--accent); font-size: .76rem; font-weight: 800; text-transform: uppercase; }
        .admin-claims-header h1 { margin: .2rem 0; font-size: 2.5rem; }
        .admin-claims-header p { margin: 0; max-width: 62ch; color: var(--text-muted); }
        .admin-claims-safety { display: flex; gap: .65rem; align-items: center; margin: 1.25rem 0; padding: .75rem .9rem; border: 1px solid rgba(255, 107, 53, .25); border-radius: 8px; color: var(--text-muted); background: var(--accent-dim); }
        .admin-claims-safety > :global(svg) { flex: 0 0 auto; color: var(--accent); }
        .admin-claim-statuses { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .45rem; margin-bottom: 1rem; }
        .admin-claim-statuses button { display: grid; gap: .12rem; padding: .65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-muted); text-align: left; cursor: pointer; }
        .admin-claim-statuses button.is-active { color: var(--text); border-color: rgba(255, 107, 53, .48); background: var(--accent-dim); }
        .admin-claim-statuses strong { font-size: 1.15rem; }
        .admin-claim-statuses span { font-size: .75rem; }
        .admin-claims-workspace { display: grid; grid-template-columns: minmax(260px, .72fr) minmax(0, 1.4fr); gap: 1rem; align-items: start; }
        .admin-claims-list, .admin-claim-detail { min-width: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
        .admin-claims-list > header { display: flex; justify-content: space-between; gap: .5rem; padding: .8rem; border-bottom: 1px solid var(--border); }
        .admin-claims-list > header span { color: var(--text-muted); font-size: .78rem; }
        .admin-claim-rows { display: grid; max-height: 640px; overflow-y: auto; }
        .admin-claim-rows button { display: flex; justify-content: space-between; gap: .65rem; padding: .8rem; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); text-align: left; cursor: pointer; }
        .admin-claim-rows button.is-selected { background: var(--accent-dim); box-shadow: inset 3px 0 var(--accent); }
        .admin-claim-rows span { min-width: 0; display: grid; gap: .15rem; }
        .admin-claim-rows strong, .admin-claim-rows small { overflow-wrap: anywhere; }
        .admin-claim-rows small, .admin-claim-rows time { color: var(--text-muted); font-size: .72rem; }
        .admin-claim-detail { padding: 1rem; position: sticky; top: 5.5rem; }
        .admin-claim-detail-header { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: .8rem; border-bottom: 1px solid var(--border); }
        .admin-claim-detail-header span { color: var(--success); font-size: .72rem; font-weight: 800; text-transform: uppercase; }
        .admin-claim-detail-header h2 { margin: .15rem 0 0; font-size: 1.35rem; }
        .admin-claim-detail-header > :global(svg) { color: var(--accent); }
        .admin-claim-compare { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; margin: .9rem 0; }
        .admin-claim-compare article { min-width: 0; display: grid; gap: .25rem; padding: .75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
        .admin-claim-compare article > :global(svg) { color: var(--accent); }
        .admin-claim-compare span, .admin-claim-compare small { color: var(--text-muted); font-size: .74rem; overflow-wrap: anywhere; }
        .admin-claim-facts { display: grid; margin: 0; }
        .admin-claim-facts div { display: grid; grid-template-columns: minmax(130px, .35fr) minmax(0, 1fr); gap: .75rem; padding: .7rem 0; border-bottom: 1px solid var(--border); }
        .admin-claim-facts dt { display: flex; gap: .35rem; color: var(--text-muted); }
        .admin-claim-facts dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
        .admin-claim-facts dd small { display: block; margin-top: .2rem; color: var(--text-muted); }
        .admin-claim-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
        .admin-claim-confirmation { display: grid; gap: .65rem; margin-top: 1rem; padding: .8rem; border: 1px solid rgba(255, 107, 53, .35); border-radius: 8px; background: var(--accent-dim); }
        .admin-claim-confirmation textarea { resize: vertical; }
        .admin-claim-confirmation > div { display: flex; flex-wrap: wrap; gap: .5rem; }
        .admin-claims-empty { min-height: 180px; display: grid; place-content: center; justify-items: center; gap: .45rem; color: var(--text-muted); text-align: center; }
        .admin-claim-message { margin-bottom: .8rem; padding: .7rem .85rem; border: 1px solid var(--border); border-radius: 8px; }
        .admin-claim-message.is-error { color: var(--danger); border-color: rgba(255, 77, 109, .35); }
        .admin-claim-message.is-success { color: var(--success); border-color: rgba(45, 212, 191, .35); }
        @media (max-width: 820px) {
          .admin-claims-header, .admin-claims-workspace { display: grid; }
          .admin-claim-statuses { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .admin-claims-workspace { grid-template-columns: 1fr; }
          .admin-claim-detail { position: static; }
        }
        @media (max-width: 520px) {
          .admin-claims-shell { padding-top: 1.25rem; }
          .admin-claim-compare, .admin-claim-facts div { grid-template-columns: 1fr; }
          .admin-claim-actions :global(.btn) { width: 100%; }
        }
      `}</style>
    </main>
  );
}
