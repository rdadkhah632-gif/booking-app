import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";
import { signOutCurrentSession } from "@/lib/auth/signOutCurrentSession";
import { useI18n } from "@/lib/useI18n";

export default function LogoutPage() {
  const { t } = useI18n();

  useEffect(() => {
    void signOutCurrentSession("/");
  }, []);

  return (
    <main className="marketplace-surface logout-page">
      <MarketplaceSurfaceStyles />
      <section className="container logout-shell">
        <div className="logout-status" role="status" aria-live="polite">
          <span className="logout-icon" aria-hidden="true">
            <LoaderCircle size={23} />
          </span>
          <div>
            <h1>{t("account.security.signingOut", "Signing out...")}</h1>
            <p>
              {t(
                "logout.waitBody",
                "Your Mirëbook session is being closed securely.",
              )}
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .logout-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: #fff;
        }

        .logout-shell {
          display: grid;
          min-height: 100dvh;
          place-items: center;
          padding: 2rem 20px;
        }

        .logout-status {
          display: flex;
          align-items: center;
          gap: 1rem;
          max-width: 460px;
        }

        .logout-icon {
          display: grid;
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          place-items: center;
          border-radius: 50%;
          color: var(--accent-strong);
          background: var(--accent-soft);
        }

        .logout-icon :global(svg) {
          animation: logout-spin 1s linear infinite;
        }

        .logout-status h1 {
          margin: 0;
          font-family: var(--font-body);
          font-size: 1.35rem;
        }

        .logout-status p {
          margin: 0.3rem 0 0;
          color: var(--text-muted);
          line-height: 1.5;
        }

        @keyframes logout-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .logout-icon :global(svg) {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
