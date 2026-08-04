import Link from "next/link";
import { MapPin } from "lucide-react";
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

function distanceLabel(
  distanceMeters: number | null | undefined,
  t: (key: string, fallback?: string) => string,
) {
  if (typeof distanceMeters !== "number") return null;
  if (distanceMeters < 1_000) {
    return `${Math.max(100, Math.round(distanceMeters / 100) * 100)} ${t(
      "directory.distance.metres",
      "m away",
    )}`;
  }
  return `${(distanceMeters / 1_000).toFixed(distanceMeters < 10_000 ? 1 : 0)} ${t(
    "directory.distance.kilometres",
    "km away",
  )}`;
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
  const distance = distanceLabel(business.distanceMeters, t);

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

      <div className="explore-business-content">
        <span className="explore-card-category">
          {business.category || t("common.business", "Business")}
        </span>

        <h3>{business.name}</h3>

        {business.description && (
          <p className="explore-card-description">{business.description}</p>
        )}

        <div className="explore-card-facts">
          <span className="explore-card-location">
            <MapPin size={14} aria-hidden="true" />
            <span>{locationLabel(business)}</span>
            {distance && <strong>{distance}</strong>}
          </span>
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
          position: relative;
          min-height: 0;
          aspect-ratio: 16 / 9;
          border-bottom: 1px solid var(--border);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .explore-business-image.no-image {
          aspect-ratio: 16 / 9;
        }

        .explore-business-fallback-mark {
          display: grid;
          width: 3.6rem;
          height: 3.6rem;
          place-items: center;
          border: 1px solid rgba(237, 90, 42, 0.22);
          border-radius: 8px;
          background: #ffffff;
          color: var(--accent);
          box-shadow: 8px 8px 0 rgba(237, 90, 42, 0.1);
          font-size: 1.05rem;
          font-weight: 900;
        }

        .explore-card-category {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .explore-booking-mode {
          position: absolute;
          top: 0.75rem;
          left: 0.75rem;
          z-index: 1;
          padding: 0.38rem 0.55rem;
          border-radius: 4px;
          color: #ffffff;
          font-size: 0.68rem;
          font-weight: 850;
          text-transform: uppercase;
          box-shadow: 0 4px 14px rgba(20, 24, 32, 0.15);
        }

        .explore-booking-mode.instant {
          background: rgba(237, 90, 42, 0.94);
        }

        .explore-booking-mode.request {
          background: rgba(192, 68, 28, 0.94);
        }

        .explore-business-content h3 {
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          font-size: 1.05rem;
          line-height: 1.25;
        }

        .explore-card-description {
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          color: var(--text-muted);
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
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

        .explore-card-location {
          display: flex;
          align-items: center;
          gap: 0.28rem;
          min-width: 0;
        }

        .explore-card-location > span {
          min-width: 0;
        }

        .explore-card-location strong {
          flex: 0 0 auto;
          color: var(--text);
          font-size: 0.7rem;
        }

        .explore-card-cta {
          display: inline-flex;
          width: fit-content;
          gap: 0.35rem;
          align-items: center;
          margin-top: auto;
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 800;
        }

        .explore-card-cta span {
          font-size: 1.1rem;
          line-height: 1;
        }
      `}</style>
    </Link>
  );
}
