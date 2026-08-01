import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/useI18n";
import DirectoryCategoryArtwork from "./DirectoryCategoryArtwork";
import {
  directoryCategoryLabel,
  directoryImageCredit,
} from "./directoryCategories";
import { DirectoryPlace } from "./exploreTypes";

type Props = {
  place: DirectoryPlace;
  onShowOnMap: (placeId: string) => void;
};

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

export default function ExploreDirectoryCard({ place, onShowOnMap }: Props) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const location = [place.city, place.region].filter(Boolean).join(", ");
  const distance = distanceLabel(place.distanceMeters, t);
  const hasImage = Boolean(place.image && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [place.image?.url]);

  return (
    <article className="explore-directory-card">
      <div
        className={`directory-card-media ${hasImage ? "has-image" : "no-image"}`}
        aria-hidden={hasImage ? undefined : "true"}
      >
        <DirectoryCategoryArtwork category={place.categoryKey} />
        {hasImage && place.image && (
          <img
            src={place.image.url}
            alt={place.image.alt}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
      <div className="directory-card-content">
        <div className="directory-card-heading">
          <div>
            <span className="directory-type">
              {t("directory.card.type", "Local place")}
            </span>
            <h2>
              <Link href={`/places/${place.id}`}>{place.name}</Link>
            </h2>
          </div>
          {distance && <span className="directory-distance">{distance}</span>}
        </div>

        <p className="directory-category">
          {directoryCategoryLabel(place.categoryKey, t)}
        </p>
        {place.description && (
          <p className="directory-description">{place.description}</p>
        )}
        <p className="directory-location">
          <MapPin size={15} aria-hidden="true" />
          <span>{location || t("directory.card.albania", "Albania")}</span>
        </p>

        <div className="directory-card-footer">
          <span className="directory-booking-note">
            {t("directory.card.notBookable", "Not bookable on Mirëbook yet")}
          </span>
          <div className="directory-card-actions">
            <Link href={`/places/${place.id}`} className="btn btn-accent">
              {t("directory.card.details", "Details")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onShowOnMap(place.id)}
            >
              <MapPin size={16} aria-hidden="true" />
              {t("directory.card.showMap", "Map")}
            </button>
          </div>
        </div>

        <div className="directory-credits">
          {hasImage &&
            place.image &&
            (place.image.attribution.url ? (
              <a
                className="directory-attribution"
                href={place.image.attribution.url}
                target="_blank"
                rel="noreferrer"
              >
                {t("directory.card.photo", "Photo")}:{" "}
                {directoryImageCredit(place.image.attribution.label)}
              </a>
            ) : (
              <span className="directory-attribution">
                {t("directory.card.photo", "Photo")}:{" "}
                {directoryImageCredit(place.image.attribution.label)}
              </span>
            ))}
          {place.attribution.url ? (
            <a
              className="directory-attribution"
              href={place.attribution.url}
              target="_blank"
              rel="noreferrer"
            >
              {place.attribution.label}
            </a>
          ) : (
            <span className="directory-attribution">
              {place.attribution.label}
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .explore-directory-card {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 3px 14px rgba(20, 24, 32, 0.04);
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        .explore-directory-card:hover {
          border-color: var(--border-2);
          box-shadow: 0 12px 28px rgba(20, 24, 32, 0.09);
          transform: translateY(-2px);
        }

        .directory-card-media {
          position: relative;
          min-height: 0;
          aspect-ratio: 16 / 10;
          display: grid;
          place-items: center;
          background: var(--surface-2);
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }

        .directory-card-media.no-image {
          aspect-ratio: 16 / 5;
          min-height: 148px;
        }

        .directory-card-media img {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .directory-card-media :global(.directory-category-artwork) {
          position: absolute;
          inset: 0;
        }

        .directory-card-content {
          min-width: 0;
          padding: 0.95rem;
          display: flex;
          flex-direction: column;
          gap: 0.48rem;
        }

        .directory-card-heading,
        .directory-card-footer,
        .directory-card-actions,
        .directory-location {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .directory-card-heading,
        .directory-card-footer {
          justify-content: space-between;
          align-items: flex-start;
        }

        .directory-card-heading h2 {
          margin: 0.15rem 0 0;
          font-size: 1.08rem;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .directory-card-heading h2 a {
          color: inherit;
          text-decoration: none;
        }

        .directory-card-heading h2 a:hover {
          color: var(--accent);
        }

        .directory-type,
        .directory-distance,
        .directory-booking-note,
        .directory-attribution {
          font-size: 0.72rem;
        }

        .directory-type {
          color: var(--success);
          font-weight: 700;
        }

        .directory-distance {
          flex: 0 0 auto;
          color: var(--text-muted);
        }

        .directory-category,
        .directory-description,
        .directory-location,
        .directory-booking-note,
        .directory-attribution {
          color: var(--text-muted);
        }

        .directory-description {
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .directory-location {
          min-width: 0;
          margin: 0;
          font-size: 0.82rem;
        }

        .directory-location span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .directory-card-footer {
          align-self: end;
          width: 100%;
          margin-top: auto;
          padding-top: 0.5rem;
          border-top: 1px solid var(--border);
        }

        .directory-card-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .directory-card-actions :global(.btn) {
          min-height: 44px;
          padding: 0.52rem 0.68rem;
          gap: 0.35rem;
          font-size: 0.76rem;
        }

        .directory-card-actions :global(.btn-accent) {
          background: var(--success);
          color: #ffffff;
        }

        .directory-credits {
          display: flex;
          flex-wrap: wrap;
          gap: 0.2rem 0.65rem;
          margin-top: 0.2rem;
          padding-top: 0.45rem;
          opacity: 0.78;
        }

        .directory-attribution {
          width: fit-content;
          text-decoration: none;
          font-size: 0.66rem;
          line-height: 1.35;
        }

        .directory-attribution[href]:hover {
          color: var(--text);
        }

        @media (max-width: 900px) {
          .directory-card-footer {
            display: grid;
            gap: 0.5rem;
            justify-content: stretch;
          }

          .directory-card-actions {
            flex-wrap: nowrap;
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .explore-directory-card {
            grid-template-rows: auto minmax(0, 1fr);
          }

          .directory-card-heading,
          .directory-card-footer {
            display: grid;
            gap: 0.4rem;
            justify-content: stretch;
          }

          .directory-card-actions {
            justify-content: flex-start;
          }

          .directory-card-actions :global(.btn) {
            min-height: 44px;
            padding: 0.5rem 0.62rem;
            font-size: 0.74rem;
          }

          .directory-card-content {
            gap: 0.35rem;
            padding: 0.85rem;
          }

          .directory-card-media.no-image {
            min-height: 0;
            aspect-ratio: 16 / 7;
          }

          .directory-attribution {
            font-size: 0.66rem;
            line-height: 1.35;
          }
        }
      `}</style>
    </article>
  );
}
