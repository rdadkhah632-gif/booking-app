import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  firstRelation,
  loadAppContext,
} from "@/lib/server/app-api/context";

type NotificationRow = {
  booking_id?: string | null;
};

type BookingRow = {
  id: string;
  business_id: string;
  service_id: string;
  staff_member_id?: string | null;
  departure_id?: string | null;
  customer_name?: string | null;
  party_size?: number | null;
  start_at: string;
  duration_minutes: number;
  status: string;
};

type DepartureRow = {
  id: string;
  business_id: string;
  staff_member_id?: string | null;
};

type ServiceRow = {
  id: string;
  name?: string | null;
};

type BusinessRow = {
  id: string;
  timezone?: string | null;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return errorResponse(
      response,
      405,
      "method_not_allowed",
      "Method not allowed",
    );
  }

  response.setHeader("Cache-Control", "private, no-store");

  try {
    const context = await loadAppContext(request);
    const linkedStaff = context.linkedStaffProfiles.filter(
      (staff) => staff.active !== false,
    );

    if (linkedStaff.length === 0) {
      return errorResponse(
        response,
        403,
        "staff_required",
        "A linked staff profile is required",
      );
    }

    const linkedStaffIds = linkedStaff.map((staff) => staff.id);
    const linkedBusinessIds = Array.from(
      new Set(linkedStaff.map((staff) => staff.business_id)),
    );
    const { data: notifications, error: notificationError } =
      await context.supabaseAdmin
        .from("notifications")
        .select("booking_id")
        .eq("user_id", context.user.id)
        .in("audience", ["staff", "general"])
        .not("booking_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<NotificationRow[]>();

    if (notificationError) throw notificationError;

    const bookingIds = Array.from(
      new Set(
        (notifications || [])
          .map((notification) => notification.booking_id)
          .filter((bookingId): bookingId is string => Boolean(bookingId)),
      ),
    );

    if (bookingIds.length === 0) {
      return response.status(200).json({ contexts: [] });
    }

    const { data: bookings, error: bookingError } = await context.supabaseAdmin
      .from("bookings")
      .select(
        "id, business_id, service_id, staff_member_id, departure_id, customer_name, party_size, start_at, duration_minutes, status",
      )
      .in("id", bookingIds)
      .in("business_id", linkedBusinessIds)
      .returns<BookingRow[]>();

    if (bookingError) throw bookingError;

    const departureIds = Array.from(
      new Set(
        (bookings || [])
          .map((booking) => booking.departure_id)
          .filter((departureId): departureId is string => Boolean(departureId)),
      ),
    );
    const { data: departures, error: departureError } = departureIds.length
      ? await context.supabaseAdmin
          .from("service_departures")
          .select("id, business_id, staff_member_id")
          .in("id", departureIds)
          .in("business_id", linkedBusinessIds)
          .returns<DepartureRow[]>()
      : { data: [] as DepartureRow[], error: null };

    if (departureError) throw departureError;

    const departureById = new Map(
      (departures || []).map((departure) => [departure.id, departure]),
    );
    const authorizedBookings = (bookings || []).filter((booking) => {
      if (booking.departure_id) {
        const departure = departureById.get(booking.departure_id);
        return Boolean(
          departure?.staff_member_id &&
          linkedStaffIds.includes(departure.staff_member_id),
        );
      }

      return Boolean(
        booking.staff_member_id &&
        linkedStaffIds.includes(booking.staff_member_id),
      );
    });
    const serviceIds = Array.from(
      new Set(authorizedBookings.map((booking) => booking.service_id)),
    );
    const businessIds = Array.from(
      new Set(authorizedBookings.map((booking) => booking.business_id)),
    );
    const [serviceResult, businessResult] = await Promise.all([
      serviceIds.length
        ? context.supabaseAdmin
            .from("services")
            .select("id, name")
            .in("id", serviceIds)
            .returns<ServiceRow[]>()
        : Promise.resolve({ data: [] as ServiceRow[], error: null }),
      businessIds.length
        ? context.supabaseAdmin
            .from("businesses")
            .select("id, timezone")
            .in("id", businessIds)
            .returns<BusinessRow[]>()
        : Promise.resolve({ data: [] as BusinessRow[], error: null }),
    ]);

    if (serviceResult.error) throw serviceResult.error;
    if (businessResult.error) throw businessResult.error;

    const serviceById = new Map(
      (serviceResult.data || []).map((service) => [service.id, service]),
    );
    const businessById = new Map(
      (businessResult.data || []).map((business) => [business.id, business]),
    );

    return response.status(200).json({
      contexts: authorizedBookings.map((booking) => ({
        id: booking.id,
        departure_id: booking.departure_id || null,
        customer_name: booking.customer_name || "Customer",
        party_size: Math.max(Number(booking.party_size || 1), 1),
        start_at: booking.start_at,
        duration_minutes: booking.duration_minutes,
        status: booking.status,
        services: firstRelation(serviceById.get(booking.service_id)) || null,
        businesses:
          firstRelation(businessById.get(booking.business_id)) || null,
      })),
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
