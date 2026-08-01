import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { requestBookingCreatedEmail } from "@/lib/server/app-api/transactionalEmail";
import {
  DEFAULT_TIME_ZONE,
  dateKeyInTimeZone,
  minutesSinceMidnightInTimeZone,
} from "@/lib/timezone";

type CreateBookingBody = {
  businessId?: unknown;
  serviceId?: unknown;
  staffMemberId?: unknown;
  startAt?: unknown;
  customerNotes?: unknown;
};

type BusinessRow = {
  id: string;
  user_id?: string | null;
  name: string;
  published?: boolean | null;
  auto_accept_bookings?: boolean | null;
  booking_interval_minutes?: number | null;
  min_notice_minutes?: number | null;
  max_advance_days?: number | null;
  buffer_before_minutes?: number | null;
  buffer_after_minutes?: number | null;
  timezone?: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
};

type StaffRow = {
  id: string;
  name: string;
};

type AvailabilityRow = {
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type BookingOverlapRow = {
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
};

type AtomicBookingResult = {
  booking_id: string;
  booking_status: "pending" | "confirmed";
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null;
}

function safeTimeZone(value?: string | null) {
  const candidate = value?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: candidate }).format(
      new Date(),
    );
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function dayOfWeekInTimeZone(date: Date, timeZone: string) {
  const shortDay = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(shortDay);
}

function bookingEnd(booking: BookingOverlapRow) {
  const start = new Date(booking.start_at);
  return booking.end_at
    ? new Date(booking.end_at)
    : addMinutes(start, booking.duration_minutes);
}

function localizedCopy(params: {
  locale: "en" | "sq";
  status: "pending" | "confirmed";
  businessName: string;
  serviceName: string;
  staffName: string;
  customerName: string;
  appointmentTime: string;
}) {
  if (params.locale === "sq") {
    return {
      customerTitle:
        params.status === "pending" ? "Kërkesa u dërgua" : "U konfirmua",
      customerMessage:
        params.status === "pending"
          ? `${params.businessName} do ta shqyrtojë kërkesën tuaj për ${params.serviceName}, ${params.appointmentTime}.`
          : `Rezervimi juaj për ${params.serviceName} te ${params.businessName} u konfirmua për ${params.appointmentTime}.`,
      businessTitle:
        params.status === "pending" ? "Kërkon miratim" : "U konfirmua",
      businessMessage: `${params.customerName} rezervoi ${params.serviceName} për ${params.appointmentTime} me ${params.staffName}.`,
      staffTitle: "Rezervim i konfirmuar",
      staffMessage: `${params.customerName} rezervoi ${params.serviceName} për ${params.appointmentTime}.`,
    };
  }

  return {
    customerTitle: params.status === "pending" ? "Request sent" : "Confirmed",
    customerMessage:
      params.status === "pending"
        ? `${params.businessName} will review your request for ${params.serviceName} on ${params.appointmentTime}.`
        : `Your ${params.serviceName} booking with ${params.businessName} is confirmed for ${params.appointmentTime}.`,
    businessTitle: params.status === "pending" ? "Needs approval" : "Confirmed",
    businessMessage: `${params.customerName} booked ${params.serviceName} for ${params.appointmentTime} with ${params.staffName}.`,
    staffTitle: "Booking confirmed",
    staffMessage: `${params.customerName} booked ${params.serviceName} for ${params.appointmentTime}.`,
  };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return errorResponse(
      response,
      405,
      "method_not_allowed",
      "Method not allowed",
    );
  }

  try {
    const context = await loadAppContext(request);
    const body = (request.body || {}) as CreateBookingBody;
    const businessId = cleanText(body.businessId);
    const serviceId = cleanText(body.serviceId);
    const staffMemberId = cleanText(body.staffMemberId);
    const customerNotes = cleanText(body.customerNotes).slice(0, 1_000);
    const startAtValue = cleanText(body.startAt);

    if (
      !UUID_PATTERN.test(businessId) ||
      !UUID_PATTERN.test(serviceId) ||
      !UUID_PATTERN.test(staffMemberId)
    ) {
      return errorResponse(
        response,
        400,
        "invalid_booking_selection",
        "Choose a valid business, service and staff member",
      );
    }

    const startAt = new Date(startAtValue);
    if (!startAtValue || Number.isNaN(startAt.getTime())) {
      return errorResponse(
        response,
        400,
        "invalid_booking_time",
        "Choose a valid appointment time",
      );
    }

    const customerEmail = (context.user.email || "").trim().toLowerCase();
    const customerName =
      context.profile?.full_name?.trim() ||
      customerEmail.split("@")[0] ||
      "Customer";
    if (!customerEmail) {
      return errorResponse(
        response,
        400,
        "customer_email_required",
        "Add an email address before booking",
      );
    }

    const [businessResult, serviceResult, staffResult, assignmentResult] =
      await Promise.all([
        context.supabaseAdmin
          .from("businesses")
          .select(
            "id, user_id, name, published, auto_accept_bookings, booking_interval_minutes, min_notice_minutes, max_advance_days, buffer_before_minutes, buffer_after_minutes, timezone",
          )
          .eq("id", businessId)
          .eq("published", true)
          .maybeSingle<BusinessRow>(),
        context.supabaseAdmin
          .from("services")
          .select("id, name, duration_minutes")
          .eq("id", serviceId)
          .eq("business_id", businessId)
          .eq("active", true)
          .maybeSingle<ServiceRow>(),
        context.supabaseAdmin
          .from("staff_members")
          .select("id, name")
          .eq("id", staffMemberId)
          .eq("business_id", businessId)
          .eq("active", true)
          .maybeSingle<StaffRow>(),
        context.supabaseAdmin
          .from("staff_services")
          .select("staff_member_id")
          .eq("staff_member_id", staffMemberId)
          .eq("service_id", serviceId)
          .maybeSingle<{ staff_member_id: string }>(),
      ]);

    if (businessResult.error) throw businessResult.error;
    if (serviceResult.error) throw serviceResult.error;
    if (staffResult.error) throw staffResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    const business = businessResult.data;
    const service = serviceResult.data;
    const staff = staffResult.data;
    const assignment = assignmentResult.data;

    if (!business) {
      return errorResponse(
        response,
        404,
        "business_unavailable",
        "This business is not available for booking",
      );
    }
    if (!service) {
      return errorResponse(
        response,
        409,
        "service_unavailable",
        "This service is no longer available",
      );
    }
    if (!staff || !assignment) {
      return errorResponse(
        response,
        409,
        "staff_unavailable",
        "This staff option is no longer available",
      );
    }

    const now = new Date();
    const minNoticeMinutes = Math.max(0, business.min_notice_minutes ?? 0);
    if (startAt < addMinutes(now, minNoticeMinutes)) {
      return errorResponse(
        response,
        409,
        "booking_too_soon",
        "This appointment time is too soon to book",
      );
    }

    const timeZone = safeTimeZone(business.timezone);
    const maxAdvanceDays = Math.max(0, business.max_advance_days ?? 60);
    const maxDateKey = dateKeyInTimeZone(
      new Date(now.getTime() + maxAdvanceDays * 86_400_000),
      timeZone,
    );
    if (dateKeyInTimeZone(startAt, timeZone) > maxDateKey) {
      return errorResponse(
        response,
        409,
        "booking_too_far_ahead",
        "This appointment is outside the booking window",
      );
    }

    const dayOfWeek = dayOfWeekInTimeZone(startAt, timeZone);
    const [staffHoursResult, businessHoursResult] = await Promise.all([
      context.supabaseAdmin
        .from("staff_availability")
        .select("start_time, end_time, is_closed")
        .eq("staff_member_id", staffMemberId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle<AvailabilityRow>(),
      context.supabaseAdmin
        .from("availability")
        .select("start_time, end_time, is_closed")
        .eq("business_id", businessId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle<AvailabilityRow>(),
    ]);
    if (staffHoursResult.error) throw staffHoursResult.error;
    if (businessHoursResult.error) throw businessHoursResult.error;
    const staffHours = staffHoursResult.data;
    const businessHours = businessHoursResult.data;
    const hours = staffHours || businessHours;
    const availableFrom = hours ? clockMinutes(hours.start_time) : null;
    const availableUntil = hours ? clockMinutes(hours.end_time) : null;
    const appointmentStartMinutes = minutesSinceMidnightInTimeZone(
      startAt,
      timeZone,
    );
    const appointmentEndMinutes =
      appointmentStartMinutes + service.duration_minutes;
    const intervalMinutes = Math.max(
      1,
      business.booking_interval_minutes ?? 15,
    );

    if (
      !hours ||
      hours.is_closed ||
      availableFrom === null ||
      availableUntil === null ||
      appointmentStartMinutes < availableFrom ||
      appointmentEndMinutes > availableUntil ||
      (appointmentStartMinutes - availableFrom) % intervalMinutes !== 0
    ) {
      return errorResponse(
        response,
        409,
        "slot_unavailable",
        "This time is no longer available",
      );
    }

    const appointmentEnd = addMinutes(startAt, service.duration_minutes);
    const candidateStart = addMinutes(
      startAt,
      -Math.max(0, business.buffer_before_minutes ?? 0),
    );
    const candidateEnd = addMinutes(
      appointmentEnd,
      Math.max(0, business.buffer_after_minutes ?? 0),
    );
    const { data: occupiedBookings, error: occupiedError } =
      await context.supabaseAdmin
        .from("bookings")
        .select("start_at, end_at, duration_minutes")
        .eq("business_id", businessId)
        .eq("staff_member_id", staffMemberId)
        .in("status", ["pending", "confirmed"])
        .gte(
          "start_at",
          new Date(candidateStart.getTime() - 86_400_000).toISOString(),
        )
        .lte(
          "start_at",
          new Date(candidateEnd.getTime() + 86_400_000).toISOString(),
        )
        .returns<BookingOverlapRow[]>();

    if (occupiedError) throw occupiedError;
    const hasConflict = (occupiedBookings || []).some((booking) => {
      const existingStart = new Date(booking.start_at);
      return (
        candidateStart < bookingEnd(booking) && candidateEnd > existingStart
      );
    });
    if (hasConflict) {
      return errorResponse(
        response,
        409,
        "slot_unavailable",
        "This time was just booked. Choose another time",
      );
    }

    const status: "pending" | "confirmed" =
      business.auto_accept_bookings === false ? "pending" : "confirmed";
    const locale = context.profile?.preferred_language === "sq" ? "sq" : "en";
    const appointmentTime = new Intl.DateTimeFormat(
      locale === "sq" ? "sq-AL" : "en-GB",
      {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(startAt);
    const copy = localizedCopy({
      locale,
      status,
      businessName: business.name,
      serviceName: service.name,
      staffName: staff.name,
      customerName,
      appointmentTime,
    });
    const appointmentDate = dateKeyInTimeZone(startAt, timeZone);

    const { data: created, error: createError } = await context.supabaseAdmin
      .rpc("mirebook_create_customer_booking", {
        p_customer_user_id: context.user.id,
        p_business_id: businessId,
        p_service_id: serviceId,
        p_staff_member_id: staffMemberId,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_customer_phone: context.profile?.phone?.trim() || null,
        p_customer_notes: customerNotes || null,
        p_start_at: startAt.toISOString(),
        p_duration_minutes: service.duration_minutes,
        p_booking_status: status,
        p_customer_notification_title: copy.customerTitle,
        p_customer_notification_message: copy.customerMessage,
        p_business_notification_title: copy.businessTitle,
        p_business_notification_message: copy.businessMessage,
        p_staff_notification_title: copy.staffTitle,
        p_staff_notification_message: copy.staffMessage,
        p_business_action_url: `/dashboard/bookings?businessId=${businessId}&date=${appointmentDate}`,
        p_staff_action_url: `/staff/calendar?date=${appointmentDate}`,
      })
      .single<AtomicBookingResult>();

    if (createError || !created) {
      const message = createError?.message || "Booking could not be created";
      if (
        message.includes("prevent_overlapping_bookings") ||
        message.includes("customer_booking_slot_unavailable")
      ) {
        return errorResponse(
          response,
          409,
          "slot_unavailable",
          "This time was just booked. Choose another time",
        );
      }
      if (message.includes("customer_booking_business_unavailable")) {
        return errorResponse(
          response,
          404,
          "business_unavailable",
          "This business is not available for booking",
        );
      }
      if (message.includes("customer_booking_service_unavailable")) {
        return errorResponse(
          response,
          409,
          "service_unavailable",
          "This service is no longer available",
        );
      }
      if (message.includes("customer_booking_staff_unavailable")) {
        return errorResponse(
          response,
          409,
          "staff_unavailable",
          "This staff option is no longer available",
        );
      }
      if (
        createError?.code === "PGRST202" ||
        message.includes("mirebook_create_customer_booking")
      ) {
        return errorResponse(
          response,
          503,
          "booking_contract_not_installed",
          "Native booking is not configured yet",
        );
      }
      throw createError || new Error(message);
    }

    const emailDelivery = await requestBookingCreatedEmail(
      request,
      created.booking_id,
    );

    return response.status(201).json({
      booking: {
        id: created.booking_id,
        status: created.booking_status,
        businessName: business.name,
        serviceName: service.name,
        staffName: staff.name,
        startAt: startAt.toISOString(),
        durationMinutes: service.duration_minutes,
        timezone: timeZone,
      },
      notifications: "committed",
      emailDelivery,
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
