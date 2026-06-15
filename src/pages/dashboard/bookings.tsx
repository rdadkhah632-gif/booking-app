import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import EmptyBookingsCard from "@/components/dashboard-bookings/EmptyBookingsCard";
import {
  Booking,
  Business,
  RangeFilter,
} from "@/components/dashboard-bookings/dashboardBookingsTypes";
import { useBookingStatusLabel } from "@/components/dashboard-bookings/BookingStatusBadge";
import { useI18n } from "@/lib/useI18n";
import {
  isDeclinedStatusUnsupported,
  supabaseErrorDetails,
} from "@/lib/bookingStatusErrors";
import { requestTransactionalEmail } from "@/lib/email/client";

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default function Bookings() {
  const router = useRouter();
  const { t } = useI18n();
  const bookingStatusLabel = useBookingStatusLabel();
  const { businessId, date, status, view } = router.query;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("today");
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date()),
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    bookingId: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function buildBookingsQuery(next?: {
    nextBusinessId?: string;
    nextFilter?: RangeFilter;
    nextDate?: string;
    nextStatus?: string;
  }) {
    const query: Record<string, string> = {};
    const effectiveBusinessId =
      next?.nextBusinessId ||
      business?.id ||
      (typeof businessId === "string" ? businessId : "");
    const effectiveFilter = next?.nextFilter || rangeFilter;
    const effectiveDate = next?.nextDate || selectedDate;
    const effectiveStatus = next?.nextStatus ?? statusFilter;

    if (effectiveBusinessId) query.businessId = effectiveBusinessId;

    if (effectiveFilter === "custom") {
      query.date = effectiveDate;
    } else {
      query.view = effectiveFilter;
    }

    if (effectiveStatus !== "all") query.status = effectiveStatus;

    return query;
  }

  function replaceBookingsQuery(next?: {
    nextBusinessId?: string;
    nextFilter?: RangeFilter;
    nextDate?: string;
    nextStatus?: string;
  }) {
    router.replace(
      {
        pathname: "/dashboard/bookings",
        query: buildBookingsQuery(next),
      },
      undefined,
      { shallow: true },
    );
  }

  function updateBookingView(nextFilter: RangeFilter, nextDate?: string) {
    const effectiveDate = nextDate || selectedDate;
    setSelectedDate(effectiveDate);
    setRangeFilter(nextFilter);

    replaceBookingsQuery({
      nextFilter,
      nextDate: effectiveDate,
    });
  }

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("user_id", sessionUserId)
      .order("created_at", { ascending: false });

    if (businessesError) throw businessesError;

    const owned = ownedBusinesses || [];
    setBusinesses(owned);

    if (owned.length === 0) return null;

    if (businessId && !Array.isArray(businessId)) {
      const selected = owned.find((item) => item.id === businessId);

      if (!selected) {
        throw new Error(
          t(
            "dashboardBookings.error.noAccess",
            "You do not have access to this business.",
          ),
        );
      }
      return selected;
    }

    if (owned.length === 1) return owned[0];

    return owned[0];
  }

  async function loadBookings(options?: {
    keepSuccess?: boolean;
    silent?: boolean;
  }) {
    setError(null);
    setActionError(null);
    if (!options?.keepSuccess) setSuccess(null);
    if (!options?.silent) setPageLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const selectedBusiness = await getBusinessContext(session.user.id);

      if (!selectedBusiness) {
        setBusiness(null);
        setBookings([]);
        setPageLoading(false);
        return;
      }

      setBusiness(selectedBusiness);

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          business_id,
          customer_user_id,
          customer_name,
          customer_email,
          customer_phone,
          customer_notes,
          internal_notes,
          start_at,
          end_at,
          duration_minutes,
          status,
          created_at,
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
        .eq("business_id", selectedBusiness.id)
        .order("start_at", { ascending: true });

      if (error) throw error;

      const normalisedBookings = (data || []).map((booking: any) => ({
        ...booking,
        services: Array.isArray(booking.services)
          ? booking.services[0] || null
          : booking.services,
        staff_members: Array.isArray(booking.staff_members)
          ? booking.staff_members[0] || null
          : booking.staff_members,
      }));

      setBookings(normalisedBookings);
      setPageLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t("dashboardBookings.error.load", "Could not load bookings."),
      );
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadBookings();
  }, [router.isReady, businessId]);

  useEffect(() => {
    if (!router.isReady) return;

    function refreshOnFocus() {
      loadBookings({ silent: true, keepSuccess: true });
    }

    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadBookings({ silent: true, keepSuccess: true });
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [router.isReady, businessId]);

  useEffect(() => {
    if (!business?.id) return;

    let refreshTimer: number | null = null;
    function queueRefresh() {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadBookings({ silent: true, keepSuccess: true });
      }, 350);
    }

    const channel = supabase
      .channel(`business-bookings-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `business_id=eq.${business.id}`,
        },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_requests",
          filter: `business_id=eq.${business.id}`,
        },
        queueRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [business?.id]);

  useEffect(() => {
    if (!router.isReady) return;

    const validViews: RangeFilter[] = [
      "today",
      "tomorrow",
      "week",
      "upcoming",
      "history",
      "custom",
    ];
    const validStatuses = [
      "all",
      "pending",
      "confirmed",
      "completed",
      "cancelled",
      "declined",
    ];

    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSelectedDate(date);
      setRangeFilter("custom");
      return;
    }

    if (typeof view === "string" && validViews.includes(view as RangeFilter)) {
      setRangeFilter(view as RangeFilter);
    }

    if (typeof status === "string" && validStatuses.includes(status)) {
      setStatusFilter(status);
    } else if (typeof status === "undefined") {
      setStatusFilter("all");
    }
  }, [router.isReady, date, status, view]);

  async function createCustomerNotification(params: {
    booking: Booking;
    type: string;
    title: string;
    message: string;
    actionUrl: string;
  }) {
    if (!params.booking.customer_user_id) return;

    await supabase.from("notifications").insert({
      user_id: params.booking.customer_user_id,
      business_id: params.booking.business_id,
      booking_id: params.booking.id,
      audience: "customer",
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl,
    });
  }

  function updateLocalBookingStatus(bookingId: string, nextStatus: string) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status: nextStatus } : booking,
      ),
    );
  }

  function serviceName(booking: Booking) {
    return (
      booking.services?.name ||
      t("dashboardBookings.notification.defaultService", "your appointment")
    );
  }

  function appointmentDateTime(booking: Booking) {
    return new Date(booking.start_at).toLocaleString();
  }

  async function acceptPendingBooking(booking: Booking) {
    if (actionLoadingId) return;

    const confirmed = confirm(
      t(
        "dashboardBookings.confirm.accept",
        "Accept this booking request and confirm the appointment?",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(booking.id);
    setActionError(null);
    setError(null);
    setSuccess(null);

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking.id)
      .eq("business_id", booking.business_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    setActionLoadingId(null);

    if (error || !updatedBooking) {
      setError(
        error?.message ||
          t(
            "dashboardBookings.error.actionNoLongerAvailable",
            "This booking is no longer available for that action. Refresh bookings to see the latest status.",
          ),
      );
      return;
    }

    updateLocalBookingStatus(booking.id, "confirmed");

    await createCustomerNotification({
      booking,
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
        "dashboardBookings.success.accepted",
        "Booking accepted. The customer has been notified and the appointment is now confirmed.",
      ),
    );
    await loadBookings({ keepSuccess: true, silent: true });
  }

  async function declinePendingBooking(booking: Booking) {
    if (actionLoadingId) return;

    const confirmed = confirm(
      t(
        "dashboardBookings.confirm.decline",
        "Decline this booking request? The customer will see it as declined.",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(booking.id);
    setActionError(null);
    setError(null);
    setSuccess(null);

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: "declined" })
      .eq("id", booking.id)
      .eq("business_id", booking.business_id)
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
            "This booking is no longer available for that action. Refresh bookings to see the latest status.",
          );
      setError(message);
      setActionError({ bookingId: booking.id, message });
      return;
    }

    updateLocalBookingStatus(booking.id, "declined");

    await createCustomerNotification({
      booking,
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
    await loadBookings({ keepSuccess: true, silent: true });
  }

  async function cancelBooking(booking: Booking) {
    if (actionLoadingId) return;

    const confirmed = confirm(
      t(
        "dashboardBookings.confirm.cancel",
        "Cancel this booking? This will also show as cancelled to the customer.",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(booking.id);
    setActionError(null);
    setError(null);
    setSuccess(null);

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("business_id", booking.business_id)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();

    setActionLoadingId(null);

    if (error || !updatedBooking) {
      setError(
        error?.message ||
          t(
            "dashboardBookings.error.actionNoLongerAvailable",
            "This booking is no longer available for that action. Refresh bookings to see the latest status.",
          ),
      );
      return;
    }

    updateLocalBookingStatus(booking.id, "cancelled");

    await createCustomerNotification({
      booking,
      type: "booking_cancelled",
      title: t(
        "dashboardBookings.notification.cancelledTitle",
        "Booking cancelled",
      ),
      message: t(
        "dashboardBookings.notification.cancelledMessage",
        "Your booking was cancelled by the business.",
      ),
      actionUrl: "/my-bookings",
    });
    void requestTransactionalEmail({
      event: "booking_status_changed",
      bookingId: booking.id,
    });

    setSuccess(
      t(
        "dashboardBookings.success.cancelled",
        "Booking cancelled. The customer has been notified and the booking is now locked as cancelled.",
      ),
    );
    await loadBookings({ keepSuccess: true, silent: true });
  }

  async function completeBooking(booking: Booking) {
    if (actionLoadingId) return;

    const confirmed = confirm(
      t(
        "dashboardBookings.confirm.complete",
        "Mark this appointment as completed?",
      ),
    );
    if (!confirmed) return;

    setActionLoadingId(booking.id);
    setActionError(null);
    setError(null);
    setSuccess(null);

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id)
      .eq("business_id", booking.business_id)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();

    setActionLoadingId(null);

    if (error || !updatedBooking) {
      setError(
        error?.message ||
          t(
            "dashboardBookings.error.actionNoLongerAvailable",
            "This booking is no longer available for that action. Refresh bookings to see the latest status.",
          ),
      );
      return;
    }

    updateLocalBookingStatus(booking.id, "completed");

    await createCustomerNotification({
      booking,
      type: "booking_completed",
      title: t(
        "dashboardBookings.notification.completedTitle",
        "Appointment completed",
      ),
      message: t(
        "dashboardBookings.notification.completedMessage",
        "Your appointment has been marked as completed.",
      ),
      actionUrl: "/my-bookings",
    });
    void requestTransactionalEmail({
      event: "booking_status_changed",
      bookingId: booking.id,
    });

    setSuccess(
      t(
        "dashboardBookings.success.completed",
        "Booking marked as completed. The customer has been notified and the booking is now locked in history.",
      ),
    );
    await loadBookings({ keepSuccess: true, silent: true });
  }

  function statusLabel(value: string) {
    return bookingStatusLabel(value);
  }

  function bookingTime(booking: Booking) {
    const start = new Date(booking.start_at);
    const end = booking.end_at
      ? new Date(booking.end_at)
      : new Date(start.getTime() + booking.duration_minutes * 60000);

    return {
      start,
      end,
      label: `${start.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${end.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    };
  }

  function dateRangeForFilter(filter: RangeFilter) {
    const today = startOfDay(new Date());

    if (filter === "today") {
      return {
        start: today,
        end: endOfDay(today),
        label: t("dashboardHome.summary.today", "Today"),
      };
    }

    if (filter === "tomorrow") {
      const tomorrow = addDays(today, 1);
      return {
        start: tomorrow,
        end: endOfDay(tomorrow),
        label: t("dashboardBookings.range.tomorrow", "Tomorrow"),
      };
    }

    if (filter === "week") {
      return {
        start: today,
        end: endOfDay(addDays(today, 6)),
        label: t("dashboardHome.schedule.title", "Next 7 days"),
      };
    }

    if (filter === "custom") {
      const selected = new Date(`${selectedDate}T12:00:00`);
      return {
        start: startOfDay(selected),
        end: endOfDay(selected),
        label: selected.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
      };
    }

    return {
      start: null,
      end: null,
      label:
        filter === "history"
          ? t("dashboardBookings.summary.history", "History")
          : t("dashboardBookings.range.upcoming", "All upcoming"),
    };
  }

  const now = new Date();

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const staffOptions = useMemo(() => {
    return Array.from(
      new Set(
        bookings
          .map((booking) => booking.staff_members?.name?.trim())
          .filter(Boolean) as string[],
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const range = dateRangeForFilter(rangeFilter);

    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.start_at);

      const matchesStatus =
        statusFilter === "all" ? true : booking.status === statusFilter;
      const matchesStaff =
        staffFilter === "all"
          ? true
          : booking.staff_members?.name?.trim() === staffFilter;
      const matchesSearch = !search
        ? true
        : [
            booking.customer_name,
            booking.customer_email,
            booking.customer_phone,
            booking.services?.name,
            booking.staff_members?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);

      let matchesRange = true;

      if (rangeFilter === "history") {
        matchesRange =
          booking.status === "cancelled" ||
          booking.status === "declined" ||
          booking.status === "completed" ||
          (booking.status === "confirmed" && bookingDate < now);
      } else if (rangeFilter === "upcoming") {
        matchesRange =
          booking.status === "pending" ||
          (booking.status === "confirmed" && bookingDate >= now);
      } else if (range.start && range.end) {
        matchesRange = bookingDate >= range.start && bookingDate <= range.end;
      }

      return matchesStatus && matchesStaff && matchesSearch && matchesRange;
    });
  }, [
    bookings,
    rangeFilter,
    selectedDate,
    statusFilter,
    staffFilter,
    searchTerm,
    now,
  ]);

  const groupedFilteredBookings = useMemo(() => {
    const groups = filteredBookings.reduce<Record<string, Booking[]>>(
      (acc, booking) => {
        const key = new Date(booking.start_at).toISOString().slice(0, 10);
        if (!acc[key]) acc[key] = [];
        acc[key].push(booking);
        return acc;
      },
      {},
    );

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (rangeFilter === "history") return b.localeCompare(a);
        return a.localeCompare(b);
      })
      .map(([dateKey, rows]) => ({
        dateKey,
        label: new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        bookings: rows.sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
      }));
  }, [filteredBookings, rangeFilter]);

  const selectedRange = dateRangeForFilter(rangeFilter);

  const selectedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    undefined,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );

  const activeFilterSummary = [
    selectedRange.label,
    statusFilter === "all"
      ? t("dashboardBookings.status.all", "All statuses")
      : statusLabel(statusFilter),
    staffFilter !== "all"
      ? `${t("support.business.staff", "Staff")}: ${staffFilter}`
      : "",
    searchTerm.trim()
      ? `${t("dashboardBookings.filters.searchShort", "Search")}: ${searchTerm.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  function customerHistoryLink(booking: Booking) {
    if (booking.customer_user_id) {
      return `/dashboard/customers/${booking.customer_user_id}?businessId=${business?.id || booking.business_id}`;
    }

    return `/dashboard/customers/by-email?email=${encodeURIComponent(booking.customer_email || "")}&businessId=${business?.id || booking.business_id}`;
  }

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setStaffFilter("all");
    updateBookingView("today");
    replaceBookingsQuery({ nextFilter: "today", nextStatus: "all" });
  }

  function goToToday() {
    const today = toDateInputValue(new Date());
    setSelectedDate(today);
    setRangeFilter("today");
    replaceBookingsQuery({ nextFilter: "today", nextDate: today });
  }

  function changeSelectedDate(value: string) {
    setSelectedDate(value);
    setRangeFilter("custom");
    replaceBookingsQuery({ nextFilter: "custom", nextDate: value });
  }

  function renderAppointment(booking: Booking) {
    const time = bookingTime(booking);
    const isWorking = actionLoadingId === booking.id;
    const isLocked =
      booking.status === "cancelled" ||
      booking.status === "declined" ||
      booking.status === "completed";

    return (
      <article key={booking.id} className={`calendar-appointment ${booking.status}`}>
        <div className="calendar-time">
          <strong>{time.label}</strong>
          <span>{booking.duration_minutes} {t("common.minutes", "minutes")}</span>
        </div>

        <div className="calendar-appointment-main">
          <div className="calendar-appointment-heading">
            <Link href={customerHistoryLink(booking)}>
              {booking.customer_name ||
                t("dashboardBookings.card.customerFallback", "Customer")}
            </Link>
            <span className={`calendar-status status-${booking.status}`}>
              {statusLabel(booking.status)}
            </span>
          </div>

          <p className="small muted">
            {booking.services?.name ||
              t("dashboardBookings.card.noService", "No service recorded")}
            {" · "}
            {booking.staff_members?.name ||
              t("dashboardBookings.card.noStaff", "Staff not recorded")}
          </p>

          {(booking.customer_notes || booking.internal_notes) && (
            <p className="small muted calendar-note">
              {booking.customer_notes || booking.internal_notes}
            </p>
          )}
        </div>

        <div className="calendar-actions">
          {booking.status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => acceptPendingBooking(booking)}
                className="btn btn-accent"
                disabled={isWorking}
              >
                {isWorking
                  ? t("dashboardBookings.actions.working", "Working...")
                  : t("dashboardBookings.actions.accept", "Accept")}
              </button>
              <button
                type="button"
                onClick={() => declinePendingBooking(booking)}
                className="btn btn-danger"
                disabled={isWorking}
              >
                {t("dashboardBookings.actions.decline", "Decline")}
              </button>
            </>
          )}

          {booking.status === "confirmed" && !isLocked && (
            <>
              <button
                type="button"
                onClick={() => completeBooking(booking)}
                className="btn btn-ghost"
                disabled={isWorking}
              >
                {t("dashboardBookings.actions.complete", "Complete")}
              </button>
              <button
                type="button"
                onClick={() => cancelBooking(booking)}
                className="btn btn-ghost"
                disabled={isWorking}
              >
                {t("dashboardBookings.actions.cancel", "Cancel")}
              </button>
            </>
          )}

          <Link href={customerHistoryLink(booking)} className="btn btn-ghost">
            {t("dashboardBookings.card.customerDetails", "Details")}
          </Link>
        </div>

        {actionError?.bookingId === booking.id && (
          <p role="alert" className="small calendar-action-error">
            {actionError.message}
          </p>
        )}
      </article>
    );
  }

  return (
    <DashboardLayout
      title={t("dashboardBookings.pageTitle", "Calendar")}
      subtitle={
        business
          ? `${t("dashboardBookings.pageSubtitleSelected", "Appointments and booking requests for")} ${business.name}.`
          : t(
              "dashboardBookings.pageSubtitle",
              "Create your business first, then customer bookings will appear here.",
            )
      }
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
          <div className="booking-success-row">
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

      {pageLoading && (
        <div className="card">
          <p className="muted">
            {t("dashboardBookings.loading", "Loading bookings...")}
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

      {!pageLoading && businesses.length === 0 && (
        <EmptyBookingsCard type="no-business" />
      )}

      {!pageLoading && business && businesses.length > 1 && (
        <div
          className="card"
          style={{ borderColor: "rgba(255,190,11,0.28)", marginBottom: "1rem" }}
        >
          <p className="small muted">
            {t(
              "dashboardBookings.multiBusinessNotice",
              "This account has more than one business. Mirëbook is using your primary business for this launch version. Contact support if this needs changing.",
            )}
          </p>
        </div>
      )}

      {!pageLoading && business && bookings.length === 0 && (
        <section className="calendar-empty-state">
          <div>
            <h2>{t("dashboardBookings.emptyCalendar.title", "No appointments yet")}</h2>
            <p className="muted">
              {t(
                "dashboardBookings.emptyCalendar.body",
                "When customers book, appointment requests and confirmed bookings will appear here.",
              )}
            </p>
          </div>

          <div className="calendar-empty-ready-card">
            <strong>
              {t("dashboardBookings.emptyCalendar.readyTitle", "Ready to take bookings?")}
            </strong>
            <p className="small muted">
              {t(
                "dashboardBookings.emptyCalendar.readyBody",
                "Complete setup, preview the customer profile, then share the booking page when you are ready.",
              )}
            </p>
          </div>

          <div className="calendar-empty-action-grid">
            <Link href="/dashboard/businesses" className="calendar-empty-action">
              <strong>{t("dashboardLayout.nav.setup", "Setup")}</strong>
              <span>{t("dashboardBookings.empty.completeSetup", "Complete setup")}</span>
            </Link>
            <Link href="/dashboard/services" className="calendar-empty-action">
              <strong>{t("dashboardLayout.nav.services", "Services")}</strong>
              <span>{t("dashboardBookings.empty.addService", "Add first service")}</span>
            </Link>
            <Link href="/dashboard/availability" className="calendar-empty-action">
              <strong>{t("dashboardHome.setup.hours", "Working hours")}</strong>
              <span>{t("dashboardBookings.empty.setAvailability", "Set availability")}</span>
            </Link>
            <Link href={`/explore/${business.id}`} className="calendar-empty-action">
              <strong>{t("dashboardHome.setup.preview", "See what customers see")}</strong>
              <span>{t("dashboardBookings.empty.previewProfile", "Preview public profile")}</span>
            </Link>
          </div>

          <Link href="/dashboard" className="btn btn-ghost calendar-empty-today">
            {t("dashboardLayout.nav.today", "Today")}
          </Link>
        </section>
      )}

      {!pageLoading && business && bookings.length > 0 && (
        <div className="calendar-workspace">
          <section className="calendar-shell">
            <div className="calendar-toolbar">
              <div>
                <p className="small muted">
                  {t("dashboardBookings.calendar.kicker", "Schedule")}
                </p>
                <h2>{rangeFilter === "custom" ? selectedDateLabel : selectedRange.label}</h2>
              </div>

              <div className="calendar-date-controls">
                <button type="button" className="btn btn-ghost" onClick={goToToday}>
                  {t("dashboardHome.summary.today", "Today")}
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => changeSelectedDate(event.target.value)}
                  aria-label={t("dashboardBookings.filters.jumpDate", "Jump to date")}
                />
              </div>
            </div>

            <div className="calendar-range-row">
              {[
                { key: "today", label: t("dashboardHome.summary.today", "Today") },
                {
                  key: "tomorrow",
                  label: t("dashboardBookings.range.tomorrow", "Tomorrow"),
                },
                { key: "week", label: t("dashboardHome.schedule.title", "Next 7 days") },
                {
                  key: "upcoming",
                  label: t("dashboardBookings.range.upcoming", "Upcoming"),
                },
                {
                  key: "history",
                  label: t("dashboardBookings.summary.history", "History"),
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={
                    rangeFilter === item.key ? "calendar-chip active" : "calendar-chip"
                  }
                  onClick={() => updateBookingView(item.key as RangeFilter)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="calendar-filter-row">
              <label>
                <span>{t("dashboardBookings.filters.status", "Status")}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    replaceBookingsQuery({ nextStatus: event.target.value });
                  }}
                >
                  <option value="all">
                    {t("dashboardBookings.status.all", "All statuses")}
                  </option>
                  <option value="pending">{statusLabel("pending")}</option>
                  <option value="confirmed">{statusLabel("confirmed")}</option>
                  <option value="completed">{statusLabel("completed")}</option>
                  <option value="cancelled">{statusLabel("cancelled")}</option>
                  <option value="declined">{statusLabel("declined")}</option>
                </select>
              </label>

              {staffOptions.length > 0 && (
                <label>
                  <span>{t("support.business.staff", "Staff")}</span>
                  <select
                    value={staffFilter}
                    onChange={(event) => setStaffFilter(event.target.value)}
                  >
                    <option value="all">
                      {t("dashboardBookings.filters.allStaff", "All staff")}
                    </option>
                    {staffOptions.map((staffName) => (
                      <option key={staffName} value={staffName}>
                        {staffName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                <span>{t("dashboardBookings.filters.searchShort", "Search")}</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t(
                    "dashboardBookings.filters.searchPlaceholder",
                    "Search bookings",
                  )}
                />
              </label>
            </div>
          </section>

          <div className="calendar-overview">
            <div>
              <strong>{activeFilterSummary}</strong>
              <span className="small muted">
                {filteredBookings.length}{" "}
                {t("dashboardBookings.appointments", "appointments")}
              </span>
            </div>
            {pendingBookings.length > 0 && (
              <span className="calendar-pending">
                {pendingBookings.length}{" "}
                {t("dashboardBookings.needsApproval", "need approval")}
              </span>
            )}
          </div>

          {pendingBookings.length > 0 && rangeFilter !== "history" && (
            <section className="pending-strip">
              <div>
                <strong>
                  {t("dashboardBookings.pendingStrip.title", "Requests waiting")}
                </strong>
                <p className="small muted">
                  {t(
                    "dashboardBookings.pendingStrip.body",
                    "Review pending booking requests before they become part of the confirmed schedule.",
                  )}
                </p>
              </div>
              <div className="pending-strip-list">
                {pendingBookings.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    className="pending-pill"
                    onClick={() => {
                      setStatusFilter("pending");
                      updateBookingView("upcoming");
                    }}
                  >
                    <span>{booking.customer_name || t("common.customer", "Customer")}</span>
                    <small>{bookingTime(booking).label}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {filteredBookings.length === 0 && (
            <section className="calendar-empty-state">
              <h2>{t("dashboardBookings.empty.noFilteredTitle", "No appointments in this view")}</h2>
              <p className="muted">
                {t(
                  "dashboardBookings.empty.noFilteredBody",
                  "Try another date, staff member, status or search term.",
                )}
              </p>
              <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                {t("dashboardBookings.filters.reset", "Reset filters")}
              </button>
            </section>
          )}

          {groupedFilteredBookings.map((group) => (
            <section key={group.dateKey} className="calendar-day">
              <div className="calendar-day-heading">
                <p className="small muted">
                  {group.bookings.length}{" "}
                  {t("dashboardBookings.appointmentCount", "appointment")}
                  {group.bookings.length === 1 ? "" : "s"}
                </p>
                <h2 style={{ fontFamily: "var(--font-display)" }}>
                  {group.label}
                </h2>
              </div>

              <div className="calendar-day-schedule">
                {group.bookings.map((booking) => renderAppointment(booking))}
              </div>
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        .calendar-workspace {
          display: grid;
          gap: 1rem;
        }

        .calendar-shell,
        .calendar-empty-state {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .calendar-toolbar,
        .calendar-date-controls,
        .calendar-filter-row,
        .calendar-range-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .calendar-toolbar {
          justify-content: space-between;
        }

        .calendar-toolbar h2,
        .calendar-toolbar p,
        .calendar-empty-state h2,
        .calendar-empty-state p {
          margin-top: 0;
        }

        .calendar-date-controls input,
        .calendar-filter-row input,
        .calendar-filter-row select {
          min-height: 2.55rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          color-scheme: dark;
        }

        .calendar-date-controls input,
        .calendar-filter-row input,
        .calendar-filter-row select {
          padding: 0.55rem 0.7rem;
        }

        .calendar-filter-row label {
          display: grid;
          gap: 0.3rem;
          flex: 1 1 180px;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 700;
        }

        .calendar-chip {
          min-height: 2.35rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          border-radius: 999px;
          padding: 0.45rem 0.8rem;
          cursor: pointer;
        }

        .calendar-chip.active {
          border-color: rgba(255, 107, 53, 0.4);
          background: var(--accent-dim);
          color: var(--accent);
          font-weight: 800;
        }

        .calendar-overview {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 0.75rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .calendar-overview > div {
          display: grid;
          gap: 0.2rem;
        }

        .calendar-pending {
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 800;
        }

        .pending-strip {
          display: grid;
          grid-template-columns: minmax(180px, 0.85fr) minmax(0, 1.4fr);
          gap: 1rem;
          align-items: center;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(255, 107, 53, 0.24);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.07);
        }

        .pending-strip p {
          margin-top: 0.25rem;
        }

        .pending-strip-list {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .pending-pill {
          display: grid;
          gap: 0.15rem;
          min-width: 9rem;
          text-align: left;
          border: 1px solid rgba(255, 107, 53, 0.24);
          border-radius: var(--radius);
          background: rgba(11, 18, 32, 0.45);
          color: var(--text);
          padding: 0.65rem 0.75rem;
          cursor: pointer;
        }

        .pending-pill small {
          color: var(--text-muted);
        }

        .calendar-day {
          display: grid;
          gap: 0.8rem;
        }

        .calendar-day-heading {
          padding-top: 0.35rem;
          border-bottom: 1px solid var(--border);
        }

        .calendar-day-heading h2,
        .calendar-day-heading p {
          margin-top: 0;
        }

        .calendar-day-schedule {
          display: grid;
          gap: 0.55rem;
        }

        .calendar-appointment {
          display: grid;
          grid-template-columns: 9rem minmax(0, 1fr) auto;
          gap: 0.9rem;
          align-items: center;
          padding: 0.85rem 0;
          border-bottom: 1px solid var(--border);
        }

        .calendar-appointment.pending {
          border-left: 3px solid var(--accent);
          padding-left: 0.75rem;
        }

        .calendar-time,
        .calendar-appointment-main {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
        }

        .calendar-time span {
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .calendar-appointment-heading,
        .calendar-actions {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .calendar-appointment-heading a {
          color: var(--text);
          font-weight: 900;
          text-decoration: none;
        }

        .calendar-status {
          border-radius: 999px;
          padding: 0.18rem 0.5rem;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
        }

        .status-pending {
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
        }

        .status-confirmed,
        .status-completed {
          background: rgba(45, 212, 191, 0.12);
          color: var(--success);
        }

        .calendar-note {
          margin-top: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendar-actions {
          justify-content: flex-end;
        }

        .calendar-action-error {
          grid-column: 2 / -1;
          margin: 0;
          color: var(--danger);
        }

        .calendar-empty-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .calendar-empty-ready-card {
          display: grid;
          gap: 0.25rem;
          padding: 0.85rem;
          border: 1px solid rgba(255, 107, 53, 0.2);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.06);
        }

        .calendar-empty-ready-card p {
          margin: 0;
        }

        .calendar-empty-action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
        }

        .calendar-empty-action {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .calendar-empty-action span {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.82rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendar-empty-today {
          width: fit-content;
        }

        .booking-success-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        @media (max-width: 700px) {
          .calendar-shell,
          .calendar-empty-state {
            padding: 0.85rem;
          }

          .calendar-toolbar,
          .calendar-date-controls,
          .calendar-date-controls input,
          .calendar-range-row,
          .calendar-range-row button,
          .calendar-filter-row,
          .calendar-filter-row label,
          .pending-strip,
          .pending-strip-list,
          .pending-pill,
          .calendar-empty-action-grid,
          .calendar-empty-actions,
          .calendar-empty-actions :global(.btn),
          .calendar-empty-actions a {
            display: grid;
            width: 100%;
          }

          .calendar-overview {
            align-items: flex-start;
          }

          .calendar-appointment {
            grid-template-columns: 1fr;
            align-items: stretch;
            padding: 0.85rem 0;
          }

          .calendar-actions,
          .calendar-actions :global(.btn),
          .calendar-actions button,
          .calendar-actions a {
            width: 100%;
            justify-content: center;
          }

          .booking-success-row {
            display: grid;
          }

          .calendar-empty-action-grid {
            grid-template-columns: 1fr;
          }

          .booking-success-row :global(.btn),
          .booking-success-row button {
            width: 100%;
            justify-content: center;
          }

          .calendar-empty-today {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
