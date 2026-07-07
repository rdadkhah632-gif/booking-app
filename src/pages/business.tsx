import Head from "next/head";
import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import { getBusinessAppUrl, getCustomerAppUrl } from "@/lib/appUrls";
import { useState } from "react";

type BusinessTabId = "how" | "setup" | "pricing" | "staff";

export default function BusinessHomePage() {
  const { t } = useI18n();
  const [activeTabId, setActiveTabId] = useState<BusinessTabId>("how");
  const customerHomeUrl = getCustomerAppUrl();
  const businessRegisterUrl = getBusinessAppUrl(
    "/register?accountType=business",
  );
  const businessLoginUrl = getBusinessAppUrl("/login?product=business");
  const businessTabs: Array<{
    id: BusinessTabId;
    label: string;
    title: string;
    body: string;
    points: string[];
    panelTitle: string;
    panelItems: string[];
  }> = [
    {
      id: "how",
      label: t("businessHome.tabs.how.label", "How it works"),
      title: t(
        "businessHome.tabs.how.title",
        "A simpler way to run bookings from the first day.",
      ),
      body: t(
        "businessHome.tabs.how.body",
        "Mirëbook connects a customer-facing booking page with the business calendar, inbox and staff workspace behind it.",
      ),
      points: [
        t("businessHome.tabs.how.pointOne", "Customers find your profile"),
        t(
          "businessHome.tabs.how.pointTwo",
          "They choose a service, provider and time",
        ),
        t(
          "businessHome.tabs.how.pointThree",
          "You see requests and confirmed work in one place",
        ),
      ],
      panelTitle: t("businessHome.tabs.how.panelTitle", "Core flow"),
      panelItems: [
        t("businessHome.tabs.how.panelOne", "Public profile"),
        t("businessHome.tabs.how.panelTwo", "Calendar"),
        t("businessHome.tabs.how.panelThree", "Inbox"),
      ],
    },
    {
      id: "setup",
      label: t("businessHome.tabs.setup.label", "Setup"),
      title: t(
        "businessHome.tabs.setup.title",
        "Get bookable without opening every setting.",
      ),
      body: t(
        "businessHome.tabs.setup.body",
        "Start with the few things customers need: profile basics, one service, one provider or team member, working hours and booking mode.",
      ),
      points: [
        t("businessHome.tabs.setup.pointOne", "Business profile and location"),
        t(
          "businessHome.tabs.setup.pointTwo",
          "First service with duration and price",
        ),
        t(
          "businessHome.tabs.setup.pointThree",
          "Working hours and preview before publish",
        ),
      ],
      panelTitle: t("businessHome.tabs.setup.panelTitle", "Setup path"),
      panelItems: [
        t("businessHome.tabs.setup.panelOne", "Profile"),
        t("businessHome.tabs.setup.panelTwo", "Service"),
        t("businessHome.tabs.setup.panelThree", "Preview"),
      ],
    },
    {
      id: "pricing",
      label: t("businessHome.tabs.pricing.label", "Pricing"),
      title: t(
        "businessHome.tabs.pricing.title",
        "Early partner access while Mirëbook grows.",
      ),
      body: t(
        "businessHome.tabs.pricing.body",
        "Mirëbook Business is currently available for early partners. Customer booking payments stay separate from business membership.",
      ),
      points: [
        t(
          "businessHome.tabs.pricing.pointOne",
          "No customer booking commission during the early partner period",
        ),
        t(
          "businessHome.tabs.pricing.pointTwo",
          "Membership details are handled directly with Mirëbook",
        ),
        t(
          "businessHome.tabs.pricing.pointThree",
          "Online subscription management can be enabled later",
        ),
      ],
      panelTitle: t("businessHome.tabs.pricing.panelTitle", "Included now"),
      panelItems: [
        t("businessHome.tabs.pricing.panelOne", "Bookings"),
        t("businessHome.tabs.pricing.panelTwo", "Staff and services"),
        t("businessHome.tabs.pricing.panelThree", "Public profile"),
      ],
    },
    {
      id: "staff",
      label: t("businessHome.tabs.staff.label", "Staff"),
      title: t(
        "businessHome.tabs.staff.title",
        "Staff get the work view, not the owner dashboard.",
      ),
      body: t(
        "businessHome.tabs.staff.body",
        "Linked staff can see assigned appointments, their calendar, working hours and inbox updates without business setup controls.",
      ),
      points: [
        t("businessHome.tabs.staff.pointOne", "Assigned appointments only"),
        t(
          "businessHome.tabs.staff.pointTwo",
          "Working hours for their schedule",
        ),
        t(
          "businessHome.tabs.staff.pointThree",
          "Owner controls stay with the business owner",
        ),
      ],
      panelTitle: t("businessHome.tabs.staff.panelTitle", "Staff workspace"),
      panelItems: [
        t("businessHome.tabs.staff.panelOne", "Today"),
        t("businessHome.tabs.staff.panelTwo", "Calendar"),
        t("businessHome.tabs.staff.panelThree", "Inbox"),
      ],
    },
  ];
  const activeTab =
    businessTabs.find((tab) => tab.id === activeTabId) || businessTabs[0];

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
              <Link href={businessRegisterUrl} className="btn btn-accent">
                {t("businessHome.cta.start", "Start business setup")}
              </Link>
              <Link href={businessLoginUrl} className="btn btn-ghost">
                {t("businessHome.cta.login", "Log in to Mirëbook Business")}
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
            <strong>
              {t("businessHome.proof.booking", "One booking view")}
            </strong>
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

      <section className="business-tabs-section">
        <div className="container">
          <div className="business-tabs-heading">
            <h2>
              {t(
                "businessHome.tabs.title",
                "Mirëbook Business, split into the parts owners actually need.",
              )}
            </h2>
            <p>
              {t(
                "businessHome.tabs.body",
                "Understand the product quickly, then start setup when it makes sense.",
              )}
            </p>
          </div>

          <div
            className="business-tabs"
            role="tablist"
            aria-label="Mirëbook Business sections"
          >
            {businessTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTabId === tab.id}
                className={activeTabId === tab.id ? "active" : ""}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="business-tab-panel" role="tabpanel">
            <div className="business-tab-copy">
              <h3>{activeTab.title}</h3>
              <p>{activeTab.body}</p>
              <ul>
                {activeTab.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="business-tab-actions">
                <Link href={businessRegisterUrl} className="btn btn-accent">
                  {t("businessHome.cta.start", "Start business setup")}
                </Link>
                <Link href={businessLoginUrl} className="btn btn-ghost">
                  {t("businessHome.cta.login", "Log in to Mirëbook Business")}
                </Link>
              </div>
            </div>
            <aside className="business-tab-card">
              <strong>{activeTab.panelTitle}</strong>
              {activeTab.panelItems.map((item, index) => (
                <span key={item}>
                  <em>{index + 1}</em>
                  {item}
                </span>
              ))}
            </aside>
          </div>
        </div>
      </section>

      <section className="business-preview-band">
        <div className="container business-preview-layout">
          <div className="business-section-heading">
            <p>{t("businessHome.preview.kicker", "Workspace preview")}</p>
            <h2>
              {t(
                "businessHome.preview.title",
                "Run the day from Today, Calendar and Inbox.",
              )}
            </h2>
            <span>
              {t(
                "businessHome.preview.body",
                "The web product already mirrors the first business/staff app direction: daily actions first, setup second.",
              )}
            </span>
          </div>

          <div className="business-preview-stack" aria-hidden="true">
            <div className="business-preview-panel business-preview-panel-main">
              <div className="business-preview-panel-head">
                <strong>{t("businessHome.preview.today", "Today")}</strong>
                <span>{t("businessHome.preview.ready", "Ready")}</span>
              </div>
              <div className="business-preview-metric-row">
                <span>
                  {t("businessHome.preview.next", "Next appointment")}
                </span>
                <strong>10:00</strong>
              </div>
              <div className="business-preview-metric-row">
                <span>{t("businessHome.preview.requests", "Requests")}</span>
                <strong>2</strong>
              </div>
            </div>

            <div className="business-preview-panel">
              <div className="business-preview-panel-head">
                <strong>
                  {t("businessHome.preview.calendar", "Calendar")}
                </strong>
                <span>{t("businessHome.preview.week", "Week")}</span>
              </div>
              <div className="business-preview-appointment">
                <span>09:00</span>
                <strong>{t("businessHome.preview.serviceOne", "Cut")}</strong>
              </div>
              <div className="business-preview-appointment">
                <span>10:30</span>
                <strong>
                  {t("businessHome.preview.serviceTwo", "Colour")}
                </strong>
              </div>
            </div>

            <div className="business-preview-panel">
              <div className="business-preview-panel-head">
                <strong>{t("businessHome.preview.inbox", "Inbox")}</strong>
                <span>{t("businessHome.preview.action", "Action")}</span>
              </div>
              <div className="business-preview-alert">
                {t(
                  "businessHome.preview.alert",
                  "Review one reschedule request",
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="business-section business-team-band">
        <div className="container business-team-layout">
          <div>
            <p className="business-section-kicker">
              {t("businessHome.team.kicker", "One business product")}
            </p>
            <h2>
              {t(
                "businessHome.team.title",
                "Staff is part of Mirëbook Business.",
              )}
            </h2>
          </div>
          <div className="business-team-copy">
            <p>
              {t(
                "businessHome.team.body",
                "Business owners manage setup, bookings and the team. Linked staff gets a focused workspace for assigned appointments, personal availability and work notifications.",
              )}
            </p>
            <p>
              {t(
                "businessHome.team.ownerBody",
                "Owners who also take appointments can keep business management and their personal schedule connected without switching products.",
              )}
            </p>
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
            <Link href={businessRegisterUrl} className="btn btn-accent">
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

        .business-tabs-section {
          padding: 76px 0;
          border-bottom: 1px solid var(--border);
          background: #111822;
        }

        .business-tabs-heading {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(280px, 0.6fr);
          gap: 2rem;
          align-items: end;
          margin-bottom: 1.5rem;
        }

        .business-tabs-heading h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1.08;
          letter-spacing: 0;
        }

        .business-tabs-heading p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .business-tabs {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .business-tabs button {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-muted);
          cursor: pointer;
          font: inherit;
          font-size: 0.88rem;
          font-weight: 800;
          padding: 0.55rem 0.85rem;
        }

        .business-tabs button.active {
          border-color: rgba(255, 107, 53, 0.5);
          background: var(--accent-dim);
          color: var(--accent);
        }

        .business-tab-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.45fr);
          gap: 1.25rem;
          align-items: stretch;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.035);
          padding: 1.25rem;
        }

        .business-tab-copy {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .business-tab-copy h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 3vw, 2.7rem);
          line-height: 1.08;
        }

        .business-tab-copy p {
          max-width: 760px;
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .business-tab-copy ul {
          display: grid;
          gap: 0.5rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .business-tab-copy li {
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
          color: var(--text-muted);
        }

        .business-tab-copy li::before {
          content: "";
          width: 0.42rem;
          height: 0.42rem;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--accent);
        }

        .business-tab-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.2rem;
        }

        .business-tab-card {
          display: grid;
          gap: 0.65rem;
          align-content: start;
          padding: 1rem;
          border: 1px solid rgba(255, 107, 53, 0.22);
          border-radius: 8px;
          background: rgba(7, 11, 19, 0.42);
        }

        .business-tab-card strong {
          margin-bottom: 0.25rem;
        }

        .business-tab-card span {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .business-tab-card em {
          display: inline-flex;
          width: 1.55rem;
          height: 1.55rem;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--accent-dim);
          color: var(--accent);
          font-size: 0.78rem;
          font-style: normal;
          font-weight: 900;
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

        .business-preview-band {
          padding: 88px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: #0d131c;
        }

        .business-preview-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
          gap: 3rem;
          align-items: center;
        }

        .business-preview-layout .business-section-heading {
          margin-bottom: 0;
        }

        .business-preview-stack {
          display: grid;
          grid-template-columns: 1fr 0.85fr;
          gap: 1rem;
          align-items: start;
        }

        .business-preview-panel {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.24);
        }

        .business-preview-panel-main {
          grid-row: span 2;
          min-height: 260px;
          background: linear-gradient(
            180deg,
            rgba(255, 107, 53, 0.14),
            rgba(255, 255, 255, 0.045)
          );
        }

        .business-preview-panel-head,
        .business-preview-metric-row,
        .business-preview-appointment {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .business-preview-panel-head span {
          padding: 0.25rem 0.55rem;
          border: 1px solid rgba(45, 212, 191, 0.25);
          border-radius: 999px;
          color: #8debdc;
          font-size: 0.75rem;
          font-weight: 800;
        }

        .business-preview-metric-row,
        .business-preview-appointment,
        .business-preview-alert {
          padding: 0.75rem;
          border-radius: 8px;
          background: rgba(7, 11, 19, 0.58);
          color: var(--text-muted);
          font-size: 0.88rem;
        }

        .business-preview-metric-row strong,
        .business-preview-appointment strong {
          color: var(--text);
        }

        .business-preview-alert {
          color: var(--text);
          border: 1px solid rgba(255, 107, 53, 0.22);
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

          .business-proof-grid {
            grid-template-columns: 1fr 1fr;
          }

          .business-proof-grid > div:last-child {
            grid-column: 1 / -1;
            border-top: 1px solid var(--border);
          }

          .business-team-layout,
          .business-membership,
          .business-tabs-heading,
          .business-tab-panel,
          .business-preview-layout {
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
          .business-tab-panel {
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

          .business-tab-actions {
            display: grid;
          }

          .business-tab-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .business-preview-band {
            padding: 62px 0;
          }

          .business-preview-stack {
            grid-template-columns: 1fr;
          }

          .business-preview-panel-main {
            min-height: 0;
          }
        }
      `}</style>
    </main>
  );
}
