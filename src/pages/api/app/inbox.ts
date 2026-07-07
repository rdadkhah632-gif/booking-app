import type { NextApiRequest, NextApiResponse } from "next";
import {
  businessForContext,
  errorResponse,
  firstRelation,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  staffForContext,
} from "@/lib/server/app-api/context";

type RelatedBusiness = {
  name?: string | null;
};

type RelatedService = {
  name?: string | null;
  price?: number | null;
};

type RelatedStaff = {
  name?: string | null;
  role_title?: string | null;
};

type InboxBookingRow = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at: string;
  duration_minutes: number;
  status: string;
  businesses?: RelatedBusiness | RelatedBusiness[] | null;
  services?: RelatedService | RelatedService[] | null;
  staff_members?: RelatedStaff | RelatedStaff[] | null;
};

type InboxRequestRow = {
  id: string;
  booking_id: string;
  business_id: string;
  request_type: string;
  status: string;
  current_start_at?: string | null;
  requested_start_at: string;
  requested_duration_minutes: number;
  message?: string | null;
  created_at: string;
  bookings?: InboxBookingRow | InboxBookingRow[] | null;
  businesses?: RelatedBusiness | RelatedBusiness[] | null;
  requested_staff?: RelatedStaff | RelatedStaff[] | null;
};

type InboxNotificationRow = {
  id: string;
  user_id?: string | null;
  business_id?: string | null;
  booking_id?: string | null;
  booking_request_id?: string | null;
  audience: string;
  type: string;
  title: string;
  message?: string | null;
  action_url?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

function serviceLabel(booking?: InboxBookingRow | null) {
  const service = firstRelation(booking?.services);
  return service?.name || "Appointment";
}

function staffLabel(
  booking?: InboxBookingRow | null,
  requestedStaff?: RelatedStaff | null,
) {
  const staff = requestedStaff || firstRelation(booking?.staff_members);
  if (!staff?.name) return null;
  return staff.role_title ? `${staff.name} · ${staff.role_title}` : staff.name;
}

function shapeBookingAction(booking: InboxBookingRow) {
  return {
    id: `booking:${booking.id}`,
    kind: "booking_request",
    priority: "needs_action",
    bookingId: booking.id,
    businessId: booking.business_id,
    title: "Booking request",
    message: `${booking.customer_name} requested ${serviceLabel(booking)}.`,
    customerName: booking.customer_name,
    customerEmail: booking.customer_email || null,
    customerPhone: booking.customer_phone || null,
    serviceName: serviceLabel(booking),
    staffName: staffLabel(booking),
    currentStartAt: booking.start_at,
    requestedStartAt: booking.start_at,
    durationMinutes: booking.duration_minutes,
    status: booking.status,
    actions: ["accept", "decline"],
  };
}

function shapeRescheduleAction(request: InboxRequestRow) {
  const booking = firstRelation(request.bookings);
  const requestedStaff = firstRelation(request.requested_staff);

  return {
    id: `request:${request.id}`,
    kind: request.request_type || "reschedule",
    priority: "needs_action",
    requestId: request.id,
    bookingId: request.booking_id,
    businessId: request.business_id,
    title: "Reschedule request",
    message: `${booking?.customer_name || "Customer"} requested a new appointment time.`,
    customerName: booking?.customer_name || null,
    customerEmail: booking?.customer_email || null,
    customerPhone: booking?.customer_phone || null,
    serviceName: serviceLabel(booking),
    staffName: staffLabel(booking, requestedStaff),
    currentStartAt: request.current_start_at || booking?.start_at || null,
    requestedStartAt: request.requested_start_at,
    durationMinutes:
      request.requested_duration_minutes || booking?.duration_minutes || null,
    status: request.status,
    actions: ["accept_reschedule", "decline_reschedule"],
    createdAt: request.created_at,
  };
}

function shapeNotification(notification: InboxNotificationRow) {
  return {
    id: notification.id,
    kind: "notification",
    priority: notification.read_at ? "recent" : "unread",
    type: notification.type,
    title: notification.title,
    message: notification.message || null,
    actionUrl: notification.action_url || null,
    bookingId: notification.booking_id || null,
    bookingRequestId: notification.booking_request_id || null,
    readAt: notification.read_at || null,
    createdAt: notification.created_at || null,
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
          "Business inbox is not available",
        );
      }

      const [pendingBookings, pendingRequests, notifications] =
        await Promise.all([
          context.supabaseAdmin
            .from("bookings")
            .select(
              `
              id,
              business_id,
              customer_name,
              customer_email,
              customer_phone,
              start_at,
              duration_minutes,
              status,
              services (
                name,
                price
              ),
              staff_members (
                name,
                role_title
              )
            `,
            )
            .eq("business_id", business.id)
            .eq("status", "pending")
            .order("start_at", { ascending: true })
            .returns<InboxBookingRow[]>(),
          context.supabaseAdmin
            .from("booking_requests")
            .select(
              `
              id,
              booking_id,
              business_id,
              request_type,
              status,
              current_start_at,
              requested_start_at,
              requested_duration_minutes,
              message,
              created_at,
              bookings (
                id,
                business_id,
                customer_name,
                customer_email,
                customer_phone,
                start_at,
                duration_minutes,
                status,
                services (
                  name,
                  price
                ),
                staff_members (
                  name,
                  role_title
                )
              ),
              requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
                name,
                role_title
              )
            `,
            )
            .eq("business_id", business.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .returns<InboxRequestRow[]>(),
          context.supabaseAdmin
            .from("notifications")
            .select(
              "id, user_id, business_id, booking_id, booking_request_id, audience, type, title, message, action_url, read_at, created_at",
            )
            .eq("business_id", business.id)
            .eq("audience", "business")
            .order("created_at", { ascending: false })
            .limit(30)
            .returns<InboxNotificationRow[]>(),
        ]);

      if (pendingBookings.error) throw pendingBookings.error;
      if (pendingRequests.error) throw pendingRequests.error;
      if (notifications.error) throw notifications.error;

      const needsAction = [
        ...(pendingBookings.data || []).map(shapeBookingAction),
        ...(pendingRequests.data || []).map(shapeRescheduleAction),
      ];
      const updates = (notifications.data || []).map(shapeNotification);

      return res.status(200).json({
        scope,
        business: {
          id: business.id,
          name: business.name,
        },
        counts: {
          needsAction: needsAction.length,
          unread: updates.filter((item) => !item.readAt).length,
          recent: updates.length,
        },
        needsAction,
        updates,
      });
    }

    const staff = staffForContext(context, readStringParam(req.query.staffId));
    if (!staff?.id) {
      return errorResponse(
        res,
        403,
        "staff_not_available",
        "Staff inbox is not available",
      );
    }

    const { data, error } = await context.supabaseAdmin
      .from("notifications")
      .select(
        "id, user_id, business_id, booking_id, booking_request_id, audience, type, title, message, action_url, read_at, created_at",
      )
      .eq("user_id", context.user.id)
      .in("audience", ["staff", "general"])
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<InboxNotificationRow[]>();

    if (error) throw error;

    const updates = (data || []).map(shapeNotification);

    return res.status(200).json({
      scope,
      staff: {
        id: staff.id,
        businessId: staff.business_id,
        name: staff.name,
        roleTitle: staff.role_title,
      },
      counts: {
        needsAction: 0,
        unread: updates.filter((item) => !item.readAt).length,
        recent: updates.length,
      },
      needsAction: [],
      updates,
    });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
