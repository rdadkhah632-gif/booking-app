import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { DEFAULT_TIME_ZONE, zonedDateTimeToUtc } from "@/lib/timezone";

type ManualBookingRequest = {
  businessId?: string;
  serviceId?: string;
  staffMemberId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNotes?: string;
  date?: string;
  time?: string;
  startAt?: string;
};

type BookingOverlapRow = {
  id: string;
  staff_member_id: string;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
};

type CustomerProfileRow = {
  id: string;
};

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
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

function overlaps(
  booking: BookingOverlapRow,
  staffMemberId: string,
  start: Date,
  end: Date,
) {
  if (booking.staff_member_id !== staffMemberId) return false;

  const bookingStart = new Date(booking.start_at);
  const bookingEnd = booking.end_at
    ? new Date(booking.end_at)
    : addMinutes(bookingStart, booking.duration_minutes);

  return start < bookingEnd && end > bookingStart;
}

function cleanText(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(
  res: NextApiResponse,
  status: number,
  code: string,
  error: string,
) {
  return res.status(status).json({ code, error });
}

function manualStartFromRequest(params: {
  date: string;
  time: string;
  timeZone?: string | null;
  startAt?: string;
}) {
  if (params.startAt) {
    const parsedStart = new Date(params.startAt);
    if (!Number.isNaN(parsedStart.getTime())) return parsedStart;
  }

  return zonedDateTimeToUtc(params.date, params.time, params.timeZone);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  const token = bearerToken(req);
  if (!token) {
    return errorResponse(res, 401, "auth_required", "Authentication required");
  }

  const request = (req.body || {}) as ManualBookingRequest;
  const businessId = cleanText(request.businessId);
  const serviceId = cleanText(request.serviceId);
  const staffMemberId = cleanText(request.staffMemberId);
  const customerName = cleanText(request.customerName);
  const customerEmail = cleanText(request.customerEmail).toLowerCase();
  const customerPhone = cleanText(request.customerPhone);
  const customerNotes = cleanText(request.customerNotes);
  const date = cleanText(request.date);
  const time = cleanText(request.time);
  const startAt = cleanText(request.startAt);

  if (
    !businessId ||
    !serviceId ||
    !staffMemberId ||
    !customerName ||
    !customerEmail.includes("@") ||
    !date ||
    !time
  ) {
    return errorResponse(res, 400, "invalid_request", "Invalid appointment");
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    return errorResponse(
      res,
      500,
      "server_not_configured",
      "Manual appointments are not configured",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return errorResponse(res, 401, "invalid_session", "Invalid session");
  }

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, user_id, timezone")
    .eq("id", businessId)
    .maybeSingle<{ id: string; user_id: string; timezone?: string | null }>();

  if (businessError) {
    return errorResponse(
      res,
      500,
      "business_lookup_failed",
      businessError.message,
    );
  }

  if (!business) {
    return errorResponse(res, 403, "forbidden", "Appointment not permitted");
  }

  const isBusinessOwner = business.user_id === user.id;
  let isAssignedStaffMember = false;

  if (!isBusinessOwner) {
    const { data: staffAccess, error: staffAccessError } = await supabaseAdmin
      .from("staff_members")
      .select("id")
      .eq("id", staffMemberId)
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle<{ id: string }>();

    if (staffAccessError) {
      return errorResponse(
        res,
        500,
        "staff_lookup_failed",
        staffAccessError.message,
      );
    }

    isAssignedStaffMember = Boolean(staffAccess);
  }

  if (!isBusinessOwner && !isAssignedStaffMember) {
    return errorResponse(res, 403, "forbidden", "Appointment not permitted");
  }

  const start = manualStartFromRequest({
    date,
    time,
    timeZone: business.timezone || DEFAULT_TIME_ZONE,
    startAt,
  });
  if (Number.isNaN(start.getTime())) {
    return errorResponse(res, 400, "invalid_time", "Invalid appointment time");
  }

  const [
    { data: service, error: serviceError },
    { data: staff, error: staffError },
    { data: staffService, error: staffServiceError },
    { data: existingBookings, error: bookingsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, duration_minutes, active")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .eq("active", true)
      .maybeSingle<{ id: string; duration_minutes: number; active: boolean }>(),
    supabaseAdmin
      .from("staff_members")
      .select("id, active")
      .eq("id", staffMemberId)
      .eq("business_id", businessId)
      .eq("active", true)
      .maybeSingle<{ id: string; active: boolean }>(),
    supabaseAdmin
      .from("staff_services")
      .select("staff_member_id")
      .eq("staff_member_id", staffMemberId)
      .eq("service_id", serviceId)
      .maybeSingle<{ staff_member_id: string }>(),
    supabaseAdmin
      .from("bookings")
      .select("id, staff_member_id, start_at, end_at, duration_minutes, status")
      .eq("business_id", businessId)
      .eq("staff_member_id", staffMemberId)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", addDays(startOfDay(start), -1).toISOString())
      .lte("start_at", addDays(endOfDay(start), 1).toISOString()),
  ]);

  if (serviceError) {
    return errorResponse(
      res,
      500,
      "service_lookup_failed",
      serviceError.message,
    );
  }
  if (staffError) {
    return errorResponse(res, 500, "staff_lookup_failed", staffError.message);
  }
  if (staffServiceError) {
    return errorResponse(
      res,
      500,
      "staff_service_lookup_failed",
      staffServiceError.message,
    );
  }
  if (bookingsError) {
    return errorResponse(
      res,
      500,
      "bookings_lookup_failed",
      bookingsError.message,
    );
  }

  if (!service) {
    return errorResponse(
      res,
      404,
      "service_unavailable",
      "Service unavailable",
    );
  }
  if (!staff) {
    return errorResponse(res, 404, "staff_unavailable", "Staff unavailable");
  }
  if (!staffService) {
    return errorResponse(
      res,
      409,
      "staff_service_unavailable",
      "Staff not assigned to service",
    );
  }

  const durationMinutes = service.duration_minutes;
  const appointmentEnd = addMinutes(start, durationMinutes);
  const hasConflict = ((existingBookings || []) as BookingOverlapRow[]).some(
    (booking) => overlaps(booking, staffMemberId, start, appointmentEnd),
  );

  if (hasConflict) {
    return errorResponse(res, 409, "conflict", "Appointment time unavailable");
  }

  const { data: existingCustomerProfile, error: customerProfileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", customerEmail)
      .maybeSingle<CustomerProfileRow>();

  if (customerProfileError) {
    return errorResponse(
      res,
      500,
      "customer_lookup_failed",
      customerProfileError.message,
    );
  }

  const { data: createdBooking, error: createError } = await supabaseAdmin
    .from("bookings")
    .insert({
      business_id: businessId,
      service_id: serviceId,
      staff_member_id: staffMemberId,
      customer_user_id: existingCustomerProfile?.id || null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      customer_notes: customerNotes || null,
      start_at: start.toISOString(),
      duration_minutes: durationMinutes,
      status: "confirmed",
    })
    .select("id")
    .single<{ id: string }>();

  if (createError) {
    if (createError.message.includes("prevent_overlapping_bookings")) {
      return errorResponse(
        res,
        409,
        "conflict",
        "Appointment time unavailable",
      );
    }

    return errorResponse(res, 500, "create_failed", createError.message);
  }

  return res.status(200).json({ bookingId: createdBooking.id });
}
