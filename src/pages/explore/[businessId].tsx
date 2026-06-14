import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import AuthNav from "@/components/AuthNav";
import PublicBusinessHero from "@/components/public-business/PublicBusinessHero";
import PublicBusinessSetupWarning from "@/components/public-business/PublicBusinessSetupWarning";
import PublicBusinessServices from "@/components/public-business/PublicBusinessServices";
import PublicBusinessStaffPicker from "@/components/public-business/PublicBusinessStaffPicker";
import PublicBusinessAvailability from "@/components/public-business/PublicBusinessAvailability";
import PublicBusinessSummary from "@/components/public-business/PublicBusinessSummary";
import { useI18n } from "@/lib/useI18n";
import { requestTransactionalEmail } from "@/lib/email/client";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description?: string | null;
  image_url?: string | null;
};

type StaffMember = {
  id: string;
  name: string;
  role_title?: string | null;
  image_url?: string | null;
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

type Business = {
  id: string;
  user_id?: string | null;
  published?: boolean | null;
  name: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  address?: string | null;
  image_url?: string | null;
  auto_accept_bookings?: boolean;
  booking_interval_minutes?: number | null;
  min_notice_minutes?: number | null;
  max_advance_days?: number | null;
  buffer_before_minutes?: number | null;
  buffer_after_minutes?: number | null;
  cancellation_policy?: string | null;
  reschedule_policy?: string | null;
  timezone?: string | null;
  currency?: string | null;
};

type Booking = {
  id: string;
  staff_member_id: string;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
};

type UserRole = "customer" | "business" | null;

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

export default function BusinessBookingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { businessId } = router.query;

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<BusinessAvailability[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<
    StaffAvailability[]
  >([]);

  const [customerUserId, setCustomerUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isOwnerPreview, setIsOwnerPreview] = useState(false);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [staffFilter, setStaffFilter] = useState<StaffFilter>("any");
  const [timeSlots, setTimeSlots] = useState<SlotOption[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedStaffChoice, setSelectedStaffChoice] =
    useState<StaffChoice>("any");

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getCustomerSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAuthChecked(true);
        return;
      }

      setCustomerUserId(session.user.id);
      setCustomerEmail(session.user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name, phone")
        .eq("id", session.user.id)
        .single();

      if (profile?.full_name) setCustomerName(profile.full_name);
      if (profile?.phone) setCustomerPhone(profile.phone);

      setUserRole(profile?.role === "business" ? "business" : "customer");
      setAuthChecked(true);
    }

    getCustomerSession();
  }, []);

  async function loadBookingPage() {
    if (!businessId || Array.isArray(businessId)) return;

    setPageLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    const ownerPreview =
      !!session?.user?.id && businessData?.user_id === session.user.id;

    if (
      businessError ||
      !businessData ||
      (!businessData.published && !ownerPreview)
    ) {
      setError(
        t(
          "publicBusiness.error.notAvailable",
          "This business is not currently available for public booking.",
        ),
      );
      setPageLoading(false);
      return;
    }

    setIsOwnerPreview(ownerPreview);
    setBusiness(businessData);

    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (servicesError) {
      setError(servicesError.message);
      setPageLoading(false);
      return;
    }

    setServices(servicesData || []);

    const { data: staffData, error: staffError } = await supabase
      .from("staff_members")
      .select("id, name, role_title, image_url")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (staffError) {
      setError(staffError.message);
      setPageLoading(false);
      return;
    }

    setStaffMembers(staffData || []);

    const staffIds = (staffData || []).map((staff) => staff.id);

    if (staffIds.length > 0) {
      const { data: staffServiceData, error: staffServiceError } =
        await supabase
          .from("staff_services")
          .select("staff_member_id, service_id")
          .in("staff_member_id", staffIds);

      if (staffServiceError) {
        setError(staffServiceError.message);
        setPageLoading(false);
        return;
      }

      setStaffServices(staffServiceData || []);

      const { data: staffAvailabilityData, error: staffAvailabilityError } =
        await supabase
          .from("staff_availability")
          .select(
            "staff_member_id, day_of_week, start_time, end_time, is_closed",
          )
          .in("staff_member_id", staffIds);

      if (staffAvailabilityError) {
        setError(staffAvailabilityError.message);
        setPageLoading(false);
        return;
      }

      setStaffAvailability(staffAvailabilityData || []);
    } else {
      setStaffServices([]);
      setStaffAvailability([]);
    }

    const { data: availabilityData, error: availabilityError } = await supabase
      .from("availability")
      .select("*")
      .eq("business_id", businessId);

    if (availabilityError) {
      setError(availabilityError.message);
      setPageLoading(false);
      return;
    }

    setAvailability(availabilityData || []);

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("id, staff_member_id, start_at, end_at, duration_minutes, status")
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"]);

    setBookings(bookingsData || []);
    setPageLoading(false);
  }

  useEffect(() => {
    loadBookingPage();
  }, [businessId]);

  useEffect(() => {
    function refreshOnFocus() {
      loadBookingPage();
    }

    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadBookingPage();
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [businessId]);

  function formatDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function sameDate(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  function moveCalendarMonth(offset: number) {
    setCalendarMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function resetCalendarToToday() {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function normaliseDateValue(date: Date) {
    const cleanDate = new Date(date);
    cleanDate.setHours(0, 0, 0, 0);
    return cleanDate;
  }

  function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
  }
  function bookingIntervalMinutes() {
    return business?.booking_interval_minutes || 15;
  }

  function minNoticeMinutes() {
    return business?.min_notice_minutes || 0;
  }

  function maxAdvanceDays() {
    return business?.max_advance_days || 60;
  }

  function bufferBeforeMinutes() {
    return business?.buffer_before_minutes || 0;
  }

  function bufferAfterMinutes() {
    return business?.buffer_after_minutes || 0;
  }

  function currencySymbol() {
    if (business?.currency === "EUR") return "€";
    if (business?.currency === "ALL") return "L";
    if (business?.currency === "USD") return "$";
    return "£";
  }

  function formatServicePrice(price: number) {
    return `${currencySymbol()}${Number(price || 0).toFixed(2)}`;
  }

  function locationLabel() {
    return (
      [business?.address, business?.city, business?.country]
        .filter(Boolean)
        .join(", ") ||
      t("publicBusiness.locationComingSoon", "Location not provided")
    );
  }

  function heroBackgroundImage() {
    if (!business?.image_url) return undefined;
    return `linear-gradient(rgba(11, 18, 32, 0.2), rgba(11, 18, 32, 0.75)), url("${business.image_url}")`;
  }

  function serviceImageBackground(service: Service) {
    if (!service.image_url) return undefined;
    return `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url("${service.image_url}")`;
  }

  function bookingModeText() {
    return business?.auto_accept_bookings === false
      ? t("publicBusiness.bookingMode.request", "Booking request")
      : t("publicBusiness.bookingMode.instant", "Instant confirmation");
  }

  function bookingModeDescription() {
    return business?.auto_accept_bookings === false
      ? t(
          "publicBusiness.bookingMode.requestBody",
          "The business will review and confirm your request.",
        )
      : t(
          "publicBusiness.bookingMode.instantBody",
          "Your booking will be confirmed immediately after you submit.",
        );
  }

  function businessTimezoneLabel() {
    return (
      business?.timezone ||
      t("publicBusiness.localBusinessTime", "local business time")
    );
  }

  function cancellationPolicyText() {
    return (
      business?.cancellation_policy?.trim() ||
      t(
        "publicBusiness.cancellationFallback",
        "Cancellation policy has not been added by this business yet.",
      )
    );
  }

  function reschedulePolicyText() {
    return (
      business?.reschedule_policy?.trim() ||
      t(
        "publicBusiness.rescheduleFallback",
        "Reschedule requests can be managed from My Bookings when available.",
      )
    );
  }

  async function createBookingNotifications(
    bookingId: string | null,
    bookingStatus: string,
    startAt: string,
    staffMemberId: string,
  ) {
    if (
      !business ||
      !businessId ||
      Array.isArray(businessId) ||
      !selectedService ||
      !customerUserId
    )
      return;

    const appointmentTime = new Date(startAt).toLocaleString();
    const staff = staffMembers.find((member) => member.id === staffMemberId);
    const staffLabel = staff
      ? staff.name
      : t("publicBusiness.staff.anyAvailable", "Any available staff");

    await supabase.from("notifications").insert([
      {
        user_id: customerUserId,
        business_id: businessId,
        booking_id: bookingId,
        audience: "customer",
        type:
          bookingStatus === "pending"
            ? "booking_requested"
            : "booking_accepted",
        title:
          bookingStatus === "pending"
            ? t("notifications.types.bookingRequested.title", "Request sent")
            : t("notifications.types.bookingAccepted.title", "Confirmed"),
        message:
          bookingStatus === "pending"
            ? `${business.name} ${t("publicBusiness.notification.customerPendingMessage", "will review your booking request for")} ${selectedService.name} ${t("publicBusiness.notification.forWord", "for")} ${appointmentTime}.`
            : `${t("publicBusiness.notification.customerConfirmedPrefix", "Your booking is confirmed for")} ${selectedService.name} ${t("publicBusiness.notification.withBusiness", "with")} ${business.name} ${t("publicBusiness.notification.forWord", "for")} ${appointmentTime}.`,
        action_url: bookingId
          ? `/booking-confirmation?id=${bookingId}`
          : "/my-bookings",
      },
      {
        business_id: businessId,
        booking_id: bookingId,
        audience: "business",
        type:
          bookingStatus === "pending"
            ? "booking_needs_approval"
            : "booking_created",
        title:
          bookingStatus === "pending"
            ? t(
                "publicBusiness.notification.needsApprovalTitle",
                "Needs approval",
              )
            : t("publicBusiness.notification.createdTitle", "Confirmed"),
        message: `${customerName.trim() || t("publicBusiness.customerFallback", "A customer")} ${t("publicBusiness.notification.bookedWord", "booked")} ${selectedService.name} ${t("publicBusiness.notification.forWord", "for")} ${appointmentTime} ${t("publicBusiness.notification.withWord", "with")} ${staffLabel}.`,
        action_url: `/dashboard/bookings?businessId=${businessId}&date=${selectedDate}`,
      },
    ]);
  }

  function getServiceStaff(service: Service | null) {
    if (!service) return [];

    return staffMembers.filter((staff) =>
      staffServices.some(
        (link) =>
          link.staff_member_id === staff.id && link.service_id === service.id,
      ),
    );
  }

  function getCandidateStaff(
    service: Service | null,
    filter: StaffFilter = staffFilter,
  ) {
    const serviceStaff = getServiceStaff(service);
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

  function generateSlotsForStaffOnDate(
    staffId: string,
    dateValue: string,
    service: Service | null,
  ) {
    if (!dateValue || !service) return [];

    const dayAvailability = getStaffDayAvailabilityForDate(staffId, dateValue);
    if (!dayAvailability || dayAvailability.is_closed) return [];

    const slots: string[] = [];
    let start = new Date(`${dateValue}T${dayAvailability.start_time}`);
    const end = new Date(`${dateValue}T${dayAvailability.end_time}`);
    const now = new Date();
    const slotIntervalMinutes = bookingIntervalMinutes();
    const earliestBookableTime = addMinutes(now, minNoticeMinutes());
    const maxAdvanceDate = new Date(now);
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + maxAdvanceDays());
    maxAdvanceDate.setHours(23, 59, 59, 999);
    while (
      start.getTime() + service.duration_minutes * 60000 <=
      end.getTime()
    ) {
      const visibleSlotStart = new Date(start);
      const slotStart = addMinutes(visibleSlotStart, -bufferBeforeMinutes());
      const appointmentEnd = addMinutes(
        visibleSlotStart,
        service.duration_minutes,
      );
      const slotEnd = addMinutes(appointmentEnd, bufferAfterMinutes());
      const timeString = visibleSlotStart.toTimeString().slice(0, 5);
      const isPastSlot = visibleSlotStart < now;
      const isTooSoon = visibleSlotStart < earliestBookableTime;
      const isTooFarAhead = visibleSlotStart > maxAdvanceDate;

      const overlapsBooking = bookings.some((booking) => {
        if (booking.staff_member_id !== staffId) return false;

        const bookingStart = new Date(booking.start_at);
        const bookingEnd = booking.end_at
          ? new Date(booking.end_at)
          : addMinutes(bookingStart, booking.duration_minutes);

        return slotStart < bookingEnd && slotEnd > bookingStart;
      });

      if (!isPastSlot && !isTooSoon && !isTooFarAhead && !overlapsBooking) {
        slots.push(timeString);
      }

      start = addMinutes(start, slotIntervalMinutes);
    }

    return slots;
  }

  function generateMergedSlots(
    dateValue: string,
    service: Service | null,
    filter: StaffFilter = staffFilter,
  ) {
    if (!dateValue || !service) return [];

    const mergedSlots = getCandidateStaff(service, filter).reduce<
      Record<string, string[]>
    >((acc, staff) => {
      const slots = generateSlotsForStaffOnDate(staff.id, dateValue, service);

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
    service: Service | null,
    filter: StaffFilter = staffFilter,
  ) {
    const slots = generateMergedSlots(dateValue, service, filter);
    const availableStaffIds = Array.from(
      new Set(slots.flatMap((slot) => slot.staffIds)),
    );

    return {
      availableStaffIds,
      availableSlotCount: slots.length,
      isBookable: slots.length > 0,
    };
  }

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
        !isPast && selectedService
          ? getDayAvailabilitySummary(dateString, selectedService, staffFilter)
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
    selectedService,
    staffFilter,
    staffMembers,
    staffServices,
    staffAvailability,
    bookings,
    business,
  ]);

  const selectedStaff = useMemo(() => {
    if (selectedStaffChoice === "any") return null;
    return (
      staffMembers.find((staff) => staff.id === selectedStaffChoice) || null
    );
  }, [staffMembers, selectedStaffChoice]);

  const selectedFilterStaff = useMemo(() => {
    if (staffFilter === "any") return null;
    return staffMembers.find((staff) => staff.id === staffFilter) || null;
  }, [staffMembers, staffFilter]);

  const selectableStaff = useMemo(() => {
    return getServiceStaff(selectedService);
  }, [selectedService, staffMembers, staffServices]);

  const availableStaffForSelectedTime = useMemo(() => {
    if (!selectedTime) return [];

    const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime);
    if (!selectedSlot) return [];

    return selectableStaff.filter((staff) =>
      selectedSlot.staffIds.includes(staff.id),
    );
  }, [selectedTime, timeSlots, selectableStaff]);

  const bookableServiceCount = services.filter((service) =>
    staffServices.some((link) => link.service_id === service.id),
  ).length;
  const visibleServices = useMemo(() => {
    return services.map((service) => {
      const assignedStaffCount = staffServices.filter(
        (link) => link.service_id === service.id,
      ).length;

      return {
        service,
        assignedStaffCount,
        isBookable: assignedStaffCount > 0,
      };
    });
  }, [services, staffServices]);

  const setupIssueMessages = useMemo(() => {
    const issues: string[] = [];

    if (services.length === 0)
      issues.push(
        t(
          "publicBusiness.setupIssue.noServices",
          "No active services are available yet.",
        ),
      );
    if (staffMembers.length === 0)
      issues.push(
        t(
          "publicBusiness.setupIssue.noStaff",
          "No active staff are available yet.",
        ),
      );
    if (availability.filter((row) => row.is_closed !== true).length === 0)
      issues.push(
        t(
          "publicBusiness.setupIssue.noHours",
          "No working hours are available yet.",
        ),
      );
    if (bookableServiceCount === 0 && services.length > 0)
      issues.push(
        t(
          "publicBusiness.setupIssue.servicesNotAssigned",
          "Services are visible but not assigned to staff yet.",
        ),
      );

    return issues;
  }, [services, staffMembers, availability, bookableServiceCount]);

  function businessIcon() {
    if (business?.category?.toLowerCase().includes("dent")) return "🦷";
    if (business?.category?.toLowerCase().includes("barber")) return "💈";
    if (business?.category?.toLowerCase().includes("salon")) return "✂️";
    if (business?.category?.toLowerCase().includes("restaurant")) return "🍽️";
    return "✨";
  }

  // useEffect for time slots
  useEffect(() => {
    if (!selectedDate || !selectedService) {
      setTimeSlots([]);
      return;
    }

    const slots = generateMergedSlots(
      selectedDate,
      selectedService,
      staffFilter,
    );
    setTimeSlots(slots);

    if (selectedTime && !slots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime("");
      setSelectedStaffChoice("any");
    }
  }, [
    selectedDate,
    selectedService,
    staffFilter,
    staffAvailability,
    bookings,
    selectableStaff,
    business,
  ]);

  function staffForSlot(slotTime: string) {
    const slot = timeSlots.find((item) => item.time === slotTime);
    if (!slot) return [];

    return selectableStaff.filter((staff) => slot.staffIds.includes(staff.id));
  }

  function resolveStaffForBooking() {
    const slot = timeSlots.find((item) => item.time === selectedTime);
    if (!slot) return "";

    if (selectedStaffChoice !== "any") {
      return slot.staffIds.includes(selectedStaffChoice)
        ? selectedStaffChoice
        : "";
    }

    return slot.staffIds[0] || "";
  }

  function selectedStaffSummary() {
    if (!selectedTime) {
      if (staffFilter === "any")
        return t(
          "publicBusiness.staff.chooseTimeFirst",
          "Staff choice appears after choosing a time",
        );
      return selectedFilterStaff
        ? `${t("publicBusiness.staff.onlyShowing", "Only showing slots with")} ${selectedFilterStaff.name}`
        : t(
            "publicBusiness.staff.chooseTimeToPick",
            "Choose a time to pick staff",
          );
    }

    const staffForSelectedSlot = staffForSlot(selectedTime);

    if (selectedStaffChoice === "any") {
      if (staffForSelectedSlot.length === 0)
        return t("publicBusiness.staff.anyAvailable", "Any available staff");

      return staffForSelectedSlot.length === 1
        ? `${t("publicBusiness.staff.assignedAutomatically", "Assigned automatically")}: ${staffForSelectedSlot[0].name}`
        : `${t("publicBusiness.staff.anyAvailable", "Any available staff")} · ${staffForSelectedSlot.length} ${t("support.business.staff", "staff")} ${t("publicBusiness.staff.canDoThisTime", "can do this time")}`;
    }

    return selectedStaff
      ? `${t("support.business.staff", "Staff")}: ${selectedStaff.name}`
      : t("publicBusiness.staff.noneSelected", "No staff selected");
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    if (!authChecked) return;

    if (!customerUserId || userRole !== "customer") {
      setError(
        `${t("publicBusiness.error.loginToBook", "Please login or create a customer account to book with")} ${business?.name || t("publicBusiness.thisBusiness", "this business")}.`,
      );
      return;
    }

    if (
      !businessId ||
      Array.isArray(businessId) ||
      !selectedService ||
      !selectedDate ||
      !selectedTime
    ) {
      setError(
        t(
          "publicBusiness.error.missingSelection",
          "Choose a service, staff option, date and time before booking.",
        ),
      );
      return;
    }

    const staffMemberIdForBooking = resolveStaffForBooking();

    if (!staffMemberIdForBooking) {
      setError(
        t(
          "publicBusiness.error.chooseStaff",
          "Please choose Any available staff or one of the staff available for this time.",
        ),
      );
      return;
    }

    setLoading(true);
    setError(null);

    const { data: freshService, error: freshServiceError } = await supabase
      .from("services")
      .select("id, duration_minutes, active")
      .eq("id", selectedService.id)
      .eq("business_id", businessId)
      .eq("active", true)
      .maybeSingle();

    if (freshServiceError || !freshService) {
      setLoading(false);
      setError(
        t(
          "publicBusiness.error.serviceUnavailable",
          "This service is no longer available. Please choose another service.",
        ),
      );
      await loadBookingPage();
      return;
    }

    const { data: freshStaff, error: freshStaffError } = await supabase
      .from("staff_members")
      .select("id, active")
      .eq("id", staffMemberIdForBooking)
      .eq("business_id", businessId)
      .eq("active", true)
      .maybeSingle();

    if (freshStaffError || !freshStaff) {
      setLoading(false);
      setError(
        t(
          "publicBusiness.error.staffUnavailable",
          "This staff option is no longer available for booking. Please choose another staff option.",
        ),
      );
      await loadBookingPage();
      return;
    }

    const { data: freshStaffService, error: freshStaffServiceError } =
      await supabase
        .from("staff_services")
        .select("staff_member_id")
        .eq("staff_member_id", staffMemberIdForBooking)
        .eq("service_id", selectedService.id)
        .maybeSingle();

    if (freshStaffServiceError || !freshStaffService) {
      setLoading(false);
      setError(
        t(
          "publicBusiness.error.staffServiceUnavailable",
          "This staff member can no longer be booked for the selected service. Please choose another option.",
        ),
      );
      await loadBookingPage();
      return;
    }

    const { data: freshBookingsData, error: freshBookingsError } =
      await supabase
        .from("bookings")
        .select("id, staff_member_id, start_at, end_at, duration_minutes, status")
        .eq("business_id", businessId)
        .in("status", ["pending", "confirmed"]);

    if (freshBookingsError) {
      setLoading(false);
      setError(
        t(
          "publicBusiness.error.unableToCreate",
          "Unable to create this booking right now. Please try again.",
        ),
      );
      return;
    }

    setBookings(freshBookingsData || []);

    const freshSlots = (() => {
      const nextBookings = (freshBookingsData || []) as Booking[];
      const dayAvailability = getStaffDayAvailabilityForDate(
        staffMemberIdForBooking,
        selectedDate,
      );
      if (!dayAvailability || dayAvailability.is_closed) return [];

      const slots: string[] = [];
      let start = new Date(`${selectedDate}T${dayAvailability.start_time}`);
      const end = new Date(`${selectedDate}T${dayAvailability.end_time}`);
      const now = new Date();
      const slotIntervalMinutes = bookingIntervalMinutes();
      const earliestBookableTime = addMinutes(now, minNoticeMinutes());
      const maxAdvanceDate = new Date(now);
      maxAdvanceDate.setDate(maxAdvanceDate.getDate() + maxAdvanceDays());
      maxAdvanceDate.setHours(23, 59, 59, 999);

      while (
        start.getTime() + freshService.duration_minutes * 60000 <=
        end.getTime()
      ) {
        const visibleSlotStart = new Date(start);
        const slotStart = addMinutes(visibleSlotStart, -bufferBeforeMinutes());
        const appointmentEnd = addMinutes(
          visibleSlotStart,
          freshService.duration_minutes,
        );
        const slotEnd = addMinutes(appointmentEnd, bufferAfterMinutes());
        const timeString = visibleSlotStart.toTimeString().slice(0, 5);

        const overlapsBooking = nextBookings.some((booking) => {
          if (booking.staff_member_id !== staffMemberIdForBooking) return false;

          const bookingStart = new Date(booking.start_at);
          const bookingEnd = booking.end_at
            ? new Date(booking.end_at)
            : addMinutes(bookingStart, booking.duration_minutes);

          return slotStart < bookingEnd && slotEnd > bookingStart;
        });

        if (
          visibleSlotStart >= now &&
          visibleSlotStart >= earliestBookableTime &&
          visibleSlotStart <= maxAdvanceDate &&
          !overlapsBooking
        ) {
          slots.push(timeString);
        }

        start = addMinutes(start, slotIntervalMinutes);
      }

      return slots;
    })();

    if (!freshSlots.includes(selectedTime)) {
      setLoading(false);
      setError(
        t(
          "publicBusiness.error.slotUnavailable",
          "This time is no longer available. Please choose another time.",
        ),
      );
      setSelectedTime("");
      return;
    }

    const startAt = new Date(
      `${selectedDate}T${selectedTime}:00`,
    ).toISOString();
    const bookingStatus =
      business?.auto_accept_bookings === false ? "pending" : "confirmed";

    const { data: createdBooking, error } = await supabase
      .from("bookings")
      .insert({
        business_id: businessId,
        service_id: selectedService.id,
        staff_member_id: staffMemberIdForBooking,
        customer_user_id: customerUserId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim().toLowerCase(),
        customer_phone: customerPhone.trim() || null,
        customer_notes: customerNote.trim() || null,
        start_at: startAt,
        duration_minutes: selectedService.duration_minutes,
        status: bookingStatus,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      if (error.message.includes("prevent_overlapping_bookings")) {
        setError(
          t(
            "publicBusiness.error.slotJustBooked",
            "This time is no longer available. Please choose another time.",
          ),
        );
      } else {
        setError(
          t(
            "publicBusiness.error.unableToCreate",
            "Unable to create this booking right now. Please try again.",
          ),
        );
      }
      await loadBookingPage();
      return;
    }

    await createBookingNotifications(
      createdBooking?.id || null,
      bookingStatus,
      startAt,
      staffMemberIdForBooking,
    );

    if (createdBooking?.id) {
      void requestTransactionalEmail({
        event: "booking_created",
        bookingId: createdBooking.id,
      });
      router.push(`/booking-confirmation?id=${createdBooking.id}`);
    } else {
      router.push(
        bookingStatus === "pending"
          ? "/my-bookings?bookingRequested=1"
          : "/my-bookings",
      );
    }
  }
  if (pageLoading) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <p className="muted">
              {t("publicBusiness.loading", "Loading Mirëbook booking page...")}
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!business) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <h1 className="page-title">
              {t("publicBusiness.notFound.title", "Business not found")}
            </h1>
            <p className="page-sub">
              {t(
                "publicBusiness.notFound.body",
                "This business may be hidden, unpublished or unavailable.",
              )}
            </p>
            <Link
              href="/explore"
              className="btn btn-accent"
              style={{ marginTop: "1rem" }}
            >
              {t(
                "publicBusiness.notFound.backMarketplace",
                "Back to Mirëbook marketplace",
              )}
            </Link>

            <Link
              href="/support/customer"
              className="btn btn-ghost"
              style={{ marginTop: "1rem", marginLeft: "0.75rem" }}
            >
              {t("support.customer.title", "Customer support")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  const canSubmit = Boolean(
    selectedService &&
    selectedDate &&
    selectedTime &&
    selectedStaffChoice &&
    customerUserId &&
    userRole === "customer",
  );

  const selectedSlotForComponents =
    selectedDate && selectedTime
      ? {
          startAt: `${selectedDate}T${selectedTime}:00`,
          label: selectedTime,
          staffMemberId:
            selectedStaffChoice === "any" ? null : selectedStaffChoice,
        }
      : null;

  const timeSlotsForComponents = timeSlots.map((slot) => ({
    startAt: `${selectedDate}T${slot.time}:00`,
    label: slot.time,
    staffMemberId: slot.staffIds[0] || null,
  }));

  const availabilityEmptyMessage = !selectedService
    ? t(
        "publicBusiness.availability.chooseServiceFirst",
        "Choose a service first to see available booking times.",
      )
    : selectableStaff.length === 0
      ? t(
          "publicBusiness.availability.noAssignedStaff",
          "No active staff are assigned to this service yet. Choose another service or contact the business.",
        )
    : !selectedDate
      ? t(
          "publicBusiness.availability.chooseDateFirst",
          "Choose a date to see available booking times.",
        )
      : t(
          "publicBusiness.availability.none",
          "No available times for this date. Try another date or staff member.",
        );

  const staffPreferenceLabel =
    staffFilter === "any"
      ? t("publicBusiness.staff.any", "Any available staff")
      : selectedFilterStaff?.name || null;

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "36px 24px 70px" }}>
        <Link href="/explore" className="muted small">
          ← {t("publicBusiness.backToResults", "Back to results")}
        </Link>

        {isOwnerPreview && (
          <div
            className="card"
            style={{
              marginTop: "1rem",
              borderColor: "rgba(255,107,53,0.35)",
              background: "rgba(255,107,53,0.07)",
            }}
          >
            <p className="small" style={{ color: "var(--accent)" }}>
              {t("publicBusiness.preview.kicker", "Owner preview")}
            </p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t(
                "publicBusiness.preview.title",
                "You are previewing your own business page",
              )}
            </h3>
            <p className="small muted" style={{ marginTop: "0.35rem" }}>
              {business.published
                ? t(
                    "publicBusiness.preview.publishedBody",
                    "This is the public page customers can use to book. Changes should be made from your dashboard.",
                  )
                : t(
                    "publicBusiness.preview.draftBody",
                    "This page is hidden from customers because the business is not published yet. You can still preview it as the owner.",
                  )}
            </p>
            <div className="booking-action-row compact">
              <Link href="/dashboard/settings" className="btn btn-ghost">
                {t(
                  "publicBusiness.preview.manage",
                  "Manage in Mirëbook Business",
                )}
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{ borderColor: "rgba(255,77,109,0.35)", marginTop: "1rem" }}
          >
            <p style={{ color: "var(--danger)" }}>{error}</p>

            {(!customerUserId || userRole !== "customer") && (
              <div className="booking-action-row">
                <Link href="/login" className="btn btn-accent">
                  {t("publicBusiness.auth.loginToBook", "Login to book")}
                </Link>

                <Link href="/register" className="btn btn-ghost">
                  {t(
                    "publicBusiness.auth.createCustomerAccount",
                    "Create customer account",
                  )}
                </Link>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: "1.5rem" }}>
          <PublicBusinessHero
            business={business}
            heroBackgroundImage={heroBackgroundImage}
            locationLabel={locationLabel}
            bookingModeText={bookingModeText}
            bookingModeDescription={bookingModeDescription}
          />

          <p className="small muted" style={{ marginTop: "0.75rem" }}>
            {t("publicBusiness.timesShownIn", "Times shown in")}{" "}
            {businessTimezoneLabel()} · {bookingIntervalMinutes()}{" "}
            {t("publicBusiness.minuteSlotGrid", "minute appointment intervals")}
          </p>
        </div>

        <PublicBusinessSetupWarning issues={setupIssueMessages} />

        <div className="booking-page-grid">
          <section>
            <PublicBusinessServices
              services={visibleServices
                .filter((item) => item.isBookable)
                .map((item) => item.service)}
              selectedServiceId={selectedService?.id || ""}
              bookableServiceCount={bookableServiceCount}
              totalServiceCount={services.length}
              onSelectService={(serviceId) => {
                const nextService =
                  services.find((service) => service.id === serviceId) || null;
                setSelectedService(nextService);
                setSelectedDate("");
                setStaffFilter("any");
                setSelectedStaffChoice("any");
                setSelectedTime("");
              }}
              formatServicePrice={formatServicePrice}
              serviceImageBackground={serviceImageBackground}
            />

            {selectedService && (
              <div className="booking-action-row compact">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelectedService(null);
                    setSelectedDate("");
                    setStaffFilter("any");
                    setSelectedStaffChoice("any");
                    setSelectedTime("");
                  }}
                >
                  {t("publicBusiness.actions.changeService", "Change service")}
                </button>
              </div>
            )}

            {services.length > 0 && bookableServiceCount === 0 && (
              <div
                className="card"
                style={{
                  background: "rgba(255,190,11,0.06)",
                  borderColor: "rgba(255,190,11,0.22)",
                  marginTop: "1rem",
                }}
              >
                <p className="small" style={{ color: "var(--warning)" }}>
                  {t(
                    "publicBusiness.services.notBookableTitle",
                    "Services not bookable yet",
                  )}
                </p>
                <p className="small muted" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "publicBusiness.services.notBookableBody",
                    "This business has active services, but staff have not been assigned to them yet.",
                  )}
                </p>
              </div>
            )}
            {selectedService && (
              <div className="booking-step-stack">
                <PublicBusinessStaffPicker
                  staffMembers={staffMembers}
                  selectedStaffId={staffFilter}
                  onSelectStaff={(staffId) => {
                    setStaffFilter(staffId);
                    setSelectedDate("");
                    setSelectedTime("");
                    setSelectedStaffChoice("any");
                  }}
                  availableStaffForSelectedService={selectableStaff}
                />

                <PublicBusinessAvailability
                  selectedServiceName={selectedService.name}
                  selectedStaffLabel={staffPreferenceLabel}
                  selectedDate={selectedDate}
                  availableSlots={timeSlotsForComponents}
                  selectedSlot={selectedSlotForComponents}
                  loadingSlots={false}
                  canPickDate={selectableStaff.length > 0}
                  noSlotsMessage={availabilityEmptyMessage}
                  onDateChange={(date) => {
                    setSelectedDate(date);
                    setSelectedTime("");
                    setSelectedStaffChoice("any");
                  }}
                  onSelectSlot={(slot) => {
                    setSelectedTime(slot.label);
                    setSelectedStaffChoice(slot.staffMemberId || "any");
                  }}
                />
              </div>
            )}
          </section>

          <PublicBusinessSummary
            business={business}
            selectedService={selectedService}
            selectedSlot={selectedSlotForComponents}
            selectedStaffSummary={selectedStaffSummary}
            selectedDateLabel={
              selectedDateLabel && selectedTime
                ? `${selectedDateLabel} · ${selectedTime}`
                : selectedDateLabel
            }
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            customerNotes={customerNote}
            submitting={loading}
            error={error}
            canSubmit={canSubmit}
            customerUserId={customerUserId}
            userRole={userRole}
            isOwnerPreview={isOwnerPreview}
            loginHref={`/login?redirectTo=${encodeURIComponent(`/explore/${business.id}`)}`}
            onCustomerNameChange={setCustomerName}
            onCustomerEmailChange={setCustomerEmail}
            onCustomerPhoneChange={setCustomerPhone}
            onCustomerNotesChange={setCustomerNote}
            onSubmit={createBooking}
            formatServicePrice={formatServicePrice}
            bookingModeText={bookingModeText}
            bookingModeDescription={bookingModeDescription}
            reschedulePolicyText={reschedulePolicyText}
          />
        </div>
      </section>

      <style jsx>{`
        .booking-action-row {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .booking-action-row.compact {
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        :global(.public-business-hero) {
          overflow: hidden;
          padding: 0;
        }

        :global(.public-business-hero-image) {
          min-height: 210px;
          background-size: cover;
          background-position: center;
        }

        :global(.public-business-hero-content) {
          padding: 1.25rem 1.5rem;
        }

        :global(.public-business-pill-accent) {
          background: var(--accent-dim);
          color: var(--accent);
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
        }

        :global(.public-business-pill-muted) {
          background: var(--surface-2);
          color: var(--text-muted);
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          border: 1px solid var(--border);
        }

        :global(.public-business-meta-grid) {
          display: grid;
          gap: 0.4rem;
          margin-top: 1rem;
        }

        :global(.public-business-service-list) {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        :global(.public-business-service-card) {
          display: flex;
          gap: 1rem;
          align-items: stretch;
          text-align: left;
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
          color: var(--text);
          cursor: pointer;
        }

        :global(.public-business-service-image) {
          width: 130px;
          min-height: 100px;
          border-radius: 14px;
          background-size: cover;
          background-position: center;
          flex-shrink: 0;
        }

        :global(.public-business-staff-list) {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        :global(.public-business-staff-card) {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          text-align: left;
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
          color: var(--text);
          cursor: pointer;
        }

        :global(.public-business-staff-avatar) {
          width: 46px;
          height: 46px;
          border-radius: 999px;
          background: var(--accent-dim);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          flex-shrink: 0;
          overflow: hidden;
        }

        :global(.public-business-staff-avatar span) {
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          display: block;
        }

        :global(.public-business-slot-grid) {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
          gap: 0.5rem;
          margin-top: 1rem;
        }

        :global(.public-business-summary-box) {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
        }

        :global(.public-business-form) {
          display: grid;
          gap: 0.75rem;
        }

        .booking-section-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 1rem;
        }
        .booking-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          gap: 2rem;
          align-items: start;
          margin-top: 1.5rem;
        }

        .booking-summary-panel {
          position: sticky;
          top: 96px;
        }

        .booking-time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        @media (max-width: 980px) {
          .booking-page-grid {
            grid-template-columns: 1fr;
          }

          .booking-summary-panel {
            position: static;
          }

          .booking-page-grid > section,
          .booking-summary-panel {
            min-width: 0;
            max-width: 100%;
          }
        }

        @media (max-width: 520px) {
          .booking-page-grid {
            gap: 1rem;
          }

          .booking-calendar-card {
            padding: 0.65rem !important;
          }

          .booking-staff-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .booking-calendar-weekdays,
          .booking-calendar-grid {
            gap: 0.25rem !important;
          }

          .booking-calendar-grid button {
            min-height: 40px !important;
            border-radius: 10px !important;
            padding: 0.15rem !important;
          }

          .booking-time-grid {
            grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
          }

          :global(.public-business-service-card) {
            display: grid;
          }

          :global(.public-business-service-image) {
            width: 100%;
            min-height: 150px;
          }

          :global(.public-business-staff-card) {
            align-items: flex-start;
          }

          :global(.public-business-slot-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          :global(.public-business-slot-grid .btn) {
            width: 100%;
            min-width: 0;
            padding-inline: 0.6rem;
          }

          .booking-action-row,
          .booking-section-heading {
            display: grid;
          }

          .booking-action-row :global(.btn),
          .booking-action-row a,
          .booking-action-row button {
            width: 100%;
            justify-content: center;
          }

          .booking-summary-panel input,
          .booking-summary-panel textarea,
          .booking-summary-panel select,
          .booking-summary-panel .btn {
            width: 100%;
            min-width: 0;
          }
          .booking-step-stack {
            display: grid;
            gap: 1rem;
            margin-top: 1rem;
          }
        }
      `}</style>
    </main>
  );
}
