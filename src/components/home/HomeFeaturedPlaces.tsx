import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DirectoryCategoryArtwork from "@/components/explore/DirectoryCategoryArtwork";
import {
  directoryCategoryLabel,
  directoryImageCredit,
} from "@/components/explore/directoryCategories";
import type { DirectoryPlace } from "@/components/explore/exploreTypes";
import { useI18n } from "@/lib/useI18n";

const FEATURED_PLACE_COUNT = 6;

function selectFeaturedPlaces(places: DirectoryPlace[]) {
  const remaining = [...places].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const selected: DirectoryPlace[] = [];
  const cityCounts = new Map<string, number>();
  const usedCategories = new Set<string>();

  while (remaining.length > 0 && selected.length < FEATURED_PLACE_COUNT) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    remaining.forEach((place, index) => {
      const city = place.city?.trim().toLocaleLowerCase() || "";
      const cityCount = cityCounts.get(city) || 0;
      const score =
        (place.image ? 100 : 0) +
        (cityCount === 0 ? 18 : 0) +
        (usedCategories.has(place.categoryKey) ? 0 : 9) -
        cityCount * 12;

      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    });

    const [place] = remaining.splice(bestIndex, 1);
    selected.push(place);
    const city = place.city?.trim().toLocaleLowerCase() || "";
    cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    usedCategories.add(place.categoryKey);
  }

  return selected;
}

function FeaturedPlaceCard({ place }: { place: DirectoryPlace }) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(place.image && !imageFailed);
  const location = [place.city, place.region].filter(Boolean).join(", ");

  useEffect(() => {
    setImageFailed(false);
  }, [place.image?.url]);

  return (
    <article className="home-featured-card">
      <Link
        href={`/places/${place.id}`}
        className="home-featured-media"
        aria-label={place.name}
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
      </Link>

      <div className="home-featured-copy">
        <div className="home-featured-meta">
          <span>{t("directory.card.type", "Local place")}</span>
          <span aria-hidden="true">·</span>
          <span>{directoryCategoryLabel(place.categoryKey, t)}</span>
        </div>
        <h3>
          <Link href={`/places/${place.id}`}>{place.name}</Link>
        </h3>
        <p className="home-featured-location">
          <MapPin size={15} aria-hidden="true" />
          <span>{location || t("directory.card.albania", "Albania")}</span>
        </p>
        {hasImage && place.image && (
          <p className="home-featured-credit">
            {place.image.attribution.url ? (
              <a
                href={place.image.attribution.url}
                target="_blank"
                rel="noreferrer"
              >
                {t("directory.card.photo", "Photo")}:{" "}
                {directoryImageCredit(place.image.attribution.label)}
              </a>
            ) : (
              <span>
                {t("directory.card.photo", "Photo")}:{" "}
                {directoryImageCredit(place.image.attribution.label)}
              </span>
            )}
          </p>
        )}
      </div>

      <style jsx global>{`
        .home-featured-card {
          min-width: 0;
        }

        .home-featured-media {
          position: relative;
          display: grid;
          width: 100%;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          border-radius: 7px;
          background: #e8ecee;
          color: inherit;
          text-decoration: none;
        }

        .home-featured-media :global(.directory-category-artwork) {
          position: absolute;
          inset: 0;
        }

        .home-featured-media img {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.24s ease;
        }

        .home-featured-media:hover img {
          transform: scale(1.025);
        }

        .home-featured-copy {
          padding-top: 0.8rem;
        }

        .home-featured-meta {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          min-width: 0;
          color: #687079;
          font-size: 0.72rem;
          font-weight: 750;
        }

        .home-featured-meta span:last-child {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        h3 {
          margin: 0.3rem 0 0;
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.3;
          letter-spacing: 0;
        }

        h3 a {
          color: #18191c;
          text-decoration: none;
        }

        h3 a:hover {
          color: #c9471c;
        }

        .home-featured-location {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
          margin: 0.35rem 0 0;
          color: #5d646d;
          font-size: 0.8rem;
        }

        .home-featured-location :global(svg) {
          flex: 0 0 auto;
        }

        .home-featured-location span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .home-featured-credit {
          margin: 0.42rem 0 0;
          color: #7a8088;
          font-size: 0.66rem;
          line-height: 1.35;
        }

        .home-featured-credit a {
          color: inherit;
          text-decoration: none;
        }

        .home-featured-credit a:hover {
          color: #3f454d;
          text-decoration: underline;
        }
      `}</style>
    </article>
  );
}

export default function HomeFeaturedPlaces() {
  const { locale, t } = useI18n();
  const [places, setPlaces] = useState<DirectoryPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const featuredPlaces = useMemo(() => selectFeaturedPlaces(places), [places]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPlaces() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/public/directory-places?limit=100&locale=${locale}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          places?: DirectoryPlace[];
        };

        if (!response.ok) throw new Error("Directory request failed");
        setPlaces(payload.places || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPlaces([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPlaces();
    return () => controller.abort();
  }, [locale]);

  if (!loading && featuredPlaces.length === 0) return null;

  return (
    <section className="home-featured-band">
      <div className="container">
        <header className="home-featured-heading">
          <div>
            <span>{t("home.featured.kicker", "Across Albania")}</span>
            <h2>{t("home.featured.title", "Places worth a closer look")}</h2>
            <p>
              {t(
                "home.featured.body",
                "Discover services, activities and local favourites in cities across the country.",
              )}
            </p>
          </div>
          <Link href="/explore?kind=places" className="home-featured-link">
            {t("home.featured.viewAll", "Explore all places")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </header>

        {loading ? (
          <div
            className="home-featured-grid home-featured-loading"
            aria-label={t("home.featured.loading", "Loading local places")}
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} aria-hidden="true">
                <span />
                <i />
                <i />
              </div>
            ))}
          </div>
        ) : (
          <div className="home-featured-grid">
            {featuredPlaces.map((place) => (
              <FeaturedPlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .home-featured-band {
          padding: 3.5rem 0 3.8rem;
          border-top: 1px solid #e5e7e9;
          background: #f7f8f8;
          color: #18191c;
        }

        .home-featured-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          margin-bottom: 1.5rem;
        }

        .home-featured-heading > div {
          max-width: 680px;
        }

        .home-featured-heading span {
          color: #c9471c;
          font-size: 0.76rem;
          font-weight: 850;
          text-transform: uppercase;
        }

        .home-featured-heading h2 {
          margin: 0.25rem 0 0;
          font-family: var(--font-body);
          font-size: 1.9rem;
          font-weight: 750;
          line-height: 1.15;
          letter-spacing: 0;
        }

        .home-featured-heading p {
          max-width: 62ch;
          margin: 0.55rem 0 0;
          color: #5d646d;
          line-height: 1.55;
        }

        :global(.home-featured-link) {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 44px;
          flex: 0 0 auto;
          color: #18191c;
          font-weight: 800;
          text-decoration: none;
        }

        :global(.home-featured-link:hover) {
          color: #c9471c;
        }

        .home-featured-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 2rem 1.15rem;
        }

        .home-featured-loading > div {
          display: grid;
          gap: 0.6rem;
        }

        .home-featured-loading span,
        .home-featured-loading i {
          display: block;
          border-radius: 6px;
          background: #e7eaeb;
        }

        .home-featured-loading span {
          aspect-ratio: 4 / 3;
        }

        .home-featured-loading i {
          width: 72%;
          height: 13px;
        }

        .home-featured-loading i:last-child {
          width: 44%;
        }

        @media (max-width: 900px) {
          .home-featured-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .home-featured-band {
            padding: 2.7rem 0 3rem;
          }

          .home-featured-heading {
            display: grid;
            gap: 0.8rem;
            margin-bottom: 1.2rem;
          }

          .home-featured-heading h2 {
            font-size: 1.65rem;
          }

          .home-featured-grid {
            width: calc(100% + var(--content-pad));
            display: flex;
            gap: 0.9rem;
            overflow-x: auto;
            padding-right: var(--content-pad);
            padding-bottom: 0.35rem;
            scroll-padding-left: 0;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }

          .home-featured-grid::-webkit-scrollbar {
            display: none;
          }

          .home-featured-grid :global(.home-featured-card) {
            width: min(82vw, 310px);
            flex: 0 0 auto;
            scroll-snap-align: start;
          }

          .home-featured-loading > div {
            width: min(82vw, 310px);
            flex: 0 0 auto;
          }
        }
      `}</style>
    </section>
  );
}
