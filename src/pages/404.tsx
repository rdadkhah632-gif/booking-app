import Head from "next/head";
import Link from "next/link";
import { Compass, LifeBuoy } from "lucide-react";
import AuthNav from "@/components/AuthNav";
import CustomerPortalStyles from "@/components/CustomerPortalStyles";
import { useI18n } from "@/lib/useI18n";

export default function NotFoundPage() {
  const { t } = useI18n();
  const pageTitle = `${t("notFound.title", "This page could not be found")} | Mirëbook`;

  return (
    <main className="marketplace-surface customer-portal-surface not-found-surface">
      <Head>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <CustomerPortalStyles />
      <AuthNav />

      <section className="container customer-page-container not-found-container">
        <div className="not-found-content">
          <p className="not-found-kicker">{t("notFound.kicker", "404")}</p>
          <h1 className="page-title">
            {t("notFound.title", "This page could not be found")}
          </h1>
          <p className="page-sub">
            {t(
              "notFound.body",
              "The link may be out of date, or the page may no longer be available.",
            )}
          </p>

          <div className="not-found-actions">
            <Link href="/explore" className="btn btn-accent">
              <Compass aria-hidden="true" size={18} />
              {t("notFound.explore", "Explore Mirëbook")}
            </Link>
            <Link href="/support" className="btn btn-ghost">
              <LifeBuoy aria-hidden="true" size={18} />
              {t("nav.support", "Support")}
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .not-found-surface {
          min-height: 100vh;
          min-height: 100dvh;
        }

        .not-found-container {
          min-height: calc(100vh - 88px);
          min-height: calc(100dvh - 88px);
          display: grid;
          place-items: center;
        }

        .not-found-content {
          width: min(100%, 640px);
          padding: 4rem 0 7rem;
          text-align: center;
        }

        .not-found-kicker {
          margin: 0 0 0.9rem;
          color: var(--success);
          font-size: 0.85rem;
          font-weight: 850;
          letter-spacing: 0;
        }

        .not-found-content :global(.page-sub) {
          margin: 1rem auto 0;
        }

        .not-found-actions {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 1.75rem;
        }

        .not-found-actions :global(.btn) {
          gap: 0.5rem;
        }

        @media (max-width: 520px) {
          .not-found-container {
            place-items: start center;
          }

          .not-found-content {
            padding-top: 4.5rem;
          }

          .not-found-actions {
            flex-direction: column;
          }

          .not-found-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
