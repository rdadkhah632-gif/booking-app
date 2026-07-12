import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  firstRelation,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { requestBookingStatusEmail } from "@/lib/server/app-api/transactionalEmail";

type AppointmentAction = "accept" | "decline" | "cancel" | "complete";

type BookingRow = {
  id: string;
  business_id: string;
  staff_member_id?: string | null;
  customer_user_id?: string | null;
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

const actionTransitions: Record<
  AppointmentAction,
  {
    from: "pending" | "confirmed";
    to: "confirmed" | "declined" | "cancelled" | "completed";
    notificationType: string;
    notificationTitle: string;
    notificationMessage: string;
    actionUrl: string;
  }
> = {
  accept: {
    from: "pending",
    to: "confirmed",
    notificationType: "booking_accepted",
    notificationTitle: "Booking accepted",
    notificationMessage: "Your booking has been accepted and confirmed.",
    actionUrl: "/booking-confirmation",
  },
  decline: {
    from: "pending",
    to: "declined",
    notificationType: "booking_declined",
    notificationTitle: "Booking declined",
    notificationMessage: "Your booking request was declined.",
    actionUrl: "/my-bookings",
  },
  cancel: {
    from: "confirmed",
    to: "cancelled",
    notificationType: "booking_cancelled",
    notificationTitle: "Booking cancelled",
    notificationMessage: "Your booking was cancelled by the business.",
    actionUrl: "/my-bookings",
  },
  complete: {
    from: "confirmed",
    to: "completed",
    notificationType: "booking_completed",
    notificationTitle: "Appointment completed",
    notificationMessage: "Your appointment has been marked as completed.",
    actionUrl: "/my-bookings",
  },
};

const bookingSelect = `
  id,
  business_id,
  staff_member_id,
  customer_user_id,
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
`;

function availableActions(status: string) {
  if (status === "pending") return ["accept", "decline"];
  if (status === "confirmed") return ["cancel", "complete"];
  return [];
}

function shapeAppointment(booking: BookingRow) {
  const service = firstRelation(booking.services);
  const staff = firstRelation(booking.staff_members);
  const start = new Date(booking.start_at);
  const end = booking.end_at
    ? new Date(booking.end_at)
    : new Date(start.getTime() + booking.duration_minutes * 60_000);

  return {
    id: booking.id,
    businessId: booking.business_id,
    customerName: booking.customer_name,
    customerEmail: booking.customer_email || null,
    customerPhone: booking.customer_phone || null,
    serviceName: service?.name || "Appointment",
    staffName: staff?.name || "Staff member",
    startAt: booking.start_at,
    endAt: end.toISOString(),
    durationMinutes: booking.duration_minutes,
    status: booking.status,
    availableActions: availableActions(booking.status),
  };
}

function readBody(req: NextApiRequest) {
  const body = (req.body || {}) as {
    appointmentId?: unknown;
    action?: unknown;
  };
  const appointmentId =
    typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";

  return { appointmentId, action };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const context = await loadAppContext(req);
    if (!context.canUseBusiness || context.ownedBusinesses.length === 0) {
      return errorResponse(
        res,
        403,
        "owner_action_required",
        "A business owner account is required for appointment actions",
      );
    }

    const { appointmentId, action } = readBody(req);
    if (
      !appointmentId ||
      !Object.prototype.hasOwnProperty.call(actionTransitions, action)
    ) {
      return errorResponse(
        res,
        400,
        "invalid_action_request",
        "Appointment ID and a supported action are required",
      );
    }

    const transition = actionTransitions[action as AppointmentAction];
    const businessIds = context.ownedBusinesses.map((business) => business.id);
    const { data: booking, error: bookingError } = await context.supabaseAdmin
      .from("bookings")
      .select(bookingSelect)
      .eq("id", appointmentId)
      .in("business_id", businessIds)
      .maybeSingle<BookingRow>();

    if (bookingError) throw bookingError;
    if (!booking) {
      return errorResponse(
        res,
        404,
        "appointment_not_found",
        "Appointment was not found",
      );
    }

    if (booking.status !== transition.from) {
      return errorResponse(
        res,
        409,
        "action_no_longer_available",
        "This appointment is no longer available for that action",
      );
    }

    const { data: updatedBooking, error: updateError } =
      await context.supabaseAdmin
        .from("bookings")
        .update({ status: transition.to })
        .eq("id", booking.id)
        .eq("business_id", booking.business_id)
        .eq("status", transition.from)
        .select(bookingSelect)
        .maybeSingle<BookingRow>();

    if (updateError) throw updateError;
    if (!updatedBooking) {
      return errorResponse(
        res,
        409,
        "action_no_longer_available",
        "This appointment changed before the action completed",
      );
    }

    let notificationStatus = "skipped";
    if (booking.customer_user_id) {
      const actionUrl =
        action === "accept"
          ? `${transition.actionUrl}?id=${booking.id}`
          : transition.actionUrl;
      const { error: notificationError } = await context.supabaseAdmin
        .from("notifications")
        .insert({
          user_id: booking.customer_user_id,
          business_id: booking.business_id,
          booking_id: booking.id,
          audience: "customer",
          type: transition.notificationType,
          title: transition.notificationTitle,
          message: transition.notificationMessage,
          action_url: actionUrl,
        });

      notificationStatus = notificationError ? "failed" : "created";
    }

    const emailStatus = await requestBookingStatusEmail(req, booking.id);

    return res.status(200).json({
      appointment: shapeAppointment(updatedBooking),
      action,
      notificationStatus,
      emailStatus,
    });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
