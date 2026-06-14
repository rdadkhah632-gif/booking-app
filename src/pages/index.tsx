import AuthNav from "@/components/AuthNav";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useI18n } from "@/lib/useI18n";
import { getBusinessAppUrl } from "@/lib/appUrls";

const journeySteps = ["discover", "choose", "track"] as const;

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const businessHomeUrl = getBusinessAppUrl();

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
            <div className="home-eyebrow">{t("home.eyebrow")}</div>
            <h1 className="home-title">{t("home.title")}</h1>
            <p className="home-subtitle">{t("home.subtitle")}</p>

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

            <div className="home-cta-row">
              <Link href="/explore" className="btn btn-ghost">
                {t("home.cta.explore", "Explore Mirëbook")}
              </Link>
              <Link href="/my-bookings" className="btn btn-ghost">
                {t("home.cta.myBookings", "My bookings")}
              </Link>
            </div>

          </div>

          <aside className="customer-journey-panel">
            <p className="customer-panel-kicker">
              {t("home.journey.kicker", "Your booking, made clear")}
            </p>
            <h2>
              {t(
                "home.journey.title",
                "From finding a service to knowing what happens next.",
              )}
            </h2>
            <div className="customer-journey-list">
              {journeySteps.map((step, index) => (
                <div key={step} className="customer-journey-step">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>
                      {t(
                        `home.journey.${step}.title`,
                        {
                          discover: "Browse bookable businesses",
                          choose: "Choose service, staff and time",
                          track: "Track every booking update",
                        }[step],
                      )}
                    </strong>
                    <p>
                      {t(
                        `home.journey.${step}.body`,
                        {
                          discover:
                            "Search by service or city and compare businesses ready to take appointments.",
                          choose:
                            "See real availability and whether your booking confirms instantly or needs approval.",
                          track:
                            "Keep requests, confirmed appointments and history together in My bookings.",
                        }[step],
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="container home-confidence-section">
        <div className="home-section-heading">
          <p className="small" style={{ color: "var(--accent)" }}>
            {t("home.trust.kicker")}
          </p>
          <h2>{t("home.trust.title")}</h2>
          <p className="muted">{t("home.trust.body")}</p>
        </div>

        <div className="grid-3">
          <article className="card">
            <p className="small muted">
              {t("home.trust.modelKicker")}
            </p>
            <h3>{t("home.trust.modelTitle")}</h3>
            <p className="muted">{t("home.trust.modelBody")}</p>
          </article>
          <article className="card">
            <p className="small muted">
              {t("home.trust.statusKicker", "Status updates")}
            </p>
            <h3>
              {t("home.trust.statusTitle", "Know whether you are confirmed")}
            </h3>
            <p className="muted">
              {t(
                "home.trust.statusBody",
                "Request sent, confirmed, declined, cancelled and completed appointments stay clearly separated.",
              )}
            </p>
          </article>
          <article className="card">
            <p className="small muted">{t("home.trust.supportKicker")}</p>
            <h3>
              {t("home.trust.supportCustomerTitle", "Customer help when needed")}
            </h3>
            <p className="muted">
              {t(
                "home.trust.supportCustomerBody",
                "Customer support, privacy information and booking guidance remain easy to reach.",
              )}
            </p>
            <Link href="/support/customer" className="home-text-link">
              {t("nav.customerSupport", "Customer support")}
            </Link>
          </article>
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
          </div>
          <Link href={businessHomeUrl} className="btn btn-ghost">
            {t("home.businessEntry.cta", "Visit Mirëbook Business")}
          </Link>
        </div>
      </section>

      <style jsx>{`
        .customer-home-hero {
          min-height: calc(100vh - 118px);
          min-height: calc(100dvh - 118px);
          padding: 44px 0;
        }

        .customer-home-hero :global(.home-title) {
          font-size: clamp(2.6rem, 5vw, 4rem);
        }

        .customer-home-hero :global(.home-subtitle) {
          margin-bottom: 24px;
        }

        .customer-journey-panel {
          align-self: center;
          padding: 1.35rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(17, 24, 34, 0.92);
        }

        .customer-panel-kicker,
        .home-business-entry p {
          margin: 0 0 0.65rem;
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .customer-journey-panel h2,
        .home-business-entry h2 {
          margin: 0;
          font-family: var(--font-display);
          letter-spacing: 0;
        }

        .customer-journey-panel h2 {
          font-size: 1.8rem;
          line-height: 1.14;
        }

        .customer-journey-list {
          display: grid;
          margin-top: 1.5rem;
        }

        .customer-journey-step {
          display: grid;
          grid-template-columns: 2rem minmax(0, 1fr);
          gap: 0.8rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
        }

        .customer-journey-step > span {
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 800;
        }

        .customer-journey-step p {
          margin: 0.35rem 0 0;
          color: var(--text-muted);
          font-size: 0.88rem;
          line-height: 1.55;
        }

        .home-confidence-section h3 {
          margin: 0.35rem 0 0.55rem;
        }

        .home-confidence-section .card > p:last-of-type {
          line-height: 1.65;
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

        @media (max-width: 860px) {
          .customer-home-hero {
            min-height: auto;
          }

        }

        @media (max-width: 620px) {
          .customer-journey-panel {
            padding: 1rem;
          }

          .home-business-entry-inner {
            display: grid;
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
