import type { NextApiRequest, NextApiResponse } from "next";
import {
  addDays,
  businessForContext,
  endOfDay,
  errorResponse,
  firstRelation,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  safeDateFromInput,
  staffForContext,
  startOfDay,
  startOfWeek,
} from "@/lib/server/app-api/context";

type CalendarBookingRow = {
  id: string;
  business_id: string;
  staff_member_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
  services?:
    | { id?: string | null; name?: string | null; price?: number | null }
    | Array<{
        id?: string | null;
        name?: string | null;
        price?: number | null;
      }>
    | null;
  staff_members?:
    | { id?: string | null; name?: string | null; role_title?: string | null }
    | Array<{
        id?: string | null;
        name?: string | null;
        role_title?: string | null;
      }>
    | null;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function statusLabel(status: string) {
  if (status === "pending") return "Needs approval";
  if (status === "confirmed") return "Confirmed";
  if (status === "declined") return "Declined";
  if (status === "cancelled") return "Cancelled";
  if (status === "completed") return "Completed";
  return "Booking";
}

function actionsForBooking(status: string, scope: "business" | "staff") {
  if (scope !== "business") return [];
  if (status === "pending") return ["accept", "decline"];
  if (status === "confirmed") return ["cancel", "complete"];
  return [];
}

function calendarRange(req: NextApiRequest) {
  const fromParam = readStringParam(req.query.from);
  const toParam = readStringParam(req.query.to);
  const dateParam = readStringParam(req.query.date);
  const baseDate = safeDateFromInput(dateParam) || new Date();

  const fallbackFrom = startOfWeek(baseDate);
  const fallbackTo = endOfDay(addDays(fallbackFrom, 6));
  const parsedFrom = fromParam ? new Date(fromParam) : fallbackFrom;
  const parsedTo = toParam ? new Date(toParam) : fallbackTo;
  const from = Number.isNaN(parsedFrom.getTime()) ? fallbackFrom : parsedFrom;
  const to = Number.isNaN(parsedTo.getTime()) ? fallbackTo : parsedTo;
  const maxTo = endOfDay(addDays(startOfDay(from), 62));

  return {
    from,
    to: to > maxTo ? maxTo : to,
  };
}

function shapeBooking(
  booking: CalendarBookingRow,
  scope: "business" | "staff",
) {
  const service = firstRelation(booking.services);
  const staff = firstRelation(booking.staff_members);
  const start = new Date(booking.start_at);
  const end = booking.end_at
    ? new Date(booking.end_at)
    : addMinutes(start, booking.duration_minutes);

  return {
    id: booking.id,
    businessId: booking.business_id,
    customerName: booking.customer_name,
    customerEmail: booking.customer_email || null,
    customerPhone: booking.customer_phone || null,
    service: service
      ? {
          id: service.id || null,
          name: service.name || "Appointment",
          price: service.price ?? null,
        }
      : null,
    staff: staff
      ? {
          id: staff.id || booking.staff_member_id || null,
          name: staff.name || "Staff member",
          roleTitle: staff.role_title || null,
        }
      : null,
    startAt: booking.start_at,
    endAt: end.toISOString(),
    durationMinutes: booking.duration_minutes,
    status: booking.status,
    statusLabel: statusLabel(booking.status),
    availableActions: actionsForBooking(booking.status, scope),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const context = await loadAppContext(req);
    const requestedScope = readStringParam(req.query.scope);
    const scope: "business" | "staff" =
      requestedScope === "staff" || !context.canUseBusiness
        ? "staff"
        : "business";
    const { from, to } = calendarRange(req);

    if (scope === "business") {
      const business = businessForContext(
        context,
        readStringParam(req.query.businessId),
      );

      if (!business) {
        return errorResponse(
          res,
          403,
          "business_not_available",
          "Business calendar is not available",
        );
      }

      const staffId = readStringParam(req.query.staffId);
      let query = context.supabaseAdmin
        .from("bookings")
        .select(
          `
          id,
          business_id,
          staff_member_id,
          customer_name,
          customer_email,
          customer_phone,
          start_at,
          end_at,
          duration_minutes,
          status,
          services (
            id,
            name,
            price
          ),
          staff_members (
            id,
            name,
            role_title
          )
        `,
        )
        .eq("business_id", business.id)
        .gte("start_at", from.toISOString())
        .lte("start_at", to.toISOString())
        .order("start_at", { ascending: true });

      if (staffId) query = query.eq("staff_member_id", staffId);

      const { data, error } = await query.returns<CalendarBookingRow[]>();
      if (error) throw error;

      return res.status(200).json({
        scope,
        range: { from: from.toISOString(), to: to.toISOString() },
        business: {
          id: business.id,
          name: business.name,
          timezone: business.timezone,
        },
        appointments: (data || []).map((booking) =>
          shapeBooking(booking, scope),
        ),
      });
    }

    const staff = staffForContext(context, readStringParam(req.query.staffId));
    if (!staff?.id) {
      return errorResponse(
        res,
        403,
        "staff_not_available",
        "Staff calendar is not available",
      );
    }

    const { data, error } = await context.supabaseAdmin
      .from("bookings")
      .select(
        `
        id,
        business_id,
        staff_member_id,
        customer_name,
        customer_email,
        customer_phone,
        start_at,
        end_at,
        duration_minutes,
        status,
        services (
          id,
          name,
          price
        ),
        staff_members (
          id,
          name,
          role_title
        )
      `,
      )
      .eq("staff_member_id", staff.id)
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString())
      .order("start_at", { ascending: true })
      .returns<CalendarBookingRow[]>();

    if (error) throw error;

    return res.status(200).json({
      scope,
      range: { from: from.toISOString(), to: to.toISOString() },
      staff: {
        id: staff.id,
        businessId: staff.business_id,
        name: staff.name,
        roleTitle: staff.role_title,
      },
      appointments: (data || []).map((booking) => shapeBooking(booking, scope)),
    });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
