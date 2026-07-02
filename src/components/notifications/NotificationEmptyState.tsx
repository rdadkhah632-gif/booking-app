import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

export default function NotificationEmptyState() {
  const { t } = useI18n();

  return (
    <div className="card notification-empty-state">
      <h3>{t("notifications.empty.title", "No updates yet")}</h3>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {t(
          "notifications.empty.body",
          "Appointment and support updates will appear here.",
        )}
      </p>

      <Link
        href="/explore"
        className="btn btn-accent"
        style={{ marginTop: "1rem" }}
      >
        {t("home.cta.explore")}
      </Link>

      <style jsx>{`
        .notification-empty-state {
          display: grid;
          justify-items: flex-start;
          gap: 0.15rem;
          max-width: 560px;
          padding: 1rem;
        }

        .notification-empty-state h3,
        .notification-empty-state p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
