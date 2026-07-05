import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";
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
  const { t } = useI18n();

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
        (typeof payload.error === "string" && payload.error) ||
          t("reschedule.error.notFound", "Booking not found."),
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
    if (!router.isReady) return;
    loadPage();
  }, [router.isReady, id]);

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
    return date.toLocaleDateString(undefined, {
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
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [selectedDate]);

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
        label: date.toLocaleDateString(undefined, {
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
    return booking?.services?.name || "your appointment";
  }

  function businessName() {
    return booking?.businesses?.name || "the business";
  }

  function appointmentDateTime(value: string) {
    return new Date(value).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

    if (
      newStartAt === booking.start_at &&
      staffMemberIdForReschedule === booking.staff_member_id
    ) {
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
  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "42px 24px 128px" }}>
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
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              display: "grid",
              gap: "1rem",
            }}
          >
            <div>
              <p className="small muted">
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
              <p className="page-sub" style={{ marginTop: "0.5rem" }}>
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
            </div>

            <div
              className="card"
              style={{
                borderColor:
                  role === "business"
                    ? "rgba(45,212,191,0.28)"
                    : "rgba(255,107,53,0.28)",
                background:
                  role === "business"
                    ? "rgba(45,212,191,0.06)"
                    : "var(--accent-dim)",
              }}
            >
              <p
                className="small"
                style={{
                  color:
                    role === "business" ? "var(--success)" : "var(--accent)",
                }}
              >
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
              <p className="small muted" style={{ marginTop: "0.45rem" }}>
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

            <div className="card">
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  marginBottom: "1rem",
                }}
              >
                {t("reschedule.current.title", "Current booking")}
              </h2>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <p className="small muted">
                    {t("common.business", "Business")}
                  </p>
                  <strong>
                    {booking.businesses?.name ||
                      t("common.business", "Business")}
                  </strong>
                </div>

                <div>
                  <p className="small muted">
                    {t("common.service", "Service")}
                  </p>
                  <strong>
                    {booking.services?.name || t("common.service", "Service")}
                  </strong>
                </div>

                <div>
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

                <div>
                  <p className="small muted">
                    {t("reschedule.current.time", "Current time")}
                  </p>
                  <strong>{appointmentDateTime(booking.start_at)}</strong>
                </div>

                <div>
                  <p className="small muted">{t("common.status", "Status")}</p>
                  <strong style={{ textTransform: "capitalize" }}>
                    {booking.status}
                  </strong>
                </div>

                <div>
                  <p className="small muted">
                    {t("common.customer", "Customer")}
                  </p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: "var(--surface-2)" }}>
              <p className="small muted">
                {t("reschedule.requested.title", "New requested appointment")}
              </p>
              <h3 style={{ marginTop: "0.25rem" }}>
                {requestedStart
                  ? `${appointmentDateTime(requestedStart.toISOString())}${requestedEnd ? ` - ${requestedEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`
                  : t(
                      "reschedule.requested.chooseDateTime",
                      "Choose a new date and time",
                    )}
              </h3>
              <p className="small muted" style={{ marginTop: "0.45rem" }}>
                {selectedTime
                  ? selectedStaff
                    ? `Staff: ${selectedStaff.name}${selectedStaff.role_title ? ` — ${selectedStaff.role_title}` : ""}`
                    : availableStaffForSelectedTime.length === 1
                      ? `Assigned automatically: ${availableStaffForSelectedTime[0].name}`
                      : `Any available staff · ${availableStaffForSelectedTime.length} staff can do this time`
                  : t(
                      "reschedule.requested.chooseStaff",
                      "Choose a time, then select any available staff member or a specific person.",
                    )}
              </p>
              <p className="small muted">
                {booking.services?.name || t("common.service", "Service")} ·{" "}
                {newDuration} {t("common.minutes", "minutes")}
              </p>
            </div>

            <form
              onSubmit={saveReschedule}
              className="card reschedule-form-card"
            >
              <h2 style={{ fontFamily: "var(--font-display)" }}>
                {t("reschedule.form.title", "New appointment time")}
              </h2>

              <div>
                <label className="small muted">
                  {t("reschedule.form.calendar", "Available dates")}
                </label>

                {selectableStaff.length === 0 && (
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    This booking cannot be rescheduled yet because no active
                    staff are assigned to this service.
                  </p>
                )}

                {selectableStaff.length > 0 && (
                  <div
                    className="card reschedule-calendar-card"
                    style={{
                      background: "var(--surface-2)",
                      padding: "0.9rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => moveCalendarMonth(-1)}
                        className="btn btn-ghost"
                        style={{ padding: "0.5rem 0.7rem" }}
                      >
                        ←
                      </button>

                      <div style={{ textAlign: "center" }}>
                        <strong>{monthLabel(calendarMonth)}</strong>
                        <p className="small muted">
                          Mirëbook disables days that cannot fit this service.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => moveCalendarMonth(1)}
                        className="btn btn-ghost"
                        style={{ padding: "0.5rem 0.7rem" }}
                      >
                        →
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={resetCalendarToToday}
                        className="btn btn-ghost"
                        style={{ padding: "0.45rem 0.75rem" }}
                      >
                        {t(
                          "reschedule.calendar.currentMonth",
                          "Back to this month",
                        )}
                      </button>
                    </div>

                    <div style={{ marginBottom: "0.85rem" }}>
                      <label className="small muted">
                        {t(
                          "reschedule.calendar.staffFilter",
                          "Optional staff filter",
                        )}
                      </label>
                      <div
                        className="reschedule-staff-filter-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: "0.5rem",
                          marginTop: "0.45rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setStaffFilter("any");
                            setSelectedDate("");
                            setSelectedTime("");
                            setSelectedStaffChoice("any");
                          }}
                          style={{
                            textAlign: "left",
                            padding: "0.7rem",
                            borderRadius: 14,
                            border:
                              staffFilter === "any"
                                ? "1px solid rgba(255,107,53,0.55)"
                                : "1px solid var(--border)",
                            background:
                              staffFilter === "any"
                                ? "var(--accent-dim)"
                                : "var(--surface)",
                            color: "var(--text)",
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
                            onClick={() => {
                              setStaffFilter(staff.id);
                              setSelectedDate("");
                              setSelectedTime("");
                              setSelectedStaffChoice("any");
                            }}
                            style={{
                              textAlign: "left",
                              padding: "0.7rem",
                              borderRadius: 14,
                              border:
                                staffFilter === staff.id
                                  ? "1px solid rgba(255,107,53,0.55)"
                                  : "1px solid var(--border)",
                              background:
                                staffFilter === staff.id
                                  ? "var(--accent-dim)"
                                  : "var(--surface)",
                              color: "var(--text)",
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

                    <div
                      className="reschedule-calendar-weekdays"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "0.35rem",
                        marginBottom: "0.35rem",
                      }}
                    >
                      {[
                        t("calendar.weekdays.sun", "Sun"),
                        t("calendar.weekdays.mon", "Mon"),
                        t("calendar.weekdays.tue", "Tue"),
                        t("calendar.weekdays.wed", "Wed"),
                        t("calendar.weekdays.thu", "Thu"),
                        t("calendar.weekdays.fri", "Fri"),
                        t("calendar.weekdays.sat", "Sat"),
                      ].map((day) => (
                        <p
                          key={day}
                          className="small muted"
                          style={{ textAlign: "center", fontWeight: 700 }}
                        >
                          {day}
                        </p>
                      ))}
                    </div>

                    <div
                      className="reschedule-calendar-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: "0.35rem",
                      }}
                    >
                      {calendarDays.map((day) => {
                        const isSelected = selectedDate === day.dateString;
                        const isDisabled = day.isPast || !day.isBookable;

                        return (
                          <button
                            key={day.dateString}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              setSelectedDate(day.dateString);
                              setSelectedTime("");
                              setSelectedStaffChoice("any");
                            }}
                            title={
                              day.isBookable
                                ? `${day.label} · ${day.availableSlotCount} slots`
                                : `${day.label} · unavailable`
                            }
                            style={{
                              minHeight: 46,
                              borderRadius: 12,
                              border: isSelected
                                ? "1px solid rgba(255,107,53,0.65)"
                                : day.isToday
                                  ? "1px solid rgba(45,212,191,0.45)"
                                  : "1px solid var(--border)",
                              background: isSelected
                                ? "var(--accent)"
                                : day.isBookable
                                  ? "var(--surface)"
                                  : "rgba(148,163,184,0.08)",
                              color: isSelected
                                ? "var(--bg)"
                                : day.isCurrentMonth
                                  ? "var(--text)"
                                  : "var(--text-muted)",
                              opacity: isDisabled
                                ? 0.32
                                : day.isCurrentMonth
                                  ? 1
                                  : 0.55,
                              cursor: isDisabled ? "not-allowed" : "pointer",
                              fontWeight: isSelected || day.isToday ? 800 : 500,
                            }}
                          >
                            <span>{day.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDateLabel && (
                      <p
                        className="small muted"
                        style={{ marginTop: "0.75rem" }}
                      >
                        {t("reschedule.calendar.selected", "Selected")}:{" "}
                        <strong style={{ color: "var(--text)" }}>
                          {selectedDateLabel}
                        </strong>
                        {staffFilter !== "any" && selectedFilterStaff
                          ? ` · ${t("reschedule.calendar.filteredTo", "filtered to")} ${selectedFilterStaff.name}`
                          : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="small muted">
                  {t("reschedule.times.title", "Available times")}
                </label>

                {!selectedDate && (
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    {t(
                      "reschedule.times.chooseDate",
                      "Choose an available date first.",
                    )}
                  </p>
                )}

                {selectedDate && timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
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
                      onClick={() => {
                        setSelectedTime(slot.time);
                        setSelectedStaffChoice("any");
                      }}
                      style={{
                        padding: "0.65rem",
                        borderRadius: 999,
                        border:
                          selectedTime === slot.time
                            ? "1px solid rgba(255,107,53,0.5)"
                            : "1px solid var(--border)",
                        background:
                          selectedTime === slot.time
                            ? "var(--accent)"
                            : "var(--surface-2)",
                        color:
                          selectedTime === slot.time
                            ? "var(--bg)"
                            : "var(--text)",
                      }}
                    >
                      <span>{slot.time}</span>
                      {slot.staffIds.length > 1 && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.68rem",
                            opacity: 0.8,
                          }}
                        >
                          {slot.staffIds.length}{" "}
                          {t("reschedule.times.available", "available")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="small muted">
                  {t("reschedule.staff.title", "Staff choice")}
                </label>

                {!selectedDate && (
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    {t("reschedule.staff.chooseDate", "Select a date first.")}
                  </p>
                )}

                {selectedDate && !selectedTime && (
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    {t(
                      "reschedule.staff.chooseTime",
                      "Choose a time first, then select any available staff member or a specific person.",
                    )}
                  </p>
                )}

                {selectedDate && selectedTime && (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.75rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <div
                      className="card"
                      style={{
                        background: "var(--surface-2)",
                        padding: "0.85rem",
                      }}
                    >
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
                      onClick={() => setSelectedStaffChoice("any")}
                      style={{
                        textAlign: "left",
                        padding: "0.85rem",
                        borderRadius: "var(--radius)",
                        border:
                          selectedStaffChoice === "any"
                            ? "1px solid rgba(255,107,53,0.55)"
                            : "1px solid var(--border)",
                        background:
                          selectedStaffChoice === "any"
                            ? "var(--accent-dim)"
                            : "var(--surface-2)",
                        color: "var(--text)",
                      }}
                    >
                      <strong>
                        {t(
                          "publicBusiness.staff.anyAvailable",
                          "Any available staff",
                        )}
                      </strong>
                      <p
                        className="small muted"
                        style={{ marginTop: "0.25rem" }}
                      >
                        {t(
                          "reschedule.staff.autoAssign",
                          "Mirëbook will assign one of the available staff members for this exact time.",
                        )}
                      </p>
                    </button>

                    {availableStaffForSelectedTime.map((staff) => {
                      const isSelected = selectedStaffChoice === staff.id;

                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => setSelectedStaffChoice(staff.id)}
                          style={{
                            textAlign: "left",
                            padding: "0.85rem",
                            borderRadius: "var(--radius)",
                            border: isSelected
                              ? "1px solid rgba(255,107,53,0.55)"
                              : "1px solid var(--border)",
                            background: isSelected
                              ? "var(--accent-dim)"
                              : "var(--surface-2)",
                            color: "var(--text)",
                          }}
                        >
                          <strong>{staff.name}</strong>
                          <p className="small muted">
                            {staff.role_title ||
                              t("staff.fallback.member", "Staff member")}
                          </p>
                          <p
                            className="small"
                            style={{
                              color: "var(--success)",
                              marginTop: "0.25rem",
                            }}
                          >
                            {t("reschedule.availableAt", "Available at")}{" "}
                            {selectedTime}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedDate ||
                  !selectedTime ||
                  !selectedStaffChoice
                }
                className="btn btn-accent"
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
            </form>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
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
        .reschedule-form-card {
          display: grid;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .reschedule-time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        @media (max-width: 520px) {
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
            min-height: 40px !important;
            border-radius: 10px !important;
            padding: 0.15rem !important;
          }

          .reschedule-time-grid {
            grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
