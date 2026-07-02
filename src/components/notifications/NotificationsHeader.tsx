import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  markingRead: boolean;
  unreadCount: number;
  showActions?: boolean;
  onRefresh: () => void;
  onMarkAllRead: () => void;
};

export default function NotificationsHeader({
  loading,
  markingRead,
  unreadCount,
  showActions = true,
  onRefresh,
  onMarkAllRead,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="notifications-header">
      <div>
        <h1 className="page-title">{t("notifications.title", "Updates")}</h1>

        <p className="page-sub">
          {t("notifications.subtitle", "Appointments and support updates.")}
        </p>
      </div>

      {(showActions || unreadCount > 0) && (
        <div className="customer-notification-actions">
          {showActions && (
            <button
              onClick={onRefresh}
              className="btn btn-ghost"
              disabled={loading}
            >
              {loading
                ? t("notifications.refreshing", "Refreshing...")
                : t("common.refresh", "Refresh")}
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="btn btn-accent"
              disabled={markingRead}
            >
              {markingRead
                ? t("notifications.markingRead", "Marking read...")
                : t("notifications.markAllRead", "Mark all read")}
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .notifications-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .notifications-header :global(.page-sub) {
          margin-top: 0.35rem;
          max-width: 38rem;
        }

        .customer-notification-actions {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          padding-top: 0.15rem;
        }

        @media (max-width: 640px) {
          .notifications-header {
            display: grid;
          }

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
