import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";

type RescheduleAction = "accept" | "decline";

type RescheduleRequestRow = {
  id: string;
  booking_id: string;
  business_id: string;
  customer_user_id?: string | null;
  requested_by: string;
  request_type: string;
  status: string;
  requested_start_at: string;
  requested_duration_minutes: number;
  requested_staff_member_id?: string | null;
  response_message?: string | null;
  updated_at?: string | null;
};

type BookingRow = {
  id: string;
  business_id: string;
};

function readBody(req: NextApiRequest) {
  const body = (req.body || {}) as {
    requestId?: unknown;
    action?: unknown;
  };

  return {
    requestId: typeof body.requestId === "string" ? body.requestId.trim() : "",
    action: typeof body.action === "string" ? body.action.trim() : "",
  };
}

function notificationFor(action: RescheduleAction) {
  if (action === "accept") {
    return {
      type: "reschedule_accepted",
      title: "Reschedule accepted",
      message: "Your reschedule request has been accepted.",
      actionUrl: "booking-confirmation",
    };
  }

  return {
    type: "reschedule_declined",
    title: "Reschedule declined",
    message: "Sorry, that time is not available.",
    actionUrl: "my-bookings",
  };
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
        "A business owner account is required for reschedule actions",
      );
    }

    const { requestId, action } = readBody(req);
    if (!requestId || (action !== "accept" && action !== "decline")) {
      return errorResponse(
        res,
        400,
        "invalid_action_request",
        "Request ID and a supported action are required",
      );
    }

    const businessIds = context.ownedBusinesses.map((business) => business.id);
    const { data: request, error: requestError } = await context.supabaseAdmin
      .from("booking_requests")
      .select(
        "id, booking_id, business_id, customer_user_id, requested_by, request_type, status, requested_start_at, requested_duration_minutes, requested_staff_member_id, response_message, updated_at",
      )
      .eq("id", requestId)
      .in("business_id", businessIds)
      .maybeSingle<RescheduleRequestRow>();

    if (requestError) throw requestError;
    if (!request) {
      return errorResponse(
        res,
        404,
        "reschedule_request_not_found",
        "Reschedule request was not found",
      );
    }

    if (
      request.requested_by !== "customer" ||
      request.request_type !== "reschedule" ||
      request.status !== "pending"
    ) {
      return errorResponse(
        res,
        409,
        "action_no_longer_available",
        "This reschedule request is no longer available for that action",
      );
    }

    const { data: booking, error: bookingError } = await context.supabaseAdmin
      .from("bookings")
      .select("id, business_id")
      .eq("id", request.booking_id)
      .eq("business_id", request.business_id)
      .maybeSingle<BookingRow>();

    if (bookingError) throw bookingError;
    if (!booking) {
      return errorResponse(
        res,
        409,
        "booking_no_longer_available",
        "The booking for this reschedule request is no longer available",
      );
    }

    if (action === "accept" && request.requested_staff_member_id) {
      const { data: requestedStaff, error: staffError } =
        await context.supabaseAdmin
          .from("staff_members")
          .select("id")
          .eq("id", request.requested_staff_member_id)
          .eq("business_id", request.business_id)
          .eq("active", true)
          .maybeSingle<{ id: string }>();

      if (staffError) throw staffError;
      if (!requestedStaff) {
        return errorResponse(
          res,
          409,
          "requested_staff_unavailable",
          "The requested staff member is no longer available",
        );
      }
    }

    if (action === "accept") {
      const requestedStart = new Date(request.requested_start_at);
      if (
        Number.isNaN(requestedStart.getTime()) ||
        request.requested_duration_minutes <= 0
      ) {
        return errorResponse(
          res,
          409,
          "requested_time_invalid",
          "The requested appointment time is no longer valid",
        );
      }
    }

    const now = new Date().toISOString();
    const responseMessage =
      action === "accept"
        ? "Accepted by business"
        : "Sorry, that time is not available.";
    const { data: updatedRequest, error: updateRequestError } =
      await context.supabaseAdmin
        .from("booking_requests")
        .update({
          status: action === "accept" ? "accepted" : "declined",
          response_message: responseMessage,
          updated_at: now,
        })
        .eq("id", request.id)
        .eq("business_id", request.business_id)
        .eq("status", "pending")
        .select("id, status, response_message, updated_at")
        .maybeSingle<{
          id: string;
          status: string;
          response_message?: string | null;
          updated_at?: string | null;
        }>();

    if (updateRequestError) throw updateRequestError;
    if (!updatedRequest) {
      return errorResponse(
        res,
        409,
        "action_no_longer_available",
        "This reschedule request changed before the action completed",
      );
    }

    let competingRequestsStatus = "skipped";
    if (action === "accept") {
      const { data: updatedBooking, error: updateBookingError } =
        await context.supabaseAdmin
          .from("bookings")
          .update({
            start_at: request.requested_start_at,
            duration_minutes: request.requested_duration_minutes,
            staff_member_id: request.requested_staff_member_id || null,
            status: "confirmed",
          })
          .eq("id", booking.id)
          .eq("business_id", booking.business_id)
          .select("id")
          .maybeSingle<{ id: string }>();

      if (updateBookingError || !updatedBooking) {
        await context.supabaseAdmin
          .from("booking_requests")
          .update({
            status: "pending",
            response_message: request.response_message || null,
            updated_at: request.updated_at || now,
          })
          .eq("id", request.id)
          .eq("status", "accepted")
          .eq("updated_at", now);

        if (updateBookingError) throw updateBookingError;
        return errorResponse(
          res,
          409,
          "booking_no_longer_available",
          "The booking changed before the reschedule completed",
        );
      }

      const { error: cancelOtherRequestsError } = await context.supabaseAdmin
        .from("booking_requests")
        .update({
          status: "cancelled",
          response_message:
            "Cancelled automatically because another reschedule request was accepted.",
          updated_at: now,
        })
        .eq("booking_id", request.booking_id)
        .eq("business_id", request.business_id)
        .eq("requested_by", "customer")
        .eq("request_type", "reschedule")
        .eq("status", "pending")
        .neq("id", request.id);

      competingRequestsStatus = cancelOtherRequestsError
        ? "failed"
        : "cancelled";
    }

    const notification = notificationFor(action as RescheduleAction);
    let notificationStatus = "skipped";
    if (request.customer_user_id) {
      const actionUrl =
        action === "accept"
          ? `/${notification.actionUrl}?id=${request.booking_id}`
          : `/${notification.actionUrl}`;
      const { error: notificationError } = await context.supabaseAdmin
        .from("notifications")
        .insert({
          user_id: request.customer_user_id,
          business_id: request.business_id,
          booking_id: request.booking_id,
          booking_request_id: request.id,
          audience: "customer",
          type: notification.type,
          title: notification.title,
          message: notification.message,
          action_url: actionUrl,
        });

      notificationStatus = notificationError ? "failed" : "created";
    }

    return res.status(200).json({
      request: updatedRequest,
      action,
      competingRequestsStatus,
      notificationStatus,
    });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
