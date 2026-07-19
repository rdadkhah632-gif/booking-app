import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Phone,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import { directoryCategoryLabel } from "@/components/explore/directoryCategories";
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
  bookable: false;
  claimable: boolean;
  linkedBusinessId?: string | null;
  attribution: { label: string; url?: string | null };
};

export default function DirectoryPlacePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!router.isReady || typeof router.query.placeId !== "string") return;
    let cancelled = false;

    async function loadPlace() {
      setLoading(true);
      setNotFound(false);
      try {
        const response = await fetch(
          `/api/public/directory-place?id=${encodeURIComponent(String(router.query.placeId))}`,
        );
        if (!response.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const payload = (await response.json()) as { place?: PlaceDetail };
        if (!cancelled) setPlace(payload.place || null);
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
  }, [router.isReady, router.query.placeId]);

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
    <main className="place-page">
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

        {loading ? (
          <div className="place-state">
            {t("directory.profile.loading", "Loading place details...")}
          </div>
        ) : notFound || !place ? (
          <div className="place-state">
            <Building2 size={30} aria-hidden="true" />
            <h1>{t("directory.profile.notFound", "Place not found")}</h1>
            <p>{t("directory.profile.notFoundBody", "This place is no longer available in Mirëbook discovery.")}</p>
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
                {t("directory.card.notBookable", "Not bookable on Mirëbook yet")}
              </span>
            </header>

            <div className="place-grid">
              <section className="place-main">
                {place.description && <p className="place-description">{place.description}</p>}

                <dl className="place-facts">
                  <div>
                    <dt><MapPin size={18} aria-hidden="true" /></dt>
                    <dd>{location || t("directory.card.albania", "Albania")}</dd>
                  </div>
                  {place.phone && (
                    <div>
                      <dt><Phone size={18} aria-hidden="true" /></dt>
                      <dd><a href={`tel:${place.phone}`}>{place.phone}</a></dd>
                    </div>
                  )}
                  {place.website && (
                    <div>
                      <dt><Globe size={18} aria-hidden="true" /></dt>
                      <dd><a href={place.website} target="_blank" rel="noreferrer">{t("directory.card.website", "Website")}</a></dd>
                    </div>
                  )}
                </dl>

                <div className="place-actions">
                  <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn btn-accent">
                    <MapPin size={17} aria-hidden="true" />
                    {t("directory.profile.directions", "Get directions")}
                  </a>
                  <Link
                    href={{ pathname: "/support/customer", query: { reportPlace: place.name, placeId: place.id } }}
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
                    ? t("directory.profile.ownerTitle", "Is this your business?")
                    : t("directory.profile.claimedTitle", "Ownership recorded")}
                </h2>
                <p>
                  {place.claimable
                    ? t("directory.profile.ownerBody", "Claim this listing with a Mirëbook Business account. Mirëbook reviews every request before linking it.")
                    : t("directory.profile.claimedBody", "This listing already has an ownership record. Booking remains unavailable until its Mirëbook business profile is ready and published.")}
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
                <a href={place.attribution.url} target="_blank" rel="noreferrer">{place.attribution.label}</a>
              ) : (
                <span>{place.attribution.label}</span>
              )}
            </footer>
          </>
        )}
      </section>

      <style jsx>{`
        .place-shell { padding-top: 2rem; padding-bottom: 4rem; }
        .place-back { display: inline-flex; align-items: center; gap: .45rem; color: var(--text-muted); text-decoration: none; margin-bottom: 1.5rem; }
        .place-back:hover { color: var(--text); }
        .place-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; padding-bottom: 1.4rem; border-bottom: 1px solid var(--border); }
        .place-header h1 { margin: .22rem 0; max-width: 18ch; font-size: clamp(2rem, 5vw, 3.8rem); line-height: 1; }
        .place-type { color: var(--success); font-size: .76rem; font-weight: 800; text-transform: uppercase; }
        .place-category, .place-status, .place-description, .place-owner-panel p, .place-attribution { color: var(--text-muted); }
        .place-status { padding: .5rem .7rem; border: 1px solid var(--border); border-radius: 999px; font-size: .78rem; white-space: nowrap; }
        .place-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(260px, .75fr); gap: 2.5rem; padding: 2rem 0; }
        .place-main { min-width: 0; }
        .place-description { max-width: 66ch; margin: 0 0 1.5rem; font-size: 1.05rem; }
        .place-facts { display: grid; gap: 0; margin: 0; }
        .place-facts div { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: .65rem; padding: .85rem 0; border-bottom: 1px solid var(--border); }
        .place-facts dt { color: var(--accent); }
        .place-facts dd { margin: 0; overflow-wrap: anywhere; }
        .place-facts a { color: var(--text); }
        .place-actions { display: flex; flex-wrap: wrap; gap: .65rem; margin-top: 1.4rem; }
        .place-actions :global(.btn), .place-owner-panel :global(.btn) { display: inline-flex; align-items: center; gap: .45rem; }
        .place-owner-panel { align-self: start; padding: 1.1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
        .place-owner-panel > :global(svg) { color: var(--accent); }
        .place-owner-panel h2 { margin: .75rem 0 .45rem; font-size: 1.15rem; }
        .place-owner-panel p { margin: 0 0 1rem; font-size: .9rem; }
        .place-attribution { display: flex; flex-wrap: wrap; gap: .45rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: .75rem; }
        .place-attribution a { color: var(--text-muted); }
        .place-state { min-height: 45vh; display: grid; place-content: center; justify-items: center; gap: .6rem; text-align: center; color: var(--text-muted); }
        .place-state h1, .place-state p { margin: 0; }
        @media (max-width: 720px) {
          .place-shell { padding-top: 1.25rem; }
          .place-header, .place-grid { display: grid; }
          .place-status { width: fit-content; white-space: normal; }
          .place-grid { grid-template-columns: 1fr; gap: 1.5rem; padding-top: 1.4rem; }
          .place-header h1 { font-size: 2.25rem; }
          .place-actions :global(.btn) { flex: 1 1 140px; }
        }
      `}</style>
    </main>
  );
}
