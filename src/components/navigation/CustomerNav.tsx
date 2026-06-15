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

      <LanguageToggle />

      <Link href="/account" className="muted">
        {t("nav.account")}
      </Link>

      {notificationCount > 0 && (
        <Link href="/notifications" className="btn btn-accent">
          {notificationLabel("customer", notificationCount, t)}
        </Link>
      )}

      <button onClick={onLogout} className="btn btn-ghost">
        {t("nav.logout")}
      </button>
    </>
  );
}
