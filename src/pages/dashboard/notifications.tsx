import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import {
  isDeclinedStatusUnsupported,
  supabaseErrorDetails,
} from "@/lib/bookingStatusErrors";
import { requestTransactionalEmail } from "@/lib/email/client";

type RelatedBusiness = {
  name: string;
};

type RelatedService = {
  name: string;
  price?: number | null;
};

type RelatedStaff = {
  name: string;
  role_title?: string | null;
};

type RequestBooking = {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at?: string | null;
  duration_minutes?: number | null;
  status?: string | null;
  services?: RelatedService | RelatedService[] | null;
  staff_members?: RelatedStaff | RelatedStaff[] | null;
};

type BookingRequest = {
  id: string;
  booking_id: string;
  business_id: string;
  customer_user_id: string;
  requested_by: string;
  request_type: string;
  status: string;
  current_start_at?: string | null;
  requested_start_at: string;
  current_staff_member_id?: string | null;
  requested_staff_member_id?: string | null;
  requested_duration_minutes: number;
  message?: string | null;
  response_message?: string | null;
  created_at: string;
  updated_at?: string | null;
  bookings?: RequestBooking | RequestBooking[] | null;
  businesses?: RelatedBusiness | RelatedBusiness[] | null;
  requested_staff?: RelatedStaff | RelatedStaff[] | null;
};

type Booking = {
  id: string;
  business_id: string;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at: string;
  duration_minutes: number;
  status: string;
  businesses?: RelatedBusiness | RelatedBusiness[] | null;
  services?: RelatedService | RelatedService[] | null;
  staff_members?: RelatedStaff | RelatedStaff[] | null;
};

type NotificationRow = {
  id: string;
  user_id?: string | null;
  business_id?: string | null;
  booking_id?: string | null;
  booking_request_id?: string | null;
  audience: string;
  type: string;
  title: string;
  message?: string | null;
  action_url?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function requestBooking(request: BookingRequest) {
  return firstRelation(request.bookings);
}

function businessName(
  value?: Booking | BookingRequest | RequestBooking | null,
  fallback = "Business",
) {
  if (!value) return fallback;

  if ("businesses" in value) {
    return firstRelation(value.businesses)?.name || fallback;
  }

  return fallback;
}

function serviceName(
  value?: Booking | RequestBooking | null,
  fallback = "Service",
) {
  if (!value) return fallback;
  return firstRelation(value.services)?.name || fallback;
}

function staffName(
  value?: Booking | RequestBooking | null,
  fallback = "Staff not recorded",
) {
  if (!value) return fallback;

  const staff = firstRelation(value.staff_members);
  if (!staff) return fallback;

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ""}`;
}

function requestedStaffName(
  request: BookingRequest,
  fallback = "Staff not recorded",
) {
  const staff = firstRelation(request.requested_staff);
  if (!staff) return fallback;

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ""}`;
}

function businessNotificationText(
  notification: NotificationRow,
  t: (key: string, fallback?: string) => string,
  currentBookingStatus?: string | null,
) {
  const type = String(notification.type || "");

  if (
    type === "booking_created" ||
    type === "booking_requested" ||
    type === "booking_approval_requested"
  ) {
    if (currentBookingStatus && currentBookingStatus !== "pending") {
      if (currentBookingStatus === "confirmed") {
        return {
          title: t("dashboardBookings.status.confirmed", "Confirmed"),
          message: t(
            "dashboardNotifications.inbox.bookingNowConfirmed",
            "This booking request has been confirmed. No approval action remains.",
          ),
        };
      }

      if (currentBookingStatus === "declined") {
        return {
          title: t("dashboardNotifications.status.declined", "Declined"),
          message: t(
            "dashboardNotifications.inbox.bookingNowDeclined",
            "This booking request was declined. No approval action remains.",
          ),
        };
      }

      if (currentBookingStatus === "cancelled") {
        return {
          title: t("dashboardBookings.status.cancelled", "Cancelled"),
          message: t(
            "dashboardNotifications.inbox.bookingNowCancelled",
            "This booking has been cancelled and is no longer actionable.",
          ),
        };
      }

      if (currentBookingStatus === "completed") {
        return {
          title: t("dashboardBookings.status.completed", "Completed"),
          message: t(
            "dashboardNotifications.inbox.bookingNowCompleted",
            "This booking is complete and no longer requires action.",
          ),
        };
      }
    }

    return {
      title: t(
        "notifications.types.businessBookingRequest.title",
        "Needs approval",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.businessBookingRequest.message",
          "Review this booking request.",
        ),
    };
  }

  if (type === "booking_confirmed" || type === "booking_accepted") {
    return {
      title: t(
        "notifications.types.businessBookingConfirmed.title",
        "Confirmed",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.businessBookingConfirmed.message",
          "This booking is confirmed.",
        ),
    };
  }

  if (type === "booking_declined") {
    return {
      title: t("dashboardNotifications.status.declined", "Declined"),
      message: t(
        "notifications.types.businessBookingDeclined.message",
        "This booking request was declined.",
      ),
    };
  }

  if (type === "booking_cancelled") {
    return {
      title: t(
        "notifications.types.businessBookingCancelled.title",
        "Booking cancelled",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.businessBookingCancelled.message",
          "A booking has been cancelled.",
        ),
    };
  }

  if (type === "booking_completed") {
    return {
      title: t("dashboardBookings.status.completed", "Completed"),
      message: t(
        "notifications.types.businessBookingCompleted.message",
        "This booking has been completed.",
      ),
    };
  }

  if (
    type === "reschedule_requested" ||
    type === "booking_reschedule_requested"
  ) {
    return {
      title: t(
        "notifications.types.businessRescheduleRequested.title",
        "Reschedule request",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.businessRescheduleRequested.message",
          "A customer has requested a new appointment time.",
        ),
    };
  }

  if (type === "support_reply_user") {
    return {
      title: t(
        "notifications.types.supportReplyUser.title",
        "User replied to support ticket",
      ),
      message:
        notification.message ||
        t(
          "notifications.types.supportReplyUser.message",
          "Open the support inbox to review the latest reply.",
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

function businessNotificationActionLabel(
  notification: NotificationRow,
  currentBookingStatus: string | null,
  t: (key: string, fallback?: string) => string,
) {
  const type = String(notification.type || "");

  if (
    currentBookingStatus === "pending" &&
    (type === "booking_created" ||
      type === "booking_requested" ||
      type === "booking_approval_requested")
  ) {
    return t(
      "dashboardNotifications.actions.reviewBookingRequest",
      "Review booking request",
    );
  }

  if (
    type === "reschedule_requested" ||
    type === "booking_reschedule_requested"
  ) {
    return t(
      "dashboardNotifications.actions.reviewRescheduleRequest",
      "Review reschedule request",
    );
  }

  if (notification.booking_id) {
    return t("dashboardNotifications.actions.openBooking", "Open appointment");
  }

  if (type.includes("support")) {
    return t("dashboardNotifications.actions.openSupport", "Open support");
  }

  return t("dashboardNotifications.actions.openUpdate", "Open update");
}

export default function BusinessNotifications() {
  const router = useRouter();
  const { t } = useI18n();

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    bookingId: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadNotifications(options?: {
    keepSuccess?: boolean;
    silent?: boolean;
  }) {
    if (!options?.silent) setLoading(true);
    setError(null);
    setActionError(null);
    if (!options?.keepSuccess) setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/dashboard/notifications");
        return;
      }

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      if (!capabilities.canUseBusiness) {
        router.replace(capabilities.defaultRoute);
        return;
      }

      const ownedBusinessIds = capabilities.ownedBusinesses.map(
        (business) => business.id,
      );
      setBusinessIds(ownedBusinessIds);

      if (ownedBusinessIds.length === 0) {
        setRequests([]);
        setBookings([]);
        setNotifications([]);
        setLoading(false);
        return;
      }

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          business_id,
          customer_user_id,
          customer_name,
          customer_email,
          customer_phone,
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
        .in("business_id", ownedBusinessIds)
        .order("start_at", { ascending: true });

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

      const { data: notificationData, error: notificationError } =
        await supabase
          .from("notifications")
          .select(
            "id, user_id, business_id, booking_id, booking_request_id, audience, type, title, message, action_url, read_at, created_at",
          )
          .in("business_id", ownedBusinessIds)
          .eq("audience", "business")
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
          business_id,
          customer_user_id,
          requested_by,
          request_type,
          status,
          current_start_at,
          requested_start_at,
          current_staff_member_id,
          requested_staff_member_id,
          requested_duration_minutes,
          message,
          response_message,
          created_at,
          updated_at,
          bookings (
            customer_name,
            customer_email,
            customer_phone,
            start_at,
            duration_minutes,
            status,
            services (
              name,
              price
            ),
            staff_members (
              name,
              role_title
            )
          ),
          businesses (
            name
          ),
          requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
            name,
            role_title
          )
        `,
        )
        .in("business_id", ownedBusinessIds)
        .order("created_at", { ascending: false });

      if (requestError) throw requestError;

      const normalisedRequests = (requestData || []).map((request: any) => ({
        ...request,
        bookings: Array.isArray(request.bookings)
          ? request.bookings[0] || null
          : request.bookings,
        businesses: Array.isArray(request.businesses)
          ? request.businesses[0] || null
          : request.businesses,
        requested_staff: Array.isArray(request.requested_staff)
          ? request.requested_staff[0] || null
          : request.requested_staff,
      }));

      setRequests(normalisedRequests as BookingRequest[]);
      setLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "dashboardNotifications.error.load",
            "Could not load notifications.",
          ),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      loadNotifications({ silent: true, keepSuccess: true });
    }

    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadNotifications({ silent: true, keepSuccess: true });
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, []);

  async function createCustomerNotification(params: {
    userId?: string | null;
    businessId: string;
    bookingId?: string | null;
    bookingRequestId?: string | null;
    type: string;
    title: string;
    message: string;
    actionUrl: string;
  }) {
    if (!params.userId) return;

    await supabase.from("notifications").insert({
      user_id: params.userId,
      business_id: params.businessId,
      booking_id: params.bookingId || null,
      booking_request_id: params.bookingRequestId || null,
      audience: "customer",
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl,
    });
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

    await loadNotifications({ keepSuccess: true, silent: true });
  }

  async function markAllBusinessNotificationsRead() {
    const unread = notifications.filter(
      (notification) => !notification.read_at,
    );
    if (unread.length === 0) return;

    const readAt = new Date().toISOString();

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || readAt,
      })),
    );

    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in(
        "id",
        unread.map((notification) => notification.id),
      );

    setSuccess(
      t(
        "dashboardNotifications.success.markedRead",
        "Business notifications marked as read.",
      ),
    );
    await loadNotifications({ keepSuccess: true, silent: true });
  }

  function notificationTone(notification: NotificationRow) {
    if (
      notification.type.includes("confirmed") ||
      notification.type.includes("accepted") ||
      notification.type.includes("created")
    )
      return "success";
    if (
      notification.type.includes("declined") ||
      notification.type.includes("cancelled")
    )
      return "warning";
    if (
      notification.type.includes("approval") ||
      notification.type.includes("requested")
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

  async function acceptBooking(booking: Booking) {
    if (actionLoadingId) return;

    const confirmed = confirm(
      t(
        "dashboardBookings.confirm.accept",
        "Accept this booking request and confirm the appointment?",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(`booking-${booking.id}`);
    setActionError(null);
    setError(null);
    setSuccess(null);

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking.id)
      .in("business_id", businessIds)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    setActionLoadingId(null);

    if (error || !updatedBooking) {
      setError(
        error?.message ||
          t(
            "dashboardBookings.error.actionNoLongerAvailable",
            "This booking is no longer available for that action. Refresh notifications to see the latest status.",
          ),
      );
      return;
    }

    setBookings((current) =>
      current.map((item) =>
        item.id === booking.id ? { ...item, status: "confirmed" } : item,
      ),
    );

    await createCustomerNotification({
      userId: booking.customer_user_id,
      businessId: booking.business_id,
      bookingId: booking.id,
      type: "booking_accepted",
      title: t(
        "dashboardBookings.notification.acceptedTitle",
        "Booking accepted",
      ),
      message: t(
        "dashboardBookings.notification.acceptedMessage",
        "Your booking has been accepted and confirmed.",
      ),
      actionUrl: `/booking-confirmation?id=${booking.id}`,
    });
    void requestTransactionalEmail({
      event: "booking_status_changed",
      bookingId: booking.id,
    });

    setSuccess(
      t(
        "dashboardNotifications.success.bookingAccepted",
        "Booking accepted. The customer has been notified and the request is no longer pending.",
      ),
    );
    await loadNotifications({ keepSuccess: true, silent: true });
  }

  async function declineBooking(booking: Booking) {
    if (actionLoadingId) return;

    const confirmed = confirm(
      t(
        "dashboardBookings.confirm.decline",
        "Decline this booking request? The customer will see it as declined.",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(`booking-${booking.id}`);
    setActionError(null);
    setError(null);
    setSuccess(null);

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: "declined" })
      .eq("id", booking.id)
      .in("business_id", businessIds)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    setActionLoadingId(null);

    if (error || !updatedBooking) {
      const message = error
        ? `${t(
            isDeclinedStatusUnsupported(error)
              ? "dashboardBookings.error.declinedStatusUnsupported"
              : "dashboardBookings.error.declineFailed",
            isDeclinedStatusUnsupported(error)
              ? "The live database does not currently allow the Declined booking status. Update the bookings status constraint, then try again."
              : "Could not decline this booking.",
          )} ${t("dashboardBookings.error.databaseDetails", "Database details")}: ${supabaseErrorDetails(error)}`
        : t(
            "dashboardBookings.error.actionNoLongerAvailable",
            "This booking is no longer available for that action. Refresh notifications to see the latest status.",
          );
      setError(message);
      setActionError({ bookingId: booking.id, message });
      return;
    }

    setBookings((current) =>
      current.map((item) =>
        item.id === booking.id ? { ...item, status: "declined" } : item,
      ),
    );

    await createCustomerNotification({
      userId: booking.customer_user_id,
      businessId: booking.business_id,
      bookingId: booking.id,
      type: "booking_declined",
      title: t(
        "dashboardBookings.notification.declinedTitle",
        "Booking declined",
      ),
      message: t(
        "dashboardBookings.notification.declinedMessage",
        "Your booking request was declined.",
      ),
      actionUrl: "/my-bookings",
    });
    void requestTransactionalEmail({
      event: "booking_status_changed",
      bookingId: booking.id,
    });

    setSuccess(
      t(
        "dashboardBookings.success.declined",
        "Booking declined. The customer has been notified and the request is no longer pending.",
      ),
    );
    await loadNotifications({ keepSuccess: true, silent: true });
  }

  async function acceptRequest(request: BookingRequest) {
    const confirmed = confirm(
      t(
        "dashboardNotifications.confirm.acceptReschedule",
        "Accept this reschedule request? The booking will be updated to the requested time.",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(`request-${request.id}`);
    setError(null);
    setSuccess(null);

    const { error: bookingError } = await supabase
      .from("bookings")
      .update({
        start_at: request.requested_start_at,
        duration_minutes: request.requested_duration_minutes,
        staff_member_id: request.requested_staff_member_id,
        status: "confirmed",
      })
      .eq("id", request.booking_id)
      .in("business_id", businessIds);

    if (bookingError) {
      setError(bookingError.message);
      setActionLoadingId(null);
      return;
    }

    const { error: requestError } = await supabase
      .from("booking_requests")
      .update({
        status: "accepted",
        response_message: t(
          "dashboardNotifications.response.acceptedByBusiness",
          "Accepted by business",
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .in("business_id", businessIds);

    if (requestError) {
      setError(requestError.message);
      setActionLoadingId(null);
      return;
    }

    const { error: cancelOtherRequestsError } = await supabase
      .from("booking_requests")
      .update({
        status: "cancelled",
        response_message: t(
          "dashboardNotifications.response.cancelledAutomatically",
          "Cancelled automatically because another reschedule request was accepted.",
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", request.booking_id)
      .eq("requested_by", "customer")
      .eq("request_type", "reschedule")
      .eq("status", "pending")
      .neq("id", request.id)
      .in("business_id", businessIds);

    setActionLoadingId(null);

    if (cancelOtherRequestsError) {
      setError(cancelOtherRequestsError.message);
      return;
    }

    setRequests((current) =>
      current.map((item) => {
        if (item.id === request.id) {
          return {
            ...item,
            status: "accepted",
            response_message: t(
              "dashboardNotifications.response.acceptedByBusiness",
              "Accepted by business",
            ),
            updated_at: new Date().toISOString(),
          };
        }

        if (
          item.booking_id === request.booking_id &&
          item.id !== request.id &&
          item.requested_by === "customer" &&
          item.request_type === "reschedule" &&
          item.status === "pending"
        ) {
          return {
            ...item,
            status: "cancelled",
            response_message: t(
              "dashboardNotifications.response.cancelledAutomatically",
              "Cancelled automatically because another reschedule request was accepted.",
            ),
            updated_at: new Date().toISOString(),
          };
        }

        return item;
      }),
    );

    setBookings((current) =>
      current.map((item) =>
        item.id === request.booking_id
          ? {
              ...item,
              start_at: request.requested_start_at,
              duration_minutes: request.requested_duration_minutes,
              status: "confirmed",
            }
          : item,
      ),
    );

    await createCustomerNotification({
      userId: request.customer_user_id,
      businessId: request.business_id,
      bookingId: request.booking_id,
      bookingRequestId: request.id,
      type: "reschedule_accepted",
      title: t(
        "dashboardNotifications.notification.rescheduleAcceptedTitle",
        "Reschedule accepted",
      ),
      message: t(
        "dashboardNotifications.notification.rescheduleAcceptedMessage",
        "Your reschedule request has been accepted.",
      ),
      actionUrl: `/booking-confirmation?id=${request.booking_id}`,
    });

    setSuccess(
      t(
        "dashboardNotifications.success.rescheduleAccepted",
        "Reschedule accepted. The booking has been updated and the customer has been notified.",
      ),
    );
    await loadNotifications({ keepSuccess: true });
  }

  async function declineRequest(request: BookingRequest) {
    const responseMessage = prompt(
      t(
        "dashboardNotifications.prompt.optionalMessage",
        "Optional message to customer:",
      ),
      t(
        "dashboardNotifications.prompt.defaultDeclineMessage",
        "Sorry, that time is not available.",
      ),
    );
    if (responseMessage === null) return;

    setActionLoadingId(`request-${request.id}`);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("booking_requests")
      .update({
        status: "declined",
        response_message: responseMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .in("business_id", businessIds);

    setActionLoadingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: "declined",
              response_message: responseMessage,
              updated_at: new Date().toISOString(),
            }
          : item,
      ),
    );

    await createCustomerNotification({
      userId: request.customer_user_id,
      businessId: request.business_id,
      bookingId: request.booking_id,
      bookingRequestId: request.id,
      type: "reschedule_declined",
      title: t(
        "dashboardNotifications.notification.rescheduleDeclinedTitle",
        "Reschedule declined",
      ),
      message:
        responseMessage ||
        t(
          "dashboardNotifications.notification.rescheduleDeclinedMessage",
          "Your reschedule request was declined. The original booking remains unchanged.",
        ),
      actionUrl: "/my-bookings",
    });

    setSuccess(
      t(
        "dashboardNotifications.success.rescheduleDeclined",
        "Reschedule declined. The original booking remains unchanged and the customer has been notified.",
      ),
    );
    await loadNotifications({ keepSuccess: true });
  }

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const pendingRequests = useMemo(() => {
    return Object.values(
      requests
        .filter((request) => request.status === "pending")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .reduce<Record<string, BookingRequest>>((latestByBooking, request) => {
          if (!latestByBooking[request.booking_id]) {
            latestByBooking[request.booking_id] = request;
          }

          return latestByBooking;
        }, {}),
    );
  }, [requests]);

  const latestPendingRequestIds = new Set(
    pendingRequests.map((request) => request.id),
  );

  const pastRequests = requests.filter(
    (request) =>
      request.status !== "pending" || !latestPendingRequestIds.has(request.id),
  );

  const actionCount = pendingBookings.length + pendingRequests.length;
  const unreadBusinessNotifications = notifications.filter(
    (notification) => !notification.read_at,
  );
  const pendingBookingIds = new Set(
    pendingBookings.map((booking) => booking.id),
  );
  const pendingRequestIds = new Set(
    pendingRequests.map((request) => request.id),
  );
  const recentBusinessNotifications = notifications
    .filter((notification) => {
      if (
        notification.booking_id &&
        pendingBookingIds.has(notification.booking_id) &&
        (notification.type === "booking_created" ||
          notification.type === "booking_requested" ||
          notification.type === "booking_approval_requested")
      ) {
        return false;
      }

      if (
        notification.booking_request_id &&
        pendingRequestIds.has(notification.booking_request_id)
      ) {
        return false;
      }

      return true;
    })
    .slice(0, 8);
  const hasInboxContent =
    actionCount > 0 ||
    recentBusinessNotifications.length > 0 ||
    pastRequests.length > 0;

  function statusLabel(status: string) {
    if (status === "pending")
      return t("dashboardBookings.status.needsApproval", "Needs approval");
    if (status === "confirmed")
      return t("dashboardBookings.status.confirmed", "Confirmed");
    if (status === "accepted")
      return t("dashboardNotifications.status.accepted", "Accepted");
    if (status === "declined")
      return t("dashboardNotifications.status.declined", "Declined");
    if (status === "cancelled")
      return t(
        "dashboardNotifications.status.supersededCancelled",
        "Superseded / cancelled",
      );
    if (status === "completed")
      return t("dashboardBookings.status.completed", "Completed");
    return status;
  }

  function statusColor(status: string) {
    if (status === "pending") return "var(--accent)";
    if (status === "confirmed") return "var(--success)";
    if (status === "accepted") return "var(--success)";
    if (status === "declined") return "var(--warning)";
    if (status === "cancelled") return "var(--text-muted)";
    if (status === "completed") return "var(--accent)";
    return "var(--text-muted)";
  }

  function statusBackground(status: string) {
    if (status === "pending") return "rgba(255,107,53,0.12)";
    if (status === "confirmed") return "rgba(45,212,191,0.12)";
    if (status === "accepted") return "rgba(45,212,191,0.12)";
    if (status === "declined") return "rgba(255,190,11,0.12)";
    if (status === "completed") return "rgba(255,107,53,0.12)";
    return "var(--surface-2)";
  }

  function formatInboxDateTime(value?: string | null) {
    if (!value) {
      return t("dashboardNotifications.inbox.recently", "Recently");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t("dashboardNotifications.inbox.recently", "Recently");
    }

    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return (
    <DashboardLayout
      title={t("dashboardLayout.nav.inbox", "Inbox")}
      subtitle={t(
        "dashboardNotifications.pageSubtitle",
        "Requests and updates for this business.",
      )}
    >
      {success && (
        <div
          className="card"
          style={{
            borderColor: "rgba(45,212,191,0.28)",
            background: "rgba(45,212,191,0.06)",
            marginBottom: "1rem",
          }}
        >
          <div className="business-notification-banner-row">
            <div>
              <p className="small" style={{ color: "var(--success)" }}>
                {t(
                  "dashboardBookings.success.actionCompleted",
                  "Action completed",
                )}
              </p>
              <strong>{success}</strong>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSuccess(null)}
            >
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="card">
          <p className="muted">
            {t(
              "dashboardNotifications.loading",
              "Loading Mirëbook notifications...",
            )}
          </p>
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{ borderColor: "rgba(255,77,109,0.35)", marginBottom: "1rem" }}
        >
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {!loading && (
        <div className="business-inbox-overview">
          <div>
            <p className="small muted">
              {t("dashboardNotifications.overview.kicker", "Action centre")}
            </p>
            <h2>
              {actionCount > 0
                ? t(
                    "dashboardNotifications.overview.actionsTitle",
                    "Customer actions need review",
                  )
                : t(
                    "dashboardNotifications.overview.clearTitle",
                    "No customer actions waiting",
                  )}
            </h2>
          </div>

          <div className="business-inbox-metrics">
            <span>
              <strong>{pendingBookings.length}</strong>{" "}
              {t(
                "dashboardNotifications.summary.bookingApprovals",
                "Booking requests",
              )}
            </span>
            <span>
              <strong>{pendingRequests.length}</strong>{" "}
              {t(
                "dashboardNotifications.summary.rescheduleRequests",
                "Reschedules",
              )}
            </span>
            <span>
              <strong>{unreadBusinessNotifications.length}</strong>{" "}
              {t("dashboardNotifications.summary.unreadUpdates", "Unread")}
            </span>
          </div>

          <button
            type="button"
            onClick={markAllBusinessNotificationsRead}
            className="btn btn-ghost"
            disabled={unreadBusinessNotifications.length === 0}
          >
            {unreadBusinessNotifications.length > 0
              ? `${t("dashboardNotifications.toolbar.mark", "Mark")} ${unreadBusinessNotifications.length} ${t("dashboardNotifications.toolbar.read", "read")}`
              : t("dashboardNotifications.toolbar.allRead", "All read")}
          </button>
        </div>
      )}

      {!loading && !hasInboxContent && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3>
            {t("dashboardNotifications.empty.title", "No pending actions")}
          </h3>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "dashboardNotifications.empty.body",
              "Booking requests and important updates will appear here.",
            )}
          </p>
        </div>
      )}

      {!loading && actionCount > 0 && (
        <div className="business-notification-section">
          <div className="business-inbox-section-header">
            <div>
              <p className="small muted">
                {t(
                  "dashboardNotifications.sections.actionRequired",
                  "Needs action",
                )}
              </p>
              <h2 style={{ fontFamily: "var(--font-display)" }}>
                {t(
                  "dashboardNotifications.sections.needsActionTitle",
                  "Review customer requests",
                )}
              </h2>
            </div>
            <span className="business-inbox-count">{actionCount}</span>
          </div>

          {pendingBookings.map((booking) => {
            const isWorking = actionLoadingId === `booking-${booking.id}`;

            return (
              <div
                key={booking.id}
                className="business-action-card"
                style={{ borderColor: "rgba(255,107,53,0.35)" }}
              >
                <div className="business-notification-card-row">
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div className="business-action-card-heading">
                      <span className="business-action-type">
                        {t(
                          "dashboardNotifications.booking.requestTitle",
                          "Booking request",
                        )}
                      </span>

                      <span
                        className="small"
                        style={{
                          background: statusBackground("pending"),
                          color: statusColor("pending"),
                          padding: "0.2rem 0.55rem",
                          borderRadius: 999,
                        }}
                      >
                        {t(
                          "dashboardBookings.status.needsApproval",
                          "Needs approval",
                        )}
                      </span>
                    </div>

                    <h3 style={{ marginTop: "0.25rem" }}>
                      {booking.customer_name ||
                        t(
                          "dashboardBookings.card.customerFallback",
                          "Customer",
                        )}
                    </h3>

                    <div className="business-action-meta">
                      <span>
                        {t(
                          "dashboardNotifications.labels.requestedTime",
                          "Requested time",
                        )}
                        : {formatInboxDateTime(booking.start_at)}
                      </span>
                      <span>
                        {t("dashboardBookings.card.service", "Service")}:{" "}
                        {serviceName(
                          booking,
                          t(
                            "dashboardNotifications.labels.serviceFallback",
                            "Service",
                          ),
                        )}
                      </span>
                      <span>
                        {t("support.business.staff", "Staff")}:{" "}
                        {staffName(
                          booking,
                          t(
                            "dashboardBookings.card.noStaff",
                            "Staff not recorded",
                          ),
                        )}
                      </span>
                      <span>
                        {t(
                          "dashboardNotifications.labels.duration",
                          "Duration",
                        )}
                        : {booking.duration_minutes}{" "}
                        {t("common.minutes", "minutes")}
                      </span>
                    </div>

                    <div className="business-action-contact">
                      <span>
                        {businessName(
                          booking,
                          t(
                            "dashboardNotifications.labels.businessFallback",
                            "Business",
                          ),
                        )}
                      </span>
                      {booking.customer_email && (
                        <span>{booking.customer_email}</span>
                      )}
                      {booking.customer_phone && (
                        <span>{booking.customer_phone}</span>
                      )}
                    </div>
                  </div>

                  <div className="business-notification-card-actions">
                    <button
                      onClick={() => acceptBooking(booking)}
                      disabled={isWorking}
                      className="btn btn-accent"
                    >
                      {isWorking
                        ? t("dashboardBookings.actions.working", "Working...")
                        : t(
                            "dashboardBookings.actions.accept",
                            "Accept booking",
                          )}
                    </button>

                    <button
                      onClick={() => declineBooking(booking)}
                      disabled={isWorking}
                      className="btn btn-danger"
                    >
                      {isWorking
                        ? t("dashboardBookings.actions.working", "Working...")
                        : t(
                            "dashboardBookings.actions.decline",
                            "Decline booking",
                          )}
                    </button>

                    {actionError?.bookingId === booking.id && (
                      <p
                        role="alert"
                        className="small"
                        style={{
                          color: "var(--danger)",
                          marginTop: "0.25rem",
                        }}
                      >
                        {actionError.message}
                      </p>
                    )}

                    <Link
                      href={`/dashboard/bookings?businessId=${booking.business_id}`}
                      className="btn btn-ghost"
                    >
                      {t(
                        "dashboardNotifications.actions.openBooking",
                        "Open appointment",
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {pendingRequests.map((request) => {
            const isWorking = actionLoadingId === `request-${request.id}`;
            const linkedBooking = requestBooking(request);

            return (
              <div key={request.id} className="business-action-card">
                <div className="business-notification-card-row">
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div className="business-action-card-heading">
                      <span className="business-action-type">
                        {t(
                          "dashboardNotifications.reschedule.requestTitle",
                          "Reschedule request",
                        )}
                      </span>

                      <span
                        className="small"
                        style={{
                          background: "rgba(255,107,53,0.12)",
                          color: "var(--accent)",
                          padding: "0.2rem 0.55rem",
                          borderRadius: 999,
                        }}
                      >
                        {t(
                          "dashboardBookings.status.needsApproval",
                          "Needs approval",
                        )}
                      </span>
                    </div>

                    <h3 style={{ marginTop: "0.25rem" }}>
                      {linkedBooking?.customer_name ||
                        t(
                          "dashboardBookings.card.customerFallback",
                          "Customer",
                        )}
                    </h3>

                    <div className="business-notification-time-grid">
                      <div className="business-time-chip">
                        <p className="small muted">
                          {t(
                            "dashboardNotifications.reschedule.currentAppointment",
                            "Current time",
                          )}
                        </p>
                        <strong>
                          {request.current_start_at
                            ? formatInboxDateTime(request.current_start_at)
                            : linkedBooking?.start_at
                              ? formatInboxDateTime(linkedBooking.start_at)
                              : t(
                                  "dashboardNotifications.labels.notRecorded",
                                  "Not recorded",
                                )}
                        </strong>
                      </div>

                      <div className="business-time-chip is-requested">
                        <p className="small muted">
                          {t(
                            "dashboardNotifications.reschedule.requestedAppointment",
                            "Requested time",
                          )}
                        </p>
                        <strong>
                          {formatInboxDateTime(request.requested_start_at)}
                        </strong>
                      </div>
                    </div>

                    <div className="business-action-meta">
                      <span>
                        {t("dashboardBookings.card.service", "Service")}:{" "}
                        {serviceName(
                          linkedBooking,
                          t(
                            "dashboardNotifications.labels.serviceFallback",
                            "Service",
                          ),
                        )}
                      </span>
                      <span>
                        {t(
                          "dashboardNotifications.labels.requestedStaff",
                          "Requested staff",
                        )}
                        :{" "}
                        {requestedStaffName(
                          request,
                          t(
                            "dashboardBookings.card.noStaff",
                            "Staff not recorded",
                          ),
                        )}
                      </span>
                      <span>
                        {businessName(
                          request,
                          t(
                            "dashboardNotifications.labels.businessFallback",
                            "Business",
                          ),
                        )}
                      </span>
                    </div>

                    {request.message && (
                      <p
                        className="small muted"
                        style={{ marginTop: "0.5rem" }}
                      >
                        {t("dashboardNotifications.labels.message", "Message")}:{" "}
                        {request.message}
                      </p>
                    )}

                    <p className="small muted" style={{ marginTop: "0.5rem" }}>
                      {t(
                        "dashboardNotifications.labels.requested",
                        "Requested",
                      )}
                      : {formatInboxDateTime(request.created_at)}
                    </p>
                  </div>

                  <div className="business-notification-card-actions">
                    <button
                      onClick={() => acceptRequest(request)}
                      disabled={isWorking}
                      className="btn btn-accent"
                    >
                      {isWorking
                        ? t("dashboardBookings.actions.working", "Working...")
                        : t(
                            "dashboardNotifications.actions.acceptNewTime",
                            "Accept new time",
                          )}
                    </button>

                    <button
                      onClick={() => declineRequest(request)}
                      disabled={isWorking}
                      className="btn btn-danger"
                    >
                      {t(
                        "dashboardNotifications.actions.declineRequest",
                        "Decline request",
                      )}
                    </button>

                    <Link
                      href={`/dashboard/bookings?businessId=${request.business_id}`}
                      className="btn btn-ghost"
                    >
                      {t(
                        "dashboardNotifications.actions.openBooking",
                        "Open appointment",
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && recentBusinessNotifications.length > 0 && (
        <div className="business-notification-section">
          <div className="business-inbox-section-header">
            <div>
              <p className="small muted">
                {t("dashboardNotifications.inbox.kicker", "Recent")}
              </p>
              <h2 style={{ fontFamily: "var(--font-display)" }}>
                {t("dashboardNotifications.inbox.title", "Recent updates")}
              </h2>
            </div>
          </div>

          <div className="business-update-list">
            {recentBusinessNotifications.map((notification) => {
              const linkedBooking = notification.booking_id
                ? bookings.find(
                    (booking) => booking.id === notification.booking_id,
                  )
                : null;
              const displayNotification = businessNotificationText(
                notification,
                t,
                linkedBooking?.status,
              );

              return (
                <div
                  key={notification.id}
                  className="business-update-row"
                  style={{
                    borderColor: notificationBorder(notification),
                    background: notificationBackground(notification),
                  }}
                >
                  <div className="business-update-copy">
                    <div className="business-update-heading">
                      <strong>{displayNotification.title}</strong>
                      <span
                        className="small"
                        style={{
                          background: notification.read_at
                            ? "var(--surface-2)"
                            : "var(--accent-dim)",
                          color: notification.read_at
                            ? "var(--text-muted)"
                            : "var(--accent)",
                          padding: "0.18rem 0.5rem",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                        }}
                      >
                        {notification.read_at
                          ? t("dashboardNotifications.status.read", "Read")
                          : t("dashboardNotifications.status.unread", "Unread")}
                      </span>
                    </div>

                    {displayNotification.message && (
                      <p className="small muted">
                        {displayNotification.message}
                      </p>
                    )}

                    <p className="small muted">
                      {formatInboxDateTime(notification.created_at)}
                    </p>
                  </div>

                  <div className="business-notification-card-actions">
                    {notification.action_url && (
                      <Link
                        href={notification.action_url}
                        className="btn btn-accent"
                        onClick={() => markNotificationRead(notification)}
                      >
                        {businessNotificationActionLabel(
                          notification,
                          linkedBooking?.status || null,
                          t,
                        )}
                      </Link>
                    )}

                    {!notification.read_at && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => markNotificationRead(notification)}
                      >
                        {t(
                          "dashboardNotifications.actions.markRead",
                          "Mark read",
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && pastRequests.length > 0 && (
        <details className="business-notification-history">
          <summary>
            <span>
              {t(
                "dashboardNotifications.sections.previousRescheduleRequests",
                "Handled reschedule requests",
              )}
            </span>
            <span className="small muted">{pastRequests.length}</span>
          </summary>

          {pastRequests.map((request) => {
            const linkedBooking = requestBooking(request);

            return (
              <div
                key={request.id}
                className="card"
                style={{
                  opacity: request.status === "cancelled" ? 0.65 : 0.85,
                }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  <strong>
                    {linkedBooking?.customer_name ||
                      t("dashboardBookings.card.customerFallback", "Customer")}
                  </strong>

                  <p className="small muted" style={{ marginTop: "0.35rem" }}>
                    {t("dashboardBookings.card.service", "Service")}:{" "}
                    {serviceName(
                      linkedBooking,
                      t(
                        "dashboardNotifications.labels.serviceFallback",
                        "Service",
                      ),
                    )}
                  </p>

                  <p className="small muted">
                    {t(
                      "dashboardNotifications.labels.requestedTime",
                      "Requested time",
                    )}
                    : {formatInboxDateTime(request.requested_start_at)}
                  </p>

                  <p className="small muted">
                    {t("dashboardNotifications.labels.requested", "Requested")}:{" "}
                    {formatInboxDateTime(request.created_at)}
                  </p>

                  <p
                    className="small"
                    style={{ color: statusColor(request.status) }}
                  >
                    {t("dashboardBookings.filters.status", "Status")}:{" "}
                    {statusLabel(request.status)}
                  </p>

                  {request.response_message && (
                    <p className="small muted">
                      {t("dashboardNotifications.labels.response", "Response")}:{" "}
                      {request.response_message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </details>
      )}

      <style jsx>{`
        .business-inbox-overview {
          align-items: center;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr) auto;
          margin-bottom: 1.25rem;
          padding: 1rem;
        }

        .business-inbox-overview h2 {
          font-family: var(--font-display);
          margin-top: 0.15rem;
        }

        .business-inbox-metrics {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .business-inbox-metrics span {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-muted);
          display: grid;
          gap: 0.2rem;
          padding: 0.65rem;
        }

        .business-inbox-metrics strong {
          color: var(--text);
          font-size: 1.25rem;
          line-height: 1;
        }

        .business-inbox-section-header {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .business-inbox-count {
          background: var(--accent-dim);
          border: 1px solid rgba(255, 107, 53, 0.32);
          border-radius: 999px;
          color: var(--accent);
          font-weight: 700;
          min-width: 2.35rem;
          padding: 0.4rem 0.75rem;
          text-align: center;
        }

        .business-notification-banner-row,
        .business-notification-empty-actions {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .business-notification-empty-actions {
          justify-content: flex-start;
          margin-top: 1rem;
        }

        .business-notification-section {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .business-notification-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .business-notification-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: flex-end;
        }

        .business-action-card,
        .business-update-row {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1rem;
        }

        .business-action-card-heading,
        .business-update-heading {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.45rem;
        }

        .business-action-type {
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .business-action-meta,
        .business-action-contact {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.7rem;
        }

        .business-action-meta span,
        .business-action-contact span {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--text-muted);
          font-size: 0.82rem;
          padding: 0.32rem 0.65rem;
        }

        .business-update-list {
          display: grid;
          gap: 0.75rem;
        }

        .business-update-row {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .business-update-copy {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
        }

        .business-notification-time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .business-time-chip {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.75rem;
        }

        .business-time-chip.is-requested {
          background: var(--accent-dim);
          border-color: rgba(255, 107, 53, 0.35);
        }

        .business-notification-history {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          margin-bottom: 1.5rem;
          padding: 0.85rem 1rem;
        }

        .business-notification-history summary {
          align-items: center;
          cursor: pointer;
          display: flex;
          font-weight: 700;
          justify-content: space-between;
          list-style: none;
        }

        .business-notification-history summary::-webkit-details-marker {
          display: none;
        }

        .business-notification-history .card {
          margin-top: 0.75rem;
        }

        @media (max-width: 640px) {
          .business-inbox-overview {
            grid-template-columns: 1fr;
          }

          .business-inbox-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .business-inbox-metrics span {
            font-size: 0.76rem;
            padding: 0.55rem;
          }

          .business-notification-card-actions,
          .business-notification-banner-row,
          .business-notification-empty-actions {
            width: 100%;
            justify-content: stretch;
          }

          .business-update-row {
            align-items: stretch;
            display: grid;
          }

          .business-notification-card-actions :global(.btn),
          .business-notification-card-actions button,
          .business-notification-card-actions a,
          .business-notification-banner-row :global(.btn),
          .business-notification-banner-row button,
          .business-notification-empty-actions :global(.btn),
          .business-notification-empty-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
