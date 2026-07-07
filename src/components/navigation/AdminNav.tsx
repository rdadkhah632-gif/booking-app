import Link from "next/link";
import { NavProps, notificationLabel } from "./navTypes";

export default function AdminNav({
  notificationCount,
  onLogout,
  t = (key, fallback) => fallback || key,
}: NavProps) {
  return (
    <>
      <Link href="/admin" className="btn btn-accent">
        {t("nav.operator", "Operator")}
      </Link>

      <Link href="/admin/businesses" className="muted">
        {t("nav.businesses", "Businesses")}
      </Link>

      <Link href="/admin/users" className="muted">
        {t("nav.users", "Users")}
      </Link>

      <Link
        href="/admin/notifications"
        className={notificationCount > 0 ? "btn btn-accent" : "muted"}
      >
        {notificationLabel("admin", notificationCount, t)}
      </Link>

      <Link href="/admin/support" className="muted nav-wide-only">
        {t("nav.support", "Support")}
      </Link>

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
    </>
  );
}
