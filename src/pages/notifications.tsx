import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
import NotificationsHeader from "@/components/notifications/NotificationsHeader";
import NotificationsStats from "@/components/notifications/NotificationsStats";
import NotificationEmptyState from "@/components/notifications/NotificationEmptyState";
import NotificationInboxSection from "@/components/notifications/NotificationInboxSection";
import PendingBookingRequestsSection from "@/components/notifications/PendingBookingRequestsSection";
import PendingRescheduleRequestsSection from "@/components/notifications/PendingRescheduleRequestsSection";
import ResolvedRescheduleRequestsSection from "@/components/notifications/ResolvedRescheduleRequestsSection";
import BookingUpdatesSection from "@/components/notifications/BookingUpdatesSection";
import {
  Booking,
  BookingRequest,
  NotificationRow,
  RelatedBusiness,
  RelatedService,
  RelatedStaff,
  RequestBooking,
} from "@/components/notifications/notificationTypes";

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function requestBooking(request: BookingRequest) {
  return firstRelation(request.bookings);
}

function bookingBusinessName(booking?: Booking | RequestBooking | null) {
  if (!booking) return "Business";
  return firstRelation(booking.businesses)?.name || "Business";
}

function bookingServiceName(booking?: Booking | RequestBooking | null) {
  if (!booking) return "Service";
  return firstRelation(booking.services)?.name || "Service";
}

function bookingStaffName(booking?: Booking | RequestBooking | null) {
  if (!booking) return "Staff not recorded";

  const staff = firstRelation(booking.staff_members);
  if (!staff) return "Staff not recorded";

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ""}`;
}

function requestedStaffName(request: BookingRequest) {
  const staff = firstRelation(request.requested_staff);
  if (!staff) return "Staff not recorded";

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ""}`;
}

export default function CustomerNotifications() {
  const router = useRouter();
  const { t } = useI18n();

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email || "");

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

      const { data: requestData, error: requestError } = await supabase
        .from("booking_requests")
        .select(
          `
          id,
          booking_id,
          status,
          requested_start_at,
          requested_duration_minutes,
          response_message,
          created_at,
          updated_at,
          requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
            name,
            role_title
          ),
          bookings (
            customer_name,
            start_at,
            duration_minutes,
            status,
            businesses (
              name
            ),
            services (
              name,
              price
            ),
            staff_members (
              name,
              role_title
            )
          )
        `,
        )
        .eq("customer_user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (requestError) throw requestError;

      const normalisedRequests = (requestData || []).map((request: any) => ({
        ...request,
        requested_staff: Array.isArray(request.requested_staff)
          ? request.requested_staff[0] || null
          : request.requested_staff,
        bookings: Array.isArray(request.bookings)
          ? request.bookings[0] || null
          : request.bookings,
      }));

      setRequests(normalisedRequests as BookingRequest[]);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          start_at,
          duration_minutes,
          status,
          businesses (
            name
          ),
          services (
            name,
            price
          ),
          staff_members (
            name,
            role_title
          )
        `,
        )
        .eq("customer_user_id", session.user.id)
        .order("start_at", { ascending: false });

      if (bookingError) throw bookingError;

      const normalisedBookings = (bookingData || []).map((booking: any) => ({
        ...booking,
        businesses: Array.isArray(booking.businesses)
          ? booking.businesses[0] || null
          : booking.businesses,
        services: Array.isArray(booking.services)
          ? booking.services[0] || null
          : booking.services,
        staff_members: Array.isArray(booking.staff_members)
          ? booking.staff_members[0] || null
          : booking.staff_members,
      }));

      setBookings(normalisedBookings as Booking[]);
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

  function statusLabel(status: string, type?: "booking" | "reschedule") {
    if (status === "pending") {
      return type === "booking"
        ? t("notifications.status.requestSent", "Request sent")
        : t(
            "notifications.status.waitingApproval",
            "Waiting for the business to confirm",
          );
    }
    if (status === "accepted")
      return t(
        "notifications.status.rescheduleAccepted",
        "Reschedule accepted",
      );
    if (status === "declined")
      return type === "booking"
        ? t("notifications.status.declined", "Declined")
        : t("notifications.status.rescheduleDeclined", "Reschedule declined");
    if (status === "cancelled") {
      return type === "booking"
        ? t("notifications.status.cancelled", "Cancelled")
        : t("notifications.status.superseded", "Superseded / replaced");
    }
    if (status === "completed")
      return t("notifications.status.completed", "Completed");
    if (status === "confirmed")
      return t("notifications.status.confirmed", "Confirmed");
    return status;
  }

  function statusColor(status: string) {
    if (status === "pending") return "var(--accent)";
    if (status === "accepted") return "var(--success)";
    if (status === "confirmed") return "var(--success)";
    if (status === "declined") return "var(--warning)";
    if (status === "cancelled") return "var(--warning)";
    if (status === "completed") return "var(--accent)";
    return "var(--text-muted)";
  }

  function statusBackground(status: string) {
    if (status === "pending") return "rgba(255,107,53,0.12)";
    if (status === "accepted") return "rgba(45,212,191,0.12)";
    if (status === "confirmed") return "rgba(45,212,191,0.12)";
    if (status === "declined") return "rgba(255,190,11,0.12)";
    if (status === "cancelled") return "rgba(255,190,11,0.12)";
    if (status === "completed") return "rgba(255,107,53,0.12)";
    return "var(--surface-2)";
  }

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

  const latestRequestsByBooking = useMemo(() => {
    const map: Record<string, BookingRequest> = {};

    requests
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .forEach((request) => {
        if (!map[request.booking_id]) {
          map[request.booking_id] = request;
        }
      });

    return Object.values(map);
  }, [requests]);

  const pendingBookingRequests = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const resolvedBookingUpdates = useMemo(() => {
    return bookings
      .filter(
        (booking) =>
          booking.status === "confirmed" ||
          booking.status === "completed" ||
          booking.status === "cancelled",
      )
      .slice(0, 12);
  }, [bookings]);

  const pendingRescheduleRequests = latestRequestsByBooking.filter(
    (request) => request.status === "pending",
  );
  const resolvedRescheduleRequests = latestRequestsByBooking.filter(
    (request) => request.status !== "pending",
  );

  const actionCount =
    pendingBookingRequests.length + pendingRescheduleRequests.length;
  const historyCount =
    resolvedBookingUpdates.length + resolvedRescheduleRequests.length;
  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;
  const recentNotifications = notifications.slice(0, 12);

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "36px 24px 70px" }}>
        <NotificationsHeader
          email={email}
          loading={loading}
          markingRead={markingRead}
          unreadCount={unreadCount}
          onRefresh={() => loadNotifications()}
          onMarkAllRead={markAllNotificationsRead}
        />

        <NotificationsStats
          actionCount={actionCount}
          historyCount={historyCount}
          unreadCount={unreadCount}
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

        {!loading &&
          actionCount === 0 &&
          historyCount === 0 &&
          recentNotifications.length === 0 && <NotificationEmptyState />}

        {!loading && recentNotifications.length > 0 && (
          <NotificationInboxSection
            notifications={recentNotifications}
            onMarkRead={markNotificationRead}
            notificationBorder={notificationBorder}
            notificationBackground={notificationBackground}
          />
        )}

        {!loading && pendingBookingRequests.length > 0 && (
          <PendingBookingRequestsSection
            bookings={pendingBookingRequests}
            bookingBusinessName={bookingBusinessName}
            bookingServiceName={bookingServiceName}
            bookingStaffName={bookingStaffName}
            statusLabel={statusLabel}
            statusColor={statusColor}
            statusBackground={statusBackground}
          />
        )}

        {!loading && pendingRescheduleRequests.length > 0 && (
          <PendingRescheduleRequestsSection
            requests={pendingRescheduleRequests}
            requestBooking={requestBooking}
            bookingBusinessName={bookingBusinessName}
            bookingServiceName={bookingServiceName}
            requestedStaffName={requestedStaffName}
            statusLabel={statusLabel}
            statusColor={statusColor}
            statusBackground={statusBackground}
          />
        )}

        {!loading && resolvedRescheduleRequests.length > 0 && (
          <ResolvedRescheduleRequestsSection
            requests={resolvedRescheduleRequests}
            requestBooking={requestBooking}
            bookingBusinessName={bookingBusinessName}
            bookingServiceName={bookingServiceName}
            requestedStaffName={requestedStaffName}
            statusLabel={statusLabel}
            statusColor={statusColor}
            statusBackground={statusBackground}
          />
        )}

        {!loading && resolvedBookingUpdates.length > 0 && (
          <BookingUpdatesSection
            bookings={resolvedBookingUpdates}
            bookingBusinessName={bookingBusinessName}
            bookingServiceName={bookingServiceName}
            bookingStaffName={bookingStaffName}
            statusLabel={statusLabel}
            statusColor={statusColor}
            statusBackground={statusBackground}
          />
        )}
      </section>

      <style jsx>{`
        .customer-notification-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .customer-notification-section {
          display: grid;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .customer-notification-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .customer-notification-card-actions {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .customer-notification-actions :global(.btn),
          .customer-notification-actions button,
          .customer-notification-actions a,
          .customer-notification-card-actions :global(.btn),
          .customer-notification-card-actions button,
          .customer-notification-card-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
