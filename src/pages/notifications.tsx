import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import NotificationsHeader from "@/components/notifications/NotificationsHeader";
import NotificationEmptyState from "@/components/notifications/NotificationEmptyState";
import NotificationInboxSection from "@/components/notifications/NotificationInboxSection";
import { NotificationRow } from "@/components/notifications/notificationTypes";

export default function CustomerNotifications() {
  const router = useRouter();
  const { t } = useI18n();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(
          `/login?redirectTo=${encodeURIComponent(router.asPath)}`,
        );
        return;
      }

      const { data: notificationData, error: notificationError } =
        await supabase
          .from("notifications")
          .select(
            "id, user_id, business_id, booking_id, booking_request_id, audience, type, title, message, action_url, read_at, created_at",
          )
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(30);

      if (notificationError) throw notificationError;

      setNotifications((notificationData || []) as NotificationRow[]);

      setLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t("notifications.error.load", "Could not load notifications."),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      loadNotifications({ silent: true });
    }

    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadNotifications({ silent: true });
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, []);

  async function markAllNotificationsRead() {
    const unreadNotificationRows = notifications.filter(
      (notification) => !notification.read_at,
    );
    if (unreadNotificationRows.length === 0) return;

    setMarkingRead(true);
    setError(null);

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in(
        "id",
        unreadNotificationRows.map((notification) => notification.id),
      );

    setMarkingRead(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || readAt,
      })),
    );
  }

  async function markNotificationRead(notification: NotificationRow) {
    if (notification.read_at) return;

    const readAt = new Date().toISOString();

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: readAt } : item,
      ),
    );

    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notification.id);
  }

  function notificationTone(notification: NotificationRow) {
    if (
      notification.type.includes("confirmed") ||
      notification.type.includes("accepted")
    )
      return "success";
    if (
      notification.type.includes("declined") ||
      notification.type.includes("cancelled")
    )
      return "warning";
    if (
      notification.type.includes("requested") ||
      notification.type.includes("approval")
    )
      return "accent";
    return "muted";
  }

  function notificationBorder(notification: NotificationRow) {
    const tone = notificationTone(notification);
    if (tone === "success") return "rgba(45,212,191,0.28)";
    if (tone === "warning") return "rgba(255,190,11,0.28)";
    if (tone === "accent") return "rgba(255,107,53,0.28)";
    return "var(--border)";
  }

  function notificationBackground(notification: NotificationRow) {
    if (notification.read_at) return "var(--surface)";
    const tone = notificationTone(notification);
    if (tone === "success") return "rgba(45,212,191,0.06)";
    if (tone === "warning") return "rgba(255,190,11,0.06)";
    if (tone === "accent") return "rgba(255,107,53,0.06)";
    return "var(--surface)";
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;
  const recentNotifications = notifications.slice(0, 12);

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "36px 24px 70px" }}>
        <NotificationsHeader
          loading={loading}
          markingRead={markingRead}
          unreadCount={unreadCount}
          showActions={recentNotifications.length > 0}
          onRefresh={() => loadNotifications()}
          onMarkAllRead={markAllNotificationsRead}
        />

        {error && (
          <div
            className="card"
            style={{
              borderColor: "rgba(255,77,109,0.35)",
              marginBottom: "1rem",
            }}
          >
            <p style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">
              {t("notifications.loading", "Loading Mirëbook notifications...")}
            </p>
          </div>
        )}

        {!loading && recentNotifications.length === 0 && (
          <NotificationEmptyState />
        )}

        {!loading && recentNotifications.length > 0 && (
          <NotificationInboxSection
            notifications={recentNotifications}
            onMarkRead={markNotificationRead}
            notificationBorder={notificationBorder}
            notificationBackground={notificationBackground}
          />
        )}
      </section>
    </main>
  );
}
