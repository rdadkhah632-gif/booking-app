import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  bookingEmailTemplate,
  departureStatusEmailTemplate,
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
import { Locale } from "@/lib/i18n";
import { dateKeyInTimeZone } from "@/lib/timezone";

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
  departure_id?: string | null;
  party_size?: number | null;
  booking_option?: "appointment" | "shared" | "private" | null;
  total_price?: number | null;
};

type DepartureRow = {
  id: string;
  business_id?: string | null;
  service_id?: string | null;
  staff_member_id?: string | null;
  start_at?: string | null;
  status?: string | null;
  meeting_point?: string | null;
};

type EmailProfile = {
  email?: string | null;
  preferred_language?: string | null;
};

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function localeFromProfile(profile?: EmailProfile | null): Locale {
  return profile?.preferred_language === "sq" ? "sq" : "en";
}

async function profileForUser(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId?: string | null,
) {
  if (!userId) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, preferred_language")
    .eq("id", userId)
    .maybeSingle<EmailProfile>();

  return data || null;
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
  timeZone?: string | null;
  departureId?: string | null;
  locale?: string | null;
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

  const albanian = params.locale === "sq";
  const appointmentTime = new Date(params.startAt).toLocaleString(
    albanian ? "sq-AL" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: params.timeZone || undefined,
    },
  );
  const appointmentDate = dateKeyInTimeZone(
    new Date(params.startAt),
    params.timeZone,
  );
  const actionUrl = params.departureId
    ? `/staff/calendar?date=${appointmentDate}&departureId=${params.departureId}`
    : `/staff/calendar?date=${appointmentDate}&bookingId=${params.bookingId}`;

  const localizedTitle = params.departureId
    ? albanian
      ? "Rezervimi i nisjes u përditësua"
      : "Departure reservation updated"
    : albanian
      ? params.status === "confirmed"
        ? "U konfirmua"
        : params.status === "cancelled"
          ? "U anulua"
          : params.status === "declined"
            ? "U refuzua"
            : "U përfundua"
      : notification.title;
  const localizedStatus = albanian
    ? params.status === "confirmed"
      ? "u konfirmua"
      : params.status === "cancelled"
        ? "u anulua"
        : params.status === "declined"
          ? "u refuzua"
          : "u përfundua"
    : notification.statusText;
  const localizedMessage = params.departureId
    ? albanian
      ? `Totalet e rezervimeve për ${params.serviceName} ndryshuan. Hap nisjen e caktuar për vendet dhe rezervimet aktuale.`
      : `Reservation totals changed for ${params.serviceName}. Open the assigned departure for current seats and reservations.`
    : albanian
      ? `Rezervimi i ${params.customerName} për ${params.serviceName} ${localizedStatus} për ${appointmentTime}.`
      : `${params.customerName}'s ${params.serviceName} booking is ${localizedStatus} for ${appointmentTime}.`;

  if (existing) {
    if (params.departureId) {
      const { error: updateError } = await params.supabaseAdmin
        .from("notifications")
        .update({
          action_url: actionUrl,
          title: localizedTitle,
          message: localizedMessage,
        })
        .eq("id", existing.id);
      if (updateError) {
        console.warn("[email] Could not repair staff notification link", {
          bookingId: params.bookingId,
          error: updateError.message,
        });
      }
    }
    return;
  }

  const { error } = await params.supabaseAdmin.from("notifications").insert({
    user_id: params.staffUserId,
    business_id: params.businessId,
    booking_id: params.bookingId,
    audience: "staff",
    type: notification.type,
    title: localizedTitle,
    message: localizedMessage,
    action_url: actionUrl,
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
  const departureEvent = request?.event === "departure_status_changed";

  if (
    (!bookingEvent && !supportEvent && !departureEvent) ||
    (bookingEvent && !("bookingId" in request && request.bookingId)) ||
    (supportEvent &&
      !("supportMessageId" in request && request.supportMessageId)) ||
    (departureEvent && !("departureId" in request && request.departureId))
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

      const requesterProfile = await profileForUser(
        supabaseAdmin,
        ticket.user_id,
      );
      const requesterEmail = ticket.email || requesterProfile?.email || null;
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
            locale: localeFromProfile(requesterProfile),
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
            locale: "en",
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

    if (departureEvent && "departureId" in request) {
      const { data: departure, error: departureError } = await supabaseAdmin
        .from("service_departures")
        .select(
          "id, business_id, service_id, staff_member_id, start_at, status, meeting_point",
        )
        .eq("id", request.departureId)
        .maybeSingle<DepartureRow>();

      if (departureError || !departure?.business_id || !departure.start_at) {
        return res.status(404).json({ error: "Departure not found" });
      }

      const [{ data: business }, { data: service }] = await Promise.all([
        supabaseAdmin
          .from("businesses")
          .select("id, user_id, name, timezone")
          .eq("id", departure.business_id)
          .maybeSingle<{
            id: string;
            user_id?: string | null;
            name?: string | null;
            timezone?: string | null;
          }>(),
        departure.service_id
          ? supabaseAdmin
              .from("services")
              .select("name")
              .eq("id", departure.service_id)
              .maybeSingle<{ name?: string | null }>()
          : Promise.resolve({ data: null }),
      ]);

      if (!business || business.user_id !== user.id) {
        return res.status(403).json({ error: "Email event not permitted" });
      }
      if (
        departure.status !== "cancelled" &&
        departure.status !== "completed"
      ) {
        return res.status(409).json({ error: "Departure is still active" });
      }

      const { data: staff } = departure.staff_member_id
        ? await supabaseAdmin
            .from("staff_members")
            .select("name, email, user_id")
            .eq("id", departure.staff_member_id)
            .eq("business_id", departure.business_id)
            .eq("active", true)
            .maybeSingle<{
              name?: string | null;
              email?: string | null;
              user_id?: string | null;
            }>()
        : { data: null };
      const appUrl = getAppBaseUrl();
      if (!appUrl) {
        return res.status(200).json({
          event: request.event,
          delivery: [{ status: "failed", reason: "config_missing" }],
          authoritativeChannel: "in_app_notifications",
        });
      }

      const staffProfile = await profileForUser(supabaseAdmin, staff?.user_id);
      const staffPreferences = await loadServerEmailPreferences(
        supabaseAdmin,
        staff?.user_id,
      );
      const staffEmail = staff?.email || staffProfile?.email;
      const departureDate = dateKeyInTimeZone(
        new Date(departure.start_at),
        business.timezone,
      );
      const staffUrl = absoluteAppUrl(
        `/staff/calendar?date=${departureDate}&departureId=${departure.id}`,
        appUrl,
        "business",
      );
      const delivery: TransactionalEmailResult[] = [];

      if (staffEmail) {
        delivery.push(
          await sendTransactionalEmail(
            departureStatusEmailTemplate({
              recipientEmail: staffEmail,
              businessName: business.name,
              serviceName: service?.name,
              staffName: staff?.name,
              startAt: departure.start_at,
              timeZone: business.timezone,
              meetingPoint: departure.meeting_point,
              status: departure.status,
              actionUrl: staffUrl,
              locale: localeFromProfile(staffProfile),
              preferenceEnabled:
                staffPreferences.preferences.email_staff_booking_changes,
            }),
          ),
        );
      }

      return res.status(200).json({
        event: request.event,
        delivery,
        authoritativeChannel: "in_app_notifications",
      });
    }

    if (!bookingEvent || !("bookingId" in request)) {
      return res.status(400).json({ error: "Unsupported email event" });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, business_id, service_id, staff_member_id, customer_user_id, customer_email, customer_name, start_at, status, departure_id, party_size, booking_option, total_price",
      )
      .eq("id", request.bookingId)
      .single<BookingRow>();

    if (bookingError || !booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const [{ data: business }, { data: service }, { data: departure }] =
      await Promise.all([
        supabaseAdmin
          .from("businesses")
          .select("id, user_id, name, timezone, currency")
          .eq("id", booking.business_id)
          .single<{
            id: string;
            user_id?: string | null;
            name: string;
            timezone?: string | null;
            currency?: string | null;
          }>(),
        booking.service_id
          ? supabaseAdmin
              .from("services")
              .select("name, booking_type")
              .eq("id", booking.service_id)
              .maybeSingle<{
                name?: string | null;
                booking_type?: "appointment" | "group" | null;
              }>()
          : Promise.resolve({ data: null }),
        booking.departure_id
          ? supabaseAdmin
              .from("service_departures")
              .select("id, staff_member_id, meeting_point")
              .eq("id", booking.departure_id)
              .maybeSingle<DepartureRow>()
          : Promise.resolve({ data: null }),
      ]);

    const assignedStaffMemberId =
      booking.staff_member_id || departure?.staff_member_id || null;
    const { data: staff } = assignedStaffMemberId
      ? await supabaseAdmin
          .from("staff_members")
          .select("name, email, user_id")
          .eq("id", assignedStaffMemberId)
          .maybeSingle<{
            name?: string | null;
            email?: string | null;
            user_id?: string | null;
          }>()
      : { data: null };

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const isCustomer = booking.customer_user_id === user.id;
    const isBusinessOwner = business.user_id === user.id;
    const isAssignedStaff = staff?.user_id === user.id;
    const customerOnly =
      request.event === "booking_status_changed" &&
      "audience" in request &&
      request.audience === "customer_only";

    if (
      (request.event === "booking_created" && !isCustomer) ||
      (request.event === "booking_status_changed" &&
        !isBusinessOwner &&
        !isAssignedStaff) ||
      (request.event === "booking_customer_cancelled" &&
        (!isCustomer || booking.status !== "cancelled"))
    ) {
      return res.status(403).json({ error: "Email event not permitted" });
    }
    if (customerOnly && !isBusinessOwner) {
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
      customerProfile,
      ownerProfile,
      staffProfile,
      customerPreferenceResult,
      ownerPreferenceResult,
      staffPreferenceResult,
    ] = await Promise.all([
      profileForUser(supabaseAdmin, booking.customer_user_id),
      profileForUser(supabaseAdmin, business.user_id),
      profileForUser(supabaseAdmin, staff?.user_id),
      loadServerEmailPreferences(supabaseAdmin, booking.customer_user_id),
      loadServerEmailPreferences(supabaseAdmin, business.user_id),
      loadServerEmailPreferences(supabaseAdmin, staff?.user_id),
    ]);

    const customerEmail = booking.customer_email || customerProfile?.email;
    const ownerEmail = ownerProfile?.email;
    const staffEmail = staff?.email || staffProfile?.email;
    const customerBookingPath = `/booking-confirmation?id=${booking.id}`;
    const bookingUrl = absoluteAppUrl(
      booking.customer_user_id
        ? customerBookingPath
        : `/login?redirectTo=${encodeURIComponent(customerBookingPath)}`,
      appUrl,
      "customer",
    );
    const isGroupBooking =
      service?.booking_type === "group" || Boolean(booking.departure_id);
    const bookingDate = dateKeyInTimeZone(
      new Date(booking.start_at),
      business.timezone,
    );
    const businessUrl = absoluteAppUrl(
      isGroupBooking && booking.departure_id
        ? `/dashboard/departures?businessId=${booking.business_id}&departureId=${booking.departure_id}`
        : `/dashboard/bookings?businessId=${booking.business_id}&date=${bookingDate}&bookingId=${booking.id}`,
      appUrl,
      "business",
    );
    const staffUrl = absoluteAppUrl(
      isGroupBooking && booking.departure_id
        ? `/staff/calendar?date=${bookingDate}&departureId=${booking.departure_id}`
        : `/staff/calendar?date=${bookingDate}&bookingId=${booking.id}`,
      appUrl,
      "business",
    );
    const bookingTemplateDetails = {
      bookingType: isGroupBooking
        ? ("group" as const)
        : ("appointment" as const),
      partySize: booking.party_size,
      bookingOption: booking.booking_option,
      meetingPoint: departure?.meeting_point,
      totalPrice: booking.total_price,
      currency: business.currency,
    };
    const messages = [];

    if (customerEmail) {
      messages.push(
        bookingEmailTemplate({
          event: request.event,
          recipientEmail: customerEmail,
          recipientRole: "customer",
          bookingStatus: booking.status,
          businessName: business.name,
          customerName: booking.customer_name,
          serviceName: service?.name,
          staffName: staff?.name,
          startAt: booking.start_at,
          timeZone: business.timezone,
          actionUrl: bookingUrl,
          locale: localeFromProfile(customerProfile),
          customerAccountHint: !booking.customer_user_id,
          ...bookingTemplateDetails,
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
          customerName: booking.customer_name,
          serviceName: service?.name,
          staffName: staff?.name,
          startAt: booking.start_at,
          timeZone: business.timezone,
          actionUrl: businessUrl,
          locale: localeFromProfile(ownerProfile),
          ...bookingTemplateDetails,
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
          customerName: booking.customer_name,
          serviceName: service?.name,
          staffName: staff?.name,
          startAt: booking.start_at,
          timeZone: business.timezone,
          actionUrl: businessUrl,
          locale: localeFromProfile(ownerProfile),
          ...bookingTemplateDetails,
          preferenceEnabled:
            ownerPreferenceResult.preferences.email_customer_cancellations,
        }),
      );
    }

    if (
      !customerOnly &&
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
          customerName: booking.customer_name,
          serviceName: service?.name,
          staffName: staff?.name,
          startAt: booking.start_at,
          timeZone: business.timezone,
          actionUrl: staffUrl,
          locale: localeFromProfile(staffProfile),
          ...bookingTemplateDetails,
          preferenceEnabled:
            request.event === "booking_created" &&
            booking.status === "confirmed"
              ? staffPreferenceResult.preferences
                  .email_staff_booking_assignments
              : staffPreferenceResult.preferences.email_staff_booking_changes,
        }),
      );
    }

    if (!customerOnly) {
      await ensureStaffBookingNotification({
        supabaseAdmin,
        staffUserId: staff?.user_id,
        businessId: booking.business_id,
        bookingId: booking.id,
        status: booking.status,
        serviceName: service?.name || "Appointment",
        customerName: booking.customer_name || "Customer",
        startAt: booking.start_at,
        timeZone: business.timezone,
        departureId: booking.departure_id,
        locale: staffProfile?.preferred_language,
      });
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
