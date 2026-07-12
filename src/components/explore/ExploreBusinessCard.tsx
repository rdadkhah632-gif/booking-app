import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Business, BusinessCardStats } from "./exploreTypes";

type Props = {
  business: Business;
  stats: BusinessCardStats;
  locationLabel: (business: Business) => string;
  imageBackground: (business: Business) => string;
};

function businessInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ExploreBusinessCard({
  business,
  stats,
  locationLabel,
  imageBackground,
}: Props) {
  const { t } = useI18n();
  const hasImage = Boolean(business.image_url);
  const serviceText = `${stats.assignedServices} ${
    stats.assignedServices === 1
      ? t("explore.card.serviceSingle", "service")
      : t("explore.card.servicePlural", "services")
  }`;
  const staffText = `${stats.activeStaff} ${
    stats.activeStaff === 1
      ? t("explore.card.staffSingle", "staff member")
      : t("explore.card.staffPlural", "staff members")
  }`;

  return (
    <Link
      href={`/explore/${business.id}`}
      className="card explore-business-card"
      aria-label={`${business.name}. ${t("explore.card.viewTimes")}`}
    >
      <div
        className={`explore-business-image ${hasImage ? "has-image" : "no-image"}`}
        style={{
          background: imageBackground(business),
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!hasImage && (
          <span className="explore-business-fallback-mark" aria-hidden="true">
            {businessInitials(business.name) || "M"}
          </span>
        )}
      </div>

      <div className="explore-business-content">
        <div className="explore-card-topline">
          <span className="explore-card-category">
            {business.category || t("common.business", "Business")}
          </span>
          <span
            className={
              business.auto_accept_bookings === false
                ? "explore-booking-mode request"
                : "explore-booking-mode instant"
            }
          >
            {business.auto_accept_bookings === false
              ? t("explore.card.requestAppointment", "Request appointment")
              : t("explore.card.bookInstantly", "Book instantly")}
          </span>
        </div>

        <h3>{business.name}</h3>

        {business.description && (
          <p className="explore-card-description">{business.description}</p>
        )}

        <div className="explore-card-facts">
          <span>{locationLabel(business)}</span>
          <span>
            {serviceText} · {staffText}
          </span>
        </div>

        <span className="explore-card-cta">
          {t("explore.card.viewTimes")}
          <span aria-hidden="true">›</span>
        </span>
      </div>

      <style jsx>{`
        .explore-business-image {
          min-height: 100%;
          border-right: 1px solid var(--border);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .explore-business-fallback-mark {
          display: grid;
          width: 3.6rem;
          height: 3.6rem;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 50%;
          background: rgba(15, 14, 23, 0.62);
          color: #fff7ed;
          box-shadow: 0 0.85rem 2rem rgba(0, 0, 0, 0.24);
          font-size: 1rem;
          font-weight: 900;
        }

        .explore-card-topline {
          display: flex;
          gap: 0.45rem;
          align-items: center;
          justify-content: space-between;
          min-width: 0;
        }

        .explore-card-category {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .explore-booking-mode {
          flex: 0 0 auto;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 800;
        }

        .explore-booking-mode.instant {
          background: rgba(45, 212, 191, 0.1);
          color: var(--success);
        }

        .explore-booking-mode.request {
          background: var(--accent-dim);
          color: var(--accent);
        }

        .explore-business-content h3 {
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          font-size: 1.05rem;
          line-height: 1.2;
        }

        .explore-card-description {
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          color: var(--text-muted);
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .explore-card-facts {
          display: grid;
          gap: 0.1rem;
          min-width: 0;
          color: var(--text-muted);
          font-size: 0.74rem;
        }

        .explore-card-facts span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .explore-card-cta {
          display: inline-flex;
          width: fit-content;
          gap: 0.35rem;
          align-items: center;
          margin-top: auto;
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 900;
        }

        .explore-card-cta span {
          font-size: 1.1rem;
          line-height: 1;
        }
      `}</style>
    </Link>
  );
}
