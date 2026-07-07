import AuthNav from "@/components/AuthNav";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useI18n } from "@/lib/useI18n";
import { getBusinessAppUrl } from "@/lib/appUrls";

const categoryShortcuts = [
  { label: "Barbers", query: "barber" },
  { label: "Beauty", query: "beauty" },
  { label: "Nails", query: "nails" },
  { label: "Fitness", query: "fitness" },
  { label: "Dental", query: "dental" },
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

  function searchBusinesses(e: React.FormEvent) {
    e.preventDefault();

    router.push({
      pathname: "/explore",
      query: {
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      },
    });
  }

  return (
    <main>
      <AuthNav />

      <section className="home-hero customer-home-hero">
        <div className="home-glow home-glow-one" />
        <div className="home-glow home-glow-two" />

        <div className="container home-hero-grid">
          <div className="home-copy">
            <div className="home-eyebrow">
              {t("home.eyebrow", "Book local services")}
            </div>
            <h1 className="home-title">{t("home.title")}</h1>
            <p className="home-subtitle">
              {t(
                "home.stage8.subtitle",
                "Find services near you and book in a few clicks.",
              )}
            </p>

            <form onSubmit={searchBusinesses} className="home-search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("home.search.servicePlaceholder")}
                className="home-search-input"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("home.search.cityPlaceholder")}
                className="home-search-input"
              />
              <button className="btn btn-accent home-search-button">
                {t("home.search.button")}
              </button>
            </form>

            <div className="home-category-row">
              {categoryShortcuts.map((item) => (
                <Link
                  key={item.query}
                  href={`/explore?query=${encodeURIComponent(item.query)}`}
                  className="home-category-pill"
                >
                  {t(`home.categories.${item.query}`, item.label)}
                </Link>
              ))}
            </div>

            <div className="home-cta-row">
              <Link href="/explore" className="btn btn-ghost">
                {t("home.cta.explore", "Explore")}
              </Link>
              <Link href="/my-bookings" className="btn btn-ghost">
                {t("home.cta.myBookings", "My bookings")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-business-entry">
        <div className="container home-business-entry-inner">
          <div>
            <p>{t("home.business.kicker", "For businesses")}</p>
            <h2>
              {t(
                "home.businessEntry.title",
                "Run bookings and daily operations with Mirëbook Business.",
              )}
            </h2>
            <span>
              {t(
                "home.businessEntry.body",
                "Owners and staff use a separate workspace for setup, calendar and inbox.",
              )}
            </span>
          </div>
          <div className="home-business-actions">
            <Link href={businessHomeUrl} className="btn btn-ghost">
              {t("home.businessEntry.cta", "Visit Mirëbook Business")}
            </Link>
            <Link href={businessRegisterUrl} className="btn btn-ghost">
              {t("home.businessEntry.setupCta", "List your business")}
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .customer-home-hero {
          min-height: 620px;
          padding: 60px 0;
        }

        .customer-home-hero :global(.home-title) {
          font-size: clamp(2.8rem, 6vw, 5rem);
        }

        .customer-home-hero :global(.home-subtitle) {
          margin-bottom: 24px;
        }

        .home-copy {
          max-width: 860px;
        }

        .home-business-entry p {
          margin: 0 0 0.65rem;
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .home-business-entry h2 {
          margin: 0;
          font-family: var(--font-display);
          letter-spacing: 0;
        }

        .home-business-entry span {
          display: block;
          max-width: 620px;
          margin-top: 0.65rem;
          color: var(--text-muted);
          line-height: 1.55;
        }

        .home-category-row {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .home-category-pill {
          padding: 0.45rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .home-text-link {
          display: inline-block;
          margin-top: 1rem;
          color: var(--accent);
          font-weight: 700;
        }

        .home-business-entry {
          padding: 44px 0;
          border-top: 1px solid var(--border);
          background: var(--surface);
        }

        .home-business-entry-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }

        .home-business-entry h2 {
          max-width: 720px;
          font-size: clamp(1.5rem, 3vw, 2.3rem);
          line-height: 1.14;
        }

        .home-business-entry :global(.btn) {
          flex: 0 0 auto;
        }

        .home-business-actions {
          display: flex;
          gap: 0.7rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 620px) {
          .customer-home-hero {
            min-height: auto;
          }

          .home-business-entry-inner {
            display: grid;
          }

          .home-business-actions {
            display: grid;
            justify-content: stretch;
          }

          .home-business-entry :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
