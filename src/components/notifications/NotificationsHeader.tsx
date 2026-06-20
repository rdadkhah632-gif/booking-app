import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  markingRead: boolean;
  unreadCount: number;
  onRefresh: () => void;
  onMarkAllRead: () => void;
};

export default function NotificationsHeader({
  loading,
  markingRead,
  unreadCount,
  onRefresh,
  onMarkAllRead,
}: Props) {
  const { t } = useI18n();

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h1 className="page-title">{t("notifications.title", "Updates")}</h1>

      <p className="page-sub" style={{ marginTop: "0.5rem" }}>
        {t(
          "notifications.subtitle",
          "Booking updates and appointment changes.",
        )}
      </p>

      <div className="customer-notification-actions">
        <Link href="/my-bookings" className="btn btn-ghost">
          {t("nav.myBookings")}
        </Link>

        <button
          onClick={onRefresh}
          className="btn btn-ghost"
          disabled={loading}
        >
          {loading
            ? t("notifications.refreshing", "Refreshing...")
            : t("common.refresh", "Refresh")}
        </button>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="btn btn-accent"
            disabled={markingRead}
          >
            {markingRead
              ? t("notifications.markingRead", "Marking read...")
              : `${t("notifications.mark", "Mark")} ${unreadCount} ${t("notifications.read", "read")}`}
          </button>
        )}
      </div>

      <style jsx>{`
        .customer-notification-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .customer-notification-actions :global(.btn),
          .customer-notification-actions button,
          .customer-notification-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
