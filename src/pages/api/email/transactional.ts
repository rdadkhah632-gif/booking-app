import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { bookingEmailTemplate } from "@/lib/email/templates";
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

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
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
  if (
    !request?.bookingId ||
    !["booking_created", "booking_status_changed"].includes(request.event)
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
      (request.event === "booking_status_changed" && !isBusinessOwner)
    ) {
      return res.status(403).json({ error: "Email event not permitted" });
    }

    const [
      customerProfileEmail,
      ownerEmail,
      staffProfileEmail,
      customerPreferenceResult,
      ownerPreferenceResult,
      staffPreferenceResult,
    ] =
      await Promise.all([
        emailForUser(supabaseAdmin, booking.customer_user_id),
        emailForUser(supabaseAdmin, business.user_id),
        emailForUser(supabaseAdmin, staff?.user_id),
        loadServerEmailPreferences(
          supabaseAdmin,
          booking.customer_user_id,
        ),
        loadServerEmailPreferences(supabaseAdmin, business.user_id),
        loadServerEmailPreferences(supabaseAdmin, staff?.user_id),
      ]);

    const customerEmail = booking.customer_email || customerProfileEmail;
    const staffEmail = staff?.email || staffProfileEmail;
    const bookingUrl = `${appUrl()}/booking-confirmation?id=${booking.id}`;
    const businessUrl = `${appUrl()}/dashboard/bookings?businessId=${booking.business_id}`;
    const staffUrl = `${appUrl()}/staff/calendar`;
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

    if (
      staffEmail &&
      ["confirmed", "cancelled", "declined"].includes(booking.status)
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
