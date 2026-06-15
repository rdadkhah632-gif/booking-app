import Head from "next/head";
import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import { getBusinessAppUrl, getCustomerAppUrl } from "@/lib/appUrls";

export default function BusinessHomePage() {
  const { t } = useI18n();
  const customerHomeUrl = getCustomerAppUrl();
  const businessRegisterUrl = getBusinessAppUrl(
    "/register?accountType=business",
  );
  const businessLoginUrl = getBusinessAppUrl("/login?product=business");

  return (
    <main className="business-site">
      <Head>
        <title>
          {t(
            "businessHome.metaTitle",
            "Mirëbook Business | Bookings, staff and availability",
          )}
        </title>
        <meta
          name="description"
          content={t(
            "businessHome.metaDescription",
            "Manage bookings, staff, services, availability and your public business profile with Mirëbook Business.",
          )}
        />
      </Head>

      <AuthNav />

      <section className="business-hero">
        <div className="business-hero-shade" />
        <div className="container business-hero-inner">
          <div className="business-hero-copy">
            <p className="business-product-label">
              Mirëbook {t("product.business.suffix", "Business")}
            </p>
            <h1>
              {t(
                "businessHome.hero.title",
                "Keep bookings, staff and the working day in one clear place.",
              )}
            </h1>
            <p className="business-hero-body">
              {t(
                "businessHome.hero.body",
                "A simple workspace for appointments, services, staff and the profile customers book from.",
              )}
            </p>
            <div className="business-hero-actions">
              <Link
                href={businessRegisterUrl}
                className="btn btn-accent"
              >
                {t("businessHome.cta.start", "Start business setup")}
              </Link>
              <Link href={businessLoginUrl} className="btn btn-ghost">
                {t(
                  "businessHome.cta.login",
                  "Log in to Mirëbook Business",
                )}
              </Link>
            </div>
            <Link href={customerHomeUrl} className="business-customer-link">
              {t("businessHome.cta.customer", "View customer Mirëbook")}
            </Link>
          </div>
        </div>
      </section>

      <section className="business-proof-band">
        <div className="container business-proof-grid">
          <div>
            <strong>{t("businessHome.proof.booking", "One booking view")}</strong>
            <span>
              {t(
                "businessHome.proof.bookingBody",
                "Pending, confirmed and completed work stays distinct.",
              )}
            </span>
          </div>
          <div>
            <strong>{t("businessHome.proof.team", "Owners and staff")}</strong>
            <span>
              {t(
                "businessHome.proof.teamBody",
                "Staff works inside Mirëbook Business with role-appropriate access.",
              )}
            </span>
          </div>
          <div>
            <strong>
              {t("businessHome.proof.profile", "A bookable public profile")}
            </strong>
            <span>
              {t(
                "businessHome.proof.profileBody",
                "Customers see services, staff and real available times.",
              )}
            </span>
          </div>
        </div>
      </section>

      <section className="business-section">
        <div className="container business-membership">
          <div>
            <p className="business-section-kicker">
              {t("businessHome.membership.kicker", "Early partners")}
            </p>
            <h2>
              {t(
                "businessHome.membership.title",
                "Mirëbook Business is open for early partners.",
              )}
            </h2>
            <p>
              {t(
                "businessHome.membership.body",
                "Manage bookings, services, staff and your public profile. No customer booking commission is charged during the early partner period.",
              )}
            </p>
          </div>
          <div className="business-membership-details">
            <strong>
              {t(
                "businessHome.membership.offer",
                "Early partner access is set up directly with Mirëbook.",
              )}
            </strong>
            <span>
              {t(
                "businessHome.membership.payment",
                "Start with the core booking workspace now. Customer bookings stay separate from business membership.",
              )}
            </span>
            <Link href="/support/business" className="btn btn-ghost">
              {t("businessHome.membership.support", "Contact business support")}
            </Link>
          </div>
        </div>
      </section>

      <section className="business-final">
        <div className="container business-final-inner">
          <div>
            <p>{t("businessHome.final.kicker", "Ready to get organised?")}</p>
            <h2>
              {t(
                "businessHome.final.title",
                "Set up the business customers can find and your team can run.",
              )}
            </h2>
          </div>
          <div className="business-final-actions">
            <Link
              href={businessRegisterUrl}
              className="btn btn-accent"
            >
              {t("businessHome.cta.start", "Start business setup")}
            </Link>
            <Link href={businessLoginUrl} className="btn btn-ghost">
              {t("businessHome.cta.login", "Log in to Mirëbook Business")}
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .business-site {
          background: var(--bg);
        }

        .business-hero {
          position: relative;
          min-height: calc(100vh - 136px);
          min-height: calc(100dvh - 136px);
          display: flex;
          align-items: center;
          background-image: url("/mirebook-business-hero.png");
          background-size: cover;
          background-position: center;
          overflow: hidden;
        }

        .business-hero-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(7, 11, 19, 0.98) 0%,
            rgba(7, 11, 19, 0.88) 34%,
            rgba(7, 11, 19, 0.28) 68%,
            rgba(7, 11, 19, 0.08) 100%
          );
        }

        .business-hero-inner {
          position: relative;
          z-index: 1;
          width: 100%;
          padding-top: 40px;
          padding-bottom: 40px;
        }

        .business-hero-copy {
          max-width: 680px;
        }

        .business-product-label,
        .business-section-kicker,
        .business-section-heading > p,
        .business-final p {
          margin: 0 0 0.75rem;
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .business-hero h1 {
          max-width: 650px;
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.7rem, 5.5vw, 5.3rem);
          line-height: 0.98;
          letter-spacing: 0;
        }

        .business-hero-body {
          max-width: 610px;
          margin: 1.35rem 0 0;
          color: rgba(238, 242, 247, 0.82);
          font-size: 1.08rem;
          line-height: 1.7;
        }

        .business-hero-actions,
        .business-final-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1.75rem;
        }

        .business-customer-link {
          display: inline-block;
          margin-top: 1.25rem;
          color: rgba(238, 242, 247, 0.72);
          font-size: 0.9rem;
          text-decoration: underline;
          text-underline-offset: 0.25rem;
        }

        .business-proof-band {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }

        .business-proof-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .business-proof-grid > div {
          display: grid;
          gap: 0.4rem;
          min-width: 0;
          padding: 1.35rem 1.5rem;
          border-right: 1px solid var(--border);
        }

        .business-proof-grid > div:last-child {
          border-right: 0;
        }

        .business-proof-grid span {
          color: var(--text-muted);
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .business-section {
          padding: 88px 0;
        }

        .business-audience-band {
          padding: 68px 0;
          border-bottom: 1px solid var(--border);
          background: #111822;
        }

        .business-audience-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
          gap: 4rem;
          align-items: start;
        }

        .business-audience-grid h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1.08;
          letter-spacing: 0;
        }

        .business-audience-grid > div:last-child {
          display: grid;
          gap: 1.25rem;
        }

        .business-audience-grid > div:last-child p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .business-audience-grid :global(.btn) {
          justify-self: start;
        }

        .business-section-heading {
          max-width: 760px;
          margin-bottom: 2.2rem;
        }

        .business-section-heading h2,
        .business-team-layout h2,
        .business-membership h2,
        .business-final h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.4rem);
          line-height: 1.08;
          letter-spacing: 0;
        }

        .business-section-heading > span,
        .business-membership p,
        .business-team-copy p {
          display: block;
          margin-top: 1rem;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .business-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }

        .business-feature {
          min-width: 0;
          padding: 1.5rem;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }

        .business-feature-number {
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .business-feature h3 {
          margin: 1.1rem 0 0.55rem;
          font-size: 1.05rem;
        }

        .business-feature p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.65;
        }

        .business-team-band {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: #111822;
        }

        .business-team-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 4rem;
          align-items: start;
        }

        .business-team-copy {
          border-left: 2px solid var(--accent);
          padding-left: 1.5rem;
        }

        .business-team-copy p:first-child {
          margin-top: 0;
        }

        .business-membership {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 3rem;
          align-items: start;
        }

        .business-membership-details {
          display: grid;
          gap: 1rem;
          padding: 1.5rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .business-membership-details span {
          color: var(--text-muted);
          line-height: 1.6;
        }

        .business-membership-details :global(.btn) {
          justify-content: center;
        }

        .business-final {
          padding: 70px 0;
          border-top: 1px solid var(--border);
          background: #171c21;
        }

        .business-final-inner {
          display: flex;
          justify-content: space-between;
          gap: 2rem;
          align-items: center;
        }

        .business-final h2 {
          max-width: 720px;
        }

        .business-final-actions {
          flex: 0 0 auto;
          justify-content: flex-end;
          margin-top: 0;
        }

        @media (max-width: 900px) {
          .business-hero {
            min-height: 760px;
            align-items: flex-end;
            background-position: 62% center;
          }

          .business-hero-shade {
            background: linear-gradient(
              180deg,
              rgba(7, 11, 19, 0.2) 0%,
              rgba(7, 11, 19, 0.56) 38%,
              rgba(7, 11, 19, 0.98) 72%
            );
          }

          .business-hero-inner {
            padding-top: 220px;
            padding-bottom: 56px;
          }

          .business-proof-grid,
          .business-feature-grid {
            grid-template-columns: 1fr 1fr;
          }

          .business-proof-grid > div:last-child {
            grid-column: 1 / -1;
            border-top: 1px solid var(--border);
          }

          .business-team-layout,
          .business-membership,
          .business-audience-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .business-final-inner {
            display: grid;
          }

          .business-final-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 620px) {
          .business-hero {
            min-height: 680px;
            background-position: 68% center;
          }

          .business-hero-inner {
            padding-top: 140px;
          }

          .business-hero h1 {
            font-size: 2.65rem;
          }

          .business-hero-actions,
          .business-final-actions {
            display: grid;
          }

          .business-hero-actions :global(.btn),
          .business-final-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .business-proof-grid,
          .business-feature-grid {
            grid-template-columns: 1fr;
          }

          .business-proof-grid > div {
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }

          .business-proof-grid > div:last-child {
            grid-column: auto;
            border-top: 0;
            border-bottom: 0;
          }

          .business-section {
            padding: 62px 0;
          }

          .business-feature-grid {
            border-left: 0;
          }

          .business-feature {
            border-left: 1px solid var(--border);
          }
        }
      `}</style>
    </main>
  );
}
