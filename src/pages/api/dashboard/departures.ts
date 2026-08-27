import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import {
  dateKeyInTimeZone,
  DEFAULT_TIME_ZONE,
  zonedDateTimeToUtc,
} from "@/lib/timezone";

type DepartureRequest = {
  businessId?: unknown;
  departureId?: unknown;
  serviceId?: unknown;
  staffMemberId?: unknown;
  date?: unknown;
  time?: unknown;
  capacity?: unknown;
  meetingPoint?: unknown;
  repeatCount?: unknown;
  status?: unknown;
  bookingId?: unknown;
  bookingStatus?: unknown;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  group_capacity?: number | null;
  booking_type?: string | null;
  price?: number | null;
  private_booking_enabled?: boolean | null;
  private_price?: number | null;
};

type StaffRow = {
  id: string;
  name: string;
  role_title?: string | null;
};

type DepartureRow = {
  id: string;
  business_id: string;
  service_id: string;
  staff_member_id?: string | null;
  start_at: string;
  duration_minutes: number;
  capacity: number;
  meeting_point?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BookingRow = {
  id: string;
  departure_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_notes?: string | null;
  party_size?: number | null;
  booking_option?: string | null;
  status: string;
  total_price?: number | null;
  created_at?: string | null;
  business_id?: string | null;
  service_id?: string | null;
  customer_user_id?: string | null;
  start_at?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integerValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function addDateKeyDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

function departureSeats(booking: BookingRow, capacity: number) {
  return booking.booking_option === "private"
    ? capacity
    : Math.max(Number(booking.party_size || 1), 1);
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (
    request.method !== "GET" &&
    request.method !== "POST" &&
    request.method !== "PATCH"
  ) {
    response.setHeader("Allow", "GET, POST, PATCH");
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
    const source =
      request.method === "GET" ? request.query : request.body || {};
    const businessId = textValue(source.businessId);

    if (!UUID_PATTERN.test(businessId)) {
      return errorResponse(
        response,
        400,
        "business_required",
        "Choose a valid business",
      );
    }

    const ownedBusiness = context.ownedBusinesses.find(
      (business) => business.id === businessId,
    );
    const linkedStaff = context.linkedStaffProfiles.filter(
      (staff) => staff.business_id === businessId && staff.active !== false,
    );
    const isOwner = Boolean(ownedBusiness);

    if (!isOwner && linkedStaff.length === 0) {
      return errorResponse(
        response,
        403,
        "departure_access_denied",
        "Departure access is not permitted",
      );
    }

    const business =
      ownedBusiness ||
      (linkedStaff[0]?.businesses && !Array.isArray(linkedStaff[0].businesses)
        ? linkedStaff[0].businesses
        : null);

    if (request.method === "GET") {
      const now = new Date();
      const defaultFrom = new Date(now);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const defaultTo = new Date(now);
      defaultTo.setDate(defaultTo.getDate() + 365);
      const from = textValue(request.query.from);
      const to = textValue(request.query.to);
      const departureId = textValue(request.query.departureId);

      let departureQuery = context.supabaseAdmin
        .from("service_departures")
        .select(
          "id, business_id, service_id, staff_member_id, start_at, duration_minutes, capacity, meeting_point, status, created_at, updated_at",
        )
        .eq("business_id", businessId)
        .order("start_at", { ascending: true });

      if (UUID_PATTERN.test(departureId)) {
        departureQuery = departureQuery.eq("id", departureId);
      } else {
        departureQuery = departureQuery
          .gte("start_at", from || defaultFrom.toISOString())
          .lte("start_at", to || defaultTo.toISOString());
      }

      if (!isOwner) {
        departureQuery = departureQuery.in(
          "staff_member_id",
          linkedStaff.map((staff) => staff.id),
        );
      }

      const [departureResult, serviceResult, staffResult] = await Promise.all([
        departureQuery.returns<DepartureRow[]>(),
        context.supabaseAdmin
          .from("services")
          .select(
            "id, name, duration_minutes, group_capacity, booking_type, price, private_booking_enabled, private_price",
          )
          .eq("business_id", businessId)
          .eq("booking_type", "group")
          .order("name")
          .returns<ServiceRow[]>(),
        context.supabaseAdmin
          .from("staff_members")
          .select("id, name, role_title")
          .eq("business_id", businessId)
          .eq("active", true)
          .order("name")
          .returns<StaffRow[]>(),
      ]);

      if (departureResult.error) throw departureResult.error;
      if (serviceResult.error) throw serviceResult.error;
      if (staffResult.error) throw staffResult.error;

      const departures = departureResult.data || [];
      const departureIds = departures.map((departure) => departure.id);
      const bookingFields = isOwner
        ? "id, departure_id, customer_name, customer_email, customer_phone, customer_notes, party_size, booking_option, status, total_price, created_at"
        : "id, departure_id, party_size, booking_option, status";
      const { data: bookings, error: bookingError } = departureIds.length
        ? await context.supabaseAdmin
            .from("bookings")
            .select(bookingFields)
            .in("departure_id", departureIds)
            .order("created_at", { ascending: true })
            .returns<BookingRow[]>()
        : { data: [] as BookingRow[], error: null };

      if (bookingError) throw bookingError;

      const serviceById = new Map(
        (serviceResult.data || []).map((service) => [service.id, service]),
      );
      const staffById = new Map(
        (staffResult.data || []).map((staff) => [staff.id, staff]),
      );

      return response.status(200).json({
        ok: true,
        access: isOwner ? "owner" : "staff",
        business: {
          id: businessId,
          name: business?.name || "",
          timezone: safeTimeZone(business?.timezone),
          currency: business?.currency || null,
        },
        services: serviceResult.data || [],
        staffMembers: staffResult.data || [],
        departures: departures.map((departure) => {
          const manifest = (bookings || []).filter(
            (booking) => booking.departure_id === departure.id,
          );
          const activeBookings = manifest.filter((booking) =>
            ["pending", "confirmed"].includes(booking.status),
          );
          const bookedSeats = activeBookings.reduce(
            (sum, booking) => sum + departureSeats(booking, departure.capacity),
            0,
          );

          return {
            ...departure,
            service: serviceById.get(departure.service_id) || null,
            staffMember: departure.staff_member_id
              ? staffById.get(departure.staff_member_id) || null
              : null,
            bookedSeats,
            remainingSeats: Math.max(departure.capacity - bookedSeats, 0),
            bookingCount: activeBookings.length,
            manifest: isOwner ? manifest : [],
          };
        }),
      });
    }

    if (!isOwner) {
      return errorResponse(
        response,
        403,
        "owner_required",
        "Only the business owner can change departures",
      );
    }

    const body = (request.body || {}) as DepartureRequest;

    if (request.method === "POST") {
      const serviceId = textValue(body.serviceId);
      const staffMemberId = textValue(body.staffMemberId);
      const date = textValue(body.date);
      const time = textValue(body.time);
      const capacity = integerValue(body.capacity);
      const repeatCount = Math.min(
        Math.max(integerValue(body.repeatCount, 1), 1),
        31,
      );
      const meetingPoint = textValue(body.meetingPoint).slice(0, 500);

      if (
        !UUID_PATTERN.test(serviceId) ||
        !validDate(date) ||
        !validTime(time)
      ) {
        return errorResponse(
          response,
          400,
          "departure_details_invalid",
          "Choose a group service, date and time",
        );
      }

      const { data: service, error: serviceError } = await context.supabaseAdmin
        .from("services")
        .select(
          "id, name, duration_minutes, group_capacity, booking_type, price, private_booking_enabled, private_price",
        )
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .eq("booking_type", "group")
        .maybeSingle<ServiceRow>();

      if (serviceError) throw serviceError;
      if (!service) {
        return errorResponse(
          response,
          409,
          "group_service_unavailable",
          "This group service is no longer available",
        );
      }

      const finalCapacity = capacity || Number(service.group_capacity || 0);
      if (finalCapacity < 1 || finalCapacity > 200) {
        return errorResponse(
          response,
          400,
          "capacity_invalid",
          "Capacity must be between 1 and 200",
        );
      }

      if (staffMemberId) {
        const { data: staff, error: staffError } = await context.supabaseAdmin
          .from("staff_members")
          .select("id")
          .eq("id", staffMemberId)
          .eq("business_id", businessId)
          .eq("active", true)
          .maybeSingle<{ id: string }>();
        if (staffError) throw staffError;
        if (!staff) {
          return errorResponse(
            response,
            409,
            "guide_unavailable",
            "The selected guide is unavailable",
          );
        }
      }

      const timeZone = safeTimeZone(business?.timezone);
      const rows = Array.from({ length: repeatCount }, (_, index) => {
        const departureDate = addDateKeyDays(date, index);
        const startAt = zonedDateTimeToUtc(departureDate, time, timeZone);
        return {
          business_id: businessId,
          service_id: service.id,
          staff_member_id: staffMemberId || null,
          start_at: startAt.toISOString(),
          duration_minutes: service.duration_minutes,
          capacity: finalCapacity,
          meeting_point: meetingPoint || null,
          status: "scheduled",
          updated_at: new Date().toISOString(),
        };
      });

      if (rows.some((row) => new Date(row.start_at) <= new Date())) {
        return errorResponse(
          response,
          400,
          "departure_must_be_future",
          "Departures must start in the future",
        );
      }

      const { data: created, error: insertError } = await context.supabaseAdmin
        .from("service_departures")
        .insert(rows)
        .select(
          "id, business_id, service_id, staff_member_id, start_at, duration_minutes, capacity, meeting_point, status, created_at, updated_at",
        )
        .returns<DepartureRow[]>();

      if (insertError) {
        if (insertError.code === "23505") {
          return errorResponse(
            response,
            409,
            "departure_already_exists",
            "A departure already exists for this service and time",
          );
        }
        throw insertError;
      }

      return response.status(201).json({ ok: true, departures: created || [] });
    }

    const bookingId = textValue(body.bookingId);
    if (UUID_PATTERN.test(bookingId)) {
      const nextStatus = textValue(body.bookingStatus);
      const { data: booking, error: bookingError } = await context.supabaseAdmin
        .from("bookings")
        .select(
          "id, business_id, service_id, departure_id, customer_user_id, customer_name, customer_email, customer_phone, customer_notes, party_size, booking_option, status, total_price, start_at, created_at",
        )
        .eq("id", bookingId)
        .eq("business_id", businessId)
        .not("departure_id", "is", null)
        .maybeSingle<BookingRow>();

      if (bookingError) throw bookingError;
      if (!booking) {
        return errorResponse(
          response,
          404,
          "reservation_not_found",
          "Reservation not found",
        );
      }

      const allowedTransitions: Record<string, string[]> = {
        pending: ["confirmed", "declined"],
        confirmed: ["cancelled", "completed"],
      };
      if (!allowedTransitions[booking.status]?.includes(nextStatus)) {
        return errorResponse(
          response,
          409,
          "reservation_action_unavailable",
          "This reservation can no longer be changed that way",
        );
      }

      const { data: updated, error: updateError } = await context.supabaseAdmin
        .from("bookings")
        .update({ status: nextStatus })
        .eq("id", booking.id)
        .eq("business_id", businessId)
        .eq("status", booking.status)
        .select("id, status")
        .maybeSingle<{ id: string; status: string }>();

      if (updateError) throw updateError;
      if (!updated) {
        return errorResponse(
          response,
          409,
          "reservation_action_unavailable",
          "This reservation changed while you were reviewing it",
        );
      }

      if (booking.customer_user_id) {
        const { data: customerProfile } = await context.supabaseAdmin
          .from("profiles")
          .select("preferred_language")
          .eq("id", booking.customer_user_id)
          .maybeSingle<{ preferred_language?: string | null }>();
        const albanian = customerProfile?.preferred_language === "sq";
        const copy =
          nextStatus === "confirmed"
            ? {
                type: "booking_accepted",
                title: albanian ? "Rezervimi u konfirmua" : "Booking confirmed",
                message: albanian
                  ? "Biznesi e konfirmoi rezervimin tënd në grup."
                  : "The business confirmed your group booking.",
              }
            : nextStatus === "declined"
              ? {
                  type: "booking_declined",
                  title: albanian ? "Rezervimi u refuzua" : "Booking declined",
                  message: albanian
                    ? "Biznesi nuk mundi ta pranonte këtë rezervim në grup."
                    : "The business could not accept this group booking.",
                }
              : nextStatus === "completed"
                ? {
                    type: "booking_completed",
                    title: albanian
                      ? "Rezervimi në grup u përfundua"
                      : "Group booking completed",
                    message: albanian
                      ? "Rezervimi yt në grup u shënua si i përfunduar."
                      : "Your group booking was marked as completed.",
                  }
                : {
                    type: "booking_cancelled",
                    title: albanian
                      ? "Rezervimi u anulua"
                      : "Booking cancelled",
                    message: albanian
                      ? "Biznesi anuloi rezervimin tënd në grup."
                      : "The business cancelled your group booking.",
                  };

        await context.supabaseAdmin.from("notifications").insert({
          user_id: booking.customer_user_id,
          business_id: businessId,
          booking_id: booking.id,
          audience: "customer",
          type: copy.type,
          title: copy.title,
          message: copy.message,
          action_url: `/booking-confirmation?id=${booking.id}`,
        });
      }

      return response.status(200).json({
        ok: true,
        booking: updated,
        emailEvent: "booking_status_changed",
      });
    }

    const departureId = textValue(body.departureId);
    if (!UUID_PATTERN.test(departureId)) {
      return errorResponse(
        response,
        400,
        "departure_required",
        "Choose a valid departure",
      );
    }

    const { data: departure, error: departureError } =
      await context.supabaseAdmin
        .from("service_departures")
        .select(
          "id, business_id, service_id, staff_member_id, start_at, duration_minutes, capacity, meeting_point, status, created_at, updated_at",
        )
        .eq("id", departureId)
        .eq("business_id", businessId)
        .maybeSingle<DepartureRow>();

    if (departureError) throw departureError;
    if (!departure) {
      return errorResponse(
        response,
        404,
        "departure_not_found",
        "Departure not found",
      );
    }

    const status = textValue(body.status);
    if (!["cancelled", "completed"].includes(status)) {
      return errorResponse(
        response,
        400,
        "departure_status_invalid",
        "Choose a valid departure status",
      );
    }

    if (
      status === "completed" &&
      new Date(departure.start_at).getTime() +
        departure.duration_minutes * 60_000 >
        Date.now()
    ) {
      return errorResponse(
        response,
        409,
        "departure_not_finished",
        "This departure has not finished yet",
      );
    }

    const targetBookingStatus =
      status === "cancelled" ? "cancelled" : "completed";
    const { data: changedBookingRows, error: changeError } =
      await context.supabaseAdmin.rpc("mirebook_change_departure_status", {
        p_owner_user_id: context.user.id,
        p_departure_id: departure.id,
        p_status: status,
      });

    if (changeError) throw changeError;

    const affectedBookings = (
      (changedBookingRows || []) as unknown as {
        booking_id: string;
        customer_user_id?: string | null;
      }[]
    ).map((booking) => ({
      id: booking.booking_id,
      customer_user_id: booking.customer_user_id,
    }));
    const { data: updated, error: reloadError } = await context.supabaseAdmin
      .from("service_departures")
      .select(
        "id, business_id, service_id, staff_member_id, start_at, duration_minutes, capacity, meeting_point, status, created_at, updated_at",
      )
      .eq("id", departure.id)
      .single<DepartureRow>();

    if (reloadError) throw reloadError;

    const customerUserIds = (affectedBookings || [])
      .map((booking) => booking.customer_user_id)
      .filter((userId): userId is string => Boolean(userId));
    const { data: customerProfiles } = customerUserIds.length
      ? await context.supabaseAdmin
          .from("profiles")
          .select("id, preferred_language")
          .in("id", customerUserIds)
          .returns<{ id: string; preferred_language?: string | null }[]>()
      : { data: [] as { id: string; preferred_language?: string | null }[] };
    const profileById = new Map(
      (customerProfiles || []).map((profile) => [profile.id, profile]),
    );
    const notifications = (affectedBookings || [])
      .filter((booking) => booking.customer_user_id)
      .map((booking) => {
        const albanian =
          profileById.get(booking.customer_user_id || "")
            ?.preferred_language === "sq";
        return {
          user_id: booking.customer_user_id,
          business_id: businessId,
          booking_id: booking.id,
          audience: "customer",
          type:
            targetBookingStatus === "cancelled"
              ? "booking_cancelled"
              : "booking_completed",
          title:
            targetBookingStatus === "cancelled"
              ? albanian
                ? "Nisja u anulua"
                : "Departure cancelled"
              : albanian
                ? "Rezervimi në grup u përfundua"
                : "Group booking completed",
          message:
            targetBookingStatus === "cancelled"
              ? albanian
                ? "Biznesi e anuloi nisjen e rezervuar."
                : "The business cancelled the booked departure."
              : albanian
                ? "Rezervimi yt në grup u shënua si i përfunduar."
                : "Your group booking was marked as completed.",
          action_url: `/booking-confirmation?id=${booking.id}`,
        };
      });

    if (notifications.length > 0) {
      const { error: notificationError } = await context.supabaseAdmin
        .from("notifications")
        .insert(notifications);
      if (notificationError) {
        console.error("Departure customer notifications failed", {
          departureId: departure.id,
          error: notificationError.message,
        });
      }
    }

    if (departure.staff_member_id) {
      const [{ data: assignedStaff }, { data: service }] = await Promise.all([
        context.supabaseAdmin
          .from("staff_members")
          .select("user_id")
          .eq("id", departure.staff_member_id)
          .eq("business_id", businessId)
          .eq("active", true)
          .maybeSingle<{ user_id?: string | null }>(),
        context.supabaseAdmin
          .from("services")
          .select("name")
          .eq("id", departure.service_id)
          .eq("business_id", businessId)
          .maybeSingle<{ name?: string | null }>(),
      ]);

      if (assignedStaff?.user_id) {
        const { data: staffProfile } = await context.supabaseAdmin
          .from("profiles")
          .select("preferred_language")
          .eq("id", assignedStaff.user_id)
          .maybeSingle<{ preferred_language?: string | null }>();
        const albanian = staffProfile?.preferred_language === "sq";
        const departureDate = dateKeyInTimeZone(
          new Date(departure.start_at),
          business?.timezone,
        );
        const staffCopy =
          targetBookingStatus === "cancelled"
            ? {
                type: "booking_cancelled",
                title: albanian ? "Nisja u anulua" : "Departure cancelled",
                message: albanian
                  ? `${service?.name || "Udhëtimi"} u anulua nga biznesi.`
                  : `${service?.name || "The trip"} was cancelled by the business.`,
              }
            : {
                type: "booking_completed",
                title: albanian ? "Nisja u përfundua" : "Departure completed",
                message: albanian
                  ? `${service?.name || "Udhëtimi"} u shënua si i përfunduar.`
                  : `${service?.name || "The trip"} was marked as completed.`,
              };

        const { error: staffNotificationError } = await context.supabaseAdmin
          .from("notifications")
          .insert({
            user_id: assignedStaff.user_id,
            business_id: businessId,
            booking_id: null,
            audience: "staff",
            type: staffCopy.type,
            title: staffCopy.title,
            message: staffCopy.message,
            action_url: `/staff/calendar?date=${departureDate}&departureId=${departure.id}`,
          });
        if (staffNotificationError) {
          console.error("Departure staff notification failed", {
            departureId: departure.id,
            error: staffNotificationError.message,
          });
        }
      }
    }

    return response.status(200).json({
      ok: true,
      departure: updated,
      affectedBookingIds: (affectedBookings || []).map((booking) => booking.id),
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
