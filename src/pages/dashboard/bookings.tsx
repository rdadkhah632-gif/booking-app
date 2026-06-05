import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import BookingsSummaryCards from "@/components/dashboard-bookings/BookingsSummaryCards";
import BookingsFilterPanel from "@/components/dashboard-bookings/BookingsFilterPanel";
import BookingCard from "@/components/dashboard-bookings/BookingCard";
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

  const todayBookings = useMemo(() => {
    const range = dateRangeForFilter("today");
    if (!range.start || !range.end) return [];

    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.start_at);
      return bookingDate >= range.start! && bookingDate <= range.end!;
    });
  }, [bookings]);

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === "confirmed" && new Date(booking.start_at) >= now,
    );
  }, [bookings, now]);

  const historicalBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === "cancelled" ||
        booking.status === "declined" ||
        booking.status === "completed" ||
        (booking.status === "confirmed" && new Date(booking.start_at) < now),
    );
  }, [bookings, now]);

  const filteredBookings = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const range = dateRangeForFilter(rangeFilter);

    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.start_at);

      const matchesStatus =
        statusFilter === "all" ? true : booking.status === statusFilter;
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

      return matchesStatus && matchesSearch && matchesRange;
    });
  }, [bookings, rangeFilter, selectedDate, statusFilter, searchTerm, now]);

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

  const activeFilterSummary = [
    selectedRange.label,
    statusFilter === "all"
      ? t("dashboardBookings.status.all", "All statuses")
      : statusLabel(statusFilter),
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

  function setSummaryView(filter: RangeFilter, nextStatus?: string) {
    if (nextStatus) setStatusFilter(nextStatus);
    updateBookingView(filter);
    replaceBookingsQuery({
      nextFilter: filter,
      nextStatus: nextStatus || statusFilter,
    });
  }

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    updateBookingView("today");
    replaceBookingsQuery({ nextFilter: "today", nextStatus: "all" });
  }

  return (
    <DashboardLayout
      title={t("dashboardBookings.pageTitle", "Bookings")}
      subtitle={
        business
          ? `${t("dashboardBookings.pageSubtitleSelected", "Manage appointments and booking requests for")} ${business.name}.`
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
        <EmptyBookingsCard type="no-bookings" businessId={business.id} />
      )}

      {!pageLoading && business && bookings.length > 0 && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <BookingsSummaryCards
            summary={{
              pendingCount: pendingBookings.length,
              todayCount: todayBookings.length,
              upcomingConfirmedCount: confirmedUpcomingBookings.length,
              historyCount: historicalBookings.length,
              filteredCount: filteredBookings.length,
            }}
            onSetView={setSummaryView}
          />

          <BookingsFilterPanel
            selectedRangeLabel={selectedRange.label}
            rangeFilter={rangeFilter}
            selectedDate={selectedDate}
            statusFilter={statusFilter}
            searchTerm={searchTerm}
            activeFilterSummary={activeFilterSummary}
            onUpdateView={updateBookingView}
            onStatusChange={(nextStatus) => {
              setStatusFilter(nextStatus);
              replaceBookingsQuery({ nextStatus });
            }}
            onSearchChange={setSearchTerm}
            onReset={resetFilters}
          />

          {filteredBookings.length === 0 && (
            <EmptyBookingsCard type="no-filtered-results" />
          )}

          {groupedFilteredBookings.map((group) => (
            <section
              key={group.dateKey}
              style={{ display: "grid", gap: "1rem" }}
            >
              <div>
                <p className="small muted">
                  {group.bookings.length}{" "}
                  {t("dashboardBookings.appointmentCount", "appointment")}
                  {group.bookings.length === 1 ? "" : "s"}
                </p>
                <h2 style={{ fontFamily: "var(--font-display)" }}>
                  {group.label}
                </h2>
              </div>

              {group.bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  businessId={business?.id}
                  actionLoadingId={actionLoadingId}
                  actionError={
                    actionError?.bookingId === booking.id
                      ? actionError.message
                      : null
                  }
                  customerHistoryLink={customerHistoryLink}
                  acceptPendingBooking={acceptPendingBooking}
                  declinePendingBooking={declinePendingBooking}
                  cancelBooking={cancelBooking}
                  completeBooking={completeBooking}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        .booking-success-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        @media (max-width: 700px) {
          .booking-success-row {
            display: grid;
          }

          .booking-success-row :global(.btn),
          .booking-success-row button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
