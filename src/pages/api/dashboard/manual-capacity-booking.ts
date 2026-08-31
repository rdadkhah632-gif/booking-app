import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { requestBookingStatusEmail } from "@/lib/server/app-api/transactionalEmail";
import { formatLocalizedDate } from "@/lib/i18n";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";

type ManualCapacityBookingBody = {
  businessId?: unknown;
  departureId?: unknown;
  partySize?: unknown;
  bookingOption?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  customerNotes?: unknown;
};

type DepartureRow = {
  id: string;
  business_id: string;
  service_id: string;
  start_at: string;
  duration_minutes: number;
  capacity: number;
  meeting_point?: string | null;
  status: string;
};

type ServiceRow = {
  id: string;
  name: string;
  booking_type?: string | null;
  active?: boolean | null;
  private_booking_enabled?: boolean | null;
};

type CustomerProfileRow = {
  id: string;
  role?: string | null;
  preferred_language?: string | null;
};

type AtomicBookingResult = {
  booking_id: string;
  booking_status: "confirmed";
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
  businessName: string;
  serviceName: string;
  partySize: number;
  bookingOption: "shared" | "private";
  departureTime: string;
}) {
  const guests =
    params.bookingOption === "private"
      ? params.locale === "sq"
        ? `udhëtim privat për ${params.partySize} persona`
        : `private trip for ${params.partySize} ${params.partySize === 1 ? "guest" : "guests"}`
      : params.locale === "sq"
        ? `${params.partySize} persona`
        : `${params.partySize} ${params.partySize === 1 ? "guest" : "guests"}`;

  if (params.locale === "sq") {
    return {
      customerTitle: "Rezervimi u konfirmua",
      customerMessage: `${params.businessName} e konfirmoi rezervimin tënd për ${params.serviceName}, ${guests}, më ${params.departureTime}.`,
      staffTitle: "Rezervimi i nisjes u përditësua",
      staffMessage: `Totalet e rezervimeve për ${params.serviceName} ndryshuan. Hap nisjen e caktuar për vendet dhe rezervimet aktuale.`,
    };
  }

  return {
    customerTitle: "Booking confirmed",
    customerMessage: `${params.businessName} confirmed your ${params.serviceName} booking for ${guests} on ${params.departureTime}.`,
    staffTitle: "Departure reservation updated",
    staffMessage: `Reservation totals changed for ${params.serviceName}. Open the assigned departure for current seats and reservations.`,
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
    const body = (request.body || {}) as ManualCapacityBookingBody;
    const businessId = cleanText(body.businessId, 100);
    const departureId = cleanText(body.departureId, 100);
    const customerName = cleanText(body.customerName, 160);
    const customerEmail = cleanText(body.customerEmail, 320).toLowerCase();
    const customerPhone = cleanText(body.customerPhone, 80);
    const customerNotes = cleanText(body.customerNotes);
    const bookingOption = cleanText(body.bookingOption, 20) as
      "shared" | "private";
    const partySize = Number(body.partySize);

    if (!UUID_PATTERN.test(businessId)) {
      return errorResponse(
        response,
        400,
        "business_required",
        "Choose a valid business",
      );
    }
    if (!UUID_PATTERN.test(departureId)) {
      return errorResponse(
        response,
        400,
        "departure_required",
        "Choose a scheduled departure",
      );
    }
    if (!customerName) {
      return errorResponse(
        response,
        400,
        "customer_name_required",
        "Add the customer's name",
      );
    }
    if (!customerEmail || !customerEmail.includes("@")) {
      return errorResponse(
        response,
        400,
        "customer_email_required",
        "Add a valid customer email",
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

    const business = context.ownedBusinesses.find(
      (candidate) => candidate.id === businessId,
    );
    if (!business) {
      return errorResponse(
        response,
        403,
        "owner_required",
        "Only the business owner can add this booking",
      );
    }

    const { data: departure, error: departureError } =
      await context.supabaseAdmin
        .from("service_departures")
        .select(
          "id, business_id, service_id, start_at, duration_minutes, capacity, meeting_point, status",
        )
        .eq("id", departureId)
        .eq("business_id", businessId)
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

    const [serviceResult, customerResult] = await Promise.all([
      context.supabaseAdmin
        .from("services")
        .select("id, name, booking_type, active, private_booking_enabled")
        .eq("id", departure.service_id)
        .eq("business_id", businessId)
        .eq("active", true)
        .eq("booking_type", "group")
        .maybeSingle<ServiceRow>(),
      context.supabaseAdmin
        .from("profiles")
        .select("id, role, preferred_language")
        .ilike("email", customerEmail)
        .maybeSingle<CustomerProfileRow>(),
    ]);

    if (serviceResult.error) throw serviceResult.error;
    if (customerResult.error) throw customerResult.error;
    const service = serviceResult.data;
    if (!service) {
      return errorResponse(
        response,
        409,
        "service_unavailable",
        "This group service is no longer active",
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

    const customerProfile =
      customerResult.data?.role === "business" ? null : customerResult.data;
    const locale: "en" | "sq" =
      customerProfile?.preferred_language === "sq" ||
      (!customerProfile && context.profile?.preferred_language === "sq")
        ? "sq"
        : "en";
    const timeZone = safeTimeZone(business.timezone);
    const departureTime = formatLocalizedDate(departure.start_at, locale, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    const copy = localizedCopy({
      locale,
      businessName: business.name || "Mirëbook",
      serviceName: service.name,
      partySize,
      bookingOption,
      departureTime,
    });

    const { data: created, error: createError } = await context.supabaseAdmin
      .rpc("mirebook_create_manual_capacity_booking", {
        p_owner_user_id: context.user.id,
        p_customer_user_id: customerProfile?.id || null,
        p_departure_id: departure.id,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_customer_phone: customerPhone || null,
        p_customer_notes: customerNotes || null,
        p_party_size: partySize,
        p_booking_option: bookingOption,
        p_customer_notification_title: copy.customerTitle,
        p_customer_notification_message: copy.customerMessage,
        p_staff_notification_title: copy.staffTitle,
        p_staff_notification_message: copy.staffMessage,
      })
      .single<AtomicBookingResult>();

    if (createError || !created) {
      const message = createError?.message || "Booking could not be created";
      if (message.includes("manual_capacity_booking_not_enough_seats")) {
        return errorResponse(
          response,
          409,
          "not_enough_seats",
          "There are not enough seats left for this booking",
        );
      }
      if (message.includes("manual_capacity_booking_party_size_invalid")) {
        return errorResponse(
          response,
          400,
          "party_size_invalid",
          "Choose a guest count within this departure's capacity",
        );
      }
      if (message.includes("manual_capacity_booking_private_unavailable")) {
        return errorResponse(
          response,
          409,
          "private_trip_unavailable",
          "Private booking is not available for this trip",
        );
      }
      if (
        message.includes("manual_capacity_booking_departure_unavailable") ||
        message.includes("manual_capacity_booking_service_unavailable")
      ) {
        return errorResponse(
          response,
          409,
          "departure_unavailable",
          "This departure is no longer available",
        );
      }
      if (message.includes("manual_capacity_booking_owner_required")) {
        return errorResponse(
          response,
          403,
          "owner_required",
          "Only the business owner can add this booking",
        );
      }
      if (
        createError?.code === "PGRST202" ||
        message.includes("mirebook_create_manual_capacity_booking")
      ) {
        return errorResponse(
          response,
          503,
          "manual_capacity_contract_not_installed",
          "Manual group booking is not configured yet",
        );
      }
      throw createError || new Error(message);
    }

    const emailDelivery = await requestBookingStatusEmail(
      request,
      created.booking_id,
    );

    return response.status(201).json({
      bookingId: created.booking_id,
      departureId: departure.id,
      status: created.booking_status,
      seatsRemaining: created.seats_remaining,
      emailDelivery,
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
