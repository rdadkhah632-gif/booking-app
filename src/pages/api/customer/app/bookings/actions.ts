import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { requestBookingCustomerCancelledEmail } from "@/lib/server/app-api/transactionalEmail";
import { Locale, translate } from "@/lib/i18n";
import {
  DEFAULT_TIME_ZONE,
  dateKeyInTimeZone,
  minutesSinceMidnightInTimeZone,
} from "@/lib/timezone";

type CustomerBookingAction =
  "cancel_booking" | "submit_reschedule" | "cancel_reschedule";

type ActionBody = {
  action?: unknown;
  bookingId?: unknown;
  requestId?: unknown;
  staffMemberId?: unknown;
  startAt?: unknown;
};

type BookingRow = {
  id: string;
  business_id: string;
  service_id: string;
  staff_member_id?: string | null;
  customer_user_id: string;
  customer_name: string;
  start_at: string;
  duration_minutes: number;
  status: string;
};

type BusinessRow = {
  id: string;
  name: string;
  timezone?: string | null;
  booking_interval_minutes?: number | null;
  min_notice_minutes?: number | null;
  max_advance_days?: number | null;
  buffer_before_minutes?: number | null;
  buffer_after_minutes?: number | null;
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
  id: string;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
};

type RescheduleRequestRow = {
  id: string;
  booking_id: string;
  business_id: string;
  customer_user_id: string;
  status: string;
};

type CancelBookingResult = {
  booking_id: string;
  booking_status: string;
};

type SubmitRescheduleResult = {
  request_id: string;
  request_status: string;
  requested_start_at: string;
  requested_staff_member_id: string;
};

type CancelRescheduleResult = {
  request_id: string;
  request_status: string;
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

function formatAppointment(date: Date, timeZone: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function contractUnavailable(message: string, functionName: string) {
  return message.includes(functionName);
}

function mapLifecycleError(
  response: NextApiResponse,
  error: { code?: string; message?: string } | null,
  functionName: string,
) {
  const message = error?.message || "Customer booking action failed";
  if (
    error?.code === "PGRST202" ||
    contractUnavailable(message, functionName)
  ) {
    return errorResponse(
      response,
      503,
      "booking_lifecycle_contract_not_installed",
      "Native booking management is not configured yet",
    );
  }
  if (message.includes("customer_booking_not_found")) {
    return errorResponse(
      response,
      404,
      "booking_not_found",
      "Booking was not found",
    );
  }
  if (
    message.includes("customer_booking_action_unavailable") ||
    message.includes("customer_reschedule_action_unavailable")
  ) {
    return errorResponse(
      response,
      409,
      "action_no_longer_available",
      "This action is no longer available",
    );
  }
  if (message.includes("customer_reschedule_slot_unavailable")) {
    return errorResponse(
      response,
      409,
      "slot_unavailable",
      "This time is no longer available",
    );
  }
  if (message.includes("customer_reschedule_staff_unavailable")) {
    return errorResponse(
      response,
      409,
      "staff_unavailable",
      "This professional is no longer available",
    );
  }
  if (message.includes("customer_reschedule_invalid")) {
    return errorResponse(
      response,
      409,
      "invalid_reschedule",
      "Choose a different future appointment time",
    );
  }
  throw error || new Error(message);
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
    const body = (request.body || {}) as ActionBody;
    const action = cleanText(body.action) as CustomerBookingAction;
    const bookingId = cleanText(body.bookingId);
    const requestId = cleanText(body.requestId);
    const staffMemberId = cleanText(body.staffMemberId);
    const startAtValue = cleanText(body.startAt);
    const locale: Locale =
      context.profile?.preferred_language === "sq" ? "sq" : "en";

    if (
      !["cancel_booking", "submit_reschedule", "cancel_reschedule"].includes(
        action,
      )
    ) {
      return errorResponse(
        response,
        400,
        "invalid_action_request",
        "Choose a supported booking action",
      );
    }

    if (action === "cancel_reschedule") {
      if (!UUID_PATTERN.test(requestId)) {
        return errorResponse(
          response,
          400,
          "invalid_action_request",
          "A valid reschedule request is required",
        );
      }

      const { data: bookingRequest, error: requestError } =
        await context.supabaseAdmin
          .from("booking_requests")
          .select("id, booking_id, business_id, customer_user_id, status")
          .eq("id", requestId)
          .eq("customer_user_id", context.user.id)
          .maybeSingle<RescheduleRequestRow>();
      if (requestError) throw requestError;
      if (!bookingRequest) {
        return errorResponse(
          response,
          404,
          "reschedule_request_not_found",
          "Reschedule request was not found",
        );
      }

      const [{ data: booking }, { data: business }] = await Promise.all([
        context.supabaseAdmin
          .from("bookings")
          .select("customer_name")
          .eq("id", bookingRequest.booking_id)
          .maybeSingle<{ customer_name?: string | null }>(),
        context.supabaseAdmin
          .from("businesses")
          .select("name")
          .eq("id", bookingRequest.business_id)
          .maybeSingle<{ name?: string | null }>(),
      ]);
      const customerName = booking?.customer_name?.trim() || "Customer";
      const businessName = business?.name?.trim() || "Business";
      const message = fill(
        translate(
          locale,
          "customerApp.lifecycle.rescheduleCancelled.businessMessage",
          "{customer} withdrew their reschedule request at {business}.",
        ),
        { customer: customerName, business: businessName },
      );
      const { data: cancelled, error: cancelError } =
        await context.supabaseAdmin
          .rpc("mirebook_cancel_customer_reschedule", {
            p_customer_user_id: context.user.id,
            p_booking_request_id: requestId,
            p_business_notification_title: translate(
              locale,
              "customerApp.lifecycle.rescheduleCancelled.businessTitle",
              "Reschedule request withdrawn",
            ),
            p_business_notification_message: message,
            p_business_action_url: `/dashboard/notifications?businessId=${bookingRequest.business_id}`,
          })
          .single<CancelRescheduleResult>();

      if (cancelError || !cancelled) {
        return mapLifecycleError(
          response,
          cancelError,
          "mirebook_cancel_customer_reschedule",
        );
      }

      return response.status(200).json({
        action,
        request: {
          id: cancelled.request_id,
          status: cancelled.request_status,
        },
        notifications: "committed",
        emailDelivery: "not_requested",
      });
    }

    if (!UUID_PATTERN.test(bookingId)) {
      return errorResponse(
        response,
        400,
        "invalid_action_request",
        "A valid booking is required",
      );
    }

    const { data: booking, error: bookingError } = await context.supabaseAdmin
      .from("bookings")
      .select(
        "id, business_id, service_id, staff_member_id, customer_user_id, customer_name, start_at, duration_minutes, status",
      )
      .eq("id", bookingId)
      .eq("customer_user_id", context.user.id)
      .maybeSingle<BookingRow>();
    if (bookingError) throw bookingError;
    if (!booking) {
      return errorResponse(
        response,
        404,
        "booking_not_found",
        "Booking was not found",
      );
    }

    const [{ data: business, error: businessError }, { data: service }] =
      await Promise.all([
        context.supabaseAdmin
          .from("businesses")
          .select(
            "id, name, timezone, booking_interval_minutes, min_notice_minutes, max_advance_days, buffer_before_minutes, buffer_after_minutes",
          )
          .eq("id", booking.business_id)
          .maybeSingle<BusinessRow>(),
        context.supabaseAdmin
          .from("services")
          .select("id, name, duration_minutes")
          .eq("id", booking.service_id)
          .maybeSingle<ServiceRow>(),
      ]);
    if (businessError) throw businessError;
    if (!business) {
      return errorResponse(
        response,
        409,
        "business_unavailable",
        "This business is no longer available",
      );
    }

    const timeZone = safeTimeZone(business.timezone);
    const currentAppointment = formatAppointment(
      new Date(booking.start_at),
      timeZone,
      locale,
    );
    const serviceName = service?.name || "Appointment";

    if (action === "cancel_booking") {
      if (!["pending", "confirmed"].includes(booking.status)) {
        return errorResponse(
          response,
          409,
          "action_no_longer_available",
          "This booking can no longer be cancelled",
        );
      }

      const message = fill(
        translate(
          locale,
          "customerApp.lifecycle.cancelled.businessMessage",
          "{customer} cancelled {service} for {time}.",
        ),
        {
          customer: booking.customer_name,
          service: serviceName,
          time: currentAppointment,
        },
      );
      const appointmentDate = dateKeyInTimeZone(
        new Date(booking.start_at),
        timeZone,
      );
      const { data: cancelled, error: cancelError } =
        await context.supabaseAdmin
          .rpc("mirebook_cancel_customer_booking", {
            p_customer_user_id: context.user.id,
            p_booking_id: booking.id,
            p_business_notification_title: translate(
              locale,
              "customerApp.lifecycle.cancelled.businessTitle",
              "Customer cancelled booking",
            ),
            p_business_notification_message: message,
            p_staff_notification_title: translate(
              locale,
              "customerApp.lifecycle.cancelled.staffTitle",
              "Booking cancelled",
            ),
            p_staff_notification_message: message,
            p_business_action_url: `/dashboard/bookings?businessId=${booking.business_id}&date=${appointmentDate}`,
            p_staff_action_url: `/staff/calendar?date=${appointmentDate}&bookingId=${booking.id}`,
          })
          .single<CancelBookingResult>();

      if (cancelError || !cancelled) {
        return mapLifecycleError(
          response,
          cancelError,
          "mirebook_cancel_customer_booking",
        );
      }

      const emailDelivery = await requestBookingCustomerCancelledEmail(
        request,
        booking.id,
      );
      return response.status(200).json({
        action,
        booking: {
          id: cancelled.booking_id,
          status: cancelled.booking_status,
        },
        notifications: "committed",
        emailDelivery,
      });
    }

    if (!UUID_PATTERN.test(staffMemberId)) {
      return errorResponse(
        response,
        400,
        "invalid_reschedule",
        "Choose a valid professional",
      );
    }
    const startAt = new Date(startAtValue);
    if (!startAtValue || Number.isNaN(startAt.getTime())) {
      return errorResponse(
        response,
        400,
        "invalid_reschedule",
        "Choose a valid appointment time",
      );
    }
    if (booking.status !== "confirmed") {
      return errorResponse(
        response,
        409,
        "action_no_longer_available",
        "Only confirmed bookings can be rescheduled",
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

    const [{ data: staff, error: staffError }, { data: assignment }] =
      await Promise.all([
        context.supabaseAdmin
          .from("staff_members")
          .select("id, name")
          .eq("id", staffMemberId)
          .eq("business_id", booking.business_id)
          .eq("active", true)
          .maybeSingle<StaffRow>(),
        context.supabaseAdmin
          .from("staff_services")
          .select("staff_member_id")
          .eq("staff_member_id", staffMemberId)
          .eq("service_id", service.id)
          .maybeSingle<{ staff_member_id: string }>(),
      ]);
    if (staffError) throw staffError;
    if (!staff || !assignment) {
      return errorResponse(
        response,
        409,
        "staff_unavailable",
        "This professional is no longer available",
      );
    }

    const now = new Date();
    const minNoticeMinutes = Math.max(0, business.min_notice_minutes ?? 0);
    if (startAt < addMinutes(now, minNoticeMinutes)) {
      return errorResponse(
        response,
        409,
        "booking_too_soon",
        "This appointment time is too soon",
      );
    }
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
    if (
      startAt.getTime() === new Date(booking.start_at).getTime() &&
      staffMemberId === booking.staff_member_id
    ) {
      return errorResponse(
        response,
        409,
        "invalid_reschedule",
        "Choose a different time or professional",
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
        .eq("business_id", booking.business_id)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle<AvailabilityRow>(),
    ]);
    if (staffHoursResult.error) throw staffHoursResult.error;
    if (businessHoursResult.error) throw businessHoursResult.error;
    const hours = staffHoursResult.data || businessHoursResult.data;
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

    const candidateStart = addMinutes(
      startAt,
      -Math.max(0, business.buffer_before_minutes ?? 0),
    );
    const candidateEnd = addMinutes(
      startAt,
      service.duration_minutes +
        Math.max(0, business.buffer_after_minutes ?? 0),
    );
    const { data: occupiedBookings, error: occupiedError } =
      await context.supabaseAdmin
        .from("bookings")
        .select("id, start_at, end_at, duration_minutes")
        .eq("business_id", booking.business_id)
        .eq("staff_member_id", staffMemberId)
        .in("status", ["pending", "confirmed"])
        .neq("id", booking.id)
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
    if (
      (occupiedBookings || []).some((occupied) => {
        const occupiedStart = new Date(occupied.start_at);
        return (
          candidateStart < bookingEnd(occupied) && candidateEnd > occupiedStart
        );
      })
    ) {
      return errorResponse(
        response,
        409,
        "slot_unavailable",
        "This time is no longer available",
      );
    }

    const requestedAppointment = formatAppointment(startAt, timeZone, locale);
    const notificationMessage = fill(
      translate(
        locale,
        "customerApp.lifecycle.reschedule.businessMessage",
        "{customer} requested {service} with {staff} for {time}.",
      ),
      {
        customer: booking.customer_name,
        service: service.name,
        staff: staff.name,
        time: requestedAppointment,
      },
    );
    const { data: submitted, error: submitError } = await context.supabaseAdmin
      .rpc("mirebook_submit_customer_reschedule", {
        p_customer_user_id: context.user.id,
        p_booking_id: booking.id,
        p_requested_staff_member_id: staff.id,
        p_requested_start_at: startAt.toISOString(),
        p_requested_duration_minutes: service.duration_minutes,
        p_request_message: translate(
          locale,
          "customerApp.lifecycle.reschedule.requestMessage",
          "Customer requested a new appointment time.",
        ),
        p_business_notification_title: translate(
          locale,
          "customerApp.lifecycle.reschedule.businessTitle",
          "Reschedule request",
        ),
        p_business_notification_message: notificationMessage,
        p_business_action_url: `/dashboard/notifications?businessId=${booking.business_id}`,
      })
      .single<SubmitRescheduleResult>();

    if (submitError || !submitted) {
      return mapLifecycleError(
        response,
        submitError,
        "mirebook_submit_customer_reschedule",
      );
    }

    return response.status(200).json({
      action,
      request: {
        id: submitted.request_id,
        status: submitted.request_status,
        bookingId: booking.id,
        requestedStartAt: submitted.requested_start_at,
        requestedStaffMemberId: submitted.requested_staff_member_id,
      },
      notifications: "committed",
      emailDelivery: "not_requested",
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
