import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Business, BusinessCardStats } from "./exploreTypes";

type Props = {
  business: Business;
  stats: BusinessCardStats;
  businessIcon: (business: Business) => string;
  locationLabel: (business: Business) => string;
  imageBackground: (business: Business) => string;
};

export default function ExploreBusinessCard({
  business,
  stats,
  businessIcon,
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
    <div className="card explore-business-card">
      <div
        className={`explore-business-image ${hasImage ? "has-image" : "no-image"}`}
        style={{
          minHeight: 150,
          background: imageBackground(business),
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRight: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
        }}
      >
        {!hasImage && (
          <span className="explore-business-fallback-mark" aria-hidden="true">
            {businessIcon(business)}
          </span>
        )}
      </div>

      <div className="explore-business-content">
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ marginBottom: "0.25rem" }}>{business.name}</h3>

          {business.category && (
            <span
              className="small"
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent)",
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
              }}
            >
              {business.category}
            </span>
          )}

          <span
            className="small"
            style={{
              background:
                business.auto_accept_bookings === false
                  ? "rgba(255,107,53,0.12)"
                  : "rgba(45,212,191,0.12)",
              color:
                business.auto_accept_bookings === false
                  ? "var(--accent)"
                  : "var(--success)",
              padding: "0.2rem 0.55rem",
              borderRadius: 999,
            }}
          >
            {business.auto_accept_bookings === false
              ? t("explore.card.requestAppointment", "Request appointment")
              : t("explore.card.bookInstantly", "Book instantly")}
          </span>
        </div>

        {business.description && (
          <p
            className="muted small explore-card-description"
            style={{
              marginBottom: "0.65rem",
              marginTop: "0.35rem",
              maxWidth: 680,
            }}
          >
            {business.description}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "0.65rem",
          }}
        >
          <span className="small explore-muted-pill">{serviceText}</span>
          <span className="small explore-muted-pill">{staffText}</span>
        </div>

        <p className="small muted">{locationLabel(business)}</p>
      </div>

      <div className="explore-business-actions">
        <Link href={`/explore/${business.id}`} className="btn btn-accent">
          {t("explore.card.viewTimes")}
        </Link>
      </div>
      <style jsx>{`
        .explore-card-description {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .explore-business-fallback-mark {
          width: 3.4rem;
          height: 3.4rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 107, 53, 0.26);
          border-radius: 50%;
          background:
            radial-gradient(
              circle at 35% 25%,
              rgba(255, 255, 255, 0.18),
              transparent 34%
            ),
            rgba(255, 107, 53, 0.12);
          box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.22);
          font-size: 1.75rem;
        }
      `}</style>
    </div>
  );
}
