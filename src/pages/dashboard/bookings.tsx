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
import { formatLocalizedDate, type Locale } from "@/lib/i18n";
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
import MobileDayCalendar from "@/components/calendar/MobileDayCalendar";

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
  booking_type?: "appointment" | "group" | null;
  group_capacity?: number | null;
  private_booking_enabled?: boolean | null;
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

type ManualDeparture = {
  id: string;
  business_id: string;
  service_id: string;
  start_at: string;
  duration_minutes: number;
  capacity: number;
  meeting_point?: string | null;
  status: string;
  bookedSeats: number;
  remainingSeats: number;
  service?: ManualBookingService | null;
  staffMember?: {
    id: string;
    name: string;
    role_title?: string | null;
  } | null;
};

type ManualDeparturePayload = {
  departures?: ManualDeparture[];
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
  departureId: string;
  partySize: string;
  bookingOption: "shared" | "private";
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
  departureId: "",
  partySize: "1",
  bookingOption: "shared",
};

function manualBookingDraftFromForm(form: HTMLFormElement) {
  const values = new FormData(form);
  const field = (name: keyof ManualBookingDraft) =>
    String(values.get(name) || "");

  return {
    customerName: field("customerName"),
    customerEmail: field("customerEmail"),
    customerPhone: field("customerPhone"),
    customerNotes: field("customerNotes"),
    serviceId: field("serviceId"),
    staffMemberId: field("staffMemberId"),
    date: field("date"),
    time: field("time"),
    departureId: field("departureId"),
    partySize: field("partySize"),
    bookingOption: field("bookingOption") === "private" ? "private" : "shared",
  } satisfies ManualBookingDraft;
}

function dateKeyForDate(date: Date) {
  return toDateInputValue(date);
}

function labelForDateKey(dateKey: string, locale: Locale) {
  return formatLocalizedDate(new Date(`${dateKey}T12:00:00`), locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeInputForMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

export default function Bookings() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const bookingStatusLabel = useBookingStatusLabel();
  const { businessId, date, bookingId } = router.query;

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
  const [manualDepartures, setManualDepartures] = useState<ManualDeparture[]>(
    [],
  );
  const [hasGroupServices, setHasGroupServices] = useState(false);

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
  const [cancelReviewBookingId, setCancelReviewBookingId] = useState<
    string | null
  >(null);
  const [calendarStaffFilter, setCalendarStaffFilter] = useState("all");
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
        setManualDepartures([]);
        setHasGroupServices(false);
        setPageLoading(false);
        return;
      }

      setBusiness(selectedBusiness);

      const [
        { data, error },
        { data: serviceData, error: serviceError },
        { data: staffData, error: staffError },
        departurePayload,
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            `
            id,
            business_id,
            staff_member_id,
            departure_id,
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
          .select(
            "id, business_id, name, duration_minutes, active, booking_type, group_capacity, private_booking_enabled",
          )
          .eq("business_id", selectedBusiness.id)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("staff_members")
          .select("id, business_id, name, role_title, email, user_id, active")
          .eq("business_id", selectedBusiness.id)
          .eq("active", true)
          .order("name", { ascending: true }),
        fetch(
          `/api/dashboard/departures?businessId=${encodeURIComponent(
            selectedBusiness.id,
          )}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        )
          .then(async (response) =>
            response.ok
              ? ((await response.json()) as ManualDeparturePayload)
              : null,
          )
          .catch(() => null),
      ]);

      if (error) throw error;
      if (serviceError) throw serviceError;
      if (staffError) throw staffError;

      setManualServices(serviceData || []);
      setHasGroupServices(
        (serviceData || []).some((service) => service.booking_type === "group"),
      );
      setManualStaff(staffData || []);
      setManualDepartures(departurePayload?.departures || []);

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

      const normalisedBookings = (data || [])
        .filter((booking: any) => !booking.departure_id)
        .map((booking: any) => ({
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

  useEffect(() => {
    if (typeof bookingId !== "string") return;

    if (bookings.some((booking) => booking.id === bookingId)) {
      setManualBookingOpen(false);
      setSelectedCalendarBookingId(bookingId);
    }
  }, [bookingId, bookings]);

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
    return formatLocalizedDate(booking.start_at, locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
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
    setCancelReviewBookingId(null);

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
      label: formatTimeRangeInTimeZone(start, end, timeZone, locale),
    };
  }

  const selectedManualService = useMemo(
    () =>
      manualServices.find(
        (service) => service.id === manualBooking.serviceId,
      ) || null,
    [manualServices, manualBooking.serviceId],
  );
  const isManualGroupBooking = selectedManualService?.booking_type === "group";

  const upcomingManualDepartures = useMemo(
    () =>
      manualDepartures.filter(
        (departure) =>
          departure.status === "scheduled" &&
          new Date(departure.start_at).getTime() > Date.now(),
      ),
    [manualDepartures],
  );

  const manualDepartureOptions = useMemo(
    () =>
      upcomingManualDepartures.filter(
        (departure) => departure.service_id === manualBooking.serviceId,
      ),
    [manualBooking.serviceId, upcomingManualDepartures],
  );

  const selectedManualDeparture = useMemo(
    () =>
      manualDepartureOptions.find(
        (departure) => departure.id === manualBooking.departureId,
      ) || null,
    [manualBooking.departureId, manualDepartureOptions],
  );

  const manualServiceStaffCounts = useMemo(() => {
    const activeStaffIds = new Set(manualStaff.map((staff) => staff.id));
    const counts = new Map<string, number>();

    manualStaffServices.forEach((link) => {
      if (!activeStaffIds.has(link.staff_member_id)) return;

      counts.set(link.service_id, (counts.get(link.service_id) || 0) + 1);
    });

    return counts;
  }, [manualStaff, manualStaffServices]);

  function manualServiceStaffCount(serviceId: string) {
    return manualServiceStaffCounts.get(serviceId) || 0;
  }

  const bookableManualServices = useMemo(
    () =>
      manualServices.filter(
        (service) =>
          service.booking_type === "group" ||
          manualServiceStaffCount(service.id) > 0,
      ),
    [manualServices, manualServiceStaffCounts],
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

  const manualBookingSetupReady = bookableManualServices.length > 0;
  const calendarTimeZone = business?.timezone || DEFAULT_TIME_ZONE;

  function preferredDepartureIdForService(
    serviceId: string,
    preferredDate?: string,
  ) {
    const options = upcomingManualDepartures.filter(
      (departure) =>
        departure.service_id === serviceId && departure.remainingSeats > 0,
    );
    const matchingDate = preferredDate
      ? options.find(
          (departure) =>
            dateKeyInTimeZone(
              new Date(departure.start_at),
              calendarTimeZone,
            ) === preferredDate,
        )
      : null;

    return (matchingDate || options[0])?.id || "";
  }

  function preferredStaffIdForService(serviceId: string) {
    const options = staffOptionsForService(serviceId);
    const filteredStaff =
      calendarStaffFilter !== "all"
        ? options.find((staff) => staff.id === calendarStaffFilter)
        : null;

    return filteredStaff?.id || options[0]?.id || "";
  }

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
  const allWeekBookings = useMemo(() => {
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
  const weekBookings = useMemo(() => {
    if (calendarStaffFilter === "all") return allWeekBookings;

    return allWeekBookings.filter(
      (booking) => booking.staff_member_id === calendarStaffFilter,
    );
  }, [allWeekBookings, calendarStaffFilter]);
  const weekGroups = useMemo(() => {
    return weekDays.map((day) => {
      const dateKey = dateKeyForDate(day);

      return {
        date: day,
        dateKey,
        label: labelForDateKey(dateKey, locale),
        shortLabel: formatLocalizedDate(day, locale, {
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
  }, [weekDays, weekBookings, calendarTimeZone, locale]);
  const selectedCalendarBooking = useMemo(
    () =>
      weekBookings.find(
        (booking) => booking.id === selectedCalendarBookingId,
      ) || null,
    [weekBookings, selectedCalendarBookingId],
  );
  const weekLabel = `${formatLocalizedDate(weekStartDate, locale, {
    day: "numeric",
    month: "short",
  })} - ${formatLocalizedDate(weekEndDate, locale, {
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

    return `/dashboard/customers/by-emails?email=${encodeURIComponent(booking.customer_email || "")}&businessId=${business?.id || booking.business_id}`;
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
    changeCalendarDate(
      toDateInputValue(addDays(selectedDateObject, direction * 7)),
    );
  }

  function updateManualBookingField(
    field: keyof ManualBookingDraft,
    value: string,
  ) {
    setManualBooking((current) => {
      if (field === "serviceId") {
        const service = manualServices.find((item) => item.id === value);
        if (service?.booking_type === "group") {
          return {
            ...current,
            serviceId: value,
            staffMemberId: "",
            departureId: preferredDepartureIdForService(value, current.date),
            partySize: "1",
            bookingOption: "shared",
          };
        }

        return {
          ...current,
          serviceId: value,
          staffMemberId: preferredStaffIdForService(value),
          departureId: "",
          partySize: "1",
          bookingOption: "shared",
        };
      }

      if (field === "departureId") {
        const departure = manualDepartures.find((item) => item.id === value);
        return {
          ...current,
          departureId: value,
          bookingOption:
            current.bookingOption === "private" &&
            departure?.remainingSeats !== departure?.capacity
              ? "shared"
              : current.bookingOption,
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

    setManualBooking((current) => {
      const requestedDate =
        next?.date || selectedDate || toDateInputValue(new Date());
      const currentServiceIsBookable = bookableManualServices.some(
        (service) => service.id === current.serviceId,
      );
      const departureOnRequestedDate = upcomingManualDepartures.find(
        (departure) =>
          departure.remainingSeats > 0 &&
          dateKeyInTimeZone(new Date(departure.start_at), calendarTimeZone) ===
            requestedDate,
      );
      const serviceId = currentServiceIsBookable
        ? current.serviceId
        : departureOnRequestedDate?.service_id ||
          bookableManualServices[0]?.id ||
          "";
      const service = manualServices.find((item) => item.id === serviceId);
      const groupBooking = service?.booking_type === "group";

      return {
        ...current,
        serviceId,
        staffMemberId:
          serviceId && !groupBooking
            ? preferredStaffIdForService(serviceId)
            : "",
        date: requestedDate,
        time: next?.time || current.time || "09:00",
        departureId: groupBooking
          ? preferredDepartureIdForService(serviceId, requestedDate)
          : "",
        partySize: groupBooking ? current.partySize || "1" : "1",
        bookingOption: groupBooking ? current.bookingOption : "shared",
      };
    });
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

  const manualStaffBusyIds = useMemo(() => {
    const busyStaffIds = new Set<string>();

    if (!selectedManualService || !manualBooking.date || !manualBooking.time) {
      return busyStaffIds;
    }

    const start = zonedDateTimeToUtc(
      manualBooking.date,
      manualBooking.time,
      calendarTimeZone,
    );

    if (Number.isNaN(start.getTime())) return busyStaffIds;

    const end = addMinutes(start, selectedManualService.duration_minutes);

    bookings.forEach((booking) => {
      if (booking.status !== "pending" && booking.status !== "confirmed") {
        return;
      }

      if (
        booking.staff_member_id &&
        bookingOverlaps(booking, booking.staff_member_id, start, end)
      ) {
        busyStaffIds.add(booking.staff_member_id);
      }
    });

    return busyStaffIds;
  }, [
    bookings,
    calendarTimeZone,
    manualBooking.date,
    manualBooking.time,
    selectedManualService,
  ]);

  function manualStaffAvailabilityLabel(staff: ManualBookingStaff) {
    if (!selectedManualService || !manualBooking.date || !manualBooking.time) {
      return "";
    }

    return manualStaffBusyIds.has(staff.id)
      ? t("dashboardBookings.manual.staffBusy", "Busy")
      : t("dashboardBookings.manual.staffAvailable", "Available");
  }

  function validateManualBookingDraft(
    draft: ManualBookingDraft,
    selectedService: ManualBookingService | undefined,
  ) {
    const customerName = draft.customerName.trim();
    const customerEmail = draft.customerEmail.trim().toLowerCase();

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

    if (!selectedService) {
      return t("dashboardBookings.manual.error.service", "Choose a service.");
    }

    if (selectedService.booking_type === "group") {
      const departure = manualDepartures.find(
        (item) =>
          item.id === draft.departureId &&
          item.service_id === selectedService.id,
      );
      if (
        !departure ||
        departure.status !== "scheduled" ||
        new Date(departure.start_at).getTime() <= Date.now()
      ) {
        return t(
          "dashboardBookings.manual.error.departure",
          "Choose an upcoming departure.",
        );
      }

      const partySize = Number(draft.partySize);
      if (!Number.isInteger(partySize) || partySize < 1) {
        return t(
          "dashboardBookings.manual.error.partySize",
          "Choose how many guests to add.",
        );
      }

      if (draft.bookingOption === "private") {
        if (!selectedService.private_booking_enabled) {
          return t(
            "dashboardBookings.manual.error.privateUnavailable",
            "Private booking is not available for this service.",
          );
        }
        if (
          departure.remainingSeats !== departure.capacity ||
          partySize > departure.capacity
        ) {
          return t(
            "dashboardBookings.manual.error.privateUnavailable",
            "A private trip is only available before any seats are reserved.",
          );
        }
      } else if (partySize > departure.remainingSeats) {
        return t(
          "dashboardBookings.manual.error.notEnoughSeats",
          "There are not enough seats left for this booking.",
        );
      }

      return null;
    }

    if (!draft.staffMemberId) {
      return t("dashboardBookings.manual.error.staff", "Choose staff.");
    }

    if (!draft.date || !draft.time) {
      return t(
        "dashboardBookings.manual.error.time",
        "Choose a date and time.",
      );
    }

    const start = zonedDateTimeToUtc(draft.date, draft.time, calendarTimeZone);
    if (Number.isNaN(start.getTime())) {
      return t(
        "dashboardBookings.manual.error.time",
        "Choose a date and time.",
      );
    }

    if (start.getTime() <= Date.now()) {
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

    if (code === "departure_required" || code === "departure_unavailable") {
      return t(
        "dashboardBookings.manual.error.departure",
        "Choose an upcoming departure.",
      );
    }

    if (code === "party_size_invalid") {
      return t(
        "dashboardBookings.manual.error.partySize",
        "Choose how many guests to add.",
      );
    }

    if (code === "not_enough_seats") {
      return t(
        "dashboardBookings.manual.error.notEnoughSeats",
        "There are not enough seats left for this booking.",
      );
    }

    if (code === "private_trip_unavailable") {
      return t(
        "dashboardBookings.manual.error.privateUnavailable",
        "A private trip is only available before any seats are reserved.",
      );
    }

    if (code === "manual_capacity_contract_not_installed") {
      return t(
        "dashboardBookings.manual.error.capacityConfig",
        "Manual group booking is not configured yet.",
      );
    }

    if (code === "owner_required") {
      return t(
        "dashboardBookings.manual.error.ownerRequired",
        "Only the business owner can add a group reservation.",
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

  async function createManualBooking(draft: ManualBookingDraft) {
    if (!business || manualBookingSaving) return;

    const selectedService = manualServices.find(
      (service) => service.id === draft.serviceId,
    );
    const validationError = validateManualBookingDraft(draft, selectedService);
    setManualBooking(draft);

    if (validationError || !selectedService) {
      setManualBookingError(validationError);
      return;
    }

    setManualBookingSaving(true);
    setManualBookingError(null);
    setError(null);
    setSuccess(null);

    const customerName = draft.customerName.trim();
    const customerEmail = draft.customerEmail.trim().toLowerCase();

    try {
      if (selectedService.booking_type === "group") {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setManualBookingError(manualBookingSaveError("auth_required"));
          return;
        }

        const response = await fetch("/api/dashboard/manual-capacity-booking", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: business.id,
            departureId: draft.departureId,
            customerName,
            customerEmail,
            customerPhone: draft.customerPhone,
            customerNotes: draft.customerNotes,
            partySize: Number(draft.partySize),
            bookingOption: draft.bookingOption,
          }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setManualBookingError(manualBookingSaveError(result?.code));
          return;
        }

        setManualBooking({
          ...emptyManualBookingDraft,
          date: draft.date,
          time: draft.time,
        });
        setManualBookingOpen(false);
        await router.push({
          pathname: "/dashboard/departures",
          query: {
            businessId: business.id,
            departureId: result.departureId || draft.departureId,
          },
        });
        return;
      }

      const start = zonedDateTimeToUtc(
        draft.date,
        draft.time,
        calendarTimeZone,
      );
      const [
        { data: freshService, error: freshServiceError },
        { data: freshStaff, error: freshStaffError },
        { data: freshStaffService, error: freshStaffServiceError },
        { data: freshBookings, error: freshBookingsError },
      ] = await Promise.all([
        supabase
          .from("services")
          .select("id, duration_minutes, active")
          .eq("id", selectedService.id)
          .eq("business_id", business.id)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("staff_members")
          .select("id, active")
          .eq("id", draft.staffMemberId)
          .eq("business_id", business.id)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("staff_services")
          .select("staff_member_id")
          .eq("staff_member_id", draft.staffMemberId)
          .eq("service_id", selectedService.id)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select(
            "id, staff_member_id, start_at, end_at, duration_minutes, status",
          )
          .eq("business_id", business.id)
          .eq("staff_member_id", draft.staffMemberId)
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
        freshService.duration_minutes || selectedService.duration_minutes;
      const appointmentEnd = addMinutes(start, durationMinutes);
      const hasConflict = ((freshBookings || []) as Booking[]).some((booking) =>
        bookingOverlaps(booking, draft.staffMemberId, start, appointmentEnd),
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
          serviceId: selectedService.id,
          staffMemberId: draft.staffMemberId,
          customerName,
          customerEmail,
          customerPhone: draft.customerPhone,
          customerNotes: draft.customerNotes,
          date: draft.date,
          time: draft.time,
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
        date: draft.date,
        time: draft.time,
      });
      setManualBookingOpen(false);
      setSelectedDate(draft.date);
      replaceBookingsQuery({
        nextDate: draft.date,
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
    const contactDetails = [
      booking.customer_email,
      booking.customer_phone,
    ].filter(Boolean);

    return (
      <article
        key={booking.id}
        className={`calendar-detail-card ${booking.status}`}
      >
        <div className="calendar-detail-status-row">
          <span className={`calendar-status status-${booking.status}`}>
            {statusLabel(booking.status)}
          </span>
        </div>

        <dl className="calendar-detail-list">
          <div>
            <dt>{t("dashboardBookings.details.when", "When")}</dt>
            <dd>
              <strong>{time.label}</strong>
              <span>
                {booking.duration_minutes} {t("common.minutes", "minutes")}
              </span>
            </dd>
          </div>

          <div>
            <dt>{t("dashboardBookings.details.service", "Service")}</dt>
            <dd>
              <strong>
                {booking.services?.name ||
                  t("dashboardBookings.card.noService", "No service recorded")}
              </strong>
            </dd>
          </div>

          <div>
            <dt>{t("dashboardBookings.details.staff", "Staff")}</dt>
            <dd>
              <strong>{bookingStaffLabel(booking)}</strong>
            </dd>
          </div>

          {contactDetails.length > 0 && (
            <div>
              <dt>{t("dashboardBookings.details.contact", "Contact")}</dt>
              <dd className="calendar-contact-stack">
                {contactDetails.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </dd>
            </div>
          )}

          {(booking.customer_notes || booking.internal_notes) && (
            <div>
              <dt>{t("dashboardBookings.details.notes", "Notes")}</dt>
              <dd>
                <span>{booking.customer_notes || booking.internal_notes}</span>
              </dd>
            </div>
          )}
        </dl>

        <div className="calendar-actions calendar-detail-actions">
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
                onClick={() =>
                  setCancelReviewBookingId((current) =>
                    current === booking.id ? null : booking.id,
                  )
                }
                className="btn btn-ghost"
                disabled={isWorking}
                aria-expanded={cancelReviewBookingId === booking.id}
                aria-controls={`cancel-review-${booking.id}`}
              >
                {t("dashboardBookings.actions.cancel", "Cancel")}
              </button>
            </>
          )}

          <Link href={customerHistoryLink(booking)} className="btn btn-ghost">
            {t("dashboardBookings.card.customerDetails", "Customer details")}
          </Link>
        </div>

        {cancelReviewBookingId === booking.id && (
          <div
            id={`cancel-review-${booking.id}`}
            className="calendar-cancel-review"
            role="group"
            aria-label={t(
              "dashboardBookings.cancelReview.label",
              "Review booking cancellation",
            )}
          >
            <p className="small">
              {t(
                "dashboardBookings.confirm.cancel",
                "Cancel this booking? This will also show as cancelled to the customer.",
              )}
            </p>
            <div className="calendar-cancel-review-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={isWorking}
                onClick={() => cancelBooking(booking)}
              >
                {isWorking
                  ? t("dashboardBookings.actions.working", "Working...")
                  : t(
                      "dashboardBookings.cancelReview.confirm",
                      "Confirm cancellation",
                    )}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isWorking}
                onClick={() => setCancelReviewBookingId(null)}
              >
                {t("dashboardBookings.cancelReview.keep", "Keep booking")}
              </button>
            </div>
          </div>
        )}

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
    const isCompactBlock = blockHeight < 58;

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
          isCompactBlock ? "compact" : ""
        } ${isSelected ? "selected" : ""}`}
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
        {!isCompactBlock && booking.status === "pending" && (
          <span className={`calendar-status status-${booking.status}`}>
            {statusLabel(booking.status)}
          </span>
        )}
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
    const now = new Date();
    const todayKey = dateKeyInTimeZone(now, calendarTimeZone);
    const currentMinutes = minutesSinceMidnightInTimeZone(
      now,
      calendarTimeZone,
    );
    const showCurrentTime =
      currentMinutes >= startHour * 60 && currentMinutes <= endHour * 60;
    const selectedGroup =
      weekGroups.find((group) => group.dateKey === selectedDate) ||
      weekGroups[0];
    const mobileWindow = scheduleWindowFor(selectedGroup?.bookings || []);
    const mobileAppointments = (selectedGroup?.bookings || []).map(
      (booking) => {
        const time = bookingTime(booking);

        return {
          id: booking.id,
          startMinutes: time.startMinutes,
          endMinutes: time.endMinutes,
          timeLabel: time.label,
          title:
            booking.customer_name ||
            t("dashboardBookings.card.customerFallback", "Customer"),
          subtitle:
            booking.services?.name ||
            t("dashboardBookings.card.noService", "No service recorded"),
          meta: bookingStaffLabel(booking),
          status: booking.status,
          statusLabel: statusLabel(booking.status),
        };
      },
    );

    return (
      <section className="week-calendar">
        {selectedGroup && (
          <MobileDayCalendar
            ariaLabel={t(
              "dashboardBookings.mobileAgenda.label",
              "Day calendar",
            )}
            days={weekGroups.map((group) => ({
              key: group.dateKey,
              weekday: formatLocalizedDate(group.date, locale, {
                weekday: "short",
              }),
              date: String(group.date.getDate()),
              count: group.bookings.length,
              isToday: group.dateKey === todayKey,
            }))}
            selectedDayKey={selectedGroup.dateKey}
            selectedDayLabel={selectedGroup.label}
            appointments={mobileAppointments}
            selectedAppointmentId={selectedCalendarBookingId}
            startHour={mobileWindow.startHour}
            endHour={mobileWindow.endHour}
            currentTimeMinutes={
              selectedGroup.dateKey === todayKey ? currentMinutes : null
            }
            emptyLabel={t(
              "dashboardBookings.calendar.emptySlotTitle",
              "No appointments on this day",
            )}
            addAtLabel={t("dashboardBookings.manual.addAt", "Add booking")}
            onSelectDay={changeCalendarDate}
            onSelectAppointment={(bookingId) => {
              setManualBookingOpen(false);
              setSelectedCalendarBookingId(bookingId);
            }}
            onAddSlot={(minutes) =>
              openManualBookingAt({
                date: selectedGroup.dateKey,
                time: timeInputForMinutes(minutes),
              })
            }
          />
        )}

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
                        "Add booking",
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

                {showCurrentTime && group.dateKey === todayKey && (
                  <span
                    className="calendar-current-time-line"
                    style={{
                      top: `${
                        ((currentMinutes - startHour * 60) / 60) *
                        CALENDAR_HOUR_HEIGHT
                      }px`,
                    }}
                    aria-hidden="true"
                  >
                    <span>{timeInputForMinutes(currentMinutes)}</span>
                  </span>
                )}

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
                    title={t(
                      "dashboardBookings.week.returnToToday",
                      "Return to today",
                    )}
                    aria-label={t(
                      "dashboardBookings.week.returnToToday",
                      "Return to today",
                    )}
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
                <label className="calendar-staff-filter">
                  <span>{t("dashboardBookings.filters.staff", "Staff")}</span>
                  <select
                    value={calendarStaffFilter}
                    onChange={(event) => {
                      const nextStaffId = event.target.value;

                      setCalendarStaffFilter(nextStaffId);
                      setSelectedCalendarBookingId(null);

                      if (
                        manualBookingOpen &&
                        nextStaffId !== "all" &&
                        manualBooking.serviceId &&
                        staffOptionsForService(manualBooking.serviceId).some(
                          (staff) => staff.id === nextStaffId,
                        )
                      ) {
                        setManualBooking((current) => ({
                          ...current,
                          staffMemberId: nextStaffId,
                        }));
                      }
                    }}
                    aria-label={t("dashboardBookings.filters.staff", "Staff")}
                  >
                    <option value="all">
                      {t("dashboardBookings.filters.allStaff", "All staff")}
                    </option>
                    {manualStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {manualStaffLabel(staff)}
                      </option>
                    ))}
                  </select>
                </label>
                {hasGroupServices && business && (
                  <Link
                    href={`/dashboard/departures?businessId=${business.id}`}
                    className="btn btn-ghost calendar-departures-button"
                  >
                    {t("dashboardBookings.departures.open", "Group departures")}
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn-accent calendar-add-button"
                  onClick={openManualBooking}
                >
                  {t("dashboardBookings.manual.open", "Add booking")}
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
                      "Add booking",
                    )}
                  >
                    <div className="manual-booking-heading">
                      <div>
                        <strong>
                          {t("dashboardBookings.manual.title", "Add booking")}
                        </strong>
                        <p className="small muted">
                          {t(
                            "dashboardBookings.manual.body",
                            "Choose a customer and service. Mirëbook will show the right schedule fields.",
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
                          const submittedDraft = manualBookingDraftFromForm(
                            event.currentTarget,
                          );
                          setManualBooking(submittedDraft);
                          void createManualBooking(submittedDraft);
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
                            name="customerName"
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
                            name="customerEmail"
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
                            name="customerPhone"
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
                            name="serviceId"
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
                            {manualServices.map((service) => {
                              const staffCount = manualServiceStaffCount(
                                service.id,
                              );
                              const groupService =
                                service.booking_type === "group";

                              return (
                                <option
                                  key={service.id}
                                  value={service.id}
                                  disabled={!groupService && staffCount === 0}
                                >
                                  {service.name} ·{" "}
                                  {groupService
                                    ? t(
                                        "dashboardBookings.manual.scheduledDepartureShort",
                                        "Scheduled departure",
                                      )
                                    : `${service.duration_minutes} ${t(
                                        "common.minutes",
                                        "minutes",
                                      )}`}
                                  {!groupService && staffCount === 0
                                    ? ` · ${t(
                                        "dashboardBookings.manual.noStaffShort",
                                        "No staff assigned",
                                      )}`
                                    : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>

                        {isManualGroupBooking ? (
                          <div className="manual-group-booking-fields">
                            <input
                              type="hidden"
                              name="staffMemberId"
                              value=""
                            />
                            <input
                              type="hidden"
                              name="date"
                              value={manualBooking.date}
                            />
                            <input
                              type="hidden"
                              name="time"
                              value={manualBooking.time}
                            />

                            <div className="manual-group-booking-intro">
                              <strong>
                                {t(
                                  "dashboardBookings.manual.group.title",
                                  "Add guests to a scheduled departure",
                                )}
                              </strong>
                              <p className="small muted">
                                {t(
                                  "dashboardBookings.manual.group.body",
                                  "Choose the trip first. Mirëbook will reserve its seats and keep the guest list together.",
                                )}
                              </p>
                            </div>

                            <label>
                              <span>
                                {t(
                                  "dashboardBookings.manual.departure",
                                  "Departure",
                                )}
                              </span>
                              <select
                                name="departureId"
                                value={manualBooking.departureId}
                                onChange={(event) =>
                                  updateManualBookingField(
                                    "departureId",
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="">
                                  {t(
                                    "dashboardBookings.manual.chooseDeparture",
                                    "Choose departure",
                                  )}
                                </option>
                                {manualDepartureOptions.map((departure) => (
                                  <option
                                    key={departure.id}
                                    value={departure.id}
                                    disabled={departure.remainingSeats < 1}
                                  >
                                    {formatLocalizedDate(
                                      departure.start_at,
                                      locale,
                                      {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                        timeZone: calendarTimeZone,
                                      },
                                    )}
                                    {` · ${departure.remainingSeats}/${departure.capacity} ${t(
                                      "dashboardBookings.manual.seatsLeftShort",
                                      "left",
                                    )}`}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {manualDepartureOptions.length === 0 && (
                              <div className="manual-group-booking-empty">
                                <p className="small">
                                  {t(
                                    "dashboardBookings.manual.noDepartures",
                                    "This service has no upcoming departures yet.",
                                  )}
                                </p>
                                {business && (
                                  <Link
                                    href={`/dashboard/departures?businessId=${business.id}&serviceId=${manualBooking.serviceId}`}
                                    className="btn btn-ghost"
                                  >
                                    {t(
                                      "dashboardBookings.manual.scheduleDeparture",
                                      "Schedule a departure",
                                    )}
                                  </Link>
                                )}
                              </div>
                            )}

                            {selectedManualDeparture && (
                              <>
                                <div className="manual-departure-summary">
                                  <span>
                                    {t(
                                      "dashboardBookings.manual.departureTime",
                                      "Departure",
                                    )}
                                    <strong>
                                      {formatLocalizedDate(
                                        selectedManualDeparture.start_at,
                                        locale,
                                        {
                                          dateStyle: "full",
                                          timeStyle: "short",
                                          timeZone: calendarTimeZone,
                                        },
                                      )}
                                    </strong>
                                  </span>
                                  <span>
                                    {t(
                                      "dashboardBookings.manual.seatsRemaining",
                                      "Seats remaining",
                                    )}
                                    <strong>
                                      {selectedManualDeparture.remainingSeats} /{" "}
                                      {selectedManualDeparture.capacity}
                                    </strong>
                                  </span>
                                  {selectedManualDeparture.meeting_point && (
                                    <span>
                                      {t(
                                        "dashboardBookings.manual.meetingPoint",
                                        "Meeting point",
                                      )}
                                      <strong>
                                        {selectedManualDeparture.meeting_point}
                                      </strong>
                                    </span>
                                  )}
                                </div>

                                <fieldset className="manual-booking-option">
                                  <legend>
                                    {t(
                                      "dashboardBookings.manual.bookingOption",
                                      "Booking type",
                                    )}
                                  </legend>
                                  <label>
                                    <input
                                      type="radio"
                                      name="bookingOption"
                                      value="shared"
                                      checked={
                                        manualBooking.bookingOption === "shared"
                                      }
                                      onChange={() =>
                                        updateManualBookingField(
                                          "bookingOption",
                                          "shared",
                                        )
                                      }
                                    />
                                    <span>
                                      <strong>
                                        {t(
                                          "dashboardBookings.manual.sharedSeats",
                                          "Shared seats",
                                        )}
                                      </strong>
                                      <small>
                                        {t(
                                          "dashboardBookings.manual.sharedSeatsHint",
                                          "Reserve only this group's seats.",
                                        )}
                                      </small>
                                    </span>
                                  </label>
                                  {selectedManualService?.private_booking_enabled && (
                                    <label>
                                      <input
                                        type="radio"
                                        name="bookingOption"
                                        value="private"
                                        checked={
                                          manualBooking.bookingOption ===
                                          "private"
                                        }
                                        disabled={
                                          selectedManualDeparture.remainingSeats !==
                                          selectedManualDeparture.capacity
                                        }
                                        onChange={() =>
                                          updateManualBookingField(
                                            "bookingOption",
                                            "private",
                                          )
                                        }
                                      />
                                      <span>
                                        <strong>
                                          {t(
                                            "dashboardBookings.manual.privateTrip",
                                            "Private trip",
                                          )}
                                        </strong>
                                        <small>
                                          {selectedManualDeparture.remainingSeats ===
                                          selectedManualDeparture.capacity
                                            ? t(
                                                "dashboardBookings.manual.privateTripHint",
                                                "Reserve the whole departure.",
                                              )
                                            : t(
                                                "dashboardBookings.manual.privateTripTaken",
                                                "Unavailable after seats have been reserved.",
                                              )}
                                        </small>
                                      </span>
                                    </label>
                                  )}
                                </fieldset>

                                <label>
                                  <span>
                                    {t(
                                      "dashboardBookings.manual.partySize",
                                      "Guests",
                                    )}
                                  </span>
                                  <input
                                    name="partySize"
                                    type="number"
                                    min={1}
                                    max={
                                      manualBooking.bookingOption === "private"
                                        ? selectedManualDeparture.capacity
                                        : selectedManualDeparture.remainingSeats
                                    }
                                    value={manualBooking.partySize}
                                    onChange={(event) =>
                                      updateManualBookingField(
                                        "partySize",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            <input type="hidden" name="departureId" value="" />
                            <input type="hidden" name="partySize" value="1" />
                            <input
                              type="hidden"
                              name="bookingOption"
                              value="shared"
                            />
                            <label>
                              <span>
                                {t(
                                  "dashboardBookings.manual.bookFor",
                                  "Book for",
                                )}
                              </span>
                              <select
                                name="staffMemberId"
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
                                {manualStaffOptions.map((staff) => {
                                  const availabilityLabel =
                                    manualStaffAvailabilityLabel(staff);

                                  return (
                                    <option key={staff.id} value={staff.id}>
                                      {manualStaffLabel(staff)}
                                      {availabilityLabel
                                        ? ` · ${availabilityLabel}`
                                        : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>

                            <label>
                              <span>{t("common.date", "Date")}</span>
                              <input
                                name="date"
                                type="date"
                                value={manualBooking.date}
                                onInput={(event) =>
                                  updateManualBookingField(
                                    "date",
                                    event.currentTarget.value,
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>{t("common.time", "Time")}</span>
                              <input
                                name="time"
                                type="time"
                                value={manualBooking.time}
                                onInput={(event) =>
                                  updateManualBookingField(
                                    "time",
                                    event.currentTarget.value,
                                  )
                                }
                              />
                            </label>
                          </>
                        )}

                        <label className="manual-booking-notes">
                          <span>
                            {t("dashboardBookings.manual.notes", "Notes")}
                          </span>
                          <textarea
                            name="customerNotes"
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
                            {isManualGroupBooking && selectedManualDeparture
                              ? `${selectedManualDeparture.remainingSeats} ${t(
                                  "dashboardBookings.manual.seatsRemainingShort",
                                  "seats remaining",
                                )}`
                              : selectedManualService
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
                                  isManualGroupBooking
                                    ? "dashboardBookings.manual.createReservation"
                                    : "dashboardBookings.manual.create",
                                  isManualGroupBooking
                                    ? "Add reservation"
                                    : "Add appointment",
                                )}
                          </button>
                        </div>

                        {!isManualGroupBooking &&
                          manualBooking.serviceId &&
                          manualStaffOptions.length === 0 && (
                            <p className="small manual-booking-warning">
                              {t(
                                "dashboardBookings.manual.noAssignedStaff",
                                "No active staff are assigned to this service.",
                              )}
                            </p>
                          )}

                        {!isManualGroupBooking &&
                          manualBooking.serviceId &&
                          manualBooking.date &&
                          manualBooking.time &&
                          manualStaffOptions.length > 0 && (
                            <p className="small manual-booking-staff-hint">
                              {manualStaffOptions.some(
                                (staff) => !manualStaffBusyIds.has(staff.id),
                              )
                                ? t(
                                    "dashboardBookings.manual.staffAvailabilityHint",
                                    "Available staff are labelled for the selected time.",
                                  )
                                : t(
                                    "dashboardBookings.manual.noStaffAvailableAtTime",
                                    "No assigned staff are free at this time.",
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
          grid-template-rows: auto minmax(0, 1fr);
          height: calc(100dvh - 9.75rem);
          min-height: 34rem;
          min-width: 0;
        }

        .calendar-body {
          display: grid;
          gap: 1rem;
          min-height: 0;
          min-width: 0;
        }

        .calendar-body.has-side-panel {
          grid-template-columns: minmax(0, 1fr);
        }

        .calendar-main-column,
        .calendar-side-panel {
          display: grid;
          gap: 1rem;
          min-height: 0;
          min-width: 0;
        }

        .calendar-side-panel {
          position: fixed;
          top: 6.25rem;
          right: 1.25rem;
          z-index: 40;
          width: min(24rem, calc(100vw - 2rem));
          max-height: calc(100vh - 7.5rem);
          overflow-y: auto;
          border-radius: var(--radius);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
        }

        .calendar-shell,
        .calendar-empty-state {
          display: grid;
          gap: 0.75rem;
          padding: 0.75rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          min-width: 0;
        }

        .manual-booking-panel {
          display: grid;
          gap: 0.85rem;
          padding: 0.95rem;
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
          gap: 0.75rem;
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
          min-height: 2.75rem;
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

        .manual-group-booking-fields {
          display: grid;
          gap: 0.75rem;
          min-width: 0;
        }

        .manual-group-booking-intro {
          display: grid;
          gap: 0.25rem;
          padding: 0.75rem 0.85rem;
          border-left: 3px solid var(--success);
          background: rgba(45, 212, 191, 0.06);
        }

        .manual-group-booking-intro p,
        .manual-group-booking-empty p {
          margin: 0;
        }

        .manual-group-booking-empty {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .manual-departure-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem 1rem;
          padding: 0.8rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .manual-departure-summary span {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .manual-departure-summary strong {
          overflow-wrap: anywhere;
          color: var(--text);
          font-size: 0.86rem;
        }

        .manual-booking-option {
          display: grid;
          gap: 0.5rem;
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .manual-booking-option legend {
          margin-bottom: 0.35rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .manual-booking-option label {
          display: grid;
          grid-template-columns: 1.2rem minmax(0, 1fr);
          gap: 0.65rem;
          align-items: start;
          min-height: 3.25rem;
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          cursor: pointer;
        }

        .manual-booking-option label:has(input:checked) {
          border-color: rgba(45, 212, 191, 0.55);
          background: rgba(45, 212, 191, 0.08);
        }

        .manual-booking-option label:has(input:disabled) {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .manual-booking-option input[type="radio"] {
          width: 1.1rem;
          min-height: 1.1rem;
          margin: 0.15rem 0 0;
          padding: 0;
          accent-color: var(--success);
        }

        .manual-booking-option label > span {
          display: grid;
          gap: 0.15rem;
          color: var(--text);
          font-size: 0.85rem;
        }

        .manual-booking-option small {
          color: var(--text-muted);
          font-weight: 600;
          line-height: 1.35;
        }

        .manual-booking-notes,
        .manual-booking-footer,
        .manual-booking-error,
        .manual-booking-warning,
        .manual-booking-staff-hint {
          grid-column: auto;
        }

        .manual-booking-error,
        .manual-booking-warning,
        .manual-booking-staff-hint {
          margin: 0;
        }

        .manual-booking-error {
          color: var(--danger);
        }

        .manual-booking-warning {
          color: var(--warning);
        }

        .manual-booking-staff-hint {
          color: var(--text-muted);
        }

        .manual-booking-setup {
          display: grid;
          gap: 0.75rem;
        }

        .calendar-toolbar,
        .calendar-date-controls {
          display: flex;
          gap: 0.65rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .calendar-toolbar {
          justify-content: space-between;
          min-width: 0;
        }

        .calendar-date-controls {
          flex: 1 1 auto;
          justify-content: flex-end;
          min-width: 0;
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
          min-height: 2.75rem;
          border: 0;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .calendar-step-button {
          width: 2.75rem;
          min-width: 2.75rem;
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
          min-height: 2.75rem;
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

        .calendar-staff-filter {
          display: inline-flex;
          min-height: 2.75rem;
          align-items: center;
          gap: 0.45rem;
          padding: 0 0.28rem 0 0.7rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 900;
        }

        .calendar-staff-filter select {
          max-width: 13.5rem;
          min-height: 2.75rem;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          color-scheme: dark;
          padding: 0.35rem 0.55rem;
          font: inherit;
          font-size: 0.8rem;
        }

        .calendar-add-button,
        .calendar-departures-button {
          min-height: 2.75rem;
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
          padding: 0.95rem;
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

        :global(.calendar-detail-card) {
          display: grid;
          gap: 0.85rem;
        }

        :global(.calendar-detail-status-row) {
          display: flex;
          justify-content: flex-start;
        }

        :global(.calendar-detail-list) {
          display: grid;
          gap: 0.65rem;
          margin: 0;
        }

        :global(.calendar-detail-list > div) {
          display: grid;
          gap: 0.2rem;
          padding: 0.72rem;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: calc(var(--radius) - 3px);
          background: rgba(15, 23, 42, 0.38);
        }

        :global(.calendar-detail-list dt) {
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        :global(.calendar-detail-list dd) {
          display: grid;
          gap: 0.12rem;
          margin: 0;
          min-width: 0;
        }

        :global(.calendar-detail-list dd span) {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        :global(.calendar-contact-stack) {
          overflow-wrap: anywhere;
        }

        :global(.calendar-detail-actions) {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: stretch;
        }

        :global(.calendar-detail-actions .btn) {
          justify-content: center;
        }

        :global(.calendar-cancel-review) {
          display: grid;
          gap: 0.65rem;
          padding: 0.75rem;
          border: 1px solid rgba(255, 77, 109, 0.32);
          border-radius: calc(var(--radius) - 3px);
          background: rgba(255, 77, 109, 0.06);
        }

        :global(.calendar-cancel-review p) {
          margin: 0;
        }

        :global(.calendar-cancel-review-actions) {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
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
          gap: 0.85rem;
          grid-template-rows: minmax(0, 1fr);
          height: 100%;
          min-width: 0;
          max-width: 100%;
          padding: 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: calc(var(--radius) + 2px);
          background:
            radial-gradient(
              circle at 18% 0%,
              rgba(255, 107, 53, 0.12),
              transparent 32%
            ),
            linear-gradient(
              180deg,
              rgba(15, 23, 42, 0.98),
              rgba(2, 6, 23, 0.96)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 24px 70px rgba(0, 0, 0, 0.24);
          overflow: hidden;
        }

        :global(.week-calendar-scroll) {
          position: relative;
          width: 100%;
          min-height: 0;
          max-width: 100%;
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: calc(var(--radius) + 2px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(2, 6, 23, 0.5);
          background-size: 100% 72px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            inset 0 0 0 1px rgba(2, 6, 23, 0.3);
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
          padding: 0.1rem 0.1rem 0;
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
          grid-template-columns: 4.4rem repeat(7, minmax(7.1rem, 1fr));
          min-width: 100%;
          overflow: visible;
          background: rgba(2, 6, 23, 0.22);
        }

        :global(.week-calendar-corner) {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 8;
          min-height: 3.6rem;
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.96);
        }

        :global(.week-day-header) {
          position: sticky;
          top: 0;
          z-index: 7;
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
          border-right: 1px solid rgba(148, 163, 184, 0.14);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 0;
          background: rgba(15, 23, 42, 0.62);
          color: var(--text);
          font: inherit;
          text-align: center;
          cursor: pointer;
          transition:
            background 0.16s ease,
            color 0.16s ease;
        }

        :global(.week-day-header.active) {
          background:
            linear-gradient(
              180deg,
              rgba(255, 107, 53, 0.26),
              rgba(255, 107, 53, 0.1)
            ),
            rgba(15, 23, 42, 0.9);
          color: #fff7ed;
          box-shadow: inset 0 -2px 0 rgba(255, 107, 53, 0.75);
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
          position: sticky;
          left: 0;
          z-index: 5;
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.92);
          box-shadow: 10px 0 28px rgba(0, 0, 0, 0.18);
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

        :global(.week-time-rail span:first-child) {
          transform: translateY(0.4rem);
        }

        :global(.week-day-lane) {
          border-right: 1px solid rgba(148, 163, 184, 0.12);
          overflow: hidden;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0.005)
            ),
            rgba(15, 23, 42, 0.12);
        }

        :global(.week-day-lane:last-child),
        :global(.week-day-header:last-of-type) {
          border-right: 0;
        }

        :global(.week-day-empty) {
          position: absolute;
          inset: 0.45rem;
          border: 1px dashed rgba(148, 163, 184, 0.12);
          border-radius: calc(var(--radius) - 4px);
          background: rgba(15, 23, 42, 0.12);
          pointer-events: none;
        }

        :global(.calendar-slot-hit) {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
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
          width: 1.7rem;
          height: 1.7rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 107, 53, 0.32);
          border-radius: 999px;
          background: rgba(255, 107, 53, 0.16);
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
          background: rgba(148, 163, 184, 0.1);
          pointer-events: none;
        }

        :global(.calendar-current-time-line) {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 4;
          height: 2px;
          background: var(--accent);
          box-shadow:
            0 0 0 1px rgba(255, 107, 53, 0.18),
            0 0 22px rgba(255, 107, 53, 0.34);
          pointer-events: none;
        }

        :global(.calendar-current-time-line)::before {
          content: "";
          position: absolute;
          top: 50%;
          left: -0.32rem;
          width: 0.58rem;
          height: 0.58rem;
          border-radius: 999px;
          background: var(--accent);
          transform: translateY(-50%);
          box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.14);
        }

        :global(.calendar-current-time-line span) {
          position: absolute;
          top: 50%;
          right: 0.35rem;
          transform: translateY(-50%);
          padding: 0.12rem 0.36rem;
          border-radius: 999px;
          background: rgba(255, 107, 53, 0.18);
          color: #fff7ed;
          font-size: 0.68rem;
          font-weight: 900;
        }

        :global(.calendar-schedule-block) {
          position: absolute;
          left: 0.5rem;
          right: 0.5rem;
          display: grid;
          align-content: start;
          gap: 0.16rem;
          overflow: hidden;
          padding: 0.58rem 0.65rem;
          border: 1px solid rgba(45, 212, 191, 0.32);
          border-left: 4px solid rgba(45, 212, 191, 0.92);
          border-radius: 0.82rem;
          background:
            linear-gradient(
              135deg,
              rgba(45, 212, 191, 0.18),
              rgba(45, 212, 191, 0.07)
            ),
            rgba(15, 23, 42, 0.96);
          color: var(--text);
          font: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow:
            0 18px 34px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          z-index: 3;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        :global(.calendar-schedule-block:hover),
        :global(.calendar-schedule-block:focus-visible) {
          border-color: rgba(45, 212, 191, 0.5);
          box-shadow:
            0 20px 42px rgba(0, 0, 0, 0.28),
            0 0 0 1px rgba(45, 212, 191, 0.16);
          transform: translateY(-1px);
        }

        :global(.calendar-schedule-block.selected) {
          outline: 2px solid rgba(255, 107, 53, 0.84);
          outline-offset: 1px;
        }

        :global(.calendar-schedule-block.pending) {
          border-color: rgba(255, 107, 53, 0.34);
          border-left-color: var(--accent);
          background:
            linear-gradient(
              135deg,
              rgba(255, 107, 53, 0.2),
              rgba(255, 107, 53, 0.08)
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
          font-size: 0.74rem;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.calendar-schedule-block strong) {
          overflow: hidden;
          font-size: 0.88rem;
          line-height: 1.12;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.calendar-schedule-block .calendar-status) {
          width: fit-content;
          margin-top: 0.18rem;
        }

        :global(.calendar-schedule-block.confirmed .calendar-status),
        :global(.calendar-schedule-block.completed .calendar-status) {
          display: none;
        }

        :global(.calendar-schedule-block.compact) {
          align-content: center;
          gap: 0.06rem;
          padding: 0.24rem 0.45rem;
          border-radius: 0.62rem;
        }

        :global(.calendar-schedule-block.compact .schedule-block-time) {
          font-size: 0.62rem;
          line-height: 1.05;
        }

        :global(.calendar-schedule-block.compact strong) {
          font-size: 0.74rem;
          line-height: 1.08;
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
          .calendar-workspace {
            height: calc(100dvh - 11rem);
            min-height: 32rem;
          }

          .calendar-side-panel {
            top: auto;
            right: 0.75rem;
            bottom: 0.75rem;
            left: 0.75rem;
            width: auto;
            max-height: min(70vh, 36rem);
          }
        }

        @media (max-width: 900px) {
          :global(.week-calendar) {
            grid-template-rows: minmax(0, 1fr);
            padding: 0;
            gap: 0;
            border-radius: 8px;
            background: transparent;
            box-shadow: none;
          }

          :global(.week-calendar-scroll),
          :global(.week-calendar-summary) {
            display: none;
          }
        }

        @media (max-width: 700px) {
          .calendar-workspace {
            height: calc(
              100dvh - 10.75rem - var(--mobile-workspace-dock-space, 0px)
            );
            min-height: 27rem;
          }

          .calendar-date-controls {
            justify-content: stretch;
          }

          .calendar-shell,
          .calendar-empty-state {
            padding: 0.55rem;
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

          .manual-departure-summary {
            grid-template-columns: 1fr;
          }

          .manual-group-booking-empty {
            display: grid;
            align-items: stretch;
          }

          .manual-booking-heading {
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: start;
          }

          .manual-booking-notes,
          .manual-booking-footer,
          .manual-booking-error,
          .manual-booking-warning,
          .manual-booking-staff-hint {
            grid-column: auto;
          }

          .manual-booking-actions :global(.btn),
          .manual-booking-footer :global(.btn),
          .manual-booking-actions a,
          .manual-booking-footer button {
            width: 100%;
            justify-content: center;
          }

          .manual-booking-heading :global(.btn),
          .manual-booking-heading button {
            width: auto;
            min-width: 5rem;
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

          .calendar-toolbar > div:first-child {
            display: none;
          }

          .calendar-date-controls {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 2.75rem;
            gap: 0.45rem;
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
            grid-column: 1 / -1;
            grid-row: 2;
            width: 100%;
            max-width: none;
            min-width: 0;
            padding: 0.55rem 0.7rem;
            color: var(--text);
          }

          .calendar-staff-filter {
            grid-column: 1;
            grid-row: 3;
            width: 100%;
            min-height: 2.75rem;
            padding-left: 0.25rem;
          }

          .calendar-staff-filter > span {
            display: none;
          }

          .calendar-staff-filter select {
            max-width: none;
            width: 100%;
          }

          .calendar-add-button {
            width: 2.75rem;
            min-width: 2.75rem;
            grid-column: 2;
            grid-row: 3;
            justify-content: center;
            overflow: hidden;
            padding: 0;
            color: transparent;
            position: relative;
          }

          .calendar-add-button::after {
            content: "+";
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            color: var(--bg);
            font-size: 1.35rem;
            font-weight: 900;
          }

          :global(.calendar-departures-button) {
            grid-column: 1 / -1;
            grid-row: 4;
            width: 100%;
            min-height: 2.75rem;
          }

          :global(.week-calendar) {
            grid-template-rows: minmax(0, 1fr);
            padding: 0;
            gap: 0;
            border-radius: 8px;
            background: transparent;
            box-shadow: none;
          }

          :global(.week-calendar-scroll) {
            display: none;
          }

          :global(.week-calendar-summary) {
            display: none;
          }

          :global(.mobile-week-agenda) {
            display: grid;
            gap: 0.55rem;
            min-height: 0;
            overflow-y: auto;
            padding-right: 0.12rem;
            scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
            scrollbar-width: thin;
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
            grid-template-columns: 3.65rem repeat(7, minmax(5.2rem, 1fr));
            min-width: 700px;
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

          :global(.calendar-cancel-review-actions) {
            display: grid;
          }

          :global(.calendar-cancel-review-actions .btn) {
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
