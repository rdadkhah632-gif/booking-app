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

      <div className="staff-nav-account">
        <Link href="/support/staff" className="muted nav-wide-only">
          {t("nav.staffSupport", "Staff support")}
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

      <style jsx>{`
        .staff-nav-work,
        .staff-nav-account {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          flex-wrap: wrap;
        }

        .staff-nav-work {
          flex: 1 1 auto;
        }

        .staff-nav-account {
          flex: 0 1 auto;
        }

        .staff-nav-account {
          padding-left: 0.8rem;
          border-left: 1px solid var(--border);
        }

        @media (max-width: 860px) {
          .staff-nav-work,
          .staff-nav-account {
            gap: 0.5rem;
            width: 100%;
            flex: 1 1 100%;
          }

          .staff-nav-account {
            padding-left: 0;
            border-left: 0;
          }
        }
      `}</style>
    </>
  );
}
