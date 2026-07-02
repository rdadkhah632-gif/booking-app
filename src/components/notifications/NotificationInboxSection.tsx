import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { NotificationRow } from "./notificationTypes";

type Props = {
  notifications: NotificationRow[];
  onMarkRead: (notification: NotificationRow) => void;
  notificationBorder: (notification: NotificationRow) => string;
  notificationBackground: (notification: NotificationRow) => string;
};

function notificationText(
  notification: NotificationRow,
  t: (key: string, fallback?: string) => string,
) {
  const type = String((notification as any).type || "");

  if (type === "booking_requested") {
    return {
      title: t("notifications.types.bookingRequested.title", "Request sent"),
      message:
        notification.message ||
        t(
          "notifications.types.bookingRequested.message",
          "Your booking request has been sent to the business for review.",
        ),
    };
  }

  if (type === "booking_accepted") {
    return {
      title: t("notifications.types.bookingAccepted.title", "Booking accepted"),
      message: t(
        "notifications.types.bookingAccepted.message",
        "Your booking has been accepted and confirmed.",
      ),
    };
  }

  if (type === "booking_declined") {
    return {
      title: t("notifications.types.bookingDeclined.title", "Booking declined"),
      message: t(
        "notifications.types.bookingDeclined.message",
        "Your booking request was declined.",
      ),
    };
  }

  if (type === "booking_cancelled") {
    return {
      title: t(
        "notifications.types.bookingCancelled.title",
        "Booking cancelled",
      ),
      message: t(
        "notifications.types.bookingCancelled.message",
        "Your booking was cancelled by the business.",
      ),
    };
  }

  if (type === "booking_completed") {
    return {
      title: t(
        "notifications.types.bookingCompleted.title",
        "Appointment completed",
      ),
      message: t(
        "notifications.types.bookingCompleted.message",
        "Your appointment has been marked as completed.",
      ),
    };
  }

  if (type === "reschedule_accepted") {
    return {
      title: t(
        "notifications.types.rescheduleAccepted.title",
        "Reschedule accepted",
      ),
      message: t(
        "notifications.types.rescheduleAccepted.message",
        "Your reschedule request has been accepted.",
      ),
    };
  }

  if (type === "reschedule_declined") {
    return {
      title: t(
        "notifications.types.rescheduleDeclined.title",
        "Reschedule declined",
      ),
      message: t(
        "notifications.types.rescheduleDeclined.message",
        "Your reschedule request was declined. The original booking remains unchanged.",
      ),
    };
  }

  if (type === "booking_rescheduled_by_business") {
    return {
      title: t(
        "notifications.types.bookingRescheduledByBusiness.title",
        "Booking rescheduled",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.bookingRescheduledByBusiness.message",
          "Your booking was moved to a new appointment time by the business.",
        ),
    };
  }

  if (type === "support_reply_admin") {
    return {
      title: t(
        "notifications.types.supportReplyAdmin.title",
        "Mirëbook support replied",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.supportReplyAdmin.message",
          "Open your support conversation to read the latest reply.",
        ),
    };
  }

  if (type === "support_resolved") {
    return {
      title: t(
        "notifications.types.supportResolved.title",
        "Support ticket resolved",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.supportResolved.message",
          "Your support conversation has been marked as resolved.",
        ),
    };
  }

  return {
    title:
      notification.title ||
      t("notifications.types.generic.title", "Mirëbook update"),
    message: notification.message || "",
  };
}

function notificationActionLabel(
  notification: NotificationRow,
  t: (key: string, fallback?: string) => string,
) {
  const type = String(notification.type || "");

  if (type.includes("support")) {
    return t("notifications.actions.openSupport", "Open support");
  }

  if (type.includes("reschedule")) {
    return t("notifications.actions.viewRequest", "View request");
  }

  if (type.includes("booking")) {
    return t("notifications.actions.viewBooking", "View booking");
  }

  return t("notifications.actions.openUpdate", "Open update");
}

export default function NotificationInboxSection({
  notifications,
  onMarkRead,
  notificationBorder,
  notificationBackground,
}: Props) {
  const { t } = useI18n();

  if (notifications.length === 0) return null;

  return (
    <div className="customer-notification-section">
      <div>
        <h2 style={{ fontFamily: "var(--font-display)" }}>
          {t("notifications.inbox.title", "Latest")}
        </h2>
      </div>

      {notifications.map((notification) => {
        const displayNotification = notificationText(notification, t);

        return (
          <div
            key={notification.id}
            className="card customer-notification-card"
            style={{
              borderColor: notificationBorder(notification),
              background: notificationBackground(notification),
            }}
          >
            <div className="customer-notification-card-row">
              <div className="customer-notification-card-main">
                <div className="customer-notification-title-row">
                  <strong>{displayNotification.title}</strong>

                  <span
                    className="small customer-notification-status"
                    style={{
                      background: notification.read_at
                        ? "var(--surface-2)"
                        : "var(--accent-dim)",
                      color: notification.read_at
                        ? "var(--text-muted)"
                        : "var(--accent)",
                    }}
                  >
                    {notification.read_at
                      ? t("notifications.readStatus.read", "Read")
                      : t("notifications.readStatus.unread", "Unread")}
                  </span>
                </div>

                {displayNotification.message && (
                  <p className="small muted customer-notification-message">
                    {displayNotification.message}
                  </p>
                )}

                <p className="small muted customer-notification-time">
                  {notification.created_at
                    ? new Date(notification.created_at).toLocaleString()
                    : t("notifications.recently", "Recently")}
                </p>
              </div>

              <div className="customer-notification-card-actions">
                {notification.action_url && (
                  <Link
                    href={notification.action_url}
                    className="btn btn-accent"
                    onClick={() => onMarkRead(notification)}
                  >
                    {notificationActionLabel(notification, t)}
                  </Link>
                )}

                {!notification.read_at && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onMarkRead(notification)}
                  >
                    {t("notifications.markRead", "Mark read")}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .customer-notification-section {
          display: grid;
          gap: 0.75rem;
        }

        .customer-notification-card {
          padding: 0.85rem;
        }

        .customer-notification-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .customer-notification-card-main {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 0.32rem;
        }

        .customer-notification-title-row {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .customer-notification-status {
          padding: 0.18rem 0.5rem;
          border: 1px solid var(--border);
          border-radius: 999px;
        }

        .customer-notification-message,
        .customer-notification-time {
          margin: 0;
        }

        .customer-notification-card-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 640px) {
          .customer-notification-card-row,
          .customer-notification-card-actions {
            display: grid;
          }

          .customer-notification-card-actions,
          .customer-notification-card-actions :global(.btn),
          .customer-notification-card-actions button,
          .customer-notification-card-actions a {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
