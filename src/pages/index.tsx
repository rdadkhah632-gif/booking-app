import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  ArrowRight,
  Bike,
  CalendarCheck,
  Dumbbell,
  GraduationCap,
  Landmark,
  Map,
  MapPin,
  Search,
  Scissors,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";
import { directoryCategoryLabel } from "@/components/explore/directoryCategories";
import type { DirectoryCategoryKey } from "@/components/explore/exploreTypes";
import { getBusinessAppUrl } from "@/lib/appUrls";
import { useI18n } from "@/lib/useI18n";

const categoryShortcuts: Array<{
  key: DirectoryCategoryKey;
  icon: LucideIcon;
}> = [
  { key: "beauty_grooming", icon: Scissors },
  { key: "wellness_fitness", icon: Dumbbell },
  { key: "dental_health", icon: Stethoscope },
  { key: "tours_activities", icon: Bike },
  { key: "learning_lessons", icon: GraduationCap },
  { key: "attractions", icon: Landmark },
];

const cityShortcuts = [
  "Tiranë",
  "Durrës",
  "Vlorë",
  "Sarandë",
  "Shkodër",
  "Berat",
] as const;

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const businessHomeUrl = getBusinessAppUrl();
  const businessRegisterUrl = getBusinessAppUrl(
    "/register?accountType=business",
  );

  function searchDiscovery(event: React.FormEvent) {
    event.preventDefault();
    void router.push({
      pathname: "/explore",
      query: {
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      },
    });
  }

  return (
    <main className="marketplace-surface discovery-home">
      <Head>
        <title>
          {t("home.discovery.metaTitle", "Explore and book Albania | Mirëbook")}
        </title>
        <meta
          name="description"
          content={t(
            "home.discovery.metaDescription",
            "Discover local services, activities and places across Albania, then book participating businesses through Mirëbook.",
          )}
        />
        <link
          rel="preload"
          as="image"
          href="/mirebook-customer-discovery-hero.jpg"
        />
      </Head>

      <AuthNav />
      <MarketplaceSurfaceStyles />

      <section className="discovery-home-hero">
        <div className="container discovery-hero-inner">
          <div className="discovery-hero-copy">
            <h1>
              {t("home.discovery.title", "Find your next place in Albania.")}
            </h1>
            <p>
              {t(
                "home.discovery.subtitle",
                "Discover local favourites, activities and services, then book participating businesses.",
              )}
            </p>

            <form className="discovery-search" onSubmit={searchDiscovery}>
              <label className="discovery-search-field">
                <span>{t("home.discovery.searchLabel", "What")}</span>
                <div>
                  <Search size={18} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t(
                      "home.discovery.searchPlaceholder",
                      "Services, activities or places",
                    )}
                  />
                </div>
              </label>
              <label className="discovery-search-field">
                <span>{t("home.discovery.cityLabel", "Where")}</span>
                <div>
                  <MapPin size={18} aria-hidden="true" />
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder={t(
                      "home.discovery.cityPlaceholder",
                      "City or area",
                    )}
                  />
                </div>
              </label>
              <button type="submit" className="btn btn-accent">
                <Search size={18} aria-hidden="true" />
                {t("home.discovery.search", "Search")}
              </button>
            </form>

            <div className="discovery-hero-actions">
              <Link href="/explore" className="hero-secondary-action">
                <CalendarCheck size={18} aria-hidden="true" />
                {t("home.discovery.bookable", "Explore Albania")}
              </Link>
              <Link href="/explore?view=map" className="hero-secondary-action">
                <Map size={18} aria-hidden="true" />
                {t("home.discovery.map", "Explore the map")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-browse-band">
        <div className="container">
          <header className="home-band-heading">
            <div>
              <h2>
                {t("home.discovery.browseTitle", "What are you looking for?")}
              </h2>
            </div>
            <Link href="/explore" className="home-inline-link">
              {t("home.discovery.viewAll", "View everything")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </header>

          <div className="home-category-grid">
            {categoryShortcuts.map(({ key, icon: Icon }) => (
              <Link
                key={key}
                href={{ pathname: "/explore", query: { category: key } }}
                className="home-category-link"
              >
                <Icon size={23} aria-hidden="true" />
                <span>{directoryCategoryLabel(key, t)}</span>
              </Link>
            ))}
          </div>

          <div
            className="home-city-row"
            aria-label={t("home.discovery.cities", "Explore by city")}
          >
            <strong>{t("home.discovery.cities", "Explore by city")}</strong>
            {cityShortcuts.map((item) => (
              <Link
                key={item}
                href={{ pathname: "/explore", query: { city: item } }}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-result-guide">
        <div className="container home-result-guide-inner">
          <div>
            <CalendarCheck size={24} aria-hidden="true" />
            <span>
              <strong>
                {t("home.discovery.bookTitle", "Book on Mirëbook")}
              </strong>
              <small>
                {t(
                  "home.discovery.bookBody",
                  "Choose a service and an available time from participating businesses.",
                )}
              </small>
            </span>
          </div>
          <div>
            <MapPin size={24} aria-hidden="true" />
            <span>
              <strong>
                {t("home.discovery.placeTitle", "Discover local places")}
              </strong>
              <small>
                {t(
                  "home.discovery.placeBody",
                  "View useful details and directions where Mirëbook booking is not available yet.",
                )}
              </small>
            </span>
          </div>
        </div>
      </section>

      <section className="home-business-band">
        <div className="container home-business-band-inner">
          <div>
            <span>{t("home.business.kicker", "For businesses")}</span>
            <h2>
              {t(
                "home.discovery.businessTitle",
                "Bring your business onto Mirëbook",
              )}
            </h2>
            <p>
              {t(
                "home.discovery.businessBody",
                "Claim an existing place or create a profile, then manage bookings through Mirëbook Business.",
              )}
            </p>
          </div>
          <div className="home-business-actions">
            <Link href={businessRegisterUrl} className="btn btn-accent">
              {t("home.discovery.businessCta", "Claim or list your business")}
            </Link>
            <Link href={businessHomeUrl} className="btn btn-ghost">
              {t("home.businessEntry.cta", "Visit Mirëbook Business")}
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .discovery-home-hero {
          position: relative;
          height: min(600px, calc(100dvh - 160px));
          min-height: 440px;
          overflow: hidden;
          background-image: url("/mirebook-customer-discovery-hero.jpg");
          background-position: 54% center;
          background-size: cover;
          color: #ffffff;
        }

        .discovery-home-hero::before {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(11, 18, 24, 0.78) 0%,
            rgba(11, 18, 24, 0.5) 42%,
            rgba(11, 18, 24, 0.08) 74%
          );
          content: "";
        }

        .discovery-hero-inner {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          align-items: center;
        }

        .discovery-hero-copy {
          width: min(100%, 940px);
        }

        .home-band-heading span,
        .home-business-band > :global(.container) > div:first-child > span {
          font-size: 0.76rem;
          font-weight: 850;
          text-transform: uppercase;
        }

        .discovery-hero-copy h1 {
          max-width: 720px;
          margin: 0;
          font-family: var(--font-body);
          font-size: 3.75rem;
          font-weight: 700;
          line-height: 1.04;
          letter-spacing: 0;
          text-shadow: 0 2px 22px rgba(0, 0, 0, 0.28);
        }

        .discovery-hero-copy > p {
          max-width: 620px;
          margin: 1rem 0 1.5rem;
          color: rgba(255, 255, 255, 0.94);
          font-size: 1.08rem;
          line-height: 1.55;
        }

        .discovery-search {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.25fr) minmax(180px, 0.8fr)
            auto;
          gap: 0;
          max-width: 880px;
          padding: 0.45rem;
          border: 1px solid rgba(17, 24, 39, 0.12);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 18px 46px rgba(17, 24, 39, 0.22);
        }

        .discovery-search-field {
          min-width: 0;
          padding: 0.42rem 0.85rem;
          border: 0;
          border-right: 1px solid #e2e4e7;
          border-radius: 0;
          background: #ffffff;
        }

        .discovery-search-field > span {
          display: block;
          margin-bottom: 0.08rem;
          color: #62666d;
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .discovery-search-field > div {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          min-width: 0;
        }

        .discovery-search-field :global(svg) {
          flex: 0 0 auto;
          color: #73777f;
        }

        .discovery-search-field input {
          width: 100%;
          min-width: 0;
          min-height: 28px;
          padding: 0;
          border: 0;
          border-radius: 0;
          outline: 0;
          background: transparent;
          color: #19191b;
          box-shadow: none;
        }

        .discovery-search-field input::placeholder {
          color: #8a8f98;
        }

        .discovery-search > :global(.btn) {
          min-width: 126px;
          justify-content: center;
          border-radius: 6px;
          color: #ffffff;
        }

        .discovery-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1.1rem;
          margin-top: 1.1rem;
        }

        :global(.hero-secondary-action) {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 44px;
          padding: 0.55rem 0.15rem;
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 800;
          text-decoration: none;
          text-shadow: 0 1px 10px rgba(0, 0, 0, 0.25);
        }

        :global(.hero-secondary-action:hover) {
          color: #ffffff;
          text-decoration: underline;
          text-underline-offset: 0.25rem;
        }

        .home-browse-band {
          padding: 3rem 0;
          background: #ffffff;
          color: #17151d;
        }

        .home-band-heading,
        .home-business-band-inner {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1.5rem;
        }

        .home-band-heading {
          margin-bottom: 1.2rem;
        }

        .home-band-heading span {
          color: #c9471c;
        }

        .home-band-heading h2,
        .home-business-band h2 {
          margin: 0.2rem 0 0;
          letter-spacing: 0;
        }

        .home-band-heading h2 {
          font-size: 1.8rem;
        }

        :global(.home-inline-link) {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          flex: 0 0 auto;
          color: #17151d;
          font-weight: 800;
          text-decoration: none;
        }

        .home-category-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          border-block: 1px solid #e2e4e7;
        }

        :global(.home-category-link) {
          min-width: 0;
          min-height: 104px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 0.65rem;
          padding: 1rem;
          border-right: 1px solid #e2e4e7;
          border-radius: 0;
          background: #ffffff;
          color: #17151d;
          font-size: 0.88rem;
          font-weight: 700;
          text-decoration: none;
          transition:
            background-color 0.16s ease,
            color 0.16s ease;
        }

        :global(.home-category-link:last-child) {
          border-right: 0;
        }

        :global(.home-category-link:hover) {
          background: #f7f8f9;
          color: #c9471c;
        }

        :global(.home-category-link svg:first-child) {
          color: #c9471c;
        }

        .home-city-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.7rem 1rem;
          margin-top: 1.3rem;
          padding-top: 1.1rem;
          border-top: 0;
        }

        .home-city-row strong {
          margin-right: 0.25rem;
        }

        .home-city-row :global(a) {
          color: #4c5360;
          font-weight: 700;
          text-decoration: none;
        }

        .home-city-row :global(a:hover) {
          color: #d94b19;
        }

        .home-result-guide {
          padding: 1.5rem 0;
          border-block: 1px solid #e2e4e7;
          background: #f8f9fa;
          color: #17151d;
        }

        .home-result-guide-inner {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.5rem;
        }

        .home-result-guide-inner > div {
          display: flex;
          align-items: flex-start;
          gap: 0.7rem;
        }

        .home-result-guide-inner :global(svg) {
          flex: 0 0 auto;
          color: #147d70;
        }

        .home-result-guide-inner span {
          display: grid;
          gap: 0.18rem;
        }

        .home-result-guide-inner small {
          max-width: 55ch;
          color: #626977;
          line-height: 1.45;
        }

        .home-business-band {
          padding: 2.4rem 0;
          background: #ffffff;
        }

        .home-business-band-inner {
          align-items: center;
        }

        .home-business-band > :global(.container) > div:first-child > span {
          color: var(--accent);
        }

        .home-business-band h2 {
          font-family: var(--font-body);
          font-size: 1.8rem;
          font-weight: 700;
        }

        .home-business-band p {
          max-width: 650px;
          margin: 0.55rem 0 0;
          color: var(--text-muted);
        }

        .home-business-actions {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.65rem;
        }

        @media (max-width: 760px) {
          .discovery-home-hero {
            height: auto;
            min-height: 620px;
            background-position: 62% center;
          }

          .discovery-hero-inner {
            min-height: 620px;
            padding-top: 3.5rem;
            padding-bottom: 3.5rem;
          }

          .discovery-hero-copy h1 {
            font-size: 2.65rem;
          }

          .discovery-hero-copy > p {
            font-size: 0.98rem;
          }

          .discovery-search {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .discovery-search-field {
            padding-block: 0.65rem;
            border-right: 0;
            border-bottom: 1px solid #e2e4e7;
          }

          .discovery-search > :global(.btn) {
            min-height: 48px;
          }

          .home-browse-band {
            padding: 2.2rem 0;
          }

          .home-band-heading,
          .home-business-band-inner {
            display: grid;
            align-items: start;
          }

          .home-category-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          :global(.home-category-link) {
            min-height: 100px;
            border-bottom: 1px solid #e2e4e7;
          }

          .home-result-guide-inner {
            grid-template-columns: 1fr;
          }

          .home-business-actions {
            display: grid;
            justify-content: stretch;
          }

          .home-business-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 390px) {
          .discovery-hero-copy h1 {
            font-size: 2.35rem;
          }

          .home-category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          :global(.home-category-link) {
            min-height: 96px;
          }
        }
      `}</style>
    </main>
  );
}
