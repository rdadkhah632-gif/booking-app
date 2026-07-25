import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Clock3,
  ShieldX,
} from "lucide-react";
import { getCustomerAppUrl } from "@/lib/appUrls";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type ClaimStatus =
  | "pending"
  | "needs_more_info"
  | "approved"
  | "rejected"
  | "withdrawn";

type OwnershipClaim = {
  id: string;
  directory_place_id: string;
  business_id: string;
  status: ClaimStatus;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
  place?: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    country_code?: string | null;
  } | null;
};

type ClaimPayload = {
  claims?: OwnershipClaim[];
};

export default function BusinessClaimStatus({
  businessId,
}: {
  businessId: string;
}) {
  const { locale, t } = useI18n();
  const [claims, setClaims] = useState<OwnershipClaim[]>([]);

  useEffect(() => {
    let active = true;

    async function loadClaims() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch("/api/dashboard/directory-claims", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = (await response.json()) as ClaimPayload;
        if (!response.ok || !active) return;
        setClaims(payload.claims || []);
      } catch {
        // Setup remains usable if the secondary claim summary is unavailable.
      }
    }

    void loadClaims();
    return () => {
      active = false;
    };
  }, [businessId]);

  const claim = useMemo(
    () =>
      claims
        .filter((item) => item.business_id === businessId)
        .sort(
          (left, right) =>
            new Date(right.updated_at).getTime() -
            new Date(left.updated_at).getTime(),
        )[0] || null,
    [businessId, claims],
  );

  if (!claim || claim.status === "withdrawn") return null;

  const placeName =
    claim.place?.name ||
    t("dashboardBusinesses.claim.placeFallback", "Directory place");
  const status = {
    pending: {
      icon: Clock3,
      className: "is-pending",
      label: t("dashboardBusinesses.claim.pending", "Ownership under review"),
      helper: t(
        "dashboardBusinesses.claim.pendingBody",
        "Mirëbook is checking the ownership information.",
      ),
      action: t("dashboardBusinesses.claim.view", "View request"),
      href: `/claim/${claim.directory_place_id}`,
    },
    needs_more_info: {
      icon: CircleAlert,
      className: "needs-action",
      label: t(
        "dashboardBusinesses.claim.moreInfo",
        "More ownership information needed",
      ),
      helper: t(
        "dashboardBusinesses.claim.moreInfoBody",
        "Read the review note and send clearer evidence.",
      ),
      action: t("dashboardBusinesses.claim.addInfo", "Add information"),
      href: `/claim/${claim.directory_place_id}`,
    },
    approved: {
      icon: BadgeCheck,
      className: "is-approved",
      label: t("dashboardBusinesses.claim.approved", "Ownership approved"),
      helper: t(
        "dashboardBusinesses.claim.approvedBody",
        "This place is linked to your business. Publishing still follows Setup readiness.",
      ),
      action: t("dashboardBusinesses.claim.viewPlace", "View place"),
      href: getCustomerAppUrl(`/places/${claim.directory_place_id}`),
    },
    rejected: {
      icon: ShieldX,
      className: "is-rejected",
      label: t(
        "dashboardBusinesses.claim.rejected",
        "Ownership not approved",
      ),
      helper: t(
        "dashboardBusinesses.claim.rejectedBody",
        "Review the decision before submitting new evidence.",
      ),
      action: t("dashboardBusinesses.claim.review", "Review decision"),
      href: `/claim/${claim.directory_place_id}`,
    },
  }[claim.status];

  if (!status) return null;
  const Icon = status.icon;
  const updatedAt = new Intl.DateTimeFormat(
    locale === "sq" ? "sq-AL" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  ).format(new Date(claim.updated_at));

  return (
    <section className={`business-claim-status ${status.className}`}>
      <Icon size={20} aria-hidden="true" />
      <div className="business-claim-copy">
        <span>{status.label}</span>
        <strong>{placeName}</strong>
        <small>
          {status.helper} · {updatedAt}
        </small>
      </div>
      <Link href={status.href} className="btn btn-ghost">
        {status.action}
      </Link>

      <style jsx>{`
        .business-claim-status {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .business-claim-status > :global(svg) {
          color: var(--warning);
        }

        .business-claim-status.needs-action {
          border-color: rgba(255, 190, 11, 0.42);
          background: rgba(255, 190, 11, 0.06);
        }

        .business-claim-status.is-approved {
          border-color: rgba(45, 212, 191, 0.32);
          background: rgba(45, 212, 191, 0.05);
        }

        .business-claim-status.is-approved > :global(svg) {
          color: var(--success);
        }

        .business-claim-status.is-rejected > :global(svg) {
          color: var(--danger);
        }

        .business-claim-copy {
          min-width: 0;
          display: grid;
          gap: 0.12rem;
        }

        .business-claim-copy span {
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .business-claim-copy strong,
        .business-claim-copy small {
          overflow-wrap: anywhere;
        }

        .business-claim-copy small {
          color: var(--text-muted);
          font-size: 0.76rem;
        }

        @media (max-width: 640px) {
          .business-claim-status {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .business-claim-status :global(.btn) {
            grid-column: 1 / -1;
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
