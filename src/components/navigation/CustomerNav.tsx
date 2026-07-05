import Link from "next/link";
import LanguageToggle from "./LanguageToggle";
import { useI18n } from "@/lib/useI18n";
import { NavProps, notificationLabel } from "./navTypes";

export default function CustomerNav({ notificationCount }: NavProps) {
  const { t } = useI18n();
  return (
    <>
      <Link href="/explore" className="muted customer-nav-primary">
        {t("nav.explore")}
      </Link>

      <Link href="/my-bookings" className="muted customer-nav-primary">
        {t("nav.myBookings")}
      </Link>

      {notificationCount > 0 && (
        <Link
          href="/notifications"
          className="btn btn-accent customer-nav-primary"
        >
          {notificationLabel("customer", notificationCount, t)}
        </Link>
      )}

      <details className="customer-nav-account-menu">
        <summary>{t("nav.account")}</summary>
        <div className="customer-nav-account-menu-panel">
          <LanguageToggle />
          <Link href="/account" className="muted">
            {t("nav.account")}
          </Link>
          <Link href="/logout" className="btn btn-ghost">
            {t("nav.logout")}
          </Link>
        </div>
      </details>

      <style jsx>{`
        .customer-nav-account-menu {
          display: block;
          position: relative;
        }

        .customer-nav-account-menu summary {
          min-height: 2.25rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.48rem 0.72rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
          color: var(--text);
          cursor: pointer;
          font-weight: 800;
          list-style: none;
          white-space: nowrap;
        }

        .customer-nav-account-menu summary::-webkit-details-marker {
          display: none;
        }

        .customer-nav-account-menu summary::after {
          content: "";
          width: 0.34rem;
          height: 0.34rem;
          border-right: 1.5px solid currentColor;
          border-bottom: 1.5px solid currentColor;
          transform: rotate(45deg) translateY(-1px);
          opacity: 0.75;
        }

        .customer-nav-account-menu[open] summary::after {
          transform: rotate(225deg) translateY(-1px);
        }

        .customer-nav-account-menu-panel {
          position: absolute;
          right: 0;
          top: calc(100% + 0.45rem);
          z-index: 60;
          width: min(13rem, calc(100vw - 1.5rem));
          display: grid;
          gap: 0.25rem;
          padding: 0.45rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: rgba(24, 23, 34, 0.98);
          box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.32);
        }

        .customer-nav-account-menu-panel :global(.language-switcher),
        .customer-nav-account-menu-panel :global(a),
        .customer-nav-account-menu-panel button {
          width: 100%;
        }

        @media (max-width: 540px) {
          .customer-nav-account-menu-panel {
            position: fixed;
            top: 4.75rem;
            right: 0.75rem;
            left: 0.75rem;
            width: auto;
          }
        }
      `}</style>
    </>
  );
}
