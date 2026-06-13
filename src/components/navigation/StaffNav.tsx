import Link from "next/link";
import LanguageToggle from "./LanguageToggle";
import { NavProps, notificationLabel } from "./navTypes";

export default function StaffNav({
  notificationCount,
  onLogout,
  t = (key, fallback) => fallback || key,
}: NavProps) {
  return (
    <>
      <div className="staff-nav-work">
        <Link href="/staff" className="muted">
          {t("staff.schedule.title", "My schedule")}
        </Link>

        <Link href="/staff/calendar" className="muted">
          {t("staffCalendar.title", "Calendar")}
        </Link>

        <Link href="/staff/availability" className="muted">
          {t("staff.actions.updateAvailability", "My availability")}
        </Link>

        <Link
          href="/staff/notifications"
          className={notificationCount > 0 ? "btn btn-accent" : "muted"}
        >
          {notificationLabel("staff", notificationCount, t)}
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

        <button onClick={onLogout} className="btn btn-ghost">
          {t("auth.logout", "Log out")}
        </button>
      </div>

      <style jsx>{`
        .staff-nav-work,
        .staff-nav-account {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          flex: 0 0 auto;
        }

        .staff-nav-account {
          padding-left: 0.8rem;
          border-left: 1px solid var(--border);
        }

        @media (max-width: 860px) {
          .staff-nav-work,
          .staff-nav-account {
            gap: 0.5rem;
          }

          .staff-nav-account {
            padding-left: 0.65rem;
          }
        }
      `}</style>
    </>
  );
}
