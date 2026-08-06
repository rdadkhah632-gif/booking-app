import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DirectoryCategoryArtwork from "@/components/explore/DirectoryCategoryArtwork";
import {
  directoryCategoryLabel,
  directoryImageCredit,
} from "@/components/explore/directoryCategories";
import type {
  DirectoryCategoryKey,
  DirectoryPlace,
} from "@/components/explore/exploreTypes";
import { useI18n } from "@/lib/useI18n";

const RELATED_PLACE_COUNT = 3;

type PlaceNearbyRailProps = {
  placeId: string;
  city?: string | null;
  categoryKey: DirectoryCategoryKey;
};

function uniquePlaces(
  currentPlaceId: string,
  groups: DirectoryPlace[][],
): DirectoryPlace[] {
  const seen = new Set([currentPlaceId]);
  const places: DirectoryPlace[] = [];

  for (const group of groups) {
    for (const place of group) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      places.push(place);
      if (places.length >= RELATED_PLACE_COUNT) return places;
    }
  }

  return places;
}

function NearbyPlaceCard({ place }: { place: DirectoryPlace }) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(place.image && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [place.image?.url]);

  return (
    <article className="nearby-place-card">
      <Link
        href={`/places/${place.id}`}
        className="nearby-place-media"
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

      <div className="nearby-place-copy">
        <span className="nearby-place-category">
          {directoryCategoryLabel(place.categoryKey, t)}
        </span>
        <h3>
          <Link href={`/places/${place.id}`}>{place.name}</Link>
        </h3>
        <p className="nearby-place-location">
          <MapPin size={14} aria-hidden="true" />
          <span>
            {[place.city, place.region].filter(Boolean).join(", ") ||
              t("directory.card.albania", "Albania")}
          </span>
        </p>
        {hasImage && place.image && (
          <p className="nearby-place-credit">
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

      <style jsx>{`
        .nearby-place-card {
          min-width: 0;
        }

        :global(.nearby-place-media) {
          position: relative;
          display: grid;
          width: 100%;
          aspect-ratio: 4 / 3;
          place-items: center;
          overflow: hidden;
          border-radius: 7px;
          background: var(--surface-2);
          color: inherit;
          text-decoration: none;
        }

        :global(.nearby-place-media:focus-visible) {
          outline: 3px solid var(--success);
          outline-offset: 3px;
        }

        .nearby-place-media :global(.directory-category-artwork) {
          position: absolute;
          inset: 0;
        }

        .nearby-place-media img {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.24s ease;
        }

        .nearby-place-media:hover img {
          transform: scale(1.025);
        }

        .nearby-place-copy {
          padding-top: 0.7rem;
        }

        .nearby-place-category {
          color: var(--success);
          font-size: 0.7rem;
          font-weight: 800;
        }

        .nearby-place-copy h3 {
          margin: 0.25rem 0 0;
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 820;
          line-height: 1.3;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .nearby-place-copy h3 a {
          color: var(--text);
          text-decoration: none;
        }

        .nearby-place-copy h3 a:hover {
          color: var(--success);
        }

        .nearby-place-location {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 0.35rem;
          margin: 0.35rem 0 0;
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .nearby-place-location :global(svg) {
          flex: 0 0 auto;
        }

        .nearby-place-location span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nearby-place-credit {
          margin: 0.38rem 0 0;
          color: var(--text-muted);
          font-size: 0.64rem;
          line-height: 1.35;
        }

        .nearby-place-credit a {
          color: inherit;
          text-decoration: none;
        }
      `}</style>
    </article>
  );
}

export default function PlaceNearbyRail({
  placeId,
  city,
  categoryKey,
}: PlaceNearbyRailProps) {
  const { locale, t } = useI18n();
  const [places, setPlaces] = useState<DirectoryPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function requestPlaces(params: URLSearchParams) {
      const response = await fetch(
        `/api/public/directory-places?${params.toString()}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) return [];
      const payload = (await response.json()) as { places?: DirectoryPlace[] };
      return payload.places || [];
    }

    async function loadRelatedPlaces() {
      setLoading(true);
      setPlaces([]);

      try {
        const primaryParams = new URLSearchParams({
          locale,
          limit: "8",
        });
        if (city) primaryParams.set("city", city);
        else primaryParams.set("category", categoryKey);

        const primary = await requestPlaces(primaryParams);
        let related = uniquePlaces(placeId, [primary]);

        if (related.length < RELATED_PLACE_COUNT && city) {
          const categoryParams = new URLSearchParams({
            locale,
            category: categoryKey,
            limit: "8",
          });
          const categoryPlaces = await requestPlaces(categoryParams);
          related = uniquePlaces(placeId, [primary, categoryPlaces]);
        }

        if (!controller.signal.aborted) setPlaces(related);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPlaces([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRelatedPlaces();
    return () => controller.abort();
  }, [categoryKey, city, locale, placeId]);

  const viewAllHref = useMemo(() => {
    const params = new URLSearchParams({ kind: "places" });
    if (city) params.set("city", city);
    else params.set("category", categoryKey);
    return `/explore?${params.toString()}`;
  }, [categoryKey, city]);

  const attributions = useMemo(() => {
    const seen = new Set<string>();
    return places
      .map((place) => place.attribution)
      .filter((attribution) => {
        const key = `${attribution.label}:${attribution.url || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [places]);

  if (!loading && places.length === 0) return null;

  const title = city
    ? t("directory.related.titleCity", "More in {city}").replace("{city}", city)
    : t("directory.related.title", "More places to explore");

  return (
    <section className="place-nearby" aria-labelledby="place-nearby-title">
      <header className="place-nearby-header">
        <div>
          <h2 id="place-nearby-title">{title}</h2>
          <p>
            {t(
              "directory.related.body",
              "Continue discovering reviewed local places across Albania.",
            )}
          </p>
        </div>
        <Link href={viewAllHref} className="place-nearby-all">
          {t("directory.related.viewAll", "View all")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      {loading ? (
        <div
          className="place-nearby-grid place-nearby-loading"
          aria-label={t("directory.related.loading", "Loading more places")}
        >
          {Array.from({ length: RELATED_PLACE_COUNT }, (_, index) => (
            <div key={index} aria-hidden="true">
              <span />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="place-nearby-grid">
            {places.map((relatedPlace) => (
              <NearbyPlaceCard key={relatedPlace.id} place={relatedPlace} />
            ))}
          </div>
          {attributions.length > 0 && (
            <p className="place-nearby-attribution">
              <span>{t("directory.profile.source", "Place data")}</span>
              {attributions.map((attribution, index) => (
                <span key={`${attribution.label}:${attribution.url || index}`}>
                  {index > 0 ? " · " : " "}
                  {attribution.url ? (
                    <a href={attribution.url} target="_blank" rel="noreferrer">
                      {attribution.label}
                    </a>
                  ) : (
                    attribution.label
                  )}
                </span>
              ))}
            </p>
          )}
        </>
      )}

      <style jsx>{`
        .place-nearby {
          padding: 2.35rem 0 2.7rem;
          border-top: 1px solid var(--border);
        }

        .place-nearby-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 1.5rem;
          margin-bottom: 1.2rem;
        }

        .place-nearby-header h2,
        .place-nearby-header p {
          margin: 0;
        }

        .place-nearby-header h2 {
          font-family: var(--font-body);
          font-size: 1.45rem;
          font-weight: 820;
          letter-spacing: 0;
        }

        .place-nearby-header p {
          margin-top: 0.35rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        :global(.place-nearby-all) {
          min-height: 44px;
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 0.35rem;
          color: var(--text);
          font-weight: 800;
          text-decoration: none;
        }

        :global(.place-nearby-all:hover) {
          color: var(--success);
        }

        .place-nearby-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .place-nearby-loading > div {
          display: grid;
          gap: 0.55rem;
        }

        .place-nearby-loading span,
        .place-nearby-loading i {
          display: block;
          border-radius: 6px;
          background: var(--surface-2);
        }

        .place-nearby-loading span {
          aspect-ratio: 4 / 3;
        }

        .place-nearby-loading i {
          width: 70%;
          height: 12px;
        }

        .place-nearby-loading i:last-child {
          width: 45%;
        }

        .place-nearby-attribution {
          margin: 1rem 0 0;
          color: var(--text-muted);
          font-size: 0.68rem;
          line-height: 1.45;
        }

        .place-nearby-attribution a {
          color: inherit;
          text-underline-offset: 2px;
        }

        @media (max-width: 720px) {
          .place-nearby-header {
            display: grid;
            gap: 0.6rem;
          }

          .place-nearby-grid {
            width: calc(100% + var(--content-pad));
            display: flex;
            gap: 0.9rem;
            overflow-x: auto;
            padding-right: var(--content-pad);
            padding-bottom: 0.35rem;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }

          .place-nearby-grid::-webkit-scrollbar {
            display: none;
          }

          .place-nearby-grid :global(.nearby-place-card),
          .place-nearby-loading > div {
            width: min(78vw, 300px);
            flex: 0 0 auto;
            scroll-snap-align: start;
          }
        }
      `}</style>
    </section>
  );
}
