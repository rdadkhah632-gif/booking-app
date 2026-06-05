import AuthNav from "@/components/AuthNav";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useI18n } from "@/lib/useI18n";

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

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

      <section className="home-hero">
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
              <Link href="/explore" className="btn btn-accent">
                {t("home.cta.explore")}
              </Link>

              <Link href="/register" className="btn btn-ghost">
                {t("home.cta.createAccount")}
              </Link>
            </div>

            <div className="home-proof-row">
              <span className="small muted">
                {t("home.proof.availability")}
              </span>
              <span className="small muted">{t("home.proof.staff")}</span>
              <span className="small muted">{t("home.proof.tracking")}</span>
              <span className="small muted">{t("home.proof.language")}</span>
            </div>
          </div>

          <aside className="card home-business-card">
            <p
              className="small"
              style={{ color: "var(--accent)", marginBottom: "0.35rem" }}
            >
              {t("home.business.kicker")}
            </p>

            <h2 className="home-card-title">{t("home.business.title")}</h2>

            <p className="muted" style={{ marginBottom: 24 }}>
              {t("home.business.body")}
            </p>

            <div className="home-business-links">
              <div className="card home-mini-card">
                <strong>{t("home.business.profileTitle")}</strong>
                <p className="small muted">{t("home.business.profileBody")}</p>
              </div>

              <div className="card home-mini-card">
                <strong>{t("home.business.actionTitle")}</strong>
                <p className="small muted">{t("home.business.actionBody")}</p>
              </div>

              <div className="card home-mini-card">
                <strong>{t("home.business.managerTitle")}</strong>
                <p className="small muted">{t("home.business.managerBody")}</p>
              </div>
            </div>

            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/register" className="btn btn-accent">
                {t("home.business.join")}
              </Link>

              <Link href="/login" className="btn btn-ghost">
                {t("home.business.login")}
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="container home-confidence-section">
        <div className="home-section-heading">
          <p
            className="small"
            style={{ color: "var(--accent)", marginBottom: "0.5rem" }}
          >
            {t("home.confidence.kicker")}
          </p>
          <h2>{t("home.confidence.title")}</h2>
          <p className="muted">{t("home.confidence.body")}</p>
        </div>

        <div className="grid-2">
          <div className="card">
            <p className="small muted">{t("home.customers.kicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.customers.title")}
            </h3>
            <p className="muted" style={{ margin: "0.5rem 0 1rem" }}>
              {t("home.customers.body")}
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/explore" className="btn btn-accent">
                {t("home.customers.explore")}
              </Link>
            </div>
          </div>

          <div className="card">
            <p className="small muted">{t("home.businesses.kicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.businesses.title")}
            </h3>
            <p className="muted" style={{ margin: "0.5rem 0 1rem" }}>
              {t("home.businesses.body")}
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/dashboard" className="btn btn-accent">
                {t("home.businesses.dashboard")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container home-confidence-section">
        <div className="home-section-heading">
          <p
            className="small"
            style={{ color: "var(--accent)", marginBottom: "0.5rem" }}
          >
            {t("home.growth.kicker")}
          </p>
          <h2>{t("home.growth.title")}</h2>
          <p className="muted">{t("home.growth.body")}</p>
        </div>

        <div className="grid-3">
          <div className="card">
            <p className="small muted">{t("explore.trust.customerKicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.growth.customerTitle")}
            </h3>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {t("home.growth.customerBody")}
            </p>
          </div>

          <div className="card">
            <p className="small muted">{t("explore.trust.businessKicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.growth.businessTitle")}
            </h3>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {t("home.growth.businessBody")}
            </p>
          </div>

          <div className="card">
            <p className="small muted">{t("home.growth.teamKicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.growth.teamTitle")}
            </h3>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {t("home.growth.teamBody")}
            </p>
          </div>
        </div>
      </section>

      <section className="container home-confidence-section">
        <div className="home-section-heading">
          <p
            className="small"
            style={{ color: "var(--accent)", marginBottom: "0.5rem" }}
          >
            {t("home.trust.kicker")}
          </p>
          <h2>{t("home.trust.title")}</h2>
          <p className="muted">{t("home.trust.body")}</p>
        </div>

        <div className="grid-3">
          <div className="card">
            <p className="small muted">{t("home.trust.modelKicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.trust.modelTitle")}
            </h3>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {t("home.trust.modelBody")}
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/explore" className="btn btn-ghost">
                {t("home.cta.explore")}
              </Link>
            </div>
          </div>

          <div className="card">
            <p className="small muted">{t("home.trust.supportKicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.trust.supportTitle")}
            </h3>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {t("home.trust.supportBody")}
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/support" className="btn btn-ghost">
                {t("home.trust.supportCentre")}
              </Link>
            </div>
          </div>

          <div className="card">
            <p className="small muted">{t("home.trust.legalKicker")}</p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t("home.trust.legalTitle")}
            </h3>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {t("home.trust.legalBody")}
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/privacy" className="btn btn-ghost">
                {t("common.privacy")}
              </Link>
              <Link href="/terms" className="btn btn-ghost">
                {t("common.terms")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
