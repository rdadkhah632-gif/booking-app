import {
  Activity,
  BedDouble,
  Bike,
  Building2,
  Dumbbell,
  ExternalLink,
  Flag,
  GraduationCap,
  Landmark,
  MapPin,
  Scissors,
  Stethoscope,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { directoryCategoryLabel } from "./directoryCategories";
import { DirectoryCategoryKey, DirectoryPlace } from "./exploreTypes";

type Props = {
  place: DirectoryPlace;
  onShowOnMap: (placeId: string) => void;
};

const CATEGORY_ICONS: Record<DirectoryCategoryKey, LucideIcon> = {
  beauty_grooming: Scissors,
  dental_health: Stethoscope,
  wellness_fitness: Dumbbell,
  events: Ticket,
  learning_lessons: GraduationCap,
  tours_activities: Bike,
  rentals: Building2,
  attractions: Landmark,
  food_drink: Utensils,
  lodging: BedDouble,
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
  const CategoryIcon = CATEGORY_ICONS[place.categoryKey] || Activity;
  const location = [place.city, place.region].filter(Boolean).join(", ");
  const distance = distanceLabel(place.distanceMeters, t);

  return (
    <article className="explore-directory-card">
      <div className="directory-card-icon" aria-hidden="true">
        <CategoryIcon size={28} strokeWidth={1.8} />
      </div>
      <div className="directory-card-content">
        <div className="directory-card-heading">
          <div>
            <span className="directory-type">
              {t("directory.card.type", "Local place")}
            </span>
            <h2>{place.name}</h2>
          </div>
          {distance && <span className="directory-distance">{distance}</span>}
        </div>

        <p className="directory-category">
          {directoryCategoryLabel(place.categoryKey, t)}
        </p>
        <p className="directory-location">
          <MapPin size={15} aria-hidden="true" />
          <span>{location || t("directory.card.albania", "Albania")}</span>
        </p>

        <div className="directory-card-footer">
          <span className="directory-booking-note">
            {t("directory.card.notBookable", "Not bookable on Mirëbook yet")}
          </span>
          <div className="directory-card-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onShowOnMap(place.id)}
            >
              <MapPin size={16} aria-hidden="true" />
              {t("directory.card.showMap", "Map")}
            </button>
            {place.website && (
              <a
                href={place.website}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
              >
                <ExternalLink size={16} aria-hidden="true" />
                {t("directory.card.website", "Website")}
              </a>
            )}
            <Link
              href={{
                pathname: "/support/customer",
                query: { reportPlace: place.name, placeId: place.id },
              }}
              className="btn btn-ghost"
            >
              <Flag size={16} aria-hidden="true" />
              {t("directory.card.report", "Report")}
            </Link>
          </div>
        </div>

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

      <style jsx>{`
        .explore-directory-card {
          min-width: 0;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface);
        }

        .directory-card-icon {
          min-height: 164px;
          display: grid;
          place-items: center;
          color: var(--success);
          background:
            linear-gradient(145deg, rgba(45, 212, 191, 0.15), transparent),
            var(--surface-2);
          border-right: 1px solid var(--border);
        }

        .directory-card-content {
          min-width: 0;
          padding: 0.8rem;
          display: grid;
          align-content: start;
          gap: 0.42rem;
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
          font-size: 1rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
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
          text-transform: uppercase;
        }

        .directory-distance {
          flex: 0 0 auto;
          color: var(--text-muted);
        }

        .directory-category,
        .directory-location,
        .directory-booking-note,
        .directory-attribution {
          color: var(--text-muted);
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
          margin-top: 0.15rem;
        }

        .directory-card-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .directory-card-actions :global(.btn) {
          min-height: 34px;
          padding: 0.42rem 0.6rem;
          gap: 0.35rem;
          font-size: 0.76rem;
        }

        .directory-attribution {
          width: fit-content;
          margin-top: 0.05rem;
          text-decoration: none;
        }

        .directory-attribution[href]:hover {
          color: var(--text);
        }

        @media (max-width: 640px) {
          .explore-directory-card {
            grid-template-columns: 64px minmax(0, 1fr);
          }

          .directory-card-icon {
            min-height: 0;
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
            min-height: 32px;
            padding: 0.38rem 0.5rem;
            font-size: 0.72rem;
          }

          .directory-card-content {
            gap: 0.35rem;
            padding: 0.7rem;
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
