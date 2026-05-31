import Link from "next/link";
import LanguageToggle from "./LanguageToggle";
import { useI18n } from "@/lib/useI18n";
import { NavProps, notificationLabel } from "./navTypes";

export default function CustomerNav({ notificationCount, onLogout }: NavProps) {
  const { t } = useI18n();
  return (
    <>
      <Link href="/explore" className="muted">
        {t("nav.explore")}
      </Link>

      <Link href="/my-bookings" className="muted">
        {t("nav.myBookings")}
      </Link>

      <Link
        href="/notifications"
        className={notificationCount > 0 ? "btn btn-accent" : "muted"}
      >
        {notificationLabel("customer", notificationCount, t)}
      </Link>

      <Link href="/support/customer" className="muted nav-wide-only">
        {t("nav.customerSupport")}
      </Link>

      <LanguageToggle />

      <Link href="/account" className="muted">
        {t("nav.account")}
      </Link>

      <button onClick={onLogout} className="btn btn-ghost">
        {t("nav.logout")}
      </button>
    </>
  );
}
