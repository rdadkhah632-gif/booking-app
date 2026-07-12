import Link from "next/link";
import LanguageToggle from "./LanguageToggle";
import { NavProps } from "./navTypes";

export default function StaffNav({
  notificationCount,
  onLogout,
  t = (key, fallback) => fallback || key,
}: NavProps) {
  return (
    <>
      <div className="staff-nav-work">
        <Link href="/staff" className="muted">
          {t("dashboardLayout.staffNav.today", "Today")}
        </Link>

        <Link href="/staff/calendar" className="muted">
          {t("dashboardLayout.staffNav.calendar", "Calendar")}
        </Link>

        <Link href="/staff/availability" className="muted">
          {t("dashboardLayout.staffNav.availability", "Availability")}
        </Link>

        <Link
          href="/staff/notifications"
          className={notificationCount > 0 ? "btn btn-accent" : "muted"}
        >
          {notificationCount > 0
            ? `${t("dashboardLayout.staffNav.inbox", "Inbox")} (${notificationCount})`
            : t("dashboardLayout.staffNav.inbox", "Inbox")}
        </Link>
      </div>

      <div className="staff-nav-desktop-account">
        <Link href="/support/staff" className="muted nav-wide-only">
          {t("dashboardLayout.nav.help", "Help")}
        </Link>

        <LanguageToggle />

        <Link href="/account" className="muted">
          {t("nav.account", "Account")}
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="btn btn-ghost"
          aria-label={t("auth.logout", "Log out")}
        >
          {t("auth.logout", "Log out")}
        </button>
      </div>

      <details className="staff-nav-mobile-account">
        <summary>{t("nav.account", "Account")}</summary>
        <div className="staff-nav-mobile-menu">
          <Link href="/support/staff" className="muted">
            {t("dashboardLayout.nav.help", "Help")}
          </Link>
          <LanguageToggle />
          <Link href="/account" className="muted">
            {t("nav.account", "Account")}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-ghost"
            aria-label={t("auth.logout", "Log out")}
          >
            {t("auth.logout", "Log out")}
          </button>
        </div>
      </details>

      <style jsx>{`
        .staff-nav-work,
        .staff-nav-desktop-account {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          flex-wrap: wrap;
        }

        .staff-nav-work {
          flex: 1 1 auto;
        }

        .staff-nav-desktop-account {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          flex: 0 1 auto;
          padding-left: 0.8rem;
          border-left: 1px solid var(--border);
        }

        .staff-nav-mobile-account {
          display: none;
          position: relative;
        }

        @media (max-width: 860px) {
          .staff-nav-work {
            gap: 0.5rem;
            width: 100%;
            flex: 1 1 100%;
          }

          .staff-nav-desktop-account {
            display: none;
          }

          .staff-nav-mobile-account {
            display: block;
          }

          .staff-nav-mobile-account summary {
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

          .staff-nav-mobile-account summary::-webkit-details-marker {
            display: none;
          }

          .staff-nav-mobile-account summary::after {
            content: "";
            width: 0.34rem;
            height: 0.34rem;
            border-right: 1.5px solid currentColor;
            border-bottom: 1.5px solid currentColor;
            transform: rotate(45deg) translateY(-1px);
            opacity: 0.75;
          }

          .staff-nav-mobile-account[open] summary::after {
            transform: rotate(225deg) translateY(-1px);
          }

          .staff-nav-mobile-menu {
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

          .staff-nav-mobile-account:not([open]) .staff-nav-mobile-menu {
            display: none;
          }

          .staff-nav-mobile-account[open] .staff-nav-mobile-menu {
            display: grid;
          }

          .staff-nav-mobile-menu :global(.language-switcher),
          .staff-nav-mobile-menu :global(a),
          .staff-nav-mobile-menu button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
