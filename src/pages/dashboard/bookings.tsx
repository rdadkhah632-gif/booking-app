import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import EmptyBookingsCard from "@/components/dashboard-bookings/EmptyBookingsCard";
import {
  Booking,
  Business,
} from "@/components/dashboard-bookings/dashboardBookingsTypes";
import { useBookingStatusLabel } from "@/components/dashboard-bookings/BookingStatusBadge";
import { useI18n } from "@/lib/useI18n";
import {
  isDeclinedStatusUnsupported,
  supabaseErrorDetails,
} from "@/lib/bookingStatusErrors";
import { requestTransactionalEmail } from "@/lib/email/client";
import {
  DEFAULT_TIME_ZONE,
  dateKeyInTimeZone,
  formatTimeRangeInTimeZone,
  minutesSinceMidnightInTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/timezone";

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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

const CALENDAR_HOUR_HEIGHT = 72;
const CALENDAR_MIN_BLOCK_HEIGHT = 52;
const DEFAULT_CALENDAR_START_HOUR = 8;
const DEFAULT_CALENDAR_END_HOUR = 18;

type ManualBookingService = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

type ManualBookingStaff = {
  id: string;
  business_id: string;
  name: string;
  role_title?: string | null;
  email?: string | null;
  user_id?: string | null;
  active: boolean;
};

type ManualStaffService = {
  staff_member_id: string;
  service_id: string;
};

type ManualBookingDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNotes: string;
  serviceId: string;
  staffMemberId: string;
  date: string;
  time: string;
};

const emptyManualBookingDraft: ManualBookingDraft = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerNotes: "",
  serviceId: "",
  staffMemberId: "",
  date: "",
  time: "09:00",
};

function dateKeyForDate(date: Date) {
  return toDateInputValue(date);
}

function labelForDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeInputForMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 45, totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

export default function Bookings() {
  const router = useRouter();
  const { t } = useI18n();
  const bookingStatusLabel = useBookingStatusLabel();
  const { businessId, date } = router.query;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [manualServices, setManualServices] = useState<ManualBookingService[]>(
    [],
  );
  const [manualStaff, setManualStaff] = useState<ManualBookingStaff[]>([]);
  const [manualStaffServices, setManualStaffServices] = useState<
    ManualStaffService[]
  >([]);

  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date()),
  );

  const [pageLoading, setPageLoading] = useState(true);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    bookingId: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [manualBookingSaving, setManualBookingSaving] = useState(false);
  const [selectedCalendarBookingId, setSelectedCalendarBookingId] = useState<
    string | null
  >(null);
  const [manualBookingError, setManualBookingError] = useState<string | null>(
    null,
  );
  const [manualBooking, setManualBooking] = useState<ManualBookingDraft>(
    () => ({
      ...emptyManualBookingDraft,
      date: toDateInputValue(new Date()),
    }),
  );

  function buildBookingsQuery(next?: {
    nextBusinessId?: string;
    nextDate?: string;
  }) {
    const query: Record<string, string> = {};
    const effectiveBusinessId =
      next?.nextBusinessId ||
      business?.id ||
      (typeof businessId === "string" ? businessId : "");
    const effectiveDate = next?.nextDate || selectedDate;

    if (effectiveBusinessId) query.businessId = effectiveBusinessId;
    if (effectiveDate) query.date = effectiveDate;

    return query;
  }

  function replaceBookingsQuery(next?: {
    nextBusinessId?: string;
    nextDate?: string;
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

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, name, timezone")
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
        setAccountUserId(null);
        router.replace("/login");
        return;
      }
      setAccountUserId(session.user.id);

      const selectedBusiness = await getBusinessContext(session.user.id);

      if (!selectedBusiness) {
        setBusiness(null);
        setBookings([]);
        setManualServices([]);
        setManualStaff([]);
        setManualStaffServices([]);
        setPageLoading(false);
        return;
      }

      setBusiness(selectedBusiness);

      const [
        { data, error },
        { data: serviceData, error: serviceError },
        { data: staffData, error: staffError },
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            `
            id,
            business_id,
            staff_member_id,
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
          .order("start_at", { ascending: true }),
        supabase
          .from("services")
          .select("id, business_id, name, duration_minutes, active")
          .eq("business_id", selectedBusiness.id)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("staff_members")
          .select("id, business_id, name, role_title, email, user_id, active")
          .eq("business_id", selectedBusiness.id)
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      if (error) throw error;
      if (serviceError) throw serviceError;
      if (staffError) throw staffError;

      setManualServices(serviceData || []);
      setManualStaff(staffData || []);

      const staffIds = (staffData || []).map((staff) => staff.id);

      if (staffIds.length > 0) {
        const { data: staffServiceData, error: staffServiceError } =
          await supabase
            .from("staff_services")
            .select("staff_member_id, service_id")
            .in("staff_member_id", staffIds);

        if (staffServiceError) throw staffServiceError;

        setManualStaffServices(staffServiceData || []);
      } else {
        setManualStaffServices([]);
      }

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

    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSelectedDate(date);
    }
  }, [router.isReady, date]);

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
            "This appointment is no longer available for that action. Refresh the calendar to see the latest status.",
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
              ? "Declined status is not enabled for this workspace yet. Contact Mirëbook support, then try again."
              : "Could not decline this booking.",
          )} ${t("dashboardBookings.error.databaseDetails", "Database details")}: ${supabaseErrorDetails(error)}`
        : t(
            "dashboardBookings.error.actionNoLongerAvailable",
            "This appointment is no longer available for that action. Refresh the calendar to see the latest status.",
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
            "This appointment is no longer available for that action. Refresh the calendar to see the latest status.",
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
            "This appointment is no longer available for that action. Refresh the calendar to see the latest status.",
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
    const timeZone = business?.timezone || DEFAULT_TIME_ZONE;

    return {
      start,
      end,
      startMinutes: minutesSinceMidnightInTimeZone(start, timeZone),
      endMinutes: minutesSinceMidnightInTimeZone(end, timeZone),
      label: formatTimeRangeInTimeZone(start, end, timeZone),
    };
  }

  const selectedManualService = useMemo(
    () =>
      manualServices.find(
        (service) => service.id === manualBooking.serviceId,
      ) || null,
    [manualServices, manualBooking.serviceId],
  );

  const manualStaffOptions = useMemo(() => {
    if (!manualBooking.serviceId) return manualStaff;
    const assignedStaffIds = new Set(
      manualStaffServices
        .filter((link) => link.service_id === manualBooking.serviceId)
        .map((link) => link.staff_member_id),
    );

    return manualStaff.filter((staff) => assignedStaffIds.has(staff.id));
  }, [manualBooking.serviceId, manualStaff, manualStaffServices]);

  const manualBookingSetupReady =
    manualServices.length > 0 &&
    manualStaff.length > 0 &&
    manualStaffServices.length > 0;
  const calendarTimeZone = business?.timezone || DEFAULT_TIME_ZONE;

  function staffOptionsForService(serviceId: string) {
    if (!serviceId) return manualStaff;

    const assignedStaffIds = new Set(
      manualStaffServices
        .filter((link) => link.service_id === serviceId)
        .map((link) => link.staff_member_id),
    );

    return manualStaff.filter((staff) => assignedStaffIds.has(staff.id));
  }

  function manualStaffLabel(staff: ManualBookingStaff) {
    const name =
      accountUserId && staff.user_id === accountUserId
        ? t("dashboardStaff.card.currentUserName", "You")
        : staff.name ||
          staff.email ||
          t("dashboardBookings.card.noStaff", "Staff not recorded");

    return staff.role_title ? `${name} · ${staff.role_title}` : name;
  }

  function bookingStaffLabel(booking: Booking) {
    const manualStaffRecord = manualStaff.find(
      (staff) => staff.id === booking.staff_member_id,
    );

    if (manualStaffRecord) return manualStaffLabel(manualStaffRecord);

    return (
      booking.staff_members?.name ||
      t("dashboardBookings.card.noStaff", "Staff not recorded")
    );
  }

  const selectedDateObject = useMemo(
    () => new Date(`${selectedDate}T12:00:00`),
    [selectedDate],
  );
  const weekStartDate = useMemo(
    () => startOfWeek(selectedDateObject),
    [selectedDateObject],
  );
  const weekEndDate = useMemo(
    () => endOfDay(addDays(weekStartDate, 6)),
    [weekStartDate],
  );
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate],
  );
  const weekBookings = useMemo(() => {
    const weekDateKeys = new Set(weekDays.map((day) => dateKeyForDate(day)));

    return bookings
      .filter((booking) => {
        return weekDateKeys.has(
          dateKeyInTimeZone(new Date(booking.start_at), calendarTimeZone),
        );
      })
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
  }, [bookings, weekDays, calendarTimeZone]);
  const weekGroups = useMemo(() => {
    return weekDays.map((day) => {
      const dateKey = dateKeyForDate(day);

      return {
        date: day,
        dateKey,
        label: labelForDateKey(dateKey),
        shortLabel: day.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
        }),
        bookings: weekBookings.filter(
          (booking) =>
            dateKeyInTimeZone(new Date(booking.start_at), calendarTimeZone) ===
            dateKey,
        ),
      };
    });
  }, [weekDays, weekBookings, calendarTimeZone]);
  const selectedCalendarBooking = useMemo(
    () =>
      weekBookings.find(
        (booking) => booking.id === selectedCalendarBookingId,
      ) || null,
    [weekBookings, selectedCalendarBookingId],
  );
  const weekPendingCount = weekBookings.filter(
    (booking) => booking.status === "pending",
  ).length;
  const weekLabel = `${weekStartDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })} - ${weekEndDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })}`;

  useEffect(() => {
    if (
      selectedCalendarBookingId &&
      !bookings.some((booking) => booking.id === selectedCalendarBookingId)
    ) {
      setSelectedCalendarBookingId(null);
    }
  }, [bookings, selectedCalendarBookingId]);

  function customerHistoryLink(booking: Booking) {
    if (booking.customer_user_id) {
      return `/dashboard/customers/${booking.customer_user_id}?businessId=${business?.id || booking.business_id}`;
    }

    return `/dashboard/customers/by-email?email=${encodeURIComponent(booking.customer_email || "")}&businessId=${business?.id || booking.business_id}`;
  }

  function changeCalendarDate(value: string) {
    setSelectedDate(value);
    setSelectedCalendarBookingId(null);
    if (manualBookingOpen) {
      setManualBooking((current) => ({ ...current, date: value }));
    }
    replaceBookingsQuery({ nextDate: value });
  }

  function goToToday() {
    changeCalendarDate(toDateInputValue(new Date()));
  }

  function moveWeek(direction: -1 | 1) {
    changeCalendarDate(toDateInputValue(addDays(weekStartDate, direction * 7)));
  }

  function updateManualBookingField(
    field: keyof ManualBookingDraft,
    value: string,
  ) {
    setManualBooking((current) => {
      if (field === "serviceId") {
        return {
          ...current,
          serviceId: value,
          staffMemberId: staffOptionsForService(value)[0]?.id || "",
        };
      }

      return { ...current, [field]: value };
    });
    setManualBookingError(null);
  }

  function openManualBookingAt(next?: { date?: string; time?: string }) {
    if (next?.date) {
      setSelectedDate(next.date);
      replaceBookingsQuery({ nextDate: next.date });
    }

    setManualBooking((current) => ({
      ...current,
      serviceId: current.serviceId || manualServices[0]?.id || "",
      staffMemberId:
        current.staffMemberId ||
        staffOptionsForService(
          current.serviceId || manualServices[0]?.id || "",
        )[0]?.id ||
        "",
      date: next?.date || selectedDate || toDateInputValue(new Date()),
      time: next?.time || current.time || "09:00",
    }));
    setManualBookingError(null);
    setSelectedCalendarBookingId(null);
    setManualBookingOpen(true);
  }

  function openManualBooking() {
    openManualBookingAt();
  }

  function closeManualBooking() {
    if (manualBookingSaving) return;
    setManualBookingOpen(false);
    setManualBookingError(null);
  }

  function bookingOverlaps(
    booking: Pick<
      Booking,
      "staff_member_id" | "start_at" | "end_at" | "duration_minutes"
    >,
    nextStaffId: string,
    nextStart: Date,
    nextEnd: Date,
  ) {
    if (booking.staff_member_id !== nextStaffId) return false;

    const bookingStart = new Date(booking.start_at);
    const bookingEnd = booking.end_at
      ? new Date(booking.end_at)
      : addMinutes(bookingStart, booking.duration_minutes);

    return nextStart < bookingEnd && nextEnd > bookingStart;
  }

  function validateManualBookingDraft() {
    const customerName = manualBooking.customerName.trim();
    const customerEmail = manualBooking.customerEmail.trim().toLowerCase();

    if (!customerName) {
      return t(
        "dashboardBookings.manual.error.customerName",
        "Add the customer's name.",
      );
    }

    if (!customerEmail || !customerEmail.includes("@")) {
      return t(
        "dashboardBookings.manual.error.customerEmail",
        "Add a valid customer email.",
      );
    }

    if (!selectedManualService) {
      return t("dashboardBookings.manual.error.service", "Choose a service.");
    }

    if (!manualBooking.staffMemberId) {
      return t("dashboardBookings.manual.error.staff", "Choose staff.");
    }

    if (!manualBooking.date || !manualBooking.time) {
      return t(
        "dashboardBookings.manual.error.time",
        "Choose a date and time.",
      );
    }

    const start = zonedDateTimeToUtc(
      manualBooking.date,
      manualBooking.time,
      calendarTimeZone,
    );
    if (Number.isNaN(start.getTime())) {
      return t(
        "dashboardBookings.manual.error.time",
        "Choose a date and time.",
      );
    }

    if (start <= new Date()) {
      return t(
        "dashboardBookings.manual.error.future",
        "Choose a future appointment time.",
      );
    }

    return null;
  }

  function manualBookingSaveError(code?: string) {
    if (code === "auth_required" || code === "invalid_session") {
      return t(
        "dashboardBookings.manual.error.auth",
        "Sign in again before adding appointments.",
      );
    }

    if (code === "server_not_configured") {
      return t(
        "dashboardBookings.manual.error.config",
        "Manual appointment saving is not configured yet.",
      );
    }

    if (code === "forbidden") {
      return t(
        "dashboardBookings.manual.error.forbidden",
        "You can only add appointments for a business you own.",
      );
    }

    if (code === "service_unavailable") {
      return t(
        "dashboardBookings.manual.error.serviceUnavailable",
        "This service is no longer active.",
      );
    }

    if (code === "staff_unavailable") {
      return t(
        "dashboardBookings.manual.error.staffUnavailable",
        "This staff member is no longer active.",
      );
    }

    if (code === "staff_service_unavailable") {
      return t(
        "dashboardBookings.manual.error.staffServiceUnavailable",
        "This staff member is not assigned to the selected service.",
      );
    }

    if (code === "conflict") {
      return t(
        "dashboardBookings.manual.error.conflict",
        "That time clashes with another appointment or pending request.",
      );
    }

    if (code === "invalid_time") {
      return t(
        "dashboardBookings.manual.error.invalidTime",
        "Choose a valid appointment date and time.",
      );
    }

    if (code === "past_time") {
      return t(
        "dashboardBookings.manual.error.future",
        "Choose a future appointment time.",
      );
    }

    return t(
      "dashboardBookings.manual.error.create",
      "Could not add this appointment. Try again.",
    );
  }

  async function createManualBooking() {
    if (!business || manualBookingSaving) return;

    const validationError = validateManualBookingDraft();
    if (validationError || !selectedManualService) {
      setManualBookingError(validationError);
      return;
    }

    setManualBookingSaving(true);
    setManualBookingError(null);
    setError(null);
    setSuccess(null);

    const start = zonedDateTimeToUtc(
      manualBooking.date,
      manualBooking.time,
      calendarTimeZone,
    );
    const customerName = manualBooking.customerName.trim();
    const customerEmail = manualBooking.customerEmail.trim().toLowerCase();

    try {
      const [
        { data: freshService, error: freshServiceError },
        { data: freshStaff, error: freshStaffError },
        { data: freshStaffService, error: freshStaffServiceError },
        { data: freshBookings, error: freshBookingsError },
      ] = await Promise.all([
        supabase
          .from("services")
          .select("id, duration_minutes, active")
          .eq("id", selectedManualService.id)
          .eq("business_id", business.id)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("staff_members")
          .select("id, active")
          .eq("id", manualBooking.staffMemberId)
          .eq("business_id", business.id)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("staff_services")
          .select("staff_member_id")
          .eq("staff_member_id", manualBooking.staffMemberId)
          .eq("service_id", selectedManualService.id)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select(
            "id, staff_member_id, start_at, end_at, duration_minutes, status",
          )
          .eq("business_id", business.id)
          .eq("staff_member_id", manualBooking.staffMemberId)
          .in("status", ["pending", "confirmed"])
          .gte("start_at", addDays(startOfDay(start), -1).toISOString())
          .lte("start_at", addDays(endOfDay(start), 1).toISOString()),
      ]);

      if (freshServiceError) throw freshServiceError;
      if (freshStaffError) throw freshStaffError;
      if (freshStaffServiceError) throw freshStaffServiceError;
      if (freshBookingsError) throw freshBookingsError;

      if (!freshService) {
        setManualBookingError(
          t(
            "dashboardBookings.manual.error.serviceUnavailable",
            "This service is no longer active.",
          ),
        );
        return;
      }

      if (!freshStaff) {
        setManualBookingError(
          t(
            "dashboardBookings.manual.error.staffUnavailable",
            "This staff member is no longer active.",
          ),
        );
        return;
      }

      if (!freshStaffService) {
        setManualBookingError(
          t(
            "dashboardBookings.manual.error.staffServiceUnavailable",
            "This staff member is not assigned to the selected service.",
          ),
        );
        return;
      }

      const durationMinutes =
        freshService.duration_minutes || selectedManualService.duration_minutes;
      const appointmentEnd = addMinutes(start, durationMinutes);
      const hasConflict = ((freshBookings || []) as Booking[]).some((booking) =>
        bookingOverlaps(
          booking,
          manualBooking.staffMemberId,
          start,
          appointmentEnd,
        ),
      );

      if (hasConflict) {
        setManualBookingError(
          t(
            "dashboardBookings.manual.error.conflict",
            "That time clashes with another appointment or pending request.",
          ),
        );
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setManualBookingError(manualBookingSaveError("auth_required"));
        return;
      }

      const response = await fetch("/api/dashboard/manual-booking", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: business.id,
          serviceId: selectedManualService.id,
          staffMemberId: manualBooking.staffMemberId,
          customerName,
          customerEmail,
          customerPhone: manualBooking.customerPhone,
          customerNotes: manualBooking.customerNotes,
          date: manualBooking.date,
          time: manualBooking.time,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setManualBookingError(manualBookingSaveError(result?.code));
        return;
      }

      if (result?.bookingId) {
        void requestTransactionalEmail({
          event: "booking_status_changed",
          bookingId: result.bookingId,
        });
      }

      setManualBooking({
        ...emptyManualBookingDraft,
        date: manualBooking.date,
        time: manualBooking.time,
      });
      setManualBookingOpen(false);
      setSelectedDate(manualBooking.date);
      replaceBookingsQuery({
        nextDate: manualBooking.date,
      });
      setSuccess(
        t(
          "dashboardBookings.manual.success",
          "Booking added to the calendar. Confirmation email delivery will be requested where email is enabled.",
        ),
      );
      await loadBookings({ keepSuccess: true, silent: true });
    } catch (err: any) {
      setManualBookingError(
        err.message ||
          t(
            "dashboardBookings.manual.error.create",
            "Could not add this booking. Try again.",
          ),
      );
    } finally {
      setManualBookingSaving(false);
    }
  }

  function scheduleWindowFor(dayBookings: Booking[]) {
    if (dayBookings.length === 0) {
      return {
        startHour: DEFAULT_CALENDAR_START_HOUR,
        endHour: DEFAULT_CALENDAR_END_HOUR,
      };
    }

    const startMinutes = dayBookings.map(
      (booking) => bookingTime(booking).startMinutes,
    );
    const endMinutes = dayBookings.map(
      (booking) => bookingTime(booking).endMinutes,
    );

    const earliest = Math.min(...startMinutes);
    const latest = Math.max(...endMinutes);
    const startHour = Math.max(
      0,
      Math.min(DEFAULT_CALENDAR_START_HOUR, Math.floor(earliest / 60)),
    );
    const endHour = Math.min(
      24,
      Math.max(DEFAULT_CALENDAR_END_HOUR, Math.ceil(latest / 60)),
    );

    return {
      startHour,
      endHour: Math.max(endHour, startHour + 1),
    };
  }

  function renderAppointment(booking: Booking) {
    const time = bookingTime(booking);
    const isWorking = actionLoadingId === booking.id;
    const isLocked =
      booking.status === "cancelled" ||
      booking.status === "declined" ||
      booking.status === "completed";

    return (
      <article
        key={booking.id}
        className={`calendar-appointment ${booking.status}`}
      >
        <div className="calendar-time">
          <strong>{time.label}</strong>
          <span>
            {booking.duration_minutes} {t("common.minutes", "minutes")}
          </span>
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
            {bookingStaffLabel(booking)}
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

  function renderCalendarBlock(booking: Booking, startHour: number) {
    const time = bookingTime(booking);
    const startMinutes = time.startMinutes;
    const endMinutes = time.endMinutes;
    const durationMinutes = Math.max(
      15,
      endMinutes - startMinutes || booking.duration_minutes,
    );
    const blockTop =
      ((startMinutes - startHour * 60) / 60) * CALENDAR_HOUR_HEIGHT;
    const blockHeight = Math.max(
      CALENDAR_MIN_BLOCK_HEIGHT,
      (durationMinutes / 60) * CALENDAR_HOUR_HEIGHT,
    );

    const isSelected = selectedCalendarBookingId === booking.id;

    return (
      <button
        key={booking.id}
        type="button"
        onClick={() => {
          setManualBookingOpen(false);
          setSelectedCalendarBookingId(booking.id);
        }}
        className={`calendar-schedule-block ${booking.status} ${
          isSelected ? "selected" : ""
        }`}
        style={{
          top: `${Math.max(0, blockTop)}px`,
          height: `${blockHeight}px`,
        }}
        aria-label={`${time.label} ${
          booking.customer_name ||
          t("dashboardBookings.card.customerFallback", "Customer")
        }`}
      >
        <span className="schedule-block-time">{time.label}</span>
        <strong>
          {booking.customer_name ||
            t("dashboardBookings.card.customerFallback", "Customer")}
        </strong>
        <span className="schedule-block-meta">
          {booking.services?.name ||
            t("dashboardBookings.card.noService", "No service recorded")}
          {" · "}
          {bookingStaffLabel(booking)}
        </span>
        <span className={`calendar-status status-${booking.status}`}>
          {statusLabel(booking.status)}
        </span>
      </button>
    );
  }

  function slotIsOccupied(
    dayBookings: Booking[],
    slotStartMinutes: number,
    slotEndMinutes: number,
  ) {
    return dayBookings.some((booking) => {
      if (booking.status !== "pending" && booking.status !== "confirmed") {
        return false;
      }

      const time = bookingTime(booking);
      return (
        slotStartMinutes < time.endMinutes && slotEndMinutes > time.startMinutes
      );
    });
  }

  function renderWeekCalendar() {
    const { startHour, endHour } = scheduleWindowFor(weekBookings);
    const hours = Array.from(
      { length: endHour - startHour + 1 },
      (_, index) => startHour + index,
    );
    const scheduleHeight = (endHour - startHour) * CALENDAR_HOUR_HEIGHT;

    return (
      <section className="week-calendar">
        <div className="week-calendar-summary">
          <div>
            <strong>{weekLabel}</strong>
            <span>
              {weekBookings.length}{" "}
              {weekBookings.length === 1
                ? t("dashboardBookings.appointmentCount", "appointment")
                : t("dashboardBookings.appointments", "appointments")}
            </span>
          </div>
          {weekPendingCount > 0 && (
            <span className="calendar-pending">
              {weekPendingCount}{" "}
              {t("dashboardBookings.needsApproval", "need approval")}
            </span>
          )}
        </div>

        <div
          className="mobile-week-agenda"
          aria-label={t("dashboardBookings.mobileAgenda.label", "Week agenda")}
        >
          {weekGroups.map((group) => (
            <section
              key={group.dateKey}
              className={
                group.dateKey === selectedDate
                  ? "mobile-agenda-day active"
                  : "mobile-agenda-day"
              }
            >
              <button
                type="button"
                className="mobile-agenda-day-heading"
                onClick={() => changeCalendarDate(group.dateKey)}
              >
                <span>{group.shortLabel}</span>
                <strong>
                  {group.bookings.length}{" "}
                  {group.bookings.length === 1
                    ? t("dashboardBookings.appointmentCount", "appointment")
                    : t("dashboardBookings.appointments", "appointments")}
                </strong>
              </button>

              {group.bookings.length > 0 ? (
                <div className="mobile-agenda-list">
                  {group.bookings.map((booking) => {
                    const time = bookingTime(booking);

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        className={`mobile-agenda-booking ${booking.status}`}
                        onClick={() => {
                          setManualBookingOpen(false);
                          changeCalendarDate(group.dateKey);
                          setSelectedCalendarBookingId(booking.id);
                        }}
                      >
                        <span>{time.label}</span>
                        <strong>
                          {booking.customer_name ||
                            t(
                              "dashboardBookings.card.customerFallback",
                              "Customer",
                            )}
                        </strong>
                        <small>
                          {booking.services?.name ||
                            t(
                              "dashboardBookings.card.noService",
                              "No service recorded",
                            )}
                          {" · "}
                          {bookingStaffLabel(booking)}
                        </small>
                        <em>{statusLabel(booking.status)}</em>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="small muted mobile-agenda-empty">
                  {t(
                    "dashboardBookings.calendar.emptySlotTitle",
                    "No appointments on this day",
                  )}
                </p>
              )}
            </section>
          ))}
        </div>

        <div className="week-calendar-scroll">
          <div className="week-calendar-grid">
            <div className="week-calendar-corner" />
            {weekGroups.map((group) => (
              <button
                key={group.dateKey}
                type="button"
                className={
                  group.dateKey === selectedDate
                    ? "week-day-header active"
                    : "week-day-header"
                }
                onClick={() => changeCalendarDate(group.dateKey)}
              >
                <span>{group.shortLabel}</span>
                {group.bookings.length > 0 && (
                  <small>
                    {group.bookings.length}{" "}
                    {group.bookings.length === 1
                      ? t("dashboardBookings.appointmentCount", "appointment")
                      : t("dashboardBookings.appointments", "appointments")}
                  </small>
                )}
              </button>
            ))}

            <div
              className="week-time-rail"
              style={{ height: `${scheduleHeight}px` }}
              aria-hidden="true"
            >
              {hours.map((hour) => (
                <span
                  key={hour}
                  style={{
                    top: `${(hour - startHour) * CALENDAR_HOUR_HEIGHT}px`,
                  }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {weekGroups.map((group) => (
              <div
                key={group.dateKey}
                className="week-day-lane"
                style={{ height: `${scheduleHeight}px` }}
              >
                {hours.slice(0, -1).map((hour) => {
                  const slotStartMinutes = hour * 60;
                  const slotEndMinutes = slotStartMinutes + 60;
                  const isOccupied = slotIsOccupied(
                    group.bookings,
                    slotStartMinutes,
                    slotEndMinutes,
                  );
                  const slotStyle = {
                    top: `${(hour - startHour) * CALENDAR_HOUR_HEIGHT}px`,
                    height: `${CALENDAR_HOUR_HEIGHT}px`,
                  };

                  if (isOccupied) {
                    return (
                      <span
                        key={hour}
                        className="calendar-slot-occupied"
                        style={slotStyle}
                        aria-hidden="true"
                      />
                    );
                  }

                  return (
                    <button
                      key={hour}
                      type="button"
                      tabIndex={-1}
                      className="calendar-slot-hit"
                      style={slotStyle}
                      onClick={() =>
                        openManualBookingAt({
                          date: group.dateKey,
                          time: timeInputForMinutes(hour * 60),
                        })
                      }
                      aria-label={`${t(
                        "dashboardBookings.manual.addAt",
                        "Add appointment",
                      )} ${group.shortLabel} ${String(hour).padStart(
                        2,
                        "0",
                      )}:00`}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  );
                })}

                {hours.slice(0, -1).map((hour) => (
                  <span
                    key={`line-${hour}`}
                    className="calendar-hour-line"
                    style={{
                      top: `${(hour - startHour) * CALENDAR_HOUR_HEIGHT}px`,
                    }}
                  />
                ))}

                {group.bookings.length === 0 ? (
                  <span className="week-day-empty" aria-hidden="true" />
                ) : (
                  group.bookings.map((booking) =>
                    renderCalendarBlock(booking, startHour),
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <DashboardLayout
      title={t("dashboardBookings.pageTitle", "Calendar")}
      subtitle={
        business
          ? business.name
          : t("dashboardBookings.pageSubtitle", "Create a business first.")
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
            {t("dashboardBookings.loading", "Loading calendar...")}
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

      {!pageLoading && business && (
        <div className="calendar-workspace">
          <section className="calendar-shell">
            <div className="calendar-toolbar">
              <div>
                <h2>{weekLabel}</h2>
              </div>

              <div className="calendar-date-controls">
                <div
                  className="calendar-week-stepper"
                  aria-label={t(
                    "dashboardBookings.week.controls",
                    "Week controls",
                  )}
                >
                  <button
                    type="button"
                    className="calendar-step-button"
                    onClick={() => moveWeek(-1)}
                    aria-label={t(
                      "dashboardBookings.week.previous",
                      "Previous",
                    )}
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <button
                    type="button"
                    className="calendar-today-button"
                    onClick={goToToday}
                  >
                    {t("dashboardHome.summary.today", "Today")}
                  </button>
                  <button
                    type="button"
                    className="calendar-step-button"
                    onClick={() => moveWeek(1)}
                    aria-label={t("dashboardBookings.week.next", "Next")}
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => changeCalendarDate(event.target.value)}
                  aria-label={t(
                    "dashboardBookings.filters.jumpDate",
                    "Jump to date",
                  )}
                />
                <button
                  type="button"
                  className="btn btn-accent calendar-add-button"
                  onClick={openManualBooking}
                >
                  {t("dashboardBookings.manual.open", "Add appointment")}
                </button>
              </div>
            </div>
          </section>

          <div
            className={`calendar-body ${
              manualBookingOpen || selectedCalendarBooking
                ? "has-side-panel"
                : ""
            }`.trim()}
          >
            <div className="calendar-main-column">{renderWeekCalendar()}</div>

            {(manualBookingOpen || selectedCalendarBooking) && (
              <aside className="calendar-side-panel">
                {manualBookingOpen && (
                  <section
                    className="manual-booking-panel"
                    aria-label={t(
                      "dashboardBookings.manual.title",
                      "Add appointment",
                    )}
                  >
                    <div className="manual-booking-heading">
                      <div>
                        <strong>
                          {t(
                            "dashboardBookings.manual.title",
                            "Add appointment",
                          )}
                        </strong>
                        <p className="small muted">
                          {t(
                            "dashboardBookings.manual.body",
                            "Choose the customer, service, team member and time.",
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={closeManualBooking}
                        disabled={manualBookingSaving}
                      >
                        {t("common.cancel", "Cancel")}
                      </button>
                    </div>

                    {!manualBookingSetupReady ? (
                      <div className="manual-booking-setup">
                        <p>
                          {t(
                            "dashboardBookings.manual.setupNeeded",
                            "Assign a team member to a service before adding appointments.",
                          )}
                        </p>
                        <div className="manual-booking-actions">
                          <Link
                            href="/dashboard/services"
                            className="btn btn-ghost"
                          >
                            {t(
                              "dashboardBookings.empty.addService",
                              "Add first service",
                            )}
                          </Link>
                          <Link
                            href="/dashboard/staff"
                            className="btn btn-ghost"
                          >
                            {t("dashboardLayout.nav.team", "Team")}
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <form
                        className="manual-booking-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void createManualBooking();
                        }}
                      >
                        <label>
                          <span>
                            {t(
                              "dashboardBookings.manual.customerName",
                              "Customer name",
                            )}
                          </span>
                          <input
                            value={manualBooking.customerName}
                            onChange={(event) =>
                              updateManualBookingField(
                                "customerName",
                                event.target.value,
                              )
                            }
                            autoComplete="name"
                          />
                        </label>

                        <label>
                          <span>
                            {t(
                              "dashboardBookings.manual.customerEmail",
                              "Customer email",
                            )}
                          </span>
                          <input
                            type="email"
                            value={manualBooking.customerEmail}
                            onChange={(event) =>
                              updateManualBookingField(
                                "customerEmail",
                                event.target.value,
                              )
                            }
                            autoComplete="email"
                          />
                        </label>

                        <label>
                          <span>
                            {t(
                              "dashboardBookings.manual.customerPhone",
                              "Phone",
                            )}
                          </span>
                          <input
                            value={manualBooking.customerPhone}
                            onChange={(event) =>
                              updateManualBookingField(
                                "customerPhone",
                                event.target.value,
                              )
                            }
                            autoComplete="tel"
                          />
                        </label>

                        <label>
                          <span>
                            {t("dashboardBookings.manual.service", "Service")}
                          </span>
                          <select
                            value={manualBooking.serviceId}
                            onChange={(event) =>
                              updateManualBookingField(
                                "serviceId",
                                event.target.value,
                              )
                            }
                          >
                            <option value="">
                              {t(
                                "dashboardBookings.manual.chooseService",
                                "Choose service",
                              )}
                            </option>
                            {manualServices.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name} · {service.duration_minutes}{" "}
                                {t("common.minutes", "minutes")}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>{t("support.business.staff", "Staff")}</span>
                          <select
                            value={manualBooking.staffMemberId}
                            onChange={(event) =>
                              updateManualBookingField(
                                "staffMemberId",
                                event.target.value,
                              )
                            }
                            disabled={!manualBooking.serviceId}
                          >
                            <option value="">
                              {t(
                                "dashboardBookings.manual.chooseStaff",
                                "Choose staff",
                              )}
                            </option>
                            {manualStaffOptions.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {manualStaffLabel(staff)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>{t("common.date", "Date")}</span>
                          <input
                            type="date"
                            value={manualBooking.date}
                            onChange={(event) =>
                              updateManualBookingField(
                                "date",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>{t("common.time", "Time")}</span>
                          <input
                            type="time"
                            value={manualBooking.time}
                            onChange={(event) =>
                              updateManualBookingField(
                                "time",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="manual-booking-notes">
                          <span>
                            {t("dashboardBookings.manual.notes", "Notes")}
                          </span>
                          <textarea
                            value={manualBooking.customerNotes}
                            onChange={(event) =>
                              updateManualBookingField(
                                "customerNotes",
                                event.target.value,
                              )
                            }
                            rows={3}
                          />
                        </label>

                        <div className="manual-booking-footer">
                          <p className="small muted">
                            {selectedManualService
                              ? `${selectedManualService.duration_minutes} ${t(
                                  "common.minutes",
                                  "minutes",
                                )}`
                              : t(
                                  "dashboardBookings.manual.durationHint",
                                  "Duration follows the selected service.",
                                )}
                          </p>
                          <button
                            type="submit"
                            className="btn btn-accent"
                            disabled={manualBookingSaving}
                          >
                            {manualBookingSaving
                              ? t(
                                  "dashboardBookings.manual.saving",
                                  "Adding...",
                                )
                              : t(
                                  "dashboardBookings.manual.create",
                                  "Add appointment",
                                )}
                          </button>
                        </div>

                        {manualBooking.serviceId &&
                          manualStaffOptions.length === 0 && (
                            <p className="small manual-booking-warning">
                              {t(
                                "dashboardBookings.manual.noAssignedStaff",
                                "No active staff are assigned to this service.",
                              )}
                            </p>
                          )}

                        {manualBookingError && (
                          <p
                            role="alert"
                            className="small manual-booking-error"
                          >
                            {manualBookingError}
                          </p>
                        )}
                      </form>
                    )}
                  </section>
                )}

                {selectedCalendarBooking && (
                  <section className="calendar-selected-details">
                    <div className="calendar-selected-heading">
                      <div>
                        <p className="small muted">
                          {t(
                            "dashboardBookings.details.kicker",
                            "Selected appointment",
                          )}
                        </p>
                        <h2>
                          {selectedCalendarBooking.customer_name ||
                            t(
                              "dashboardBookings.card.customerFallback",
                              "Customer",
                            )}
                        </h2>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setSelectedCalendarBookingId(null)}
                      >
                        {t("common.close", "Close")}
                      </button>
                    </div>
                    {renderAppointment(selectedCalendarBooking)}
                  </section>
                )}
              </aside>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-workspace {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .calendar-body {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .calendar-body.has-side-panel {
          grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
          align-items: start;
        }

        .calendar-main-column,
        .calendar-side-panel {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .calendar-side-panel {
          position: sticky;
          top: 1rem;
        }

        .calendar-shell,
        .calendar-empty-state {
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          min-width: 0;
        }

        .manual-booking-panel {
          display: grid;
          gap: 0.85rem;
          padding: 0.85rem;
          border: 1px solid rgba(255, 107, 53, 0.24);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .manual-booking-heading {
          display: grid;
          gap: 0.65rem;
        }

        .manual-booking-footer,
        .manual-booking-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .manual-booking-heading p,
        .manual-booking-footer p,
        .manual-booking-setup p {
          margin: 0;
        }

        .manual-booking-form {
          display: grid;
          gap: 0.65rem;
        }

        .manual-booking-form label {
          display: grid;
          gap: 0.3rem;
          min-width: 0;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .manual-booking-form input,
        .manual-booking-form select,
        .manual-booking-form textarea {
          width: 100%;
          min-height: 2.55rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          color-scheme: dark;
          padding: 0.55rem 0.7rem;
        }

        .manual-booking-form textarea {
          resize: vertical;
        }

        .manual-booking-notes,
        .manual-booking-footer,
        .manual-booking-error,
        .manual-booking-warning {
          grid-column: auto;
        }

        .manual-booking-error,
        .manual-booking-warning {
          margin: 0;
        }

        .manual-booking-error {
          color: var(--danger);
        }

        .manual-booking-warning {
          color: var(--warning);
        }

        .manual-booking-setup {
          display: grid;
          gap: 0.75rem;
        }

        .calendar-toolbar,
        .calendar-date-controls {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .calendar-toolbar {
          justify-content: space-between;
        }

        .calendar-date-controls {
          flex: 1 1 auto;
          justify-content: flex-end;
        }

        .calendar-week-stepper {
          display: inline-flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
        }

        .calendar-step-button,
        .calendar-today-button {
          min-height: 2.35rem;
          border: 0;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .calendar-step-button {
          width: 2.35rem;
          padding: 0;
          font-size: 1.35rem;
          line-height: 1;
        }

        .calendar-today-button {
          padding: 0 0.75rem;
          border-right: 1px solid var(--border);
          border-left: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .calendar-step-button:hover,
        .calendar-today-button:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--accent);
        }

        .calendar-toolbar h2,
        .calendar-toolbar p,
        .calendar-empty-state h2,
        .calendar-empty-state p {
          margin-top: 0;
        }

        .calendar-date-controls input {
          min-height: 2.35rem;
          max-width: 9.5rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          color-scheme: dark;
        }

        .calendar-date-controls input {
          padding: 0.55rem 0.7rem;
        }

        .calendar-add-button {
          min-height: 2.35rem;
          padding: 0.55rem 0.95rem;
          white-space: nowrap;
        }

        .calendar-pending {
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 800;
        }

        .calendar-selected-details {
          display: grid;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid rgba(255, 107, 53, 0.22);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.05);
        }

        .calendar-side-panel :global(.calendar-appointment) {
          grid-template-columns: 1fr;
          padding: 0;
          border-bottom: 0;
        }

        .calendar-side-panel :global(.calendar-actions) {
          justify-content: flex-start;
        }

        .calendar-selected-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .calendar-selected-heading h2,
        .calendar-selected-heading p {
          margin: 0;
        }

        :global(.week-calendar) {
          display: grid;
          gap: 0.75rem;
          min-width: 0;
          max-width: 100%;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          overflow: hidden;
        }

        :global(.week-calendar-scroll) {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: rgba(11, 18, 32, 0.28);
          scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
        }

        :global(.mobile-week-agenda) {
          display: none;
        }

        :global(.week-calendar-summary) {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        :global(.week-calendar-summary div) {
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
          flex-wrap: wrap;
        }

        :global(.week-calendar-summary span) {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        :global(.week-calendar-grid) {
          display: grid;
          grid-template-columns: 4.25rem repeat(7, minmax(5.75rem, 1fr));
          min-width: 760px;
          overflow: hidden;
          background: rgba(11, 18, 32, 0.18);
        }

        .calendar-body.has-side-panel :global(.week-calendar-grid) {
          grid-template-columns: 3.75rem repeat(7, minmax(4.15rem, 1fr));
          min-width: 0;
        }

        :global(.week-calendar-corner) {
          min-height: 3.6rem;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.02);
        }

        :global(.week-day-header) {
          min-height: 3.6rem;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          display: grid;
          gap: 0.12rem;
          align-content: center;
          justify-items: center;
          min-width: 0;
          padding: 0.4rem 0.25rem;
          border: 0;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          border-radius: 0;
          background: rgba(255, 255, 255, 0.02);
          color: var(--text);
          font: inherit;
          text-align: center;
          cursor: pointer;
        }

        :global(.week-day-header.active) {
          background: rgba(255, 107, 53, 0.08);
          color: var(--accent);
        }

        :global(.week-day-header span),
        :global(.week-day-header small) {
          overflow: hidden;
          max-width: 100%;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.week-day-header span) {
          font-weight: 900;
        }

        :global(.week-day-header small) {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 800;
        }

        :global(.week-time-rail),
        :global(.week-day-lane) {
          position: relative;
          min-width: 0;
        }

        :global(.week-time-rail) {
          border-right: 1px solid var(--border);
          background: rgba(15, 23, 42, 0.42);
        }

        :global(.week-time-rail span) {
          position: absolute;
          right: 0.45rem;
          transform: translateY(-0.55rem);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          white-space: nowrap;
        }

        :global(.week-day-lane) {
          border-right: 1px solid rgba(148, 163, 184, 0.12);
          overflow: hidden;
          background: rgba(15, 23, 42, 0.16);
        }

        :global(.week-day-lane:last-child),
        :global(.week-day-header:last-of-type) {
          border-right: 0;
        }

        :global(.week-day-empty) {
          position: absolute;
          inset: 0.35rem;
          border: 1px dashed rgba(148, 163, 184, 0.1);
          border-radius: calc(var(--radius) - 4px);
          pointer-events: none;
        }

        :global(.calendar-slot-hit) {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 0.28rem;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: transparent;
          cursor: copy;
        }

        :global(.calendar-slot-occupied) {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 1;
          pointer-events: none;
        }

        :global(.calendar-slot-hit span) {
          width: 1.55rem;
          height: 1.55rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 107, 53, 0.32);
          border-radius: 999px;
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
          font-weight: 900;
          opacity: 0;
          transform: translateY(-0.2rem);
          transition:
            opacity 0.15s ease,
            transform 0.15s ease;
        }

        :global(.calendar-slot-hit:hover),
        :global(.calendar-slot-hit:focus-visible) {
          background: rgba(255, 107, 53, 0.05);
        }

        :global(.calendar-slot-hit:hover span),
        :global(.calendar-slot-hit:focus-visible span) {
          opacity: 1;
          transform: translateY(0);
        }

        :global(.calendar-hour-line) {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border);
          pointer-events: none;
        }

        :global(.calendar-schedule-block) {
          position: absolute;
          left: 0.35rem;
          right: 0.35rem;
          display: grid;
          align-content: start;
          gap: 0.14rem;
          overflow: hidden;
          padding: 0.48rem 0.5rem;
          border: 1px solid rgba(45, 212, 191, 0.28);
          border-left: 4px solid var(--success);
          border-radius: calc(var(--radius) - 2px);
          background:
            linear-gradient(
              135deg,
              rgba(45, 212, 191, 0.14),
              rgba(45, 212, 191, 0.06)
            ),
            rgba(15, 23, 42, 0.92);
          color: var(--text);
          font: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.18);
          z-index: 3;
        }

        :global(.calendar-schedule-block.selected) {
          outline: 2px solid rgba(255, 107, 53, 0.72);
          outline-offset: 1px;
        }

        :global(.calendar-schedule-block.pending) {
          border-color: rgba(255, 107, 53, 0.34);
          border-left-color: var(--accent);
          background:
            linear-gradient(
              135deg,
              rgba(255, 107, 53, 0.16),
              rgba(255, 107, 53, 0.06)
            ),
            rgba(15, 23, 42, 0.94);
        }

        :global(.calendar-schedule-block.cancelled),
        :global(.calendar-schedule-block.declined) {
          border-left-color: var(--warning);
          opacity: 0.76;
        }

        :global(.calendar-schedule-block.completed) {
          opacity: 0.82;
        }

        :global(.schedule-block-time),
        :global(.schedule-block-meta) {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.76rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.calendar-schedule-block strong) {
          overflow: hidden;
          font-size: 0.84rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.calendar-schedule-block .calendar-status) {
          width: fit-content;
          margin-top: 0.18rem;
        }

        :global(.calendar-appointment) {
          display: grid;
          grid-template-columns: 9rem minmax(0, 1fr) auto;
          gap: 0.9rem;
          align-items: center;
          padding: 0.85rem 0;
          border-bottom: 1px solid var(--border);
        }

        :global(.calendar-appointment.pending) {
          border-left: 3px solid var(--accent);
          padding-left: 0.75rem;
        }

        :global(.calendar-time),
        :global(.calendar-appointment-main) {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
        }

        :global(.calendar-time span) {
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        :global(.calendar-appointment-heading),
        :global(.calendar-actions) {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          flex-wrap: wrap;
        }

        :global(.calendar-appointment-heading a) {
          color: var(--text);
          font-weight: 900;
          text-decoration: none;
        }

        :global(.calendar-status) {
          border-radius: 999px;
          padding: 0.18rem 0.5rem;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
        }

        :global(.status-pending) {
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
        }

        :global(.status-confirmed),
        :global(.status-completed) {
          background: rgba(45, 212, 191, 0.12);
          color: var(--success);
        }

        :global(.calendar-note) {
          margin-top: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.calendar-actions) {
          justify-content: flex-end;
        }

        :global(.calendar-action-error) {
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

        .calendar-empty-action strong,
        .calendar-empty-action span {
          display: block;
          min-width: 0;
        }

        .calendar-empty-action span {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.82rem;
          text-overflow: ellipsis;
          white-space: normal;
        }

        :global(.calendar-empty-action-grid) {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
        }

        :global(.calendar-empty-action) {
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

        :global(.calendar-empty-action strong),
        :global(.calendar-empty-action span) {
          display: block;
          min-width: 0;
        }

        :global(.calendar-empty-action span) {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.82rem;
          text-overflow: ellipsis;
          white-space: normal;
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

        @media (max-width: 980px) {
          .calendar-body.has-side-panel {
            grid-template-columns: 1fr;
          }

          .calendar-side-panel {
            position: static;
            order: -1;
          }
        }

        @media (max-width: 700px) {
          .calendar-date-controls {
            justify-content: stretch;
          }

          .calendar-shell,
          .calendar-empty-state {
            padding: 0.85rem;
          }

          .manual-booking-footer,
          .manual-booking-actions {
            display: grid;
            align-items: stretch;
            justify-content: stretch;
          }

          .manual-booking-form {
            grid-template-columns: 1fr;
          }

          .manual-booking-notes,
          .manual-booking-footer,
          .manual-booking-error,
          .manual-booking-warning {
            grid-column: auto;
          }

          .manual-booking-heading :global(.btn),
          .manual-booking-actions :global(.btn),
          .manual-booking-footer :global(.btn),
          .manual-booking-heading button,
          .manual-booking-actions a,
          .manual-booking-footer button {
            width: 100%;
            justify-content: center;
          }

          .calendar-toolbar,
          .calendar-empty-action-grid,
          .calendar-empty-actions,
          .calendar-empty-actions :global(.btn),
          .calendar-empty-actions a {
            display: grid;
            width: 100%;
          }

          .calendar-date-controls {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            width: 100%;
          }

          .calendar-week-stepper {
            grid-column: 1 / -1;
            width: 100%;
          }

          .calendar-week-stepper button {
            flex: 1 1 0;
          }

          .calendar-date-controls input {
            width: 100%;
            max-width: none;
            min-width: 0;
          }

          .calendar-add-button {
            width: auto;
            justify-content: center;
          }

          :global(.week-calendar) {
            padding: 0.65rem;
          }

          :global(.week-calendar-scroll) {
            display: none;
          }

          :global(.mobile-week-agenda) {
            display: grid;
            gap: 0.65rem;
          }

          :global(.mobile-agenda-day) {
            display: grid;
            gap: 0.5rem;
            padding: 0.65rem;
            border: 1px solid var(--border);
            border-radius: calc(var(--radius) - 2px);
            background: rgba(15, 23, 42, 0.3);
          }

          :global(.mobile-agenda-day.active) {
            border-color: rgba(255, 107, 53, 0.32);
            background: rgba(255, 107, 53, 0.06);
          }

          :global(.mobile-agenda-day-heading) {
            width: 100%;
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: center;
            border: 0;
            background: transparent;
            color: var(--text);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          :global(.mobile-agenda-day-heading span) {
            font-weight: 900;
          }

          :global(.mobile-agenda-day-heading strong) {
            color: var(--text-muted);
            font-size: 0.78rem;
            white-space: nowrap;
          }

          :global(.mobile-agenda-list) {
            display: grid;
            gap: 0.45rem;
          }

          :global(.mobile-agenda-booking) {
            display: grid;
            gap: 0.12rem;
            padding: 0.65rem;
            border: 1px solid rgba(45, 212, 191, 0.24);
            border-left: 4px solid var(--success);
            border-radius: calc(var(--radius) - 4px);
            background: rgba(15, 23, 42, 0.72);
            color: var(--text);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          :global(.mobile-agenda-booking.pending) {
            border-color: rgba(255, 107, 53, 0.28);
            border-left-color: var(--accent);
          }

          :global(.mobile-agenda-booking.cancelled),
          :global(.mobile-agenda-booking.declined) {
            border-left-color: var(--warning);
            opacity: 0.82;
          }

          :global(.mobile-agenda-booking span),
          :global(.mobile-agenda-booking small) {
            color: var(--text-muted);
            font-size: 0.76rem;
          }

          :global(.mobile-agenda-booking strong) {
            font-size: 0.9rem;
          }

          :global(.mobile-agenda-booking em) {
            width: fit-content;
            margin-top: 0.18rem;
            padding: 0.16rem 0.5rem;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-muted);
            font-size: 0.72rem;
            font-style: normal;
            font-weight: 800;
          }

          :global(.mobile-agenda-empty) {
            margin: 0;
          }

          .calendar-selected-heading {
            display: grid;
            align-items: stretch;
          }

          :global(.week-calendar-summary) {
            display: grid;
            align-items: stretch;
          }

          :global(.week-calendar-grid) {
            grid-template-columns: 3.55rem repeat(7, minmax(4.8rem, 1fr));
            min-width: 660px;
          }

          .calendar-body.has-side-panel :global(.week-calendar-grid) {
            grid-template-columns: 3.55rem repeat(7, minmax(4.8rem, 1fr));
            min-width: 660px;
          }

          :global(.week-calendar-corner),
          :global(.week-day-header) {
            min-height: 3.1rem;
          }

          :global(.week-day-header) {
            padding: 0.3rem 0.15rem;
          }

          :global(.week-day-header small) {
            font-size: 0.62rem;
          }

          :global(.week-time-rail span) {
            right: 0.3rem;
            font-size: 0.66rem;
          }

          :global(.calendar-schedule-block) {
            left: 0.18rem;
            right: 0.18rem;
            padding: 0.42rem 0.42rem;
          }

          :global(.calendar-time-rail span),
          :global(.schedule-block-time),
          :global(.schedule-block-meta) {
            font-size: 0.66rem;
          }

          :global(.calendar-schedule-block strong) {
            font-size: 0.72rem;
          }

          :global(.calendar-appointment) {
            grid-template-columns: 1fr;
            align-items: stretch;
            padding: 0.85rem 0;
          }

          :global(.calendar-actions),
          :global(.calendar-actions .btn),
          :global(.calendar-actions button),
          :global(.calendar-actions a) {
            width: 100%;
            justify-content: center;
          }

          .booking-success-row {
            display: grid;
          }

          .calendar-empty-action-grid {
            grid-template-columns: 1fr;
          }

          :global(.calendar-empty-action-grid) {
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
