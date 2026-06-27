import Link from "next/link";
import LanguageToggle from "./LanguageToggle";
import { useI18n } from "@/lib/useI18n";
import { NavProps, notificationLabel } from "./navTypes";

export default function CustomerNav({ notificationCount, onLogout }: NavProps) {
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

      <div className="customer-nav-desktop-actions">
        <LanguageToggle />

        <Link href="/account" className="muted">
          {t("nav.account")}
        </Link>

        <button onClick={onLogout} className="btn btn-ghost">
          {t("nav.logout")}
        </button>
      </div>

      <details className="customer-nav-mobile-account">
        <summary>{t("nav.account")}</summary>
        <div className="customer-nav-mobile-menu">
          <LanguageToggle />
          <Link href="/account" className="muted">
            {t("nav.account")}
          </Link>
          <button onClick={onLogout} className="btn btn-ghost">
            {t("nav.logout")}
          </button>
        </div>
      </details>

      <style jsx>{`
        .customer-nav-desktop-actions {
          display: contents;
        }

        .customer-nav-mobile-account {
          display: none;
          position: relative;
        }

        @media (max-width: 540px) {
          .customer-nav-desktop-actions {
            display: none;
          }

          .customer-nav-mobile-account {
            display: block;
          }

          .customer-nav-mobile-account summary {
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

          .customer-nav-mobile-account summary::-webkit-details-marker {
            display: none;
          }

          .customer-nav-mobile-account summary::after {
            content: "";
            width: 0.34rem;
            height: 0.34rem;
            border-right: 1.5px solid currentColor;
            border-bottom: 1.5px solid currentColor;
            transform: rotate(45deg) translateY(-1px);
            opacity: 0.75;
          }

          .customer-nav-mobile-account[open] summary::after {
            transform: rotate(225deg) translateY(-1px);
          }

          .customer-nav-mobile-menu {
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

          .customer-nav-mobile-menu :global(.language-switcher),
          .customer-nav-mobile-menu :global(a),
          .customer-nav-mobile-menu button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
