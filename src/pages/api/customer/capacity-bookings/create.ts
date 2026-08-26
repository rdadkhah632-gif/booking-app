import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { requestBookingCreatedEmail } from "@/lib/server/app-api/transactionalEmail";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";

type CapacityBookingBody = {
  departureId?: unknown;
  partySize?: unknown;
  bookingOption?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  customerNotes?: unknown;
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
};

type BusinessRow = {
  id: string;
  name: string;
  published?: boolean | null;
  auto_accept_bookings?: boolean | null;
  timezone?: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  booking_type?: string | null;
  price?: number | null;
  private_booking_enabled?: boolean | null;
  private_price?: number | null;
};

type StaffRow = {
  id: string;
  name: string;
};

type AtomicBookingResult = {
  booking_id: string;
  booking_status: "pending" | "confirmed";
  seats_remaining: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength = 1_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

function localizedCopy(params: {
  locale: "en" | "sq";
  status: "pending" | "confirmed";
  businessName: string;
  serviceName: string;
  customerName: string;
  partySize: number;
  bookingOption: "shared" | "private";
  departureTime: string;
}) {
  const guestLabel =
    params.bookingOption === "private"
      ? params.locale === "sq"
        ? `udhëtim privat për ${params.partySize} persona`
        : `private trip for ${params.partySize} ${params.partySize === 1 ? "guest" : "guests"}`
      : params.locale === "sq"
        ? `${params.partySize} persona`
        : `${params.partySize} ${params.partySize === 1 ? "guest" : "guests"}`;

  if (params.locale === "sq") {
    return {
      customerTitle:
        params.status === "pending" ? "Kërkesa u dërgua" : "U konfirmua",
      customerMessage:
        params.status === "pending"
          ? `${params.businessName} do të shqyrtojë kërkesën tuaj për ${params.serviceName}, ${guestLabel}, më ${params.departureTime}.`
          : `Rezervimi juaj për ${params.serviceName}, ${guestLabel}, u konfirmua për ${params.departureTime}.`,
      businessTitle:
        params.status === "pending"
          ? "Rezervim grupi për miratim"
          : "Rezervim grupi i konfirmuar",
      businessMessage: `${params.customerName} rezervoi ${params.serviceName}, ${guestLabel}, për ${params.departureTime}.`,
      staffTitle: "Rezervim grupi i konfirmuar",
      staffMessage: `${params.customerName} rezervoi ${params.serviceName}, ${guestLabel}, për ${params.departureTime}.`,
    };
  }

  return {
    customerTitle: params.status === "pending" ? "Request sent" : "Confirmed",
    customerMessage:
      params.status === "pending"
        ? `${params.businessName} will review your ${params.serviceName} request for ${guestLabel} on ${params.departureTime}.`
        : `Your ${params.serviceName} booking for ${guestLabel} is confirmed for ${params.departureTime}.`,
    businessTitle:
      params.status === "pending"
        ? "Group booking needs approval"
        : "Group booking confirmed",
    businessMessage: `${params.customerName} booked ${params.serviceName} for ${guestLabel} on ${params.departureTime}.`,
    staffTitle: "Group booking confirmed",
    staffMessage: `${params.customerName} booked ${params.serviceName} for ${guestLabel} on ${params.departureTime}.`,
  };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
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
    if (context.profile?.role !== "customer") {
      return errorResponse(
        response,
        403,
        "customer_account_required",
        "Use a customer account to book this departure",
      );
    }

    const body = (request.body || {}) as CapacityBookingBody;
    const departureId = cleanText(body.departureId, 100);
    const bookingOption = cleanText(body.bookingOption, 20) as
      "shared" | "private";
    const partySize = Number(body.partySize);

    if (!UUID_PATTERN.test(departureId)) {
      return errorResponse(
        response,
        400,
        "departure_required",
        "Choose a valid departure",
      );
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 200) {
      return errorResponse(
        response,
        400,
        "party_size_invalid",
        "Choose a valid number of guests",
      );
    }
    if (bookingOption !== "shared" && bookingOption !== "private") {
      return errorResponse(
        response,
        400,
        "booking_option_invalid",
        "Choose shared seats or a private trip",
      );
    }

    const { data: departure, error: departureError } =
      await context.supabaseAdmin
        .from("service_departures")
        .select(
          "id, business_id, service_id, staff_member_id, start_at, duration_minutes, capacity, meeting_point, status",
        )
        .eq("id", departureId)
        .maybeSingle<DepartureRow>();

    if (departureError) throw departureError;
    if (
      !departure ||
      departure.status !== "scheduled" ||
      new Date(departure.start_at) <= new Date()
    ) {
      return errorResponse(
        response,
        409,
        "departure_unavailable",
        "This departure is no longer available",
      );
    }

    const [businessResult, serviceResult, staffResult] = await Promise.all([
      context.supabaseAdmin
        .from("businesses")
        .select("id, name, published, auto_accept_bookings, timezone")
        .eq("id", departure.business_id)
        .eq("published", true)
        .maybeSingle<BusinessRow>(),
      context.supabaseAdmin
        .from("services")
        .select(
          "id, name, booking_type, price, private_booking_enabled, private_price",
        )
        .eq("id", departure.service_id)
        .eq("business_id", departure.business_id)
        .eq("active", true)
        .eq("booking_type", "group")
        .maybeSingle<ServiceRow>(),
      departure.staff_member_id
        ? context.supabaseAdmin
            .from("staff_members")
            .select("id, name")
            .eq("id", departure.staff_member_id)
            .eq("business_id", departure.business_id)
            .eq("active", true)
            .maybeSingle<StaffRow>()
        : Promise.resolve({ data: null as StaffRow | null, error: null }),
    ]);

    if (businessResult.error) throw businessResult.error;
    if (serviceResult.error) throw serviceResult.error;
    if (staffResult.error) throw staffResult.error;
    const business = businessResult.data;
    const service = serviceResult.data;

    if (!business || !service) {
      return errorResponse(
        response,
        409,
        "departure_unavailable",
        "This departure is no longer available",
      );
    }
    if (bookingOption === "private" && !service.private_booking_enabled) {
      return errorResponse(
        response,
        409,
        "private_trip_unavailable",
        "Private booking is not available for this trip",
      );
    }

    const customerEmail = cleanText(context.user.email, 320).toLowerCase();
    const customerName =
      cleanText(body.customerName, 160) ||
      cleanText(context.profile?.full_name, 160) ||
      customerEmail.split("@")[0] ||
      "Customer";
    if (!customerEmail) {
      return errorResponse(
        response,
        400,
        "customer_email_required",
        "Add an email address before booking",
      );
    }

    const status: "pending" | "confirmed" =
      business.auto_accept_bookings === false ? "pending" : "confirmed";
    const locale = context.profile?.preferred_language === "sq" ? "sq" : "en";
    const timeZone = safeTimeZone(business.timezone);
    const departureTime = new Intl.DateTimeFormat(
      locale === "sq" ? "sq-AL" : "en-GB",
      {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(new Date(departure.start_at));
    const copy = localizedCopy({
      locale,
      status,
      businessName: business.name,
      serviceName: service.name,
      customerName,
      partySize,
      bookingOption,
      departureTime,
    });

    const { data: created, error: createError } = await context.supabaseAdmin
      .rpc("mirebook_create_capacity_booking", {
        p_customer_user_id: context.user.id,
        p_departure_id: departure.id,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_customer_phone:
          cleanText(body.customerPhone, 80) ||
          cleanText(context.profile?.phone, 80) ||
          null,
        p_customer_notes: cleanText(body.customerNotes) || null,
        p_party_size: partySize,
        p_booking_option: bookingOption,
        p_customer_notification_title: copy.customerTitle,
        p_customer_notification_message: copy.customerMessage,
        p_business_notification_title: copy.businessTitle,
        p_business_notification_message: copy.businessMessage,
        p_staff_notification_title: copy.staffTitle,
        p_staff_notification_message: copy.staffMessage,
      })
      .single<AtomicBookingResult>();

    if (createError || !created) {
      const message = createError?.message || "Booking could not be created";
      if (message.includes("capacity_booking_not_enough_seats")) {
        return errorResponse(
          response,
          409,
          "not_enough_seats",
          "There are not enough seats left for this booking",
        );
      }
      if (message.includes("capacity_booking_party_size_invalid")) {
        return errorResponse(
          response,
          400,
          "party_size_invalid",
          "Choose a guest count within this departure's capacity",
        );
      }
      if (
        message.includes("capacity_booking_departure_unavailable") ||
        message.includes("capacity_booking_service_unavailable") ||
        message.includes("capacity_booking_business_unavailable")
      ) {
        return errorResponse(
          response,
          409,
          "departure_unavailable",
          "This departure is no longer available",
        );
      }
      if (message.includes("capacity_booking_private_unavailable")) {
        return errorResponse(
          response,
          409,
          "private_trip_unavailable",
          "Private booking is not available for this trip",
        );
      }
      if (
        createError?.code === "PGRST202" ||
        message.includes("mirebook_create_capacity_booking")
      ) {
        return errorResponse(
          response,
          503,
          "capacity_contract_not_installed",
          "Scheduled departure booking is not configured yet",
        );
      }
      if (
        createError?.code === "23505" &&
        message.includes("bookings_unique_")
      ) {
        return errorResponse(
          response,
          503,
          "capacity_contract_outdated",
          "Scheduled departure booking is temporarily unavailable",
        );
      }
      throw createError || new Error(message);
    }

    const emailDelivery = await requestBookingCreatedEmail(
      request,
      created.booking_id,
    );

    return response.status(201).json({
      booking: {
        id: created.booking_id,
        status: created.booking_status,
        businessName: business.name,
        serviceName: service.name,
        guideName: staffResult.data?.name || null,
        departureId: departure.id,
        startAt: departure.start_at,
        durationMinutes: departure.duration_minutes,
        partySize,
        bookingOption,
        meetingPoint: departure.meeting_point || null,
        seatsRemaining: created.seats_remaining,
        timezone: timeZone,
      },
      notifications: "committed",
      emailDelivery,
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
