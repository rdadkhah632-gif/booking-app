import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  bookingEmailTemplate,
  supportEmailTemplate,
} from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import {
  BookingEmailStatus,
  TransactionalEmailRequest,
  TransactionalEmailResult,
} from "@/lib/email/types";
import {
  EmailPreferences,
  loadServerEmailPreferences,
} from "@/lib/email/preferences";
import { getAppBaseUrl } from "@/lib/server/appBaseUrl";
import { getBusinessAppUrl, getCustomerAppUrl } from "@/lib/appUrls";

type BookingRow = {
  id: string;
  business_id: string;
  service_id?: string | null;
  staff_member_id?: string | null;
  customer_user_id?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  start_at: string;
  status: BookingEmailStatus;
};

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

async function emailForUser(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId?: string | null,
) {
  if (!userId) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email?: string | null }>();

  return data?.email || null;
}

function customerPreference(
  preferences: EmailPreferences,
  status: BookingEmailStatus,
) {
  if (status === "pending" || status === "declined") {
    return preferences.email_booking_request_updates;
  }
  if (status === "confirmed" || status === "completed") {
    return preferences.email_booking_confirmations;
  }
  return preferences.email_booking_cancellations;
}

function absoluteAppUrl(
  path: string,
  fallbackOrigin: string,
  product: "customer" | "business",
) {
  const configuredUrl =
    product === "business" ? getBusinessAppUrl(path) : getCustomerAppUrl(path);
  return new URL(configuredUrl, fallbackOrigin).toString();
}

function staffNotificationForStatus(status: BookingEmailStatus) {
  if (status === "confirmed") {
    return {
      type: "booking_accepted",
      title: "Confirmed",
      statusText: "confirmed",
    };
  }
  if (status === "cancelled") {
    return {
      type: "booking_cancelled",
      title: "Cancelled",
      statusText: "cancelled",
    };
  }
  if (status === "declined") {
    return {
      type: "booking_declined",
      title: "Declined",
      statusText: "declined",
    };
  }
  if (status === "completed") {
    return {
      type: "booking_completed",
      title: "Completed",
      statusText: "completed",
    };
  }

  return null;
}

async function ensureStaffBookingNotification(params: {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  staffUserId?: string | null;
  businessId: string;
  bookingId: string;
  status: BookingEmailStatus;
  serviceName: string;
  customerName: string;
  startAt: string;
}) {
  if (!params.staffUserId) return;

  const notification = staffNotificationForStatus(params.status);
  if (!notification) return;

  const { data: existing } = await params.supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", params.staffUserId)
    .eq("booking_id", params.bookingId)
    .eq("type", notification.type)
    .maybeSingle<{ id: string }>();

  if (existing) return;

  const appointmentTime = new Date(params.startAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const { error } = await params.supabaseAdmin.from("notifications").insert({
    user_id: params.staffUserId,
    business_id: params.businessId,
    booking_id: params.bookingId,
    audience: "staff",
    type: notification.type,
    title: notification.title,
    message: `${params.customerName}'s ${params.serviceName} appointment is ${notification.statusText} for ${appointmentTime}.`,
    action_url: "/staff/calendar",
  });

  if (error) {
    console.warn("[email] Could not create staff booking notification", {
      bookingId: params.bookingId,
      status: params.status,
      error: error.message,
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });

  const request = req.body as TransactionalEmailRequest;
  const bookingEvent =
    request?.event === "booking_created" ||
    request?.event === "booking_status_changed" ||
    request?.event === "booking_customer_cancelled";
  const supportEvent =
    request?.event === "support_created" ||
    request?.event === "support_replied";

  if (
    (!bookingEvent && !supportEvent) ||
    (bookingEvent && !("bookingId" in request && request.bookingId)) ||
    (supportEvent &&
      !("supportMessageId" in request && request.supportMessageId))
  ) {
    return res.status(400).json({ error: "Unsupported email event" });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    if (supportEvent && "supportMessageId" in request) {
      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from("support_messages")
        .select("id, user_id, email, subject")
        .eq("id", request.supportMessageId)
        .maybeSingle<{
          id: string;
          user_id?: string | null;
          email?: string | null;
          subject?: string | null;
        }>();

      if (ticketError || !ticket) {
        return res.status(404).json({ error: "Support request not found" });
      }

      const { data: actorProfile } = await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle<{ is_admin?: boolean | null }>();
      const isAdmin = Boolean(actorProfile?.is_admin);

      if (
        (request.event === "support_created" && ticket.user_id !== user.id) ||
        (request.event === "support_replied" && !isAdmin)
      ) {
        return res.status(403).json({ error: "Email event not permitted" });
      }

      const requesterEmail =
        ticket.email || (await emailForUser(supabaseAdmin, ticket.user_id));
      const requesterPreferences = await loadServerEmailPreferences(
        supabaseAdmin,
        ticket.user_id,
      );
      const appUrl = getAppBaseUrl();
      if (!appUrl) {
        return res.status(200).json({
          event: request.event,
          delivery: [{ status: "failed", reason: "config_missing" }],
          authoritativeChannel: "in_app_support",
        });
      }

      const supportUrl = `${appUrl}/support/messages/${ticket.id}`;
      const messages = [];

      if (requesterEmail) {
        messages.push(
          supportEmailTemplate({
            event: request.event,
            recipientEmail: requesterEmail,
            subject: ticket.subject || "Support request",
            actionUrl: supportUrl,
            preferenceEnabled:
              requesterPreferences.preferences.email_support_updates,
          }),
        );
      }

      const supportAdminEmail = process.env.SUPPORT_ADMIN_EMAIL?.trim();
      if (request.event === "support_created" && supportAdminEmail) {
        messages.push(
          supportEmailTemplate({
            event: "support_created",
            recipientEmail: supportAdminEmail,
            subject: ticket.subject || "New support request",
            actionUrl: `${appUrl}/admin/support?ticketId=${ticket.id}`,
            isAdminNotification: true,
          }),
        );
      }

      const delivery: TransactionalEmailResult[] = [];
      for (const message of messages) {
        delivery.push(await sendTransactionalEmail(message));
      }

      return res.status(200).json({
        event: request.event,
        delivery,
        authoritativeChannel: "in_app_support",
      });
    }

    if (!bookingEvent || !("bookingId" in request)) {
      return res.status(400).json({ error: "Unsupported email event" });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, business_id, service_id, staff_member_id, customer_user_id, customer_email, customer_name, start_at, status",
      )
      .eq("id", request.bookingId)
      .single<BookingRow>();

    if (bookingError || !booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const [{ data: business }, { data: service }, { data: staff }] =
      await Promise.all([
        supabaseAdmin
          .from("businesses")
          .select("id, user_id, name")
          .eq("id", booking.business_id)
          .single<{ id: string; user_id?: string | null; name: string }>(),
        booking.service_id
          ? supabaseAdmin
              .from("services")
              .select("name")
              .eq("id", booking.service_id)
              .maybeSingle<{ name?: string | null }>()
          : Promise.resolve({ data: null }),
        booking.staff_member_id
          ? supabaseAdmin
              .from("staff_members")
              .select("name, email, user_id")
              .eq("id", booking.staff_member_id)
              .maybeSingle<{
                name?: string | null;
                email?: string | null;
                user_id?: string | null;
              }>()
          : Promise.resolve({ data: null }),
      ]);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const isCustomer = booking.customer_user_id === user.id;
    const isBusinessOwner = business.user_id === user.id;

    if (
      (request.event === "booking_created" && !isCustomer) ||
      (request.event === "booking_status_changed" && !isBusinessOwner) ||
      (request.event === "booking_customer_cancelled" &&
        (!isCustomer || booking.status !== "cancelled"))
    ) {
      return res.status(403).json({ error: "Email event not permitted" });
    }

    const appUrl = getAppBaseUrl();
    if (!appUrl) {
      return res.status(200).json({
        event: request.event,
        delivery: [{ status: "failed", reason: "config_missing" }],
        authoritativeChannel: "in_app_notifications",
      });
    }

    const [
      customerProfileEmail,
      ownerEmail,
      staffProfileEmail,
      customerPreferenceResult,
      ownerPreferenceResult,
      staffPreferenceResult,
    ] = await Promise.all([
      emailForUser(supabaseAdmin, booking.customer_user_id),
      emailForUser(supabaseAdmin, business.user_id),
      emailForUser(supabaseAdmin, staff?.user_id),
      loadServerEmailPreferences(supabaseAdmin, booking.customer_user_id),
      loadServerEmailPreferences(supabaseAdmin, business.user_id),
      loadServerEmailPreferences(supabaseAdmin, staff?.user_id),
    ]);

    const customerEmail = booking.customer_email || customerProfileEmail;
    const staffEmail = staff?.email || staffProfileEmail;
    const bookingUrl = absoluteAppUrl(
      `/booking-confirmation?id=${booking.id}`,
      appUrl,
      "customer",
    );
    const businessUrl = absoluteAppUrl(
      `/dashboard/bookings?businessId=${booking.business_id}`,
      appUrl,
      "business",
    );
    const staffUrl = absoluteAppUrl("/staff/calendar", appUrl, "business");
    const messages = [];

    if (customerEmail) {
      messages.push(
        bookingEmailTemplate({
          event: request.event,
          recipientEmail: customerEmail,
          recipientRole: "customer",
          bookingStatus: booking.status,
          businessName: business.name,
          customerName: booking.customer_name || "Customer",
          serviceName: service?.name || "Appointment",
          staffName: staff?.name,
          startAt: booking.start_at,
          actionUrl: bookingUrl,
          preferenceEnabled: customerPreference(
            customerPreferenceResult.preferences,
            booking.status,
          ),
        }),
      );
    }

    if (request.event === "booking_created" && ownerEmail) {
      messages.push(
        bookingEmailTemplate({
          event: request.event,
          recipientEmail: ownerEmail,
          recipientRole: "business",
          bookingStatus: booking.status,
          businessName: business.name,
          customerName: booking.customer_name || "Customer",
          serviceName: service?.name || "Appointment",
          staffName: staff?.name,
          startAt: booking.start_at,
          actionUrl: businessUrl,
          preferenceEnabled:
            booking.status === "pending"
              ? ownerPreferenceResult.preferences.email_new_booking_requests
              : ownerPreferenceResult.preferences
                  .email_instant_booking_confirmations,
        }),
      );
    }

    if (request.event === "booking_customer_cancelled" && ownerEmail) {
      messages.push(
        bookingEmailTemplate({
          event: request.event,
          recipientEmail: ownerEmail,
          recipientRole: "business",
          bookingStatus: "cancelled",
          businessName: business.name,
          customerName: booking.customer_name || "Customer",
          serviceName: service?.name || "Appointment",
          staffName: staff?.name,
          startAt: booking.start_at,
          actionUrl: businessUrl,
          preferenceEnabled:
            ownerPreferenceResult.preferences.email_customer_cancellations,
        }),
      );
    }

    if (
      staffEmail &&
      ["confirmed", "cancelled", "declined", "completed"].includes(
        booking.status,
      )
    ) {
      messages.push(
        bookingEmailTemplate({
          event: request.event,
          recipientEmail: staffEmail,
          recipientRole: "staff",
          bookingStatus: booking.status,
          businessName: business.name,
          customerName: booking.customer_name || "Customer",
          serviceName: service?.name || "Appointment",
          staffName: staff?.name,
          startAt: booking.start_at,
          actionUrl: staffUrl,
          preferenceEnabled:
            request.event === "booking_created" &&
            booking.status === "confirmed"
              ? staffPreferenceResult.preferences
                  .email_staff_booking_assignments
              : staffPreferenceResult.preferences.email_staff_booking_changes,
        }),
      );
    }

    await ensureStaffBookingNotification({
      supabaseAdmin,
      staffUserId: staff?.user_id,
      businessId: booking.business_id,
      bookingId: booking.id,
      status: booking.status,
      serviceName: service?.name || "Appointment",
      customerName: booking.customer_name || "Customer",
      startAt: booking.start_at,
    });

    const results: TransactionalEmailResult[] = [];
    for (const message of messages) {
      results.push(await sendTransactionalEmail(message));
    }

    return res.status(200).json({
      event: request.event,
      delivery: results,
      authoritativeChannel: "in_app_notifications",
    });
  } catch (error) {
    console.error("[email] Transactional email request failed", error);
    return res.status(200).json({
      event: request?.event,
      delivery: [{ status: "failed", reason: "internal_error" }],
      authoritativeChannel: "in_app_notifications",
    });
  }
}
