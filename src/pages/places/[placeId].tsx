import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Phone,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";
import DirectoryCategoryArtwork from "@/components/explore/DirectoryCategoryArtwork";
import PlaceNearbyRail from "@/components/places/PlaceNearbyRail";
import PlaceShareAction from "@/components/places/PlaceShareAction";
import {
  directoryCategoryLabel,
  directoryImageCredit,
} from "@/components/explore/directoryCategories";
import type { DirectoryCategoryKey } from "@/components/explore/exploreTypes";
import { getBusinessAppUrl, getCustomerAppUrl } from "@/lib/appUrls";
import { recordSiteEvent } from "@/lib/siteAnalytics";
import type { PublicDirectoryPlace } from "@/lib/server/publicDirectoryPlace";
import { useI18n } from "@/lib/useI18n";

type PlaceDetail = PublicDirectoryPlace & {
  categoryKey: DirectoryCategoryKey;
};

type DirectoryPlacePageProps = {
  initialPlaceId: string;
  initialPlace: PlaceDetail | null;
  initialLocale: "en" | "sq";
  initialNotFound: boolean;
  initialUnavailable: boolean;
  canonicalUrl: string;
};

function absoluteCustomerUrl(path: string) {
  const configured = getCustomerAppUrl(path);
  return configured.startsWith("http")
    ? configured
    : `https://mirebook.com${configured}`;
}

function metaDescription(place: PlaceDetail | null, fallback: string) {
  const source = place?.description?.trim() || fallback;
  if (source.length <= 180) return source;
  return `${source.slice(0, 177).trimEnd()}...`;
}

export default function DirectoryPlacePage({
  initialPlaceId,
  initialPlace,
  initialLocale,
  initialNotFound,
  initialUnavailable,
  canonicalUrl,
}: DirectoryPlacePageProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const serverStateKey = `${initialPlaceId}:${initialLocale}`;
  const [place, setPlace] = useState<PlaceDetail | null>(initialPlace);
  const [loadedKey, setLoadedKey] = useState(serverStateKey);
  const [loading, setLoading] = useState(
    !initialPlace && !initialNotFound && !initialUnavailable,
  );
  const [notFound, setNotFound] = useState(initialNotFound);
  const [unavailable, setUnavailable] = useState(initialUnavailable);
  const [bookingBusinessId, setBookingBusinessId] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const trackedPlaceView = useRef("");

  useEffect(() => {
    setPlace(initialPlace);
    setLoadedKey(serverStateKey);
    setLoading(!initialPlace && !initialNotFound && !initialUnavailable);
    setNotFound(initialNotFound);
    setUnavailable(initialUnavailable);
    setBookingBusinessId("");
    setImageFailed(false);
  }, [initialNotFound, initialPlace, initialUnavailable, serverStateKey]);

  useEffect(() => {
    if (!router.isReady || typeof router.query.placeId !== "string") return;
    const requestKey = `${router.query.placeId}:${locale}`;
    if (serverStateKey === requestKey) return;
    if (loadedKey === requestKey) return;
    let cancelled = false;

    async function loadPlace() {
      if (!place || place.id !== router.query.placeId) {
        setPlace(null);
        setLoading(true);
      }
      setNotFound(false);
      setUnavailable(false);
      setBookingBusinessId("");
      setImageFailed(false);
      try {
        const response = await fetch(
          `/api/public/directory-place?id=${encodeURIComponent(String(router.query.placeId))}&locale=${locale}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          if (!cancelled) {
            setPlace(null);
            setNotFound(response.status === 404);
            setUnavailable(response.status !== 404);
            setLoadedKey(requestKey);
          }
          return;
        }
        const payload = (await response.json()) as { place?: PlaceDetail };
        if (cancelled) return;

        const nextPlace = payload.place || null;
        if (nextPlace?.bookable && nextPlace.bookingBusinessId) {
          setPlace(null);
          setBookingBusinessId(nextPlace.bookingBusinessId);
          setLoading(false);
          void router.replace(`/explore/${nextPlace.bookingBusinessId}`);
          return;
        }
        setPlace(nextPlace as PlaceDetail | null);
        setLoadedKey(requestKey);
      } catch {
        if (!cancelled) {
          setPlace(null);
          setUnavailable(true);
          setLoadedKey(requestKey);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlace();
    return () => {
      cancelled = true;
    };
  }, [
    loadedKey,
    locale,
    place,
    router.isReady,
    router.query.placeId,
    serverStateKey,
  ]);

  const location = place
    ? [place.address, place.city, place.region, place.postcode]
        .filter(Boolean)
        .join(", ")
    : "";
  const directionsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [place.name, location, place.countryCode].filter(Boolean).join(", "),
      )}`
    : "#";
  const claimUrl = place
    ? getBusinessAppUrl(`/claim/${encodeURIComponent(place.id)}`)
    : getBusinessAppUrl();
  const fallbackMetaDescription = place
    ? t(
        "directory.profile.metaDescription",
        "Explore {name}, contact the place and get directions with Mirëbook.",
      ).replace("{name}", place.name)
    : t(
        "directory.profile.metaDescriptionFallback",
        "Explore reviewed local places across Albania with Mirëbook.",
      );
  const pageDescription = metaDescription(place, fallbackMetaDescription);

  useEffect(() => {
    if (!place?.id || trackedPlaceView.current === place.id) return;
    trackedPlaceView.current = place.id;
    recordSiteEvent("place_viewed", {
      locale,
      entityType: "directory_place",
      entityId: place.id,
      metadata: {
        surface: "place",
        city: place.city || null,
        category: place.categoryKey,
      },
    });
  }, [locale, place?.categoryKey, place?.city, place?.id]);

  return (
    <main className="marketplace-surface place-page">
      <MarketplaceSurfaceStyles />
      <Head>
        <title>
          {place
            ? `${place.name} | Mirëbook`
            : t("directory.profile.metaTitle", "Local place | Mirëbook")}
        </title>
        {place ? (
          <>
            <meta
              key="description"
              name="description"
              content={pageDescription}
            />
            <link key="canonical" rel="canonical" href={canonicalUrl} />
            <meta
              key="og-title"
              property="og:title"
              content={`${place.name} | Mirëbook`}
            />
            <meta
              key="og-description"
              property="og:description"
              content={pageDescription}
            />
            <meta key="og-url" property="og:url" content={canonicalUrl} />
            <meta
              key="og-locale"
              property="og:locale"
              content={locale === "sq" ? "sq_AL" : "en_GB"}
            />
            {place.image && (
              <meta
                key="og-image"
                property="og:image"
                content={place.image.url}
              />
            )}
            {place.image && (
              <meta
                key="og-image-alt"
                property="og:image:alt"
                content={place.image.alt}
              />
            )}
            <meta
              key="twitter-card"
              name="twitter:card"
              content={place.image ? "summary_large_image" : "summary"}
            />
            <meta
              key="twitter-title"
              name="twitter:title"
              content={`${place.name} | Mirëbook`}
            />
            <meta
              key="twitter-description"
              name="twitter:description"
              content={pageDescription}
            />
            {place.image && (
              <meta
                key="twitter-image"
                name="twitter:image"
                content={place.image.url}
              />
            )}
          </>
        ) : (
          <meta key="robots" name="robots" content="noindex, nofollow" />
        )}
      </Head>
      <AuthNav />

      <section className="container place-shell">
        <Link href="/explore" className="place-back">
          <ArrowLeft size={17} aria-hidden="true" />
          {t("directory.profile.back", "Back to Explore")}
        </Link>

        {bookingBusinessId ? (
          <div className="place-state" role="status">
            <Building2 size={30} aria-hidden="true" />
            <h1>
              {t(
                "directory.profile.handoffTitle",
                "This business is ready to book",
              )}
            </h1>
            <p>
              {t(
                "directory.profile.handoffBody",
                "Opening its live Mirëbook profile with services and available times.",
              )}
            </p>
            <Link
              href={`/explore/${bookingBusinessId}`}
              className="btn btn-accent"
            >
              {t("directory.profile.handoffAction", "View services and book")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : loading ? (
          <div className="place-state">
            {t("directory.profile.loading", "Loading place details...")}
          </div>
        ) : unavailable ? (
          <div className="place-state" role="status">
            <Building2 size={30} aria-hidden="true" />
            <h1>
              {t(
                "directory.profile.unavailable",
                "Place details are temporarily unavailable",
              )}
            </h1>
            <p>
              {t(
                "directory.profile.unavailableBody",
                "Try again in a moment or return to Explore.",
              )}
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.location.reload()}
            >
              {t("common.retry", "Retry")}
            </button>
          </div>
        ) : notFound || !place ? (
          <div className="place-state">
            <Building2 size={30} aria-hidden="true" />
            <h1>{t("directory.profile.notFound", "Place not found")}</h1>
            <p>
              {t(
                "directory.profile.notFoundBody",
                "This place is no longer available in Mirëbook discovery.",
              )}
            </p>
          </div>
        ) : (
          <>
            <header className="place-header">
              <div className="place-heading">
                <div className="place-eyebrow">
                  <span className="place-type">
                    {t("directory.card.type", "Local place")}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="place-category">
                    {directoryCategoryLabel(place.categoryKey, t)}
                  </span>
                </div>
                <h1>{place.name}</h1>
                <p className="place-heading-location">
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    {[place.city, place.region].filter(Boolean).join(", ") ||
                      t("directory.card.albania", "Albania")}
                  </span>
                </p>
              </div>
              <span className="place-status">
                {t(
                  "directory.card.notBookable",
                  "Not bookable on Mirëbook yet",
                )}
              </span>
            </header>

            <figure
              className={`place-media ${place.image && !imageFailed ? "has-image" : "no-image"}`}
            >
              {place.image && !imageFailed ? (
                <>
                  <img
                    src={place.image.url}
                    alt={place.image.alt}
                    decoding="async"
                    onError={() => setImageFailed(true)}
                  />
                  <figcaption>
                    {t("directory.card.photo", "Photo")}:{" "}
                    {place.image.attribution.url ? (
                      <a
                        href={place.image.attribution.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {directoryImageCredit(place.image.attribution.label)}
                      </a>
                    ) : (
                      directoryImageCredit(place.image.attribution.label)
                    )}
                  </figcaption>
                </>
              ) : (
                <DirectoryCategoryArtwork
                  category={place.categoryKey}
                  size={58}
                />
              )}
            </figure>

            <div className="place-grid">
              <section className="place-main">
                <h2 className="place-section-title">
                  {t("directory.profile.about", "About this place")}
                </h2>
                {place.description && (
                  <p className="place-description">{place.description}</p>
                )}

                <h2 className="place-section-title place-contact-title">
                  {t(
                    "directory.profile.contactLocation",
                    "Contact and location",
                  )}
                </h2>
                <dl className="place-facts">
                  <div>
                    <dt>
                      <MapPin size={18} aria-hidden="true" />
                      <span>{t("directory.profile.address", "Address")}</span>
                    </dt>
                    <dd>
                      {location || t("directory.card.albania", "Albania")}
                    </dd>
                  </div>
                  {place.phone && (
                    <div>
                      <dt>
                        <Phone size={18} aria-hidden="true" />
                        <span>{t("directory.profile.phone", "Phone")}</span>
                      </dt>
                      <dd>
                        <a href={`tel:${place.phone}`}>{place.phone}</a>
                      </dd>
                    </div>
                  )}
                  {place.website && (
                    <div>
                      <dt>
                        <Globe size={18} aria-hidden="true" />
                        <span>{t("directory.card.website", "Website")}</span>
                      </dt>
                      <dd>
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() =>
                            recordSiteEvent("place_website_opened", {
                              locale,
                              entityType: "directory_place",
                              entityId: place.id,
                              metadata: { surface: "place" },
                            })
                          }
                        >
                          {t("directory.card.website", "Website")}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="place-actions">
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn place-directions-action"
                    onClick={() =>
                      recordSiteEvent("place_directions_opened", {
                        locale,
                        entityType: "directory_place",
                        entityId: place.id,
                        metadata: { surface: "place" },
                      })
                    }
                  >
                    <MapPin size={17} aria-hidden="true" />
                    {t("directory.profile.directions", "Get directions")}
                  </a>
                  <Link
                    href={{
                      pathname: "/support/customer",
                      query: { reportPlace: place.name, placeId: place.id },
                    }}
                    className="btn btn-ghost"
                  >
                    <Flag size={17} aria-hidden="true" />
                    {t("directory.card.report", "Report")}
                  </Link>
                  <PlaceShareAction
                    name={place.name}
                    description={place.description}
                    url={canonicalUrl}
                  />
                </div>
              </section>

              <aside className="place-owner-panel">
                <span className="place-owner-icon" aria-hidden="true">
                  <Building2 size={22} />
                </span>
                <h2>
                  {place.claimable
                    ? t(
                        "directory.profile.ownerTitle",
                        "Is this your business?",
                      )
                    : t("directory.profile.claimedTitle", "Ownership recorded")}
                </h2>
                <p>
                  {place.claimable
                    ? t(
                        "directory.profile.ownerBody",
                        "Claim this listing with a Mirëbook Business account. Mirëbook reviews every request before linking it.",
                      )
                    : t(
                        "directory.profile.claimedBody",
                        "This listing already has an ownership record. Booking remains unavailable until its Mirëbook business profile is ready and published.",
                      )}
                </p>
                {place.claimable && (
                  <a
                    href={claimUrl}
                    className="btn btn-ghost"
                    onClick={() =>
                      recordSiteEvent("place_claim_opened", {
                        locale,
                        entityType: "directory_place",
                        entityId: place.id,
                        metadata: { surface: "place" },
                      })
                    }
                  >
                    {t("directory.profile.claim", "Claim this place")}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </aside>
            </div>

            <PlaceNearbyRail
              placeId={place.id}
              city={place.city}
              categoryKey={place.categoryKey}
            />

            <footer className="place-attribution">
              <span>{t("directory.profile.source", "Place data")}</span>
              {place.attribution.url ? (
                <a
                  href={place.attribution.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {place.attribution.label}
                </a>
              ) : (
                <span>{place.attribution.label}</span>
              )}
            </footer>
          </>
        )}
      </section>

      <style jsx>{`
        .place-shell {
          max-width: 1240px;
          padding-top: 1.5rem;
          padding-bottom: 5rem;
        }

        .place-back {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          color: var(--text-muted);
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
        }

        .place-back:hover {
          color: var(--success);
        }

        .place-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
          padding-bottom: 1.5rem;
        }

        .place-header h1 {
          max-width: 24ch;
          margin: 0.4rem 0 0.55rem;
          font-family: var(--font-body);
          font-size: clamp(2.15rem, 4.4vw, 3.35rem);
          font-weight: 850;
          line-height: 1.05;
          letter-spacing: 0;
        }

        .place-eyebrow,
        .place-heading-location {
          display: flex;
          align-items: center;
        }

        .place-eyebrow {
          gap: 0.4rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 750;
        }

        .place-type {
          color: var(--success);
          font-weight: 850;
          text-transform: uppercase;
        }

        .place-category,
        .place-status,
        .place-description,
        .place-owner-panel p,
        .place-attribution {
          color: var(--text-muted);
        }

        .place-category {
          color: var(--text-muted);
        }

        .place-heading-location {
          gap: 0.4rem;
          margin: 0;
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .place-heading-location :global(svg) {
          flex: 0 0 auto;
          color: var(--success);
        }

        .place-status {
          max-width: 18rem;
          padding: 0.55rem 0.75rem;
          border: 1px solid rgba(20, 125, 112, 0.22);
          border-radius: 6px;
          background: var(--success-dim);
          color: var(--success);
          font-size: 0.78rem;
          font-weight: 800;
          text-align: center;
        }

        .place-media {
          position: relative;
          overflow: hidden;
          margin: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .place-media img {
          display: block;
          width: 100%;
          max-height: 470px;
          aspect-ratio: 16 / 6.4;
          object-fit: cover;
        }

        .place-media.no-image {
          height: 320px;
        }

        .place-media.no-image :global(.directory-category-artwork span) {
          width: 5.5rem;
          height: 5.5rem;
        }

        .place-media figcaption {
          position: absolute;
          right: 0.75rem;
          bottom: 0.75rem;
          max-width: calc(100% - 1.5rem);
          padding: 0.35rem 0.5rem;
          border-radius: 4px;
          background: rgba(20, 22, 25, 0.82);
          color: #fff;
          font-size: 0.68rem;
          backdrop-filter: blur(8px);
        }

        .place-media figcaption a {
          color: inherit;
        }

        .place-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(290px, 0.68fr);
          gap: clamp(2.25rem, 5vw, 4.25rem);
          padding: 2.4rem 0 2.75rem;
        }

        .place-main {
          min-width: 0;
        }

        .place-section-title {
          margin: 0 0 0.7rem;
          font-family: var(--font-body);
          font-size: 1.2rem;
          font-weight: 820;
          letter-spacing: 0;
        }

        .place-contact-title {
          margin-top: 2rem;
        }

        .place-description {
          max-width: 68ch;
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.7;
        }

        .place-facts {
          display: grid;
          gap: 0;
          margin: 0;
          border-top: 1px solid var(--border);
        }

        .place-facts div {
          display: grid;
          grid-template-columns: minmax(125px, 0.38fr) minmax(0, 1fr);
          gap: 1rem;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }

        .place-facts dt {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 800;
        }

        .place-facts dt :global(svg) {
          color: var(--success);
        }

        .place-facts dd {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .place-facts a {
          color: var(--text);
          font-weight: 700;
        }

        .place-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          margin-top: 1.5rem;
        }

        .place-actions :global(.btn),
        .place-owner-panel :global(.btn) {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          gap: 0.45rem;
        }

        .place-actions :global(.place-directions-action) {
          border: 1px solid var(--success);
          background: var(--success);
          color: #ffffff;
        }

        .place-actions :global(.place-directions-action:hover) {
          border-color: #0f685e;
          background: #0f685e;
        }

        .place-owner-panel {
          position: sticky;
          top: 96px;
          align-self: start;
          padding: 1.35rem;
          border: 1px solid rgba(237, 90, 42, 0.28);
          border-radius: 8px;
          background: var(--surface);
        }

        .place-owner-icon {
          display: grid;
          width: 2.75rem;
          height: 2.75rem;
          place-items: center;
          border-radius: 8px;
          background: var(--accent-dim);
          color: var(--accent);
        }

        .place-owner-panel h2 {
          margin: 0.8rem 0 0.5rem;
          font-family: var(--font-body);
          font-size: 1.15rem;
        }

        .place-owner-panel p {
          margin: 0 0 1rem;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .place-owner-panel :global(.btn-ghost) {
          border-color: rgba(237, 90, 42, 0.28);
          color: #c9471c;
        }

        .place-attribution {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
          font-size: 0.75rem;
        }

        .place-attribution a {
          color: var(--text-muted);
        }

        .place-state {
          display: grid;
          min-height: 52vh;
          place-content: center;
          justify-items: center;
          gap: 0.75rem;
          color: var(--text-muted);
          text-align: center;
        }

        .place-state h1,
        .place-state p {
          margin: 0;
        }

        .place-state h1 {
          font-family: var(--font-body);
        }

        @media (max-width: 720px) {
          .place-shell {
            padding-top: 0.9rem;
          }

          .place-back {
            margin-bottom: 0.75rem;
          }

          .place-header,
          .place-grid {
            display: grid;
          }

          .place-header {
            gap: 0.8rem;
            padding-bottom: 1rem;
          }

          .place-status {
            width: fit-content;
          }

          .place-grid {
            grid-template-columns: 1fr;
            gap: 1.75rem;
            padding-top: 1.5rem;
          }

          .place-header h1 {
            font-size: 2.2rem;
          }

          .place-media img {
            aspect-ratio: 4 / 3;
          }

          .place-media.no-image {
            height: 220px;
          }

          .place-owner-panel {
            position: static;
          }

          .place-facts div {
            grid-template-columns: 1fr;
            gap: 0.4rem;
          }

          .place-actions :global(.btn) {
            flex: 1 1 140px;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<
  DirectoryPlacePageProps
> = async (context) => {
  context.res.setHeader("Cache-Control", "private, no-store");

  const placeId = Array.isArray(context.params?.placeId)
    ? context.params?.placeId[0] || ""
    : context.params?.placeId || "";
  const queryLocale = Array.isArray(context.query.locale)
    ? context.query.locale[0]
    : context.query.locale;
  const browserLanguages = String(
    context.req.headers["accept-language"] || "",
  ).toLowerCase();
  const initialLocale: "en" | "sq" =
    queryLocale === "sq" || (!queryLocale && browserLanguages.includes("sq"))
      ? "sq"
      : "en";
  const canonicalUrl = absoluteCustomerUrl(
    `/places/${encodeURIComponent(placeId)}`,
  );

  const {
    getPublicDirectoryPlace,
    isPublicDirectoryPlaceId,
    PublicDirectoryUnavailableError,
  } = await import("@/lib/server/publicDirectoryPlace");

  if (!isPublicDirectoryPlaceId(placeId)) {
    context.res.statusCode = 404;
    return {
      props: {
        initialPlaceId: placeId,
        initialPlace: null,
        initialLocale,
        initialNotFound: true,
        initialUnavailable: false,
        canonicalUrl,
      },
    };
  }

  try {
    const place = await getPublicDirectoryPlace(placeId, initialLocale);
    if (!place) {
      context.res.statusCode = 404;
      return {
        props: {
          initialPlaceId: placeId,
          initialPlace: null,
          initialLocale,
          initialNotFound: true,
          initialUnavailable: false,
          canonicalUrl,
        },
      };
    }

    if (place.bookable && place.bookingBusinessId) {
      return {
        redirect: {
          destination: `/explore/${place.bookingBusinessId}`,
          permanent: false,
        },
      };
    }

    return {
      props: {
        initialPlaceId: placeId,
        initialPlace: place as PlaceDetail,
        initialLocale,
        initialNotFound: false,
        initialUnavailable: false,
        canonicalUrl,
      },
    };
  } catch (error) {
    context.res.statusCode = 503;
    if (!(error instanceof PublicDirectoryUnavailableError)) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "unknown";
      console.error("[directory-place-page] Server render failed", code);
    }

    return {
      props: {
        initialPlaceId: placeId,
        initialPlace: null,
        initialLocale,
        initialNotFound: false,
        initialUnavailable: true,
        canonicalUrl,
      },
    };
  }
};
