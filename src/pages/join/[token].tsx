import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clock3,
  ImagePlus,
  ShieldCheck,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import CustomerAuthStyles from "@/components/CustomerAuthStyles";
import { formatCurrencyAmount } from "@/lib/currency";
import { getBusinessAppUrl } from "@/lib/appUrls";
import type {
  PreparedBusinessProfile,
  PreparedServiceDraft,
} from "@/lib/onboardingPreparedProfile";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type HandoffPreview = {
  profile: PreparedBusinessProfile;
  services: PreparedServiceDraft[];
  expiresAt: string;
};

export default function PreparedBusinessJoinPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const token =
    typeof router.query.token === "string" ? router.query.token : "";
  const [preview, setPreview] = useState<HandoffPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const joinPath = token ? `/join/${token}` : "/business";
  const loginUrl = getBusinessAppUrl(
    `/login?product=business&redirectTo=${encodeURIComponent(joinPath)}`,
  );
  const registerUrl = getBusinessAppUrl(
    `/register?accountType=business&redirectTo=${encodeURIComponent(joinPath)}`,
  );

  const knownPrices = useMemo(
    () => preview?.services.filter((service) => service.priceKnown).length || 0,
    [preview],
  );

  useEffect(() => {
    if (!router.isReady || !token) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const [previewResponse, sessionResult] = await Promise.all([
        fetch(
          `/api/public/onboarding-handoff?token=${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          },
        ),
        supabase.auth.getSession(),
      ]);
      if (!active) return;
      if (!previewResponse.ok) {
        setError(
          t(
            "onboardingJoin.invalid",
            "This prepared-profile link is invalid, expired or already connected.",
          ),
        );
        setPreview(null);
      } else {
        setPreview((await previewResponse.json()) as HandoffPreview);
      }
      setSignedIn(Boolean(sessionResult.data.session));
      setSessionReady(true);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [router.isReady, t, token]);

  async function connectProfile() {
    setConnecting(true);
    setError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.assign(loginUrl);
      return;
    }
    const response = await fetch("/api/dashboard/onboarding-handoff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const payload = (await response.json()) as {
      businessId?: string;
      error?: string;
      errorCode?: string;
    };
    if (!response.ok || !payload.businessId) {
      setError(
        payload.errorCode === "owner_email_mismatch"
          ? t(
              "onboardingJoin.emailMismatch",
              "Sign in with the verified email address this invitation was sent to.",
            )
          : payload.error ||
              t(
                "onboardingJoin.connectError",
                "The prepared profile could not be connected. Contact Mirëbook for help.",
              ),
      );
      setConnecting(false);
      return;
    }
    await router.replace(
      `/dashboard/services?businessId=${encodeURIComponent(payload.businessId)}&onboarding=connected`,
    );
  }

  return (
    <main className="marketplace-surface customer-auth-surface prepared-join-page">
      <Head>
        <title>
          {preview?.profile.name
            ? `${preview.profile.name} | Mirëbook Business`
            : t(
                "onboardingJoin.metaTitle",
                "Prepared business profile | Mirëbook",
              )}
        </title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <CustomerAuthStyles />
      <AuthNav contextRole="business" />

      <section className="join-shell">
        {loading || !sessionReady ? (
          <div className="join-card join-state" role="status">
            <p>
              {t("onboardingJoin.loading", "Loading your prepared profile...")}
            </p>
          </div>
        ) : error && !preview ? (
          <div className="join-card join-state">
            <h1>
              {t("onboardingJoin.unavailableTitle", "Profile link unavailable")}
            </h1>
            <p>{error}</p>
            <Link href={getBusinessAppUrl("/")} className="btn btn-accent">
              {t("onboardingJoin.openBusiness", "Open Mirëbook Business")}
            </Link>
          </div>
        ) : preview ? (
          <div className="join-layout">
            <section className="join-card profile-summary">
              <header className="profile-heading">
                <span>
                  <BadgeCheck aria-hidden="true" />
                  {t("onboardingJoin.prepared", "Prepared for you")}
                </span>
                <h1>{preview.profile.name}</h1>
                <p>
                  {[preview.profile.category, preview.profile.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </header>

              {preview.profile.description && (
                <p className="profile-description">
                  {preview.profile.description}
                </p>
              )}

              <dl className="profile-facts">
                {preview.profile.address && (
                  <div>
                    <dt>{t("onboardingJoin.address", "Address")}</dt>
                    <dd>{preview.profile.address}</dd>
                  </div>
                )}
                {preview.profile.phone && (
                  <div>
                    <dt>{t("onboardingJoin.phone", "Business phone")}</dt>
                    <dd>{preview.profile.phone}</dd>
                  </div>
                )}
                <div>
                  <dt>{t("onboardingJoin.currency", "Service currency")}</dt>
                  <dd>{preview.profile.currency}</dd>
                </div>
              </dl>

              <section className="services-preview">
                <header>
                  <div>
                    <h2>{t("onboardingJoin.services", "Prepared services")}</h2>
                    <p>
                      {t(
                        "onboardingJoin.servicesBody",
                        "Review every duration, price and booking format before making it visible.",
                      )}
                    </p>
                  </div>
                  <span>{preview.services.length}</span>
                </header>
                <div className="service-list">
                  {preview.services.map((service) => (
                    <article key={service.id}>
                      <div>
                        <strong>{service.name}</strong>
                        <small>
                          <Clock3 aria-hidden="true" />
                          {service.durationMinutes}{" "}
                          {t("common.minutes", "minutes")}
                          {service.bookingType === "group"
                            ? ` · ${service.groupCapacity || 0} ${t("dashboardServices.group.seats", "seats")}`
                            : ""}
                        </small>
                      </div>
                      <span data-known={service.priceKnown}>
                        {service.priceKnown
                          ? formatCurrencyAmount(
                              service.price,
                              preview.profile.currency,
                              locale,
                            )
                          : service.price > 0
                            ? `${t("onboardingJoin.suggestedPrice", "Starter estimate")} · ${formatCurrencyAmount(
                                service.price,
                                preview.profile.currency,
                                locale,
                              )}`
                            : t(
                                "onboardingJoin.priceNeeded",
                                "Price to confirm",
                              )}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <aside className="join-card connection-panel">
              <span className="connection-kicker">
                <ShieldCheck aria-hidden="true" />
                {t("onboardingJoin.private", "Private owner handoff")}
              </span>
              <h2>
                {t("onboardingJoin.connectTitle", "Connect your business")}
              </h2>
              <p>
                {t(
                  "onboardingJoin.connectBody",
                  "Connect a verified Business account to take control of this profile. Nothing is published automatically.",
                )}
              </p>
              <p className="email-bound-note">
                {t(
                  "onboardingJoin.emailBound",
                  "Use the email address you gave Mirëbook. Only that verified Business account can connect this profile.",
                )}
              </p>
              <ul>
                <li>
                  <Check aria-hidden="true" />
                  {t(
                    "onboardingJoin.checkProfile",
                    "Edit all business details",
                  )}
                </li>
                <li>
                  <Check aria-hidden="true" />
                  {t(
                    "onboardingJoin.checkServices",
                    `${preview.services.length} service drafts stay hidden until reviewed`,
                  )}
                </li>
                <li>
                  <ImagePlus aria-hidden="true" />
                  {t(
                    "onboardingJoin.checkPhotos",
                    "Add or replace photos from your phone",
                  )}
                </li>
              </ul>
              {preview.services.length > knownPrices && (
                <div className="price-note">
                  {t(
                    "onboardingJoin.priceNote",
                    "Some prices are placeholders. Mirëbook will clearly mark them for your review.",
                  )}
                </div>
              )}
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              {signedIn ? (
                <button
                  type="button"
                  className="btn btn-accent connect-button"
                  disabled={connecting}
                  onClick={() => void connectProfile()}
                >
                  {connecting
                    ? t("onboardingJoin.connecting", "Connecting profile...")
                    : t("onboardingJoin.connect", "Connect this profile")}
                </button>
              ) : (
                <div className="account-actions">
                  <a className="btn btn-accent" href={registerUrl}>
                    {t(
                      "onboardingJoin.createAccount",
                      "Create Business account",
                    )}
                  </a>
                  <a className="btn btn-ghost" href={loginUrl}>
                    {t("onboardingJoin.signIn", "Sign in to connect")}
                  </a>
                </div>
              )}
              <small className="expiry">
                {t("onboardingJoin.expires", "Secure link expires")}:{" "}
                {new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
                  dateStyle: "medium",
                }).format(new Date(preview.expiresAt))}
              </small>
            </aside>
          </div>
        ) : null}
      </section>

      <style jsx>{`
        .prepared-join-page {
          min-height: 100dvh;
        }
        .join-shell {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 3rem 0 5rem;
        }
        .join-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.75fr);
          gap: 1.25rem;
          align-items: start;
        }
        .join-card {
          border: 1px solid #dde1e6;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 18px 48px rgba(20, 24, 32, 0.08);
        }
        .join-state {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          padding: 2rem;
          display: grid;
          gap: 1rem;
          overflow-wrap: anywhere;
        }
        .profile-summary {
          padding: 1.5rem;
        }
        .profile-heading {
          display: grid;
          gap: 0.45rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid #e6e8eb;
        }
        .profile-heading > span,
        .connection-kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: #147d70;
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .profile-heading > span :global(svg),
        .connection-kicker :global(svg),
        .service-list :global(svg),
        .connection-panel li :global(svg) {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
        }
        .profile-heading h1 {
          font-family: var(--font-body);
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.05;
        }
        .profile-heading p,
        .profile-description,
        .connection-panel > p,
        .services-preview header p {
          color: #626870;
        }
        .profile-description {
          margin: 1.25rem 0;
          line-height: 1.65;
        }
        .profile-facts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin: 0 0 1.5rem;
        }
        .profile-facts div {
          min-width: 0;
          padding: 0.85rem;
          border: 1px solid #e6e8eb;
          border-radius: 6px;
          background: #fafbfb;
        }
        .profile-facts dt {
          color: #777d84;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .profile-facts dd {
          margin: 0.25rem 0 0;
          overflow-wrap: anywhere;
          font-weight: 750;
        }
        .services-preview {
          display: grid;
          gap: 0.85rem;
        }
        .services-preview > header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }
        .services-preview h2,
        .connection-panel h2 {
          font-family: var(--font-body);
          font-size: 1.25rem;
        }
        .services-preview header > span {
          display: grid;
          place-items: center;
          min-width: 40px;
          min-height: 40px;
          border-radius: 50%;
          background: #e7f5f2;
          color: #147d70;
          font-weight: 850;
        }
        .service-list {
          display: grid;
          border-top: 1px solid #e6e8eb;
        }
        .service-list article {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.9rem 0;
          border-bottom: 1px solid #e6e8eb;
        }
        .service-list article > div {
          min-width: 0;
          display: grid;
          gap: 0.28rem;
        }
        .service-list small {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: #777d84;
        }
        .service-list article > span {
          flex: 0 0 auto;
          font-weight: 800;
        }
        .service-list article > span[data-known="false"] {
          color: #a15b18;
          font-size: 0.78rem;
        }
        .connection-panel {
          position: sticky;
          top: 1rem;
          display: grid;
          gap: 1rem;
          padding: 1.35rem;
        }
        .connection-panel .email-bound-note {
          padding: 0.75rem;
          border-left: 3px solid #147d70;
          border-radius: 4px;
          background: #eef8f6;
          color: #234d48;
          font-size: 0.86rem;
          font-weight: 650;
          line-height: 1.5;
        }
        .connection-panel ul {
          display: grid;
          gap: 0.65rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .connection-panel li {
          display: flex;
          gap: 0.55rem;
          align-items: flex-start;
        }
        .connection-panel li :global(svg) {
          color: #147d70;
        }
        .price-note {
          padding: 0.8rem;
          border: 1px solid #f1d5ae;
          border-radius: 6px;
          background: #fff8eb;
          color: #795124;
          font-size: 0.84rem;
        }
        .account-actions {
          display: grid;
          gap: 0.65rem;
        }
        .account-actions :global(.btn),
        .connect-button {
          width: 100%;
          min-height: 48px;
          justify-content: center;
        }
        .expiry {
          color: #777d84;
          text-align: center;
        }
        @media (max-width: 820px) {
          .join-shell {
            width: min(100% - 28px, 680px);
            padding-top: 1.5rem;
          }
          .join-layout {
            grid-template-columns: 1fr;
          }
          .connection-panel {
            position: static;
            grid-row: 1;
          }
          .profile-facts {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 520px) {
          .prepared-join-page :global(.mobile-customer-dock) {
            display: none !important;
          }
          .prepared-join-page :global(.nav-simple-inner) {
            padding-inline: 14px;
          }
          .prepared-join-page :global(.public-explore-link),
          .prepared-join-page :global(.public-business-link),
          .prepared-join-page :global(.public-customer-link),
          .prepared-join-page :global(.public-login-link),
          .prepared-join-page :global(.public-register-link) {
            display: none;
          }
          .prepared-join-page :global(.auth-nav-links) {
            margin-left: auto;
          }
          .join-shell {
            width: 100%;
            padding: 0 0 4rem;
          }
          .join-card {
            border-width: 0 0 1px;
            border-radius: 0;
            box-shadow: none;
          }
          .profile-summary,
          .connection-panel,
          .join-state {
            padding: 1.15rem;
          }
          .service-list article {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
