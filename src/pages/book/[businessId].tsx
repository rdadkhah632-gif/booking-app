import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import AuthNav from "@/components/AuthNav";
import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";
import { useI18n } from "@/lib/useI18n";

export default function LegacyBookBusinessRedirect() {
  const router = useRouter();
  const { t } = useI18n();
  const { businessId } = router.query;

  useEffect(() => {
    if (!router.isReady || !businessId || Array.isArray(businessId)) return;
    void router.replace(`/explore/${businessId}`);
  }, [router.isReady, businessId, router]);

  const validBusinessId = typeof businessId === "string" ? businessId : null;

  return (
    <main className="marketplace-surface legacy-book-page">
      <MarketplaceSurfaceStyles />
      <AuthNav />

      <section className="container legacy-book-shell">
        <div className="legacy-book-status" role="status" aria-live="polite">
          <span className="legacy-book-icon" aria-hidden="true">
            <LoaderCircle size={23} />
          </span>
          <p className="legacy-book-kicker">
            {t("legacyBook.kicker", "Mirëbook booking")}
          </p>
          <h1>{t("legacyBook.title", "Opening the booking page")}</h1>
          <p>
            {t(
              "legacyBook.body",
              "You will be taken to the business profile to choose a service, staff member and available time.",
            )}
          </p>

          <div className="legacy-book-actions">
            <Link
              href={
                validBusinessId ? `/explore/${validBusinessId}` : "/explore"
              }
              className="btn btn-accent"
            >
              {validBusinessId
                ? t("legacyBook.continue", "Continue to business")
                : t("legacyBook.browse", "Explore Mirëbook")}
            </Link>
            <Link href="/support/customer" className="btn btn-ghost">
              {t("nav.customerSupport", "Customer support")}
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .legacy-book-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: #fff;
        }

        .legacy-book-shell {
          display: grid;
          min-height: calc(100dvh - 78px);
          place-items: center;
          padding: 3rem 24px 6rem;
        }

        .legacy-book-status {
          display: grid;
          justify-items: center;
          max-width: 580px;
          text-align: center;
        }

        .legacy-book-icon {
          display: grid;
          width: 48px;
          height: 48px;
          margin-bottom: 1.25rem;
          place-items: center;
          border: 1px solid rgba(237, 90, 42, 0.2);
          border-radius: 50%;
          color: var(--accent-strong);
          background: var(--accent-soft);
        }

        .legacy-book-icon :global(svg) {
          animation: legacy-book-spin 1s linear infinite;
        }

        .legacy-book-kicker {
          margin: 0 0 0.55rem;
          color: var(--accent-strong);
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .legacy-book-status h1 {
          margin: 0;
          font-family: var(--font-body);
          font-size: clamp(2rem, 6vw, 3.25rem);
          line-height: 1.05;
        }

        .legacy-book-status > p:last-of-type {
          max-width: 34rem;
          margin: 0.85rem 0 0;
          color: var(--text-muted);
          line-height: 1.65;
        }

        .legacy-book-actions {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1.5rem;
        }

        .legacy-book-actions :global(.btn) {
          min-height: 46px;
          border-radius: 6px;
        }

        @keyframes legacy-book-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .legacy-book-icon :global(svg) {
            animation: none;
          }
        }

        @media (max-width: 560px) {
          .legacy-book-shell {
            min-height: calc(100dvh - 114px);
            padding: 2rem 14px 5rem;
          }

          .legacy-book-actions,
          .legacy-book-actions :global(.btn),
          .legacy-book-actions a {
            width: 100%;
          }

          .legacy-book-actions :global(.btn) {
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
