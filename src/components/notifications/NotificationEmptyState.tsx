import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

export default function NotificationEmptyState() {
  const { t } = useI18n();

  return (
    <div className="card">
      <h3>{t("notifications.empty.title", "No notifications yet")}</h3>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {t("notifications.empty.body", "Booking updates will appear here.")}
      </p>

      <Link
        href="/explore"
        className="btn btn-accent"
        style={{ marginTop: "1rem" }}
      >
        {t("home.cta.explore")}
      </Link>
    </div>
  );
}
