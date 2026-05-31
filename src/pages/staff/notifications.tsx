import AuthNav from "@/components/AuthNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type Notification = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

function staffNotificationText(
  notification: Notification,
  t: (key: string, fallback?: string) => string,
) {
  const type = String(notification.type || "");

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
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      window.location.href = "/login";
      return;
    }

    const { data: linkedStaff } = await supabase
      .from("staff_members")
      .select("id")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (!linkedStaff) {
      window.location.href = "/my-bookings";
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, action_url, read_at, created_at")
      .eq("user_id", session.user.id)
      .in("audience", ["staff", "general"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
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

  return (
    <main>
      <AuthNav />

      <section className="page-shell">
        <div className="page-header-row" style={{ marginBottom: "1.5rem" }}>
          <div>
            <h1 className="page-title">
              {t("staffNotifications.title", "Updates")}
            </h1>
            <p className="page-sub" style={{ marginTop: "0.5rem" }}>
              {t(
                "staffNotifications.body",
                "Staff-only updates for your schedule, profile and assigned bookings.",
              )}
            </p>
          </div>

          <div className="page-header-actions">

            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="btn btn-accent"
            >
              {unreadCount > 0
                ? `${t("staffNotifications.mark", "Mark")} ${unreadCount} ${t("staffNotifications.read", "read")}`
                : t("staffNotifications.allRead", "All read")}
            </button>
          </div>
        </div>

        {!loading && !error && (
          <div className="staff-notification-toolbar card">
            <div>
              <strong>
                {unreadCount > 0
                  ? `${unreadCount} ${unreadCount === 1 ? t("staffNotifications.unreadSingle", "unread update") : t("staffNotifications.unreadPlural", "unread updates")}`
                  : t(
                      "staffNotifications.inboxClear",
                      "All staff updates are read",
                    )}
              </strong>
              <p className="small muted">
                {t(
                  "staffNotifications.inbox.body",
                  "This inbox only shows updates linked to your staff workspace.",
                )}
              </p>
            </div>

            <div className="staff-notification-filters">
              <button
                type="button"
                className={
                  filter === "all" ? "btn btn-accent" : "btn btn-ghost"
                }
                onClick={() => setFilter("all")}
              >
                {t("staffNotifications.filter.all", "All")}
              </button>
              <button
                type="button"
                className={
                  filter === "unread" ? "btn btn-accent" : "btn btn-ghost"
                }
                onClick={() => setFilter("unread")}
              >
                {t("staffNotifications.filter.unread", "Unread")}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">
              {t(
                "staffNotifications.loading",
                "Loading staff notifications...",
              )}
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
          <div className="card">
            <h3>
              {filter === "unread"
                ? t("staffNotifications.empty.unreadTitle", "No unread updates")
                : t(
                    "staffNotifications.empty.title",
                    "No staff notifications yet",
                  )}
            </h3>
            <p className="muted">
              {filter === "unread"
                ? t(
                    "staffNotifications.empty.unreadBody",
                    "Everything in your staff inbox has been read.",
                  )
                : t(
                    "staffNotifications.empty.body",
                    "Booking updates, schedule changes and staff account messages will appear here.",
                  )}
            </p>
          </div>
        )}

        {!loading && !error && filteredNotifications.length > 0 && (
          <div className="staff-notification-list">
            {filteredNotifications.map((item) => {
              const displayNotification = staffNotificationText(item, t);

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

                    <p className="muted">
                      {displayNotification.message}
                    </p>

                    <p className="small muted">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="staff-notification-actions">
                    {item.action_url &&
                      item.action_url.startsWith("/staff") && (
                        <Link href={item.action_url} className="btn btn-ghost">
                          {t("common.open", "Open")}
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
        .staff-notification-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          border-color: rgba(255, 107, 53, 0.22);
        }

        .staff-notification-filters {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        :global(.badge-muted) {
          background: var(--surface-2);
          color: var(--text-muted);
        }

        .staff-notification-list {
          display: grid;
          gap: 1rem;
        }

        .staff-notification-toolbar,
        .staff-notification-card {
          gap: 0.75rem;
        }

        .staff-notification-toolbar p,
        .staff-notification-card p {
          margin-top: 0;
        }

        .staff-notification-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
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
          .staff-notification-toolbar,
          .staff-notification-card {
            display: grid;
          }

          .staff-notification-filters,
          .staff-notification-actions {
            justify-content: stretch;
          }

          .staff-notification-filters :global(.btn),
          .staff-notification-filters button,
          .staff-notification-actions :global(.btn),
          .staff-notification-actions button {
            width: 100%;
          }

          .page-header-actions :global(.btn),
          .page-header-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
