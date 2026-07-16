import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import { formatLocalizedDate } from "@/lib/i18n";

type Notification = {
  id: string;
  booking_id: string | null;
  title: string | null;
  message: string | null;
  type: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

type BookingContext = {
  id: string;
  customer_name: string;
  start_at: string;
  duration_minutes: number;
  status: string;
  services?: { name?: string | null } | { name?: string | null }[] | null;
};

function bookingServiceName(booking: BookingContext, fallback: string) {
  if (!booking.services) return fallback;
  return Array.isArray(booking.services)
    ? booking.services[0]?.name || fallback
    : booking.services.name || fallback;
}

function dateInputValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function staffNotificationText(
  notification: Notification,
  t: (key: string, fallback?: string) => string,
) {
  const type = String(notification.type || "");

  if (
    type === "booking_created" ||
    type === "booking_requested" ||
    type === "booking_approval_requested"
  ) {
    return {
      title: t(
        "staffNotifications.booking.pendingTitle",
        "Awaiting business approval",
      ),
      message: t(
        "staffNotifications.booking.pendingBody",
        "This assigned booking request is waiting for the business to approve it. No staff action is required.",
      ),
    };
  }

  if (type === "booking_confirmed" || type === "booking_accepted") {
    return {
      title: t("staff.status.confirmed", "Confirmed"),
      message: t(
        "staffNotifications.booking.confirmedBody",
        "This assigned booking is confirmed and belongs in your active schedule.",
      ),
    };
  }

  if (type === "booking_declined") {
    return {
      title: t("staff.status.declined", "Declined"),
      message: t(
        "staffNotifications.booking.declinedBody",
        "This booking request was declined and is not active work.",
      ),
    };
  }

  if (type === "booking_cancelled") {
    return {
      title: t("staff.status.cancelled", "Cancelled"),
      message: t(
        "staffNotifications.booking.cancelledBody",
        "This booking was cancelled and is no longer active work.",
      ),
    };
  }

  if (type === "booking_completed") {
    return {
      title: t("staff.status.completed", "Completed"),
      message: t(
        "staffNotifications.booking.completedBody",
        "This assigned appointment has been completed.",
      ),
    };
  }

  if (type.includes("booking")) {
    return {
      title: t(
        "notifications.types.staffBooking.title",
        "Staff booking update",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.staffBooking.message",
          "One of your assigned bookings has been updated.",
        ),
    };
  }

  if (type.includes("schedule") || type.includes("availability")) {
    return {
      title: t("notifications.types.staffSchedule.title", "Schedule update"),
      message:
        notification.message ||
        t(
          "notifications.types.staffSchedule.message",
          "Your staff schedule or availability has been updated.",
        ),
    };
  }

  if (type.includes("profile") || type.includes("staff")) {
    return {
      title: t(
        "notifications.types.staffProfile.title",
        "Staff profile update",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.staffProfile.message",
          "Your staff profile or access has been updated.",
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
      t("staffNotifications.fallback.title", "Staff update"),
    message:
      notification.message ||
      t("staffNotifications.fallback.message", "You have a new staff update."),
  };
}

export default function StaffNotificationsPage() {
  const { locale, t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bookingContexts, setBookingContexts] = useState<
    Record<string, BookingContext>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login?redirectTo=/staff/notifications";
      return;
    }

    const capabilities = await getAccountCapabilities(
      session.user.id,
      session.user.email,
    );

    if (!capabilities.canUseStaff || !capabilities.primaryStaffId) {
      window.location.href = capabilities.defaultRoute;
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, booking_id, title, message, type, action_url, read_at, created_at",
      )
      .eq("user_id", session.user.id)
      .in("audience", ["staff", "general"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const nextNotifications = (data || []) as Notification[];
    setNotifications(nextNotifications);

    const bookingIds = Array.from(
      new Set(
        nextNotifications
          .map((notification) => notification.booking_id)
          .filter((bookingId): bookingId is string => Boolean(bookingId)),
      ),
    );

    if (bookingIds.length > 0) {
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(
          "id, customer_name, start_at, duration_minutes, status, services(name)",
        )
        .eq("staff_member_id", capabilities.primaryStaffId)
        .in("id", bookingIds);

      setBookingContexts(
        ((bookingData || []) as unknown as BookingContext[]).reduce(
          (map, booking) => {
            map[booking.id] = booking;
            return map;
          },
          {} as Record<string, BookingContext>,
        ),
      );
    } else {
      setBookingContexts({});
    }
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    await loadNotifications();
  }

  async function markAllRead() {
    const unreadIds = notifications
      .filter((item) => !item.read_at)
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);

    await loadNotifications();
  }

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.read_at).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread")
      return notifications.filter((item) => !item.read_at);
    return notifications;
  }, [filter, notifications]);

  function notificationTypeLabel(type?: string | null) {
    if (!type) return t("staffNotifications.type.general", "General");
    if (type.includes("booking"))
      return t("staffNotifications.type.booking", "Booking");
    if (type.includes("schedule") || type.includes("availability"))
      return t("staffNotifications.type.schedule", "Schedule");
    if (type.includes("profile") || type.includes("staff"))
      return t("staffNotifications.type.profile", "Profile");
    return t("staffNotifications.type.general", "General");
  }

  function notificationActionLabel(type?: string | null) {
    const value = String(type || "");
    if (value.includes("booking"))
      return t("staffNotifications.actions.viewSchedule", "View calendar");
    if (value.includes("availability") || value.includes("schedule"))
      return t("staffNotifications.actions.openSchedule", "Open calendar");
    if (value.includes("support"))
      return t("staffNotifications.actions.openSupport", "Open support");
    return t("staffNotifications.actions.openUpdate", "Open update");
  }

  return (
    <DashboardLayout
      workspace="staff"
      title={t("staffNotifications.title", "Inbox")}
      subtitle={t(
        "staffNotifications.body",
        "Appointments, schedule changes and support replies.",
      )}
    >
      <section className="staff-workspace-page">
        {!loading && !error && (
          <div className="staff-notification-utility">
            <div>
              <strong>
                {unreadCount > 0
                  ? `${unreadCount} ${unreadCount === 1 ? t("staffNotifications.unreadSingle", "unread update") : t("staffNotifications.unreadPlural", "unread updates")}`
                  : t("staffNotifications.inboxClear", "Everything is read")}
              </strong>
            </div>

            <div className="staff-notification-filters">
              <button
                type="button"
                className={
                  filter === "all" ? "btn btn-accent" : "btn btn-ghost"
                }
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
              >
                {t("staffNotifications.filter.all", "All")}
              </button>
              <button
                type="button"
                className={
                  filter === "unread" ? "btn btn-accent" : "btn btn-ghost"
                }
                onClick={() => setFilter("unread")}
                aria-pressed={filter === "unread"}
              >
                {t("staffNotifications.filter.unread", "Unread")}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="btn btn-ghost staff-mark-all-read"
                >
                  {t("staffNotifications.markAllRead", "Mark all read")}
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">
              {t("staffNotifications.loading", "Loading staff inbox...")}
            </p>
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{ borderColor: "rgba(255,77,109,0.35)" }}
          >
            <p style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {!loading && !error && filteredNotifications.length === 0 && (
          <div className="card staff-notification-empty">
            <h3>
              {filter === "unread"
                ? t("staffNotifications.empty.unreadTitle", "No unread updates")
                : t("staffNotifications.empty.title", "No updates yet")}
            </h3>
            <p className="muted">
              {filter === "unread"
                ? t(
                    "staffNotifications.empty.unreadBody",
                    "You have read every update.",
                  )
                : t(
                    "staffNotifications.empty.body",
                    "Appointment, schedule and support updates will appear here.",
                  )}
            </p>
            <div className="staff-notification-empty-actions">
              <Link href="/staff/calendar" className="btn btn-accent">
                {t("staffNotifications.actions.viewSchedule", "View calendar")}
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && filteredNotifications.length > 0 && (
          <div className="staff-notification-list">
            {filteredNotifications.map((item) => {
              const displayNotification = staffNotificationText(item, t);
              const booking = item.booking_id
                ? bookingContexts[item.booking_id]
                : null;
              const actionUrl = booking
                ? `/staff/calendar?date=${dateInputValue(booking.start_at)}&bookingId=${booking.id}`
                : item.action_url;

              return (
                <div key={item.id} className="card staff-notification-card">
                  <div>
                    <div className="staff-notification-title-row">
                      <strong>{displayNotification.title}</strong>
                      {!item.read_at && (
                        <span className="badge badge-accent">
                          {t("common.new", "New")}
                        </span>
                      )}
                      <span className="badge badge-muted">
                        {notificationTypeLabel(item.type)}
                      </span>
                    </div>

                    <p className="muted">{displayNotification.message}</p>

                    {booking && (
                      <div className="staff-notification-appointment">
                        <strong>{booking.customer_name}</strong>
                        <span>
                          {bookingServiceName(
                            booking,
                            t("common.service", "Service"),
                          )}
                        </span>
                        <span>
                          {formatLocalizedDate(booking.start_at, locale, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}

                    <p className="small muted">
                      {formatLocalizedDate(item.created_at, locale)}
                    </p>
                  </div>

                  <div className="staff-notification-actions">
                    {actionUrl &&
                      (actionUrl.startsWith("/staff") ||
                        actionUrl.startsWith("/support")) && (
                        <Link href={actionUrl} className="btn btn-ghost">
                          {notificationActionLabel(item.type)}
                        </Link>
                      )}
                    {!item.read_at && (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        className="btn btn-ghost"
                      >
                        {t("staffNotifications.markRead", "Mark read")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        .staff-workspace-page {
          width: 100%;
          min-width: 0;
        }

        .staff-notification-utility {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 0.85rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
          color: var(--text-muted);
        }

        .staff-notification-utility strong {
          color: var(--text);
        }

        .staff-notification-filters {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .staff-mark-all-read {
          min-height: 2.25rem;
          font-size: 0.8rem;
        }

        :global(.badge-muted) {
          background: var(--surface-2);
          color: var(--text-muted);
        }

        .staff-notification-list {
          display: grid;
          gap: 0.75rem;
        }

        .staff-notification-empty {
          display: grid;
          gap: 0.65rem;
          justify-items: start;
          max-width: 36rem;
        }

        .staff-notification-empty h3,
        .staff-notification-empty p {
          margin: 0;
        }

        .staff-notification-empty-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .staff-notification-card p {
          margin: 0.25rem 0 0;
        }

        .staff-notification-appointment {
          display: flex;
          gap: 0.35rem 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .staff-notification-appointment strong {
          color: var(--text);
        }

        .staff-notification-appointment span + span::before {
          content: "·";
          margin-right: 0.65rem;
        }

        .staff-notification-card {
          display: flex;
          justify-content: space-between;
          gap: 0.85rem;
          align-items: flex-start;
          padding: 0.9rem;
        }

        .staff-notification-title-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-notification-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: flex-start;
        }

        @media (max-width: 700px) {
          .staff-notification-utility,
          .staff-notification-card {
            display: grid;
          }

          .staff-notification-filters,
          .staff-notification-actions,
          .staff-notification-empty-actions {
            justify-content: stretch;
          }

          .staff-notification-actions :global(.btn),
          .staff-notification-actions button,
          .staff-notification-empty-actions :global(.btn) {
            width: 100%;
          }

          .staff-notification-filters {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .staff-notification-filters :global(.btn),
          .staff-notification-filters button {
            width: 100%;
            justify-content: center;
          }

          .staff-notification-filters .staff-mark-all-read {
            grid-column: 1 / -1;
            min-height: 2.15rem;
            padding-block: 0.45rem;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
