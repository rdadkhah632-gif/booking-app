import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
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
import {
  directoryCategoryLabel,
  directoryImageCredit,
} from "@/components/explore/directoryCategories";
import type { DirectoryCategoryKey } from "@/components/explore/exploreTypes";
import { getBusinessAppUrl } from "@/lib/appUrls";
import { useI18n } from "@/lib/useI18n";

type PlaceDetail = {
  id: string;
  name: string;
  categoryKey: DirectoryCategoryKey;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode: string;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  bookable: boolean;
  bookingBusinessId?: string | null;
  claimable: boolean;
  linkedBusinessId?: string | null;
  image?: {
    url: string;
    alt: string;
    attribution: { label: string; url?: string | null };
  } | null;
  attribution: { label: string; url?: string | null };
};

export default function DirectoryPlacePage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bookingBusinessId, setBookingBusinessId] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!router.isReady || typeof router.query.placeId !== "string") return;
    let cancelled = false;

    async function loadPlace() {
      setLoading(true);
      setNotFound(false);
      setBookingBusinessId("");
      setImageFailed(false);
      try {
        const response = await fetch(
          `/api/public/directory-place?id=${encodeURIComponent(String(router.query.placeId))}&locale=${locale}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          if (!cancelled) setNotFound(true);
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
        setPlace(nextPlace);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlace();
    return () => {
      cancelled = true;
    };
  }, [locale, router.isReady, router.query.placeId]);

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

  return (
    <main className="marketplace-surface place-page">
      <MarketplaceSurfaceStyles />
      <Head>
        <title>
          {place
            ? `${place.name} | Mirëbook`
            : t("directory.profile.metaTitle", "Local place | Mirëbook")}
        </title>
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
              <div>
                <span className="place-type">
                  {t("directory.card.type", "Local place")}
                </span>
                <h1>{place.name}</h1>
                <p className="place-category">
                  {directoryCategoryLabel(place.categoryKey, t)}
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
                {place.description && (
                  <p className="place-description">{place.description}</p>
                )}

                <dl className="place-facts">
                  <div>
                    <dt>
                      <MapPin size={18} aria-hidden="true" />
                    </dt>
                    <dd>
                      {location || t("directory.card.albania", "Albania")}
                    </dd>
                  </div>
                  {place.phone && (
                    <div>
                      <dt>
                        <Phone size={18} aria-hidden="true" />
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
                      </dt>
                      <dd>
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noreferrer"
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
                    className="btn btn-accent"
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
                </div>
              </section>

              <aside className="place-owner-panel">
                <Building2 size={24} aria-hidden="true" />
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
                  <a href={claimUrl} className="btn btn-ghost">
                    {t("directory.profile.claim", "Claim this place")}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </aside>
            </div>

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
          max-width: 1180px;
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
          color: var(--text);
        }

        .place-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          padding-bottom: 1.4rem;
        }

        .place-header h1 {
          max-width: 22ch;
          margin: 0.35rem 0 0.4rem;
          font-family: var(--font-body);
          font-size: clamp(2rem, 5vw, 3.25rem);
          font-weight: 850;
          line-height: 1.02;
          letter-spacing: 0;
        }

        .place-type {
          color: var(--success);
          font-size: 0.75rem;
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
          margin: 0;
          font-size: 1rem;
        }

        .place-status {
          max-width: 18rem;
          padding: 0.55rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-2);
          font-size: 0.78rem;
          font-weight: 700;
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
          max-height: 420px;
          aspect-ratio: 16 / 6;
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
          grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.65fr);
          gap: clamp(2rem, 5vw, 4.5rem);
          padding: 2.25rem 0 2.75rem;
        }

        .place-main {
          min-width: 0;
        }

        .place-description {
          max-width: 68ch;
          margin: 0 0 1.5rem;
          font-size: 1.08rem;
          line-height: 1.72;
        }

        .place-facts {
          display: grid;
          gap: 0;
          margin: 0;
          border-top: 1px solid var(--border);
        }

        .place-facts div {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 0.75rem;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }

        .place-facts dt {
          color: var(--accent);
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

        .place-owner-panel {
          position: sticky;
          top: 96px;
          align-self: start;
          padding: 1.25rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: var(--shadow-card);
        }

        .place-owner-panel > :global(svg) {
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
            box-shadow: none;
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
