import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  Eye,
  RefreshCw,
  Route,
  UserPlus,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import { getAdminLoginHref } from "@/lib/auth/getAdminLoginHref";
import { getStableBrowserSession } from "@/lib/auth/getStableBrowserSession";
import { useI18n } from "@/lib/useI18n";

type CountRow = { key: string; count: number };
type CampaignRow = { source: string; campaign: string; count: number };
type ContentRow = {
  entityType: string;
  entityId: string;
  label: string;
  count: number;
};
type DailyRow = {
  date: string;
  interactions: number;
  accounts: number;
  bookings: number;
};
type RecentRow = {
  id: string;
  eventName: string;
  route: string;
  source?: string | null;
  campaign?: string | null;
  deviceCategory: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  createdAt: string;
};
type GrowthPayload = {
  days: number;
  generatedAt: string;
  storageAvailable: boolean;
  sqlRequired?: string | null;
  summary: {
    interactions: number;
    contentViews: number;
    accountCreated: number;
    bookingCreated: number;
    claimInterest: number;
    registrationStarted: number;
    bookingStarted: number;
  };
  accountRoles: {
    customer: number;
    business: number;
    staffLinked: number;
  };
  events: CountRow[];
  sources: CountRow[];
  campaigns: CampaignRow[];
  devices: CountRow[];
  topContent: ContentRow[];
  daily: DailyRow[];
  recent: RecentRow[];
  error?: string;
};

const EMPTY_PAYLOAD: GrowthPayload = {
  days: 30,
  generatedAt: "",
  storageAvailable: false,
  summary: {
    interactions: 0,
    contentViews: 0,
    accountCreated: 0,
    bookingCreated: 0,
    claimInterest: 0,
    registrationStarted: 0,
    bookingStarted: 0,
  },
  accountRoles: { customer: 0, business: 0, staffLinked: 0 },
  events: [],
  sources: [],
  campaigns: [],
  devices: [],
  topContent: [],
  daily: [],
  recent: [],
};

function contentHref(item: ContentRow) {
  return item.entityType === "business"
    ? `/explore/${item.entityId}`
    : `/places/${item.entityId}`;
}

export default function AdminGrowthPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [days, setDays] = useState(30);
  const [payload, setPayload] = useState<GrowthPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");

  async function loadGrowth(nextDays = days) {
    setLoading(true);
    setError("");
    try {
      const session = await getStableBrowserSession();
      if (!session) {
        await router.replace(getAdminLoginHref(router.asPath, "/admin/growth"));
        return;
      }

      const response = await fetch(`/api/admin/growth?days=${nextDays}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as GrowthPayload;
      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!response.ok) {
        throw new Error(nextPayload.error || "growth_load_failed");
      }
      setAccessDenied(false);
      setPayload(nextPayload);
    } catch {
      setError(
        t(
          "admin.growth.error",
          "Growth analytics could not be loaded. Try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    void loadGrowth(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, days]);

  const maxDaily = useMemo(
    () =>
      Math.max(
        1,
        ...payload.daily.map((item) =>
          Math.max(item.interactions, item.accounts, item.bookings),
        ),
      ),
    [payload.daily],
  );
  const visibleDaily = payload.daily.slice(-14);

  function eventLabel(name: string) {
    const labels: Record<string, string> = {
      home_search_submitted: t(
        "admin.growth.event.homeSearch",
        "Homepage search",
      ),
      home_suggestion_selected: t(
        "admin.growth.event.homeSuggestion",
        "Homepage suggestion selected",
      ),
      home_map_opened: t("admin.growth.event.homeMap", "Homepage map opened"),
      business_entry_opened: t(
        "admin.growth.event.businessEntry",
        "Business entry opened",
      ),
      explore_search_submitted: t(
        "admin.growth.event.exploreSearch",
        "Explore search",
      ),
      explore_suggestion_selected: t(
        "admin.growth.event.exploreSuggestion",
        "Explore suggestion selected",
      ),
      explore_view_changed: t(
        "admin.growth.event.viewChanged",
        "List or map changed",
      ),
      explore_kind_changed: t(
        "admin.growth.event.kindChanged",
        "Result type changed",
      ),
      explore_map_result_selected: t(
        "admin.growth.event.mapSelection",
        "Map result selected",
      ),
      explore_more_results: t(
        "admin.growth.event.moreResults",
        "More results opened",
      ),
      explore_location_requested: t(
        "admin.growth.event.locationRequested",
        "Nearby requested",
      ),
      explore_location_resolved: t(
        "admin.growth.event.locationResolved",
        "Nearby result",
      ),
      place_viewed: t("admin.growth.event.placeViewed", "Local place viewed"),
      place_website_opened: t(
        "admin.growth.event.websiteOpened",
        "Place website opened",
      ),
      place_directions_opened: t(
        "admin.growth.event.directionsOpened",
        "Directions opened",
      ),
      place_claim_opened: t(
        "admin.growth.event.claimOpened",
        "Business claim opened",
      ),
      business_viewed: t(
        "admin.growth.event.businessViewed",
        "Bookable business viewed",
      ),
      booking_started: t(
        "admin.growth.event.bookingStarted",
        "Booking submitted",
      ),
      registration_viewed: t(
        "admin.growth.event.registrationViewed",
        "Registration viewed",
      ),
      registration_submitted: t(
        "admin.growth.event.registrationSubmitted",
        "Registration submitted",
      ),
    };
    return labels[name] || name.replace(/_/g, " ");
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  if (accessDenied) {
    return (
      <main>
        <AuthNav />
        <section className="container growth-access-state">
          <div className="card">
            <h1>{t("admin.growth.adminOnlyTitle", "Admin only")}</h1>
            <p className="muted">
              {t("admin.growth.adminOnly", "Admin access is required.")}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="growth-page">
      <Head>
        <title>
          {t("admin.growth.metaTitle", "Growth analytics | Mirëbook")}
        </title>
      </Head>
      <AuthNav contextRole="admin" />

      <section className="container growth-shell">
        <header className="growth-header">
          <div>
            <span>{t("admin.growth.kicker", "Launch signals")}</span>
            <h1>{t("admin.growth.title", "Growth analytics")}</h1>
            <p>
              {t(
                "admin.growth.subtitle",
                "See how discovery, outreach and real account activity move toward bookings.",
              )}
            </p>
          </div>
          <div className="growth-controls">
            <label>
              <span>{t("admin.growth.period", "Period")}</span>
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>
                  {t("admin.growth.last7", "Last 7 days")}
                </option>
                <option value={30}>
                  {t("admin.growth.last30", "Last 30 days")}
                </option>
                <option value={90}>
                  {t("admin.growth.last90", "Last 90 days")}
                </option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-ghost icon-button"
              onClick={() => void loadGrowth(days)}
              disabled={loading}
              aria-label={t("common.refresh", "Refresh")}
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {error && <p className="growth-message is-error">{error}</p>}
        {!payload.storageAvailable && !loading && (
          <div className="growth-message is-warning">
            <strong>
              {t(
                "admin.growth.storageTitle",
                "Interaction reporting is not active yet",
              )}
            </strong>
            <span>
              {t(
                "admin.growth.storageBody",
                "Account and booking totals remain available. Activate the private launch analytics migration to begin collecting customer interactions.",
              )}
            </span>
          </div>
        )}

        <section
          className="growth-metrics"
          aria-label={t("admin.growth.summary", "Growth summary")}
        >
          <article>
            <Eye aria-hidden="true" />
            <span>
              {t("admin.growth.interactions", "Tracked interactions")}
            </span>
            <strong>{loading ? "–" : payload.summary.interactions}</strong>
            <small>
              {t(
                "admin.growth.interactionsBody",
                "Anonymous, allowlisted actions",
              )}
            </small>
          </article>
          <article>
            <UserPlus aria-hidden="true" />
            <span>{t("admin.growth.accounts", "New accounts")}</span>
            <strong>{loading ? "–" : payload.summary.accountCreated}</strong>
            <small>
              {payload.accountRoles.customer}{" "}
              {t("admin.growth.customers", "customer")} ·{" "}
              {payload.accountRoles.business}{" "}
              {t("admin.growth.businesses", "business")} ·{" "}
              {payload.accountRoles.staffLinked}{" "}
              {t("admin.growth.staffLinked", "staff-linked")}
            </small>
          </article>
          <article>
            <CalendarCheck aria-hidden="true" />
            <span>{t("admin.growth.bookings", "Bookings created")}</span>
            <strong>{loading ? "–" : payload.summary.bookingCreated}</strong>
            <small>
              {t("admin.growth.bookingsBody", "Authoritative booking records")}
            </small>
          </article>
          <article>
            <Route aria-hidden="true" />
            <span>{t("admin.growth.claimInterest", "Claim interest")}</span>
            <strong>{loading ? "–" : payload.summary.claimInterest}</strong>
            <small>
              {t(
                "admin.growth.claimInterestBody",
                "Business claim links opened",
              )}
            </small>
          </article>
        </section>

        <section className="growth-funnel">
          <header>
            <div>
              <span>{t("admin.growth.funnelKicker", "Conversion")}</span>
              <h2>
                {t("admin.growth.funnelTitle", "From interest to action")}
              </h2>
            </div>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              {t("admin.growth.openVercel", "Open visitor analytics")}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </header>
          <div className="funnel-steps">
            <div>
              <span>
                {t("admin.growth.contentViews", "Place and business views")}
              </span>
              <strong>{payload.summary.contentViews}</strong>
            </div>
            <div>
              <span>
                {t(
                  "admin.growth.registrationAttempts",
                  "Registration submissions",
                )}
              </span>
              <strong>{payload.summary.registrationStarted}</strong>
            </div>
            <div>
              <span>
                {t("admin.growth.accountsCreated", "Accounts created")}
              </span>
              <strong>{payload.summary.accountCreated}</strong>
            </div>
            <div>
              <span>
                {t("admin.growth.bookingAttempts", "Booking submissions")}
              </span>
              <strong>{payload.summary.bookingStarted}</strong>
            </div>
            <div>
              <span>
                {t("admin.growth.bookingsCreated", "Bookings created")}
              </span>
              <strong>{payload.summary.bookingCreated}</strong>
            </div>
          </div>
          <p>
            {t(
              "admin.growth.visitorNote",
              "Unique visitors, page views and referrers are measured anonymously in Vercel. Mirëbook stores only the aggregate actions shown here.",
            )}
          </p>
        </section>

        <section className="growth-grid">
          <div className="growth-panel">
            <header>
              <h2>{t("admin.growth.sources", "Acquisition sources")}</h2>
            </header>
            <div className="ranked-list">
              {payload.sources.length ? (
                payload.sources.map((item) => (
                  <div key={item.key}>
                    <span>{item.key}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p>
                  {t(
                    "admin.growth.noSources",
                    "No attributed interactions yet.",
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="growth-panel">
            <header>
              <h2>{t("admin.growth.devices", "Devices")}</h2>
            </header>
            <div className="ranked-list">
              {payload.devices.length ? (
                payload.devices.map((item) => (
                  <div key={item.key}>
                    <span>{item.key}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p>{t("admin.growth.noDevices", "No device activity yet.")}</p>
              )}
            </div>
          </div>
          <div className="growth-panel">
            <header>
              <h2>{t("admin.growth.campaigns", "Campaigns")}</h2>
            </header>
            <div className="ranked-list">
              {payload.campaigns.length ? (
                payload.campaigns.map((item) => (
                  <div key={`${item.source}:${item.campaign}`}>
                    <span>
                      {item.campaign}
                      <small>{item.source}</small>
                    </span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p>
                  {t("admin.growth.noCampaigns", "No campaign activity yet.")}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="growth-panel content-panel">
          <header>
            <div>
              <span>{t("admin.growth.contentKicker", "Discovery")}</span>
              <h2>
                {t(
                  "admin.growth.topContent",
                  "Most-viewed places and businesses",
                )}
              </h2>
            </div>
          </header>
          <div className="content-table">
            {payload.topContent.length ? (
              payload.topContent.map((item, index) => (
                <Link
                  href={contentHref(item)}
                  key={`${item.entityType}:${item.entityId}`}
                >
                  <span className="content-rank">{index + 1}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>
                      {item.entityType === "business"
                        ? t(
                            "admin.growth.bookableBusiness",
                            "Bookable business",
                          )
                        : t("directory.card.type", "Local place")}
                    </small>
                  </span>
                  <strong>{item.count}</strong>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p>
                {t(
                  "admin.growth.noContent",
                  "No place or business views have been recorded yet.",
                )}
              </p>
            )}
          </div>
        </section>

        <section className="growth-panel daily-panel">
          <header>
            <div>
              <span>{t("admin.growth.dailyKicker", "Trend")}</span>
              <h2>{t("admin.growth.dailyTitle", "Latest 14 days")}</h2>
            </div>
            <div className="chart-legend">
              <span className="is-interaction">
                {t("admin.growth.legendInteractions", "Interactions")}
              </span>
              <span className="is-account">
                {t("admin.growth.legendAccounts", "Accounts")}
              </span>
              <span className="is-booking">
                {t("admin.growth.legendBookings", "Bookings")}
              </span>
            </div>
          </header>
          <div className="daily-chart">
            {visibleDaily.map((item) => (
              <div className="daily-column" key={item.date} title={item.date}>
                <div className="daily-bars">
                  <span
                    className="is-interaction"
                    style={{
                      height: `${Math.max(2, (item.interactions / maxDaily) * 100)}%`,
                    }}
                  />
                  <span
                    className="is-account"
                    style={{
                      height: `${Math.max(2, (item.accounts / maxDaily) * 100)}%`,
                    }}
                  />
                  <span
                    className="is-booking"
                    style={{
                      height: `${Math.max(2, (item.bookings / maxDaily) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {new Intl.DateTimeFormat(
                    locale === "sq" ? "sq-AL" : "en-GB",
                    { day: "numeric", month: "short" },
                  ).format(new Date(`${item.date}T12:00:00Z`))}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="growth-panel recent-panel">
          <header>
            <h2>{t("admin.growth.recent", "Recent interactions")}</h2>
          </header>
          <div className="recent-list">
            {payload.recent.length ? (
              payload.recent.map((item) => (
                <div key={item.id}>
                  <BarChart3 size={17} aria-hidden="true" />
                  <span>
                    <strong>{eventLabel(item.eventName)}</strong>
                    <small>{item.entityLabel || item.route}</small>
                  </span>
                  <span className="recent-context">
                    <small>
                      {item.source || "direct"} · {item.deviceCategory}
                    </small>
                    <time dateTime={item.createdAt}>
                      {formatDateTime(item.createdAt)}
                    </time>
                  </span>
                </div>
              ))
            ) : (
              <p>{t("admin.growth.noRecent", "No recent interactions yet.")}</p>
            )}
          </div>
        </section>
      </section>

      <style jsx>{`
        .growth-shell {
          padding-top: 2rem;
          padding-bottom: 5rem;
          display: grid;
          gap: 1.25rem;
        }
        .growth-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1.5rem;
        }
        .growth-header > div:first-child {
          max-width: 720px;
        }
        .growth-header span,
        .growth-panel header span,
        .growth-funnel header span {
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 850;
          text-transform: uppercase;
        }
        .growth-header h1 {
          margin: 0.2rem 0 0.45rem;
          font-size: 2.45rem;
          letter-spacing: 0;
        }
        .growth-header p,
        .growth-funnel > p {
          color: var(--text-muted);
          line-height: 1.55;
        }
        .growth-controls {
          display: flex;
          align-items: flex-end;
          gap: 0.65rem;
        }
        .growth-controls label {
          display: grid;
          gap: 0.25rem;
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
        }
        .growth-controls select {
          min-width: 145px;
          min-height: 44px;
        }
        .icon-button {
          width: 44px;
          min-width: 44px;
          height: 44px;
          padding: 0;
        }
        .growth-message {
          display: grid;
          gap: 0.25rem;
          padding: 0.85rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        .growth-message.is-error {
          border-color: rgba(255, 77, 109, 0.4);
          color: var(--danger);
        }
        .growth-message.is-warning {
          border-color: rgba(255, 190, 11, 0.35);
          background: rgba(255, 190, 11, 0.06);
        }
        .growth-message span {
          color: var(--text-muted);
        }
        .growth-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.8rem;
        }
        .growth-metrics article {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.3rem 0.65rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .growth-metrics article :global(svg) {
          grid-row: 1 / span 2;
          color: var(--success);
        }
        .growth-metrics article > span {
          color: var(--text-muted);
          font-size: 0.74rem;
          font-weight: 800;
        }
        .growth-metrics article > strong {
          font-family: var(--font-display);
          font-size: 2rem;
          line-height: 1;
        }
        .growth-metrics article > small {
          grid-column: 1 / -1;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .growth-funnel,
        .growth-panel {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .growth-funnel {
          padding: 1rem;
        }
        .growth-funnel header,
        .growth-panel > header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid var(--border);
        }
        .growth-funnel h2,
        .growth-panel h2 {
          margin: 0.12rem 0 0;
          font-size: 1.12rem;
          letter-spacing: 0;
        }
        .growth-funnel header a {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--text);
          font-size: 0.8rem;
          font-weight: 800;
        }
        .funnel-steps {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          margin: 1rem 0;
        }
        .funnel-steps div {
          min-width: 0;
          display: grid;
          gap: 0.35rem;
          padding: 0.2rem 0.85rem;
          border-right: 1px solid var(--border);
        }
        .funnel-steps div:first-child {
          padding-left: 0;
        }
        .funnel-steps div:last-child {
          border-right: 0;
        }
        .funnel-steps span {
          color: var(--text-muted);
          font-size: 0.72rem;
          line-height: 1.4;
        }
        .funnel-steps strong {
          font-size: 1.4rem;
        }
        .growth-funnel > p {
          margin: 0;
          font-size: 0.76rem;
        }
        .growth-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.8rem;
        }
        .growth-panel {
          padding: 1rem;
        }
        .ranked-list {
          display: grid;
        }
        .ranked-list > div {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }
        .ranked-list > div:last-child {
          border-bottom: 0;
        }
        .ranked-list span {
          min-width: 0;
          overflow-wrap: anywhere;
          text-transform: capitalize;
        }
        .ranked-list small {
          display: block;
          color: var(--text-muted);
          text-transform: none;
        }
        .ranked-list p,
        .content-table > p,
        .recent-list > p {
          margin: 0.85rem 0 0;
          color: var(--text-muted);
        }
        .content-table {
          display: grid;
        }
        .content-table :global(a) {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) auto 18px;
          align-items: center;
          gap: 0.65rem;
          min-height: 58px;
          padding: 0.55rem 0;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          text-decoration: none;
        }
        .content-table :global(a:last-child) {
          border-bottom: 0;
        }
        .content-table :global(a:hover strong) {
          color: var(--success);
        }
        .content-table :global(a > span:nth-child(2)) {
          display: grid;
          gap: 0.12rem;
        }
        .content-table :global(small) {
          color: var(--text-muted);
        }
        .content-rank {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 50%;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 850;
        }
        .daily-panel header {
          align-items: center;
        }
        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .chart-legend span {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          color: var(--text-muted);
          font-size: 0.68rem;
          text-transform: none;
        }
        .chart-legend span::before {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          background: currentColor;
          content: "";
        }
        .is-interaction {
          color: #25b8a8 !important;
        }
        .is-account {
          color: #ff8a57 !important;
        }
        .is-booking {
          color: #73a8ff !important;
        }
        .daily-chart {
          height: 190px;
          display: grid;
          grid-template-columns: repeat(14, minmax(24px, 1fr));
          gap: 0.4rem;
          align-items: end;
          padding-top: 1rem;
          overflow-x: auto;
        }
        .daily-column {
          height: 100%;
          min-width: 24px;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          gap: 0.4rem;
        }
        .daily-bars {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2px;
          min-height: 0;
          border-bottom: 1px solid var(--border);
        }
        .daily-bars span {
          width: min(7px, 28%);
          min-height: 2px;
          border-radius: 2px 2px 0 0;
          background: currentColor;
        }
        .daily-column small {
          color: var(--text-muted);
          font-size: 0.62rem;
          text-align: center;
          white-space: nowrap;
        }
        .recent-list {
          display: grid;
        }
        .recent-list > div {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) minmax(155px, auto);
          align-items: center;
          gap: 0.65rem;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }
        .recent-list > div:last-child {
          border-bottom: 0;
        }
        .recent-list :global(svg) {
          color: var(--text-muted);
        }
        .recent-list span {
          min-width: 0;
          display: grid;
          gap: 0.1rem;
        }
        .recent-list small {
          color: var(--text-muted);
          overflow-wrap: anywhere;
        }
        .recent-context {
          justify-items: end;
          text-align: right;
        }
        .recent-context time {
          color: var(--text-muted);
          font-size: 0.7rem;
        }
        .growth-access-state {
          padding-top: 3rem;
          padding-bottom: 4rem;
        }
        @media (max-width: 900px) {
          .growth-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .growth-grid {
            grid-template-columns: 1fr;
          }
          .funnel-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.75rem 0;
          }
          .funnel-steps div:nth-child(2) {
            border-right: 0;
          }
          .funnel-steps div:nth-child(3) {
            padding-left: 0;
          }
        }
        @media (max-width: 620px) {
          .growth-shell {
            padding-top: 1.25rem;
          }
          .growth-header {
            align-items: stretch;
            flex-direction: column;
          }
          .growth-header h1 {
            font-size: 2rem;
          }
          .growth-controls {
            width: 100%;
          }
          .growth-controls label {
            flex: 1;
          }
          .growth-controls select {
            width: 100%;
          }
          .growth-metrics {
            grid-template-columns: 1fr;
          }
          .growth-funnel header,
          .growth-panel > header {
            align-items: flex-start;
            flex-direction: column;
          }
          .funnel-steps {
            grid-template-columns: 1fr;
          }
          .funnel-steps div {
            padding: 0.55rem 0;
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }
          .funnel-steps div:last-child {
            border-bottom: 0;
          }
          .daily-chart {
            grid-template-columns: repeat(14, 32px);
          }
          .recent-list > div {
            grid-template-columns: 24px minmax(0, 1fr);
          }
          .recent-context {
            grid-column: 2;
            justify-items: start;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
