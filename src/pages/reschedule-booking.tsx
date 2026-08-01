import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AuthNav from "@/components/AuthNav";
import CustomerPortalStyles from "@/components/CustomerPortalStyles";
import { useI18n } from "@/lib/useI18n";
import { formatLocalizedDate } from "@/lib/i18n";
type Booking = {
  id: string;
  business_id: string;
  service_id: string;
  customer_user_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  start_at: string;
  duration_minutes: number;
  status: string;
  staff_member_id?: string | null;
  businesses?: {
    id: string;
    name: string;
    user_id: string;
  } | null;
  services?: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
  staff_members?: {
    id?: string;
    name: string;
    role_title?: string | null;
  } | null;
};

type StaffMember = {
  id: string;
  name: string;
  role_title?: string | null;
};

type StaffService = {
  staff_member_id: string;
  service_id: string;
};

type StaffAvailability = {
  staff_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type BusinessAvailability = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type ExistingBooking = {
  id: string;
  staff_member_id?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
};

type StaffFilter = "any" | string;

type StaffChoice = "any" | string;

type SlotOption = {
  time: string;
  staffIds: string[];
};

type CalendarDay = {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  label: string;
  shortLabel: string;
  availableStaffIds: string[];
  availableSlotCount: number;
  isBookable: boolean;
};

type Role = "customer" | "business" | null;

export default function RescheduleBooking() {
  const router = useRouter();
  const { id } = router.query;
  const { locale, profileLoaded, t } = useI18n();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<
    StaffAvailability[]
  >([]);
  const [availability, setAvailability] = useState<BusinessAvailability[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>(
    [],
  );

  const [role, setRole] = useState<Role>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [staffFilter, setStaffFilter] = useState<StaffFilter>("any");
  const [selectedStaffChoice, setSelectedStaffChoice] =
    useState<StaffChoice>("any");
  const [timeSlots, setTimeSlots] = useState<SlotOption[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadPage() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!id || Array.isArray(id)) {
      setError(
        t("reschedule.error.missingReference", "Missing booking reference."),
      );
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/customer/bookings?id=${encodeURIComponent(id)}&include=reschedule`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (!response.ok || !payload.booking) {
      setError(
        response.status === 404
          ? t("reschedule.error.notFound", "Booking not found.")
          : t(
              "reschedule.error.noPermission",
              "You do not have permission to reschedule this booking.",
            ),
      );
      setLoading(false);
      return;
    }

    const normalisedBooking = payload.booking as Booking;
    const viewerRole: Role =
      payload.viewerRole === "business" ? "business" : "customer";

    setRole(viewerRole);

    if (normalisedBooking.status === "cancelled") {
      setError(
        t(
          "reschedule.error.cancelled",
          "Cancelled bookings cannot be rescheduled.",
        ),
      );
      setLoading(false);
      return;
    }

    if (normalisedBooking.status === "completed") {
      setError(
        t(
          "reschedule.error.completed",
          "Completed bookings cannot be rescheduled.",
        ),
      );
      setLoading(false);
      return;
    }

    if (normalisedBooking.status === "pending") {
      setError(
        t(
          "reschedule.error.pending",
          "This booking is still waiting for business approval. It can be changed after it is confirmed.",
        ),
      );
      setLoading(false);
      return;
    }

    setBooking(normalisedBooking);

    const originalDate = new Date(normalisedBooking.start_at);
    const yyyy = originalDate.getFullYear();
    const mm = String(originalDate.getMonth() + 1).padStart(2, "0");
    const dd = String(originalDate.getDate()).padStart(2, "0");
    const originalDateValue = `${yyyy}-${mm}-${dd}`;
    setSelectedDate(originalDateValue);
    setCalendarMonth(
      new Date(originalDate.getFullYear(), originalDate.getMonth(), 1),
    );
    setStaffFilter("any");
    setSelectedStaffChoice("any");
    setSelectedTime("");

    const rescheduleContext = payload.rescheduleContext || {};
    setStaffMembers(rescheduleContext.staffMembers || []);
    setStaffServices(rescheduleContext.staffServices || []);
    setStaffAvailability(rescheduleContext.staffAvailability || []);
    setAvailability(rescheduleContext.availability || []);
    setExistingBookings(rescheduleContext.existingBookings || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!router.isReady || !profileLoaded) return;
    loadPage();
  }, [router.isReady, id, locale, profileLoaded]);

  function formatDateInputValue(date: Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function sameDate(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function normaliseDateValue(date: Date) {
    const cleanDate = new Date(date);
    cleanDate.setHours(0, 0, 0, 0);
    return cleanDate;
  }

  function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
  }

  function monthLabel(date: Date) {
    return formatLocalizedDate(date, locale, {
      month: "long",
      year: "numeric",
    });
  }

  function moveCalendarMonth(direction: number) {
    setCalendarMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );
  }

  function resetCalendarToToday() {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function staffThatCanDoBookingService() {
    if (!booking?.services) return [];

    return staffMembers.filter((staff) =>
      staffServices.some(
        (link) =>
          link.staff_member_id === staff.id &&
          link.service_id === booking.services?.id,
      ),
    );
  }

  function getCandidateStaff(filter: StaffFilter = staffFilter) {
    const serviceStaff = staffThatCanDoBookingService();
    if (filter === "any") return serviceStaff;
    return serviceStaff.filter((staff) => staff.id === filter);
  }

  function getBusinessDayAvailabilityForDate(dateValue: string) {
    if (!dateValue) return null;

    const day = new Date(`${dateValue}T12:00:00`).getDay();

    return availability.find((row) => row.day_of_week === day) || null;
  }

  function getStaffDayAvailabilityForDate(staffId: string, dateValue: string) {
    if (!dateValue) return null;

    const day = new Date(`${dateValue}T12:00:00`).getDay();

    const staffSpecificAvailability = staffAvailability.find(
      (row) => row.staff_member_id === staffId && row.day_of_week === day,
    );

    if (staffSpecificAvailability) return staffSpecificAvailability;

    const businessDayAvailability =
      getBusinessDayAvailabilityForDate(dateValue);

    if (!businessDayAvailability) return null;

    return {
      staff_member_id: staffId,
      day_of_week: businessDayAvailability.day_of_week,
      start_time: businessDayAvailability.start_time,
      end_time: businessDayAvailability.end_time,
      is_closed: businessDayAvailability.is_closed,
    };
  }

  function generateSlotsForStaffOnDate(staffId: string, dateValue: string) {
    if (!booking || !booking.services || !dateValue || !staffId) return [];

    const dayAvailability = getStaffDayAvailabilityForDate(staffId, dateValue);

    if (!dayAvailability || dayAvailability.is_closed) return [];

    const slots: string[] = [];
    let start = new Date(`${dateValue}T${dayAvailability.start_time}`);
    const end = new Date(`${dateValue}T${dayAvailability.end_time}`);
    const duration =
      booking.services.duration_minutes || booking.duration_minutes;
    const now = new Date();
    const slotIntervalMinutes = 15;

    while (start.getTime() + duration * 60000 <= end.getTime()) {
      const slotStart = new Date(start);
      const slotEnd = addMinutes(slotStart, duration);
      const timeString = slotStart.toTimeString().slice(0, 5);
      const isPastSlot = slotStart < now;

      const overlapsBooking = existingBookings.some((existing) => {
        if (existing.id === booking.id) return false;
        if (existing.staff_member_id !== staffId) return false;

        const bookingStart = new Date(existing.start_at);
        const bookingEnd = existing.end_at
          ? new Date(existing.end_at)
          : addMinutes(bookingStart, existing.duration_minutes);

        return slotStart < bookingEnd && slotEnd > bookingStart;
      });

      if (!isPastSlot && !overlapsBooking) {
        slots.push(timeString);
      }

      start = addMinutes(start, slotIntervalMinutes);
    }

    return slots;
  }

  function generateMergedSlots(
    dateValue: string,
    filter: StaffFilter = staffFilter,
  ) {
    if (!booking?.services || !dateValue) return [];

    const mergedSlots = getCandidateStaff(filter).reduce<
      Record<string, string[]>
    >((acc, staff) => {
      const slots = generateSlotsForStaffOnDate(staff.id, dateValue);

      slots.forEach((slot) => {
        if (!acc[slot]) acc[slot] = [];
        acc[slot].push(staff.id);
      });

      return acc;
    }, {});

    return Object.entries(mergedSlots)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, staffIds]) => ({ time, staffIds }));
  }

  function getDayAvailabilitySummary(
    dateValue: string,
    filter: StaffFilter = staffFilter,
  ) {
    const slots = generateMergedSlots(dateValue, filter);
    const availableStaffIds = Array.from(
      new Set(slots.flatMap((slot) => slot.staffIds)),
    );

    return {
      availableStaffIds,
      availableSlotCount: slots.length,
      isBookable: slots.length > 0,
    };
  }

  const selectableStaff = useMemo(
    () => staffThatCanDoBookingService(),
    [booking, staffMembers, staffServices],
  );

  const selectedStaff = useMemo(() => {
    if (selectedStaffChoice === "any") return null;
    return (
      staffMembers.find((staff) => staff.id === selectedStaffChoice) || null
    );
  }, [selectedStaffChoice, staffMembers]);

  const selectedFilterStaff = useMemo(() => {
    if (staffFilter === "any") return null;
    return staffMembers.find((staff) => staff.id === staffFilter) || null;
  }, [staffFilter, staffMembers]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return null;

    const date = new Date(`${selectedDate}T12:00:00`);
    return formatLocalizedDate(date, locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [locale, selectedDate]);

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const firstOfMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    );
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      date.setHours(0, 0, 0, 0);

      const dateString = formatDateInputValue(date);
      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
      const isToday = sameDate(date, today);
      const isPast = normaliseDateValue(date) < today;
      const availabilitySummary =
        !isPast && booking?.services
          ? getDayAvailabilitySummary(dateString, staffFilter)
          : { availableStaffIds: [], availableSlotCount: 0, isBookable: false };

      return {
        date,
        dateString,
        isCurrentMonth,
        isToday,
        isPast,
        label: formatLocalizedDate(date, locale, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        shortLabel: String(date.getDate()),
        ...availabilitySummary,
      };
    });
  }, [
    calendarMonth,
    booking,
    staffFilter,
    staffMembers,
    staffServices,
    staffAvailability,
    availability,
    existingBookings,
    locale,
  ]);

  const availableStaffForSelectedTime = useMemo(() => {
    if (!selectedTime) return [];

    const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime);
    if (!selectedSlot) return [];

    return selectableStaff.filter((staff) =>
      selectedSlot.staffIds.includes(staff.id),
    );
  }, [selectedTime, timeSlots, selectableStaff]);

  useEffect(() => {
    if (!booking || !selectedDate) {
      setTimeSlots([]);
      return;
    }

    const slots = generateMergedSlots(selectedDate, staffFilter);
    setTimeSlots(slots);

    if (selectedTime && !slots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime("");
      setSelectedStaffChoice("any");
    }
  }, [
    booking,
    selectedDate,
    staffFilter,
    staffAvailability,
    availability,
    existingBookings,
    selectableStaff,
  ]);

  function staffForSlot(slotTime: string) {
    const slot = timeSlots.find((item) => item.time === slotTime);
    if (!slot) return [];

    return selectableStaff.filter((staff) => slot.staffIds.includes(staff.id));
  }

  function resolveStaffForReschedule() {
    const slot = timeSlots.find((item) => item.time === selectedTime);
    if (!slot) return "";

    if (selectedStaffChoice !== "any") {
      return slot.staffIds.includes(selectedStaffChoice)
        ? selectedStaffChoice
        : "";
    }

    return slot.staffIds[0] || "";
  }
  function serviceName() {
    return (
      booking?.services?.name ||
      t("staff.fallback.appointment", "your appointment")
    );
  }

  function businessName() {
    return booking?.businesses?.name || t("common.business", "the business");
  }

  function appointmentDateTime(value: string) {
    return formatLocalizedDate(value, locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function bookingStatusLabel(status: string) {
    if (status === "pending")
      return t("bookingConfirmation.status.pending", "Request sent");
    if (status === "confirmed")
      return t("bookingConfirmation.status.confirmed", "Confirmed");
    if (status === "declined")
      return t("bookingConfirmation.status.declined", "Declined");
    if (status === "completed")
      return t("bookingConfirmation.status.completed", "Completed");
    if (status === "cancelled")
      return t("bookingConfirmation.status.cancelled", "Cancelled");
    return status;
  }

  function isSameStartAsCurrentBooking(value: string) {
    if (!booking) return false;

    const currentStart = new Date(booking.start_at).getTime();
    const requestedStart = new Date(value).getTime();

    return (
      Number.isFinite(currentStart) &&
      Number.isFinite(requestedStart) &&
      currentStart === requestedStart
    );
  }

  async function createCustomerNotification(params: {
    type: string;
    title: string;
    message: string;
    actionUrl: string;
    bookingRequestId?: string | null;
  }) {
    if (!booking?.customer_user_id) return;

    await supabase.from("notifications").insert({
      user_id: booking.customer_user_id,
      business_id: booking.business_id,
      booking_id: booking.id,
      booking_request_id: params.bookingRequestId || null,
      audience: "customer",
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl,
    });
  }

  async function createBusinessNotification(params: {
    type: string;
    title: string;
    message: string;
    actionUrl: string;
    bookingRequestId?: string | null;
  }) {
    if (!booking) return;

    await supabase.from("notifications").insert({
      business_id: booking.business_id,
      booking_id: booking.id,
      booking_request_id: params.bookingRequestId || null,
      audience: "business",
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl,
    });
  }

  async function saveReschedule(e: React.FormEvent) {
    e.preventDefault();

    if (!booking || !selectedDate || !selectedTime) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const staffMemberIdForReschedule = resolveStaffForReschedule();

    if (!staffMemberIdForReschedule) {
      setSaving(false);
      setError(
        t(
          "reschedule.error.chooseStaff",
          "Please choose any available staff member or one of the people available for this time.",
        ),
      );
      return;
    }

    const newStartAt = new Date(
      `${selectedDate}T${selectedTime}:00`,
    ).toISOString();
    const newDuration =
      booking.services?.duration_minutes || booking.duration_minutes;

    const freshSlots = generateSlotsForStaffOnDate(
      staffMemberIdForReschedule,
      selectedDate,
    );

    if (!freshSlots.includes(selectedTime)) {
      setSaving(false);
      setError(
        t(
          "reschedule.error.slotUnavailable",
          "This time is no longer available. Please choose another slot.",
        ),
      );
      setSelectedTime("");
      return;
    }

    const noChangeRequested =
      isSameStartAsCurrentBooking(newStartAt) &&
      (selectedStaffChoice === "any" ||
        staffMemberIdForReschedule === booking.staff_member_id);

    if (noChangeRequested) {
      setSaving(false);
      setError(
        t(
          "reschedule.error.noChange",
          "Choose a different date, time or staff member before submitting a reschedule.",
        ),
      );
      return;
    }

    let error = null;

    if (role === "customer") {
      const { data: existingPendingRequest, error: existingRequestError } =
        await supabase
          .from("booking_requests")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("requested_by", "customer")
          .eq("request_type", "reschedule")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (existingRequestError) {
        error = existingRequestError;
      } else if (existingPendingRequest?.id) {
        const result = await supabase
          .from("booking_requests")
          .update({
            requested_start_at: newStartAt,
            requested_staff_member_id: staffMemberIdForReschedule,
            requested_duration_minutes: newDuration,
            message: "Customer updated their requested appointment time.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPendingRequest.id)
          .select("id")
          .single();

        error = result.error;

        if (!error) {
          await createBusinessNotification({
            type: "reschedule_requested",
            title: t(
              "notifications.types.businessRescheduleRequested.title",
              "Reschedule request",
            ),
            message: `${booking.customer_name} updated their reschedule request for ${serviceName()} to ${appointmentDateTime(newStartAt)}.`,
            actionUrl: `/dashboard/notifications?businessId=${booking.business_id}`,
            bookingRequestId: result.data?.id || existingPendingRequest.id,
          });
        }
      } else {
        const result = await supabase
          .from("booking_requests")
          .insert({
            booking_id: booking.id,
            business_id: booking.business_id,
            customer_user_id: booking.customer_user_id,
            requested_by: "customer",
            request_type: "reschedule",
            status: "pending",
            current_start_at: booking.start_at,
            requested_start_at: newStartAt,
            current_staff_member_id: booking.staff_member_id || null,
            requested_staff_member_id: staffMemberIdForReschedule,
            requested_duration_minutes: newDuration,
            message: "Customer requested a new appointment time.",
          })
          .select("id")
          .single();

        error = result.error;

        if (!error) {
          await createBusinessNotification({
            type: "reschedule_requested",
            title: t(
              "notifications.types.businessRescheduleRequested.title",
              "Reschedule request",
            ),
            message: `${booking.customer_name} requested to move ${serviceName()} from ${appointmentDateTime(booking.start_at)} to ${appointmentDateTime(newStartAt)}.`,
            actionUrl: `/dashboard/notifications?businessId=${booking.business_id}`,
            bookingRequestId: result.data?.id || null,
          });
        }
      }
    } else {
      const result = await supabase
        .from("bookings")
        .update({
          start_at: newStartAt,
          duration_minutes: newDuration,
          staff_member_id: staffMemberIdForReschedule,
          status: "confirmed",
        })
        .eq("id", booking.id);

      error = result.error;

      if (!error) {
        const { error: cancelOtherRequestsError } = await supabase
          .from("booking_requests")
          .update({
            status: "cancelled",
            response_message:
              "Cancelled automatically because the business rescheduled this booking directly.",
            updated_at: new Date().toISOString(),
          })
          .eq("booking_id", booking.id)
          .eq("status", "pending");

        error = cancelOtherRequestsError;
      }
      if (!error) {
        await createCustomerNotification({
          type: "booking_rescheduled_by_business",
          title: t(
            "notifications.types.bookingRescheduledByBusiness.title",
            "Booking rescheduled",
          ),
          message: `${businessName()} moved your ${serviceName()} booking from ${appointmentDateTime(booking.start_at)} to ${appointmentDateTime(newStartAt)}.`,
          actionUrl: `/booking-confirmation?id=${booking.id}`,
        });
      }
    }

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      role === "business"
        ? t("reschedule.success.business", "Booking rescheduled successfully.")
        : t(
            "reschedule.success.customer",
            "Reschedule request sent to the business for approval.",
          ),
    );

    if (role === "business") {
      router.replace(`/dashboard/bookings?businessId=${booking.business_id}`);
    } else {
      router.replace("/my-bookings?requestSent=1");
    }
  }

  const newDuration =
    booking?.services?.duration_minutes || booking?.duration_minutes || 0;
  const requestedStart =
    selectedDate && selectedTime
      ? new Date(`${selectedDate}T${selectedTime}:00`)
      : null;
  const requestedEnd = requestedStart
    ? new Date(requestedStart.getTime() + newDuration * 60000)
    : null;
  const requestedStartIso = requestedStart?.toISOString() || "";
  const requestedStaffMemberId =
    selectedDate && selectedTime ? resolveStaffForReschedule() : "";
  const noChangeSelected =
    Boolean(requestedStartIso && booking) &&
    isSameStartAsCurrentBooking(requestedStartIso) &&
    (selectedStaffChoice === "any" ||
      requestedStaffMemberId === booking?.staff_member_id);
  const useCustomerSurface = role !== "business";

  return (
    <main
      className={
        useCustomerSurface
          ? "marketplace-surface customer-portal-surface"
          : undefined
      }
    >
      {useCustomerSurface && <CustomerPortalStyles />}
      <AuthNav />

      <section
        className={
          useCustomerSurface
            ? "container customer-page-container"
            : "container reschedule-business-container"
        }
      >
        {loading && (
          <div className="card">
            <p className="muted">
              {t("reschedule.loading", "Loading Mirëbook booking...")}
            </p>
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{ borderColor: "rgba(255,77,109,0.35)" }}
          >
            <h1 className="page-title">
              {t("reschedule.error.title", "Cannot reschedule")}
            </h1>
            <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>
              {error}
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "1rem",
                flexWrap: "wrap",
              }}
            >
              <Link href="/my-bookings" className="btn btn-accent">
                {t("nav.myBookings", "My bookings")}
              </Link>

              {role === "business" && (
                <Link href="/dashboard/bookings" className="btn btn-ghost">
                  {t(
                    "reschedule.actions.businessBookings",
                    "Business bookings",
                  )}
                </Link>
              )}
            </div>
          </div>
        )}

        {!loading && !error && booking && (
          <div className="reschedule-shell">
            <header className="reschedule-intro">
              <p className="reschedule-kicker">
                {role === "business"
                  ? t("reschedule.kicker.business", "Business reschedule")
                  : t(
                      "reschedule.kicker.customer",
                      "Customer reschedule request",
                    )}
              </p>
              <h1 className="page-title">
                {t("reschedule.title", "Reschedule booking")}
              </h1>
              <p className="page-sub">
                {role === "business"
                  ? t(
                      "reschedule.subtitle.business",
                      "Choose an available date, time and staff member. This updates the booking immediately.",
                    )
                  : t(
                      "reschedule.subtitle.customer",
                      "Choose an available date, time and staff member. Your original appointment stays confirmed until the business approves the change.",
                    )}
              </p>
            </header>

            <div
              className={`reschedule-mode-banner ${
                role === "business" ? "is-direct" : "is-approval"
              }`}
            >
              <span className="reschedule-mode-icon" aria-hidden="true">
                <Check size={18} strokeWidth={2.5} />
              </span>
              <div>
                <p className="reschedule-mode-label">
                  {role === "business"
                    ? t("reschedule.mode.direct", "Direct reschedule")
                    : t("reschedule.mode.approval", "Approval required")}
                </p>
                <strong>
                  {role === "business"
                    ? t(
                        "reschedule.mode.businessBody",
                        "Saving here immediately changes the customer booking.",
                      )
                    : t(
                        "reschedule.mode.customerBody",
                        "Your original appointment stays confirmed until the business accepts your new requested time.",
                      )}
                </strong>
                <p className="small muted">
                  {role === "business"
                    ? t(
                        "reschedule.mode.businessNotification",
                        "Mirëbook will notify the customer after you save the new appointment time.",
                      )
                    : t(
                        "reschedule.mode.customerNotification",
                        "Mirëbook will notify the business when you send or update a reschedule request.",
                      )}
                </p>
              </div>
            </div>

            {success && (
              <div
                className="card"
                style={{
                  borderColor: "rgba(45,212,191,0.35)",
                  background: "rgba(45,212,191,0.06)",
                }}
              >
                <p className="small" style={{ color: "var(--success)" }}>
                  {success}
                </p>
              </div>
            )}

            <section className="card reschedule-current-card">
              <div className="reschedule-section-heading">
                <span className="reschedule-section-icon" aria-hidden="true">
                  <CalendarDays size={19} />
                </span>
                <h2>{t("reschedule.current.title", "Current booking")}</h2>
              </div>

              <div className="reschedule-current-grid">
                <div className="reschedule-current-item">
                  <p className="small muted">
                    {t("common.business", "Business")}
                  </p>
                  <strong>
                    {booking.businesses?.name ||
                      t("common.business", "Business")}
                  </strong>
                </div>

                <div className="reschedule-current-item">
                  <p className="small muted">
                    {t("common.service", "Service")}
                  </p>
                  <strong>
                    {booking.services?.name || t("common.service", "Service")}
                  </strong>
                </div>

                <div className="reschedule-current-item">
                  <p className="small muted">
                    {t("reschedule.current.staff", "Current staff member")}
                  </p>
                  <strong>
                    {booking.staff_members?.name ||
                      t("dashboardBookings.card.noStaff", "Staff not recorded")}
                    {booking.staff_members?.role_title
                      ? ` — ${booking.staff_members.role_title}`
                      : ""}
                  </strong>
                </div>

                <div className="reschedule-current-item">
                  <p className="small muted">
                    {t("reschedule.current.time", "Current time")}
                  </p>
                  <strong>{appointmentDateTime(booking.start_at)}</strong>
                </div>

                <div className="reschedule-current-item">
                  <p className="small muted">{t("common.status", "Status")}</p>
                  <strong>{bookingStatusLabel(booking.status)}</strong>
                </div>

                <div className="reschedule-current-item">
                  <p className="small muted">
                    {t("common.customer", "Customer")}
                  </p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                </div>
              </div>
            </section>

            <section
              className={`reschedule-selection-summary ${
                requestedStart ? "has-selection" : ""
              }`}
              aria-live="polite"
            >
              <span className="reschedule-selection-icon" aria-hidden="true">
                <Clock3 size={21} />
              </span>
              <div>
                <p className="small muted">
                  {t("reschedule.requested.title", "New requested appointment")}
                </p>
                <h2>
                  {requestedStart
                    ? `${appointmentDateTime(requestedStart.toISOString())}${requestedEnd ? ` - ${formatLocalizedDate(requestedEnd, locale, { hour: "2-digit", minute: "2-digit" })}` : ""}`
                    : t(
                        "reschedule.requested.chooseDateTime",
                        "Choose a new date and time",
                      )}
                </h2>
                <p className="small muted">
                  {selectedTime
                    ? selectedStaff
                      ? `${t("reschedule.requested.staffPrefix", "Staff")}: ${selectedStaff.name}${selectedStaff.role_title ? ` — ${selectedStaff.role_title}` : ""}`
                      : availableStaffForSelectedTime.length === 1
                        ? `${t("reschedule.requested.assignedAutomatically", "Assigned automatically")}: ${availableStaffForSelectedTime[0].name}`
                        : `${t("reschedule.requested.anyAvailableStaff", "Any available staff")} · ${availableStaffForSelectedTime.length} ${t("reschedule.requested.staffAvailable", "staff available")}`
                    : t(
                        "reschedule.requested.chooseStaff",
                        "Choose a time, then select any available staff member or a specific person.",
                      )}
                </p>
                <p className="reschedule-selection-service">
                  {booking.services?.name || t("common.service", "Service")} ·{" "}
                  {newDuration} {t("common.minutes", "minutes")}
                </p>
              </div>
            </section>

            <form
              onSubmit={saveReschedule}
              className="card reschedule-form-card"
            >
              <div className="reschedule-form-heading">
                <h2>{t("reschedule.form.title", "New appointment time")}</h2>
                <p className="small muted">
                  {t(
                    "reschedule.form.guidance",
                    "Choose a date, time and available staff member.",
                  )}
                </p>
              </div>

              <section className="reschedule-form-section">
                <div className="reschedule-form-section-title">
                  <CalendarDays size={18} aria-hidden="true" />
                  <label>
                    {t("reschedule.form.calendar", "Available dates")}
                  </label>
                </div>

                {selectableStaff.length === 0 && (
                  <p className="reschedule-empty-note small muted">
                    {t(
                      "reschedule.form.noAssignedStaff",
                      "This booking cannot be rescheduled yet because no active staff are assigned to this service.",
                    )}
                  </p>
                )}

                {selectableStaff.length > 0 && (
                  <div className="reschedule-calendar-card">
                    <div className="reschedule-calendar-toolbar">
                      <button
                        type="button"
                        onClick={() => moveCalendarMonth(-1)}
                        className="reschedule-icon-button"
                        aria-label={t(
                          "reschedule.calendar.previousMonth",
                          "Previous month",
                        )}
                      >
                        <ChevronLeft size={20} aria-hidden="true" />
                      </button>

                      <div className="reschedule-calendar-month-copy">
                        <strong>{monthLabel(calendarMonth)}</strong>
                        <p className="small muted">
                          {t(
                            "reschedule.calendar.disabledDaysHint",
                            "Mirëbook disables days that cannot fit this service.",
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => moveCalendarMonth(1)}
                        className="reschedule-icon-button"
                        aria-label={t(
                          "reschedule.calendar.nextMonth",
                          "Next month",
                        )}
                      >
                        <ChevronRight size={20} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="reschedule-calendar-return">
                      <button
                        type="button"
                        onClick={resetCalendarToToday}
                        className="btn btn-ghost"
                      >
                        {t(
                          "reschedule.calendar.currentMonth",
                          "Back to this month",
                        )}
                      </button>
                    </div>

                    <div className="reschedule-staff-filter">
                      <label className="small muted">
                        {t(
                          "reschedule.calendar.staffFilter",
                          "Optional staff filter",
                        )}
                      </label>
                      <div className="reschedule-staff-filter-grid">
                        <button
                          type="button"
                          className={`reschedule-choice-card ${
                            staffFilter === "any" ? "is-selected" : ""
                          }`}
                          aria-pressed={staffFilter === "any"}
                          onClick={() => {
                            setStaffFilter("any");
                            setSelectedDate("");
                            setSelectedTime("");
                            setSelectedStaffChoice("any");
                          }}
                        >
                          <strong>
                            {t("reschedule.calendar.anyStaff", "Any staff")}
                          </strong>
                          <p className="small muted">
                            {t(
                              "reschedule.calendar.allDays",
                              "Show all bookable days",
                            )}
                          </p>
                        </button>

                        {selectableStaff.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            className={`reschedule-choice-card ${
                              staffFilter === staff.id ? "is-selected" : ""
                            }`}
                            aria-pressed={staffFilter === staff.id}
                            onClick={() => {
                              setStaffFilter(staff.id);
                              setSelectedDate("");
                              setSelectedTime("");
                              setSelectedStaffChoice("any");
                            }}
                          >
                            <strong>{staff.name}</strong>
                            <p className="small muted">
                              {staff.role_title ||
                                t("staff.fallback.member", "Staff member")}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="reschedule-calendar-weekdays">
                      {[
                        t("calendar.weekdays.sun", "Sun"),
                        t("calendar.weekdays.mon", "Mon"),
                        t("calendar.weekdays.tue", "Tue"),
                        t("calendar.weekdays.wed", "Wed"),
                        t("calendar.weekdays.thu", "Thu"),
                        t("calendar.weekdays.fri", "Fri"),
                        t("calendar.weekdays.sat", "Sat"),
                      ].map((day) => (
                        <p key={day} className="small muted">
                          {day}
                        </p>
                      ))}
                    </div>

                    <div className="reschedule-calendar-grid">
                      {calendarDays.map((day) => {
                        const isSelected = selectedDate === day.dateString;
                        const isDisabled = day.isPast || !day.isBookable;

                        return (
                          <button
                            key={day.dateString}
                            type="button"
                            disabled={isDisabled}
                            aria-pressed={isSelected}
                            className={[
                              "reschedule-calendar-day",
                              isSelected ? "is-selected" : "",
                              day.isToday ? "is-today" : "",
                              !day.isCurrentMonth ? "is-outside" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => {
                              setSelectedDate(day.dateString);
                              setSelectedTime("");
                              setSelectedStaffChoice("any");
                            }}
                            title={
                              day.isBookable
                                ? `${day.label} · ${day.availableSlotCount} ${t("reschedule.calendar.slots", "slots")}`
                                : `${day.label} · ${t("reschedule.calendar.unavailable", "unavailable")}`
                            }
                          >
                            <span>{day.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDateLabel && (
                      <p className="reschedule-selected-date small muted">
                        {t("reschedule.calendar.selected", "Selected")}:{" "}
                        <strong>{selectedDateLabel}</strong>
                        {staffFilter !== "any" && selectedFilterStaff
                          ? ` · ${t("reschedule.calendar.filteredTo", "filtered to")} ${selectedFilterStaff.name}`
                          : ""}
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section className="reschedule-form-section">
                <div className="reschedule-form-section-title">
                  <Clock3 size={18} aria-hidden="true" />
                  <label>
                    {t("reschedule.times.title", "Available times")}
                  </label>
                </div>

                {!selectedDate && (
                  <p className="reschedule-empty-note small muted">
                    {t(
                      "reschedule.times.chooseDate",
                      "Choose an available date first.",
                    )}
                  </p>
                )}

                {selectedDate && timeSlots.length === 0 && (
                  <p className="reschedule-empty-note small muted">
                    {t(
                      "reschedule.times.empty",
                      "No free times are available for this service on the selected date.",
                    )}
                  </p>
                )}

                <div className="reschedule-time-grid">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={`reschedule-time-button ${
                        selectedTime === slot.time ? "is-selected" : ""
                      }`}
                      aria-pressed={selectedTime === slot.time}
                      onClick={() => {
                        setSelectedTime(slot.time);
                        setSelectedStaffChoice("any");
                      }}
                    >
                      <span>{slot.time}</span>
                      {slot.staffIds.length > 1 && (
                        <small>
                          {slot.staffIds.length}{" "}
                          {t("reschedule.times.available", "available")}
                        </small>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section className="reschedule-form-section">
                <div className="reschedule-form-section-title">
                  <UserRound size={18} aria-hidden="true" />
                  <label>{t("reschedule.staff.title", "Staff choice")}</label>
                </div>

                {!selectedDate && (
                  <p className="reschedule-empty-note small muted">
                    {t("reschedule.staff.chooseDate", "Select a date first.")}
                  </p>
                )}

                {selectedDate && !selectedTime && (
                  <p className="reschedule-empty-note small muted">
                    {t(
                      "reschedule.staff.chooseTime",
                      "Choose a time first, then select any available staff member or a specific person.",
                    )}
                  </p>
                )}

                {selectedDate && selectedTime && (
                  <div className="reschedule-staff-choices">
                    <div className="reschedule-availability-note">
                      <p className="small muted">
                        {t("reschedule.staff.availableFor", "Available for")}{" "}
                        {selectedTime}
                      </p>
                      <strong>
                        {availableStaffForSelectedTime.length === 1
                          ? `${availableStaffForSelectedTime[0].name} ${t("reschedule.staff.isAvailable", "is available")}`
                          : `${availableStaffForSelectedTime.length} ${t("reschedule.staff.availableCount", "staff available")}`}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className={`reschedule-staff-choice ${
                        selectedStaffChoice === "any" ? "is-selected" : ""
                      }`}
                      aria-pressed={selectedStaffChoice === "any"}
                      onClick={() => setSelectedStaffChoice("any")}
                    >
                      <span className="reschedule-staff-choice-icon">
                        <UserRound size={18} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>
                          {t(
                            "publicBusiness.staff.anyAvailable",
                            "Any available staff",
                          )}
                        </strong>
                        <small className="muted">
                          {t(
                            "reschedule.staff.autoAssign",
                            "Mirëbook will assign one of the available staff members for this exact time.",
                          )}
                        </small>
                      </span>
                      {selectedStaffChoice === "any" && (
                        <Check
                          className="reschedule-choice-check"
                          size={18}
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    {availableStaffForSelectedTime.map((staff) => {
                      const isSelected = selectedStaffChoice === staff.id;

                      return (
                        <button
                          key={staff.id}
                          type="button"
                          className={`reschedule-staff-choice ${
                            isSelected ? "is-selected" : ""
                          }`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedStaffChoice(staff.id)}
                        >
                          <span className="reschedule-staff-choice-icon">
                            <UserRound size={18} aria-hidden="true" />
                          </span>
                          <span>
                            <strong>{staff.name}</strong>
                            <small className="muted">
                              {staff.role_title ||
                                t("staff.fallback.member", "Staff member")}
                              {` · ${t("reschedule.availableAt", "Available at")} ${selectedTime}`}
                            </small>
                          </span>
                          {isSelected && (
                            <Check
                              className="reschedule-choice-check"
                              size={18}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedDate ||
                  !selectedTime ||
                  !selectedStaffChoice ||
                  noChangeSelected
                }
                className="btn btn-accent reschedule-submit"
              >
                {saving
                  ? role === "customer"
                    ? t("reschedule.actions.sending", "Sending request...")
                    : t("reschedule.actions.saving", "Saving new time...")
                  : role === "customer"
                    ? t(
                        "reschedule.actions.sendRequest",
                        "Send reschedule request",
                      )
                    : t(
                        "reschedule.actions.saveTime",
                        "Save new appointment time",
                      )}
              </button>
              {noChangeSelected && (
                <p className="small" style={{ color: "var(--warning)" }}>
                  {t(
                    "reschedule.error.noChange",
                    "Choose a different date, time or staff member before submitting a reschedule.",
                  )}
                </p>
              )}
            </form>

            <div className="reschedule-back-actions">
              {role === "business" ? (
                <Link
                  href={`/dashboard/bookings?businessId=${booking.business_id}`}
                  className="btn btn-ghost"
                >
                  {t(
                    "reschedule.actions.backBusiness",
                    "Back to business bookings",
                  )}
                </Link>
              ) : (
                <Link href="/my-bookings" className="btn btn-ghost">
                  {t("reschedule.actions.backCustomer", "Back to my bookings")}
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .reschedule-business-container {
          padding: 30px 24px 72px;
        }

        .reschedule-shell {
          width: min(100%, 940px);
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .reschedule-intro {
          display: grid;
          gap: 0.55rem;
          padding: 0.35rem 0 0.75rem;
        }

        .reschedule-intro :global(.page-sub) {
          margin: 0;
        }

        .reschedule-kicker {
          margin: 0;
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .reschedule-mode-banner {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.8rem;
          align-items: flex-start;
          padding: 0.95rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .reschedule-mode-banner.is-direct {
          border-color: rgba(20, 125, 112, 0.24);
          background: rgba(20, 125, 112, 0.06);
        }

        .reschedule-mode-banner.is-approval {
          border-color: rgba(237, 90, 42, 0.22);
          background: rgba(237, 90, 42, 0.05);
        }

        .reschedule-mode-banner p,
        .reschedule-mode-banner strong {
          margin: 0;
        }

        .reschedule-mode-banner .muted {
          margin-top: 0.32rem;
          line-height: 1.5;
        }

        .reschedule-mode-icon,
        .reschedule-section-icon,
        .reschedule-selection-icon,
        .reschedule-staff-choice-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .reschedule-mode-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: var(--surface);
          color: var(--accent);
        }

        .is-direct .reschedule-mode-icon {
          color: var(--success);
        }

        .reschedule-mode-label {
          margin-bottom: 0.2rem !important;
          color: var(--accent);
          font-size: 0.74rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .is-direct .reschedule-mode-label {
          color: var(--success);
        }

        .reschedule-current-card {
          padding: 1rem;
        }

        .reschedule-section-heading,
        .reschedule-form-section-title {
          display: flex;
          gap: 0.55rem;
          align-items: center;
        }

        .reschedule-section-heading {
          margin-bottom: 0.85rem;
        }

        .reschedule-section-heading h2,
        .reschedule-form-heading h2,
        .reschedule-selection-summary h2 {
          margin: 0;
          font-family: var(--font-body);
          letter-spacing: 0;
        }

        .reschedule-section-heading h2,
        .reschedule-form-heading h2 {
          font-size: 1.2rem;
        }

        .reschedule-section-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 7px;
          background: var(--surface-2);
          color: var(--accent);
        }

        .reschedule-current-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }

        .reschedule-current-item {
          min-width: 0;
          padding: 0.75rem;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .reschedule-current-item p,
        .reschedule-current-item strong {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .reschedule-current-item strong {
          display: block;
          margin-top: 0.2rem;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .reschedule-selection-summary {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.85rem;
          align-items: flex-start;
          padding: 1rem;
          border: 1px dashed var(--border-2);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .reschedule-selection-summary.has-selection {
          border-style: solid;
          border-color: rgba(237, 90, 42, 0.28);
          background: rgba(237, 90, 42, 0.05);
        }

        .reschedule-selection-icon {
          width: 2.5rem;
          height: 2.5rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--accent);
        }

        .reschedule-selection-summary p,
        .reschedule-selection-summary h2 {
          margin: 0;
        }

        .reschedule-selection-summary h2 {
          margin-top: 0.16rem;
          font-size: clamp(1.1rem, 2.5vw, 1.4rem);
          line-height: 1.25;
        }

        .reschedule-selection-summary .muted {
          margin-top: 0.28rem;
        }

        .reschedule-selection-service {
          margin-top: 0.42rem !important;
          color: var(--text);
          font-size: 0.78rem;
          font-weight: 750;
        }

        .reschedule-form-card {
          display: grid;
          gap: 0;
          padding: 1rem;
          margin-bottom: 2rem;
        }

        .reschedule-form-heading {
          display: grid;
          gap: 0.22rem;
          padding-bottom: 1rem;
        }

        .reschedule-form-heading p {
          margin: 0;
        }

        .reschedule-form-section {
          display: grid;
          gap: 0.75rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
        }

        .reschedule-form-section-title {
          color: var(--text);
        }

        .reschedule-form-section-title :global(svg) {
          color: var(--accent);
        }

        .reschedule-form-section-title label {
          font-size: 0.95rem;
          font-weight: 800;
        }

        .reschedule-empty-note {
          margin: 0;
          padding: 0.8rem;
          border-radius: 8px;
          background: var(--surface-2);
        }

        .reschedule-calendar-card {
          display: grid;
          gap: 0.85rem;
          padding: 0.9rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .reschedule-calendar-toolbar {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 44px;
          gap: 0.6rem;
          align-items: center;
        }

        .reschedule-icon-button {
          display: inline-flex;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
        }

        .reschedule-calendar-month-copy {
          min-width: 0;
          text-align: center;
        }

        .reschedule-calendar-month-copy strong,
        .reschedule-calendar-month-copy p {
          margin: 0;
        }

        .reschedule-calendar-month-copy p {
          margin-top: 0.16rem;
          line-height: 1.35;
        }

        .reschedule-calendar-return {
          display: flex;
          justify-content: center;
        }

        .reschedule-calendar-return :global(.btn) {
          min-height: 40px;
          padding: 0.45rem 0.75rem;
        }

        .reschedule-staff-filter {
          display: grid;
          gap: 0.45rem;
          padding: 0.85rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .reschedule-staff-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
        }

        .reschedule-choice-card {
          min-height: 64px;
          padding: 0.65rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .reschedule-choice-card.is-selected {
          border-color: rgba(237, 90, 42, 0.5);
          background: var(--accent-dim);
          box-shadow: inset 3px 0 0 var(--accent);
        }

        .reschedule-choice-card strong,
        .reschedule-choice-card p {
          display: block;
          margin: 0;
          line-height: 1.35;
        }

        .reschedule-choice-card p {
          margin-top: 0.15rem;
        }

        .reschedule-calendar-weekdays,
        .reschedule-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.35rem;
        }

        .reschedule-calendar-weekdays p {
          margin: 0;
          text-align: center;
          font-weight: 750;
        }

        .reschedule-calendar-day {
          min-width: 0;
          min-height: 48px;
          padding: 0.25rem;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface);
          color: var(--text);
          font-weight: 650;
          cursor: pointer;
        }

        .reschedule-calendar-day.is-today {
          border-color: rgba(20, 125, 112, 0.45);
        }

        .reschedule-calendar-day.is-outside {
          color: var(--text-muted);
          opacity: 0.55;
        }

        .reschedule-calendar-day.is-selected {
          border-color: var(--accent);
          background: var(--accent);
          color: #fff;
          font-weight: 850;
          opacity: 1;
        }

        .reschedule-calendar-day:disabled {
          background: transparent;
          color: var(--text-faint);
          opacity: 0.34;
          cursor: not-allowed;
        }

        .reschedule-selected-date {
          margin: 0;
          padding-top: 0.1rem;
        }

        .reschedule-selected-date strong {
          color: var(--text);
        }

        .reschedule-time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
          gap: 0.5rem;
        }

        .reschedule-time-button {
          display: grid;
          min-height: 48px;
          place-items: center;
          padding: 0.5rem;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface-2);
          color: var(--text);
          font: inherit;
          font-weight: 750;
          cursor: pointer;
        }

        .reschedule-time-button small {
          display: block;
          font-size: 0.68rem;
          font-weight: 650;
          opacity: 0.76;
        }

        .reschedule-time-button.is-selected {
          border-color: var(--accent);
          background: var(--accent);
          color: #fff;
        }

        .reschedule-staff-choices {
          display: grid;
          gap: 0.55rem;
        }

        .reschedule-availability-note {
          padding: 0.75rem 0.85rem;
          border-radius: 8px;
          background: var(--surface-2);
        }

        .reschedule-availability-note p,
        .reschedule-availability-note strong {
          margin: 0;
        }

        .reschedule-availability-note strong {
          display: block;
          margin-top: 0.14rem;
        }

        .reschedule-staff-choice {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.7rem;
          align-items: center;
          min-height: 68px;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .reschedule-staff-choice.is-selected {
          border-color: rgba(237, 90, 42, 0.5);
          background: var(--accent-dim);
        }

        .reschedule-staff-choice-icon {
          width: 2.3rem;
          height: 2.3rem;
          border-radius: 50%;
          background: var(--surface-2);
          color: var(--text-muted);
        }

        .reschedule-staff-choice > span:nth-child(2) {
          display: grid;
          gap: 0.15rem;
          min-width: 0;
        }

        .reschedule-staff-choice strong,
        .reschedule-staff-choice small {
          overflow-wrap: anywhere;
        }

        .reschedule-staff-choice :global(.reschedule-choice-check) {
          color: var(--accent);
        }

        .reschedule-submit {
          justify-self: flex-start;
          min-width: 220px;
          margin-top: 1rem;
        }

        .reschedule-back-actions {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .reschedule-icon-button:hover,
        .reschedule-choice-card:hover,
        .reschedule-calendar-day:not(:disabled):hover,
        .reschedule-time-button:hover,
        .reschedule-staff-choice:hover {
          border-color: var(--border-2);
        }

        .reschedule-icon-button:focus-visible,
        .reschedule-choice-card:focus-visible,
        .reschedule-calendar-day:focus-visible,
        .reschedule-time-button:focus-visible,
        .reschedule-staff-choice:focus-visible {
          outline: 3px solid rgba(237, 90, 42, 0.2);
          outline-offset: 2px;
        }

        @media (max-width: 700px) {
          .reschedule-business-container {
            padding: 22px 14px 64px;
          }

          .reschedule-current-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .reschedule-form-card,
          .reschedule-current-card {
            padding: 0.9rem;
          }

          .reschedule-staff-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .reschedule-intro {
            padding-top: 0;
          }

          .reschedule-mode-banner,
          .reschedule-selection-summary {
            padding: 0.85rem;
          }

          .reschedule-current-grid {
            grid-template-columns: 1fr;
          }

          .reschedule-calendar-card {
            padding: 0.65rem !important;
          }

          .reschedule-staff-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .reschedule-calendar-weekdays,
          .reschedule-calendar-grid {
            gap: 0.25rem !important;
          }

          .reschedule-calendar-grid button {
            min-height: 42px !important;
            border-radius: 6px !important;
            padding: 0.15rem !important;
          }

          .reschedule-calendar-month-copy p {
            display: none;
          }

          .reschedule-time-grid {
            grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
          }

          .reschedule-submit,
          .reschedule-back-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
