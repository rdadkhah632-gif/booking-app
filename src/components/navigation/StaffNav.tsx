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
    </>
  );
}
