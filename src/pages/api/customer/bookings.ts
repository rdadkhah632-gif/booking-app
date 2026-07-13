import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  ClaimedCustomerBooking,
  claimUnlinkedCustomerBookings,
} from "@/lib/server/claimCustomerBookings";
import { Locale, translate } from "@/lib/i18n";

type ViewerRole = "customer" | "business";

type BookingRow = {
  id: string;
  business_id?: string | null;
  service_id?: string | null;
  staff_member_id?: string | null;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
  completed_at?: string | null;
};

type BusinessRow = {
  id: string;
  user_id?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes?: number | null;
  price: number;
};

type StaffRow = {
  id: string;
  name: string;
  role_title?: string | null;
};

type BookingRequestRow = {
  id: string;
  booking_id: string;
  status: string;
  requested_start_at: string;
  requested_duration_minutes: number;
  response_message?: string | null;
  created_at: string;
  requested_staff_member_id?: string | null;
};

type StaffServiceRow = {
  staff_member_id: string;
  service_id: string;
};

type StaffAvailabilityRow = {
  staff_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type ExistingBookingRow = {
  id: string;
  staff_member_id?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type CustomerNotificationCopy = {
  type: string;
  titleKey: string;
  titleFallback: string;
  messageKey: string;
  messageFallback: string;
};

const customerNotificationCopy: Record<string, CustomerNotificationCopy> = {
  pending: {
    type: "booking_requested",
    titleKey: "notifications.types.bookingRequested.title",
    titleFallback: "Request sent",
    messageKey: "notifications.types.bookingRequested.message",
    messageFallback:
      "Your booking request has been sent to the business for review.",
  },
  confirmed: {
    type: "booking_accepted",
    titleKey: "notifications.types.bookingAccepted.title",
    titleFallback: "Booking accepted",
    messageKey: "notifications.types.bookingAccepted.message",
    messageFallback: "Your booking has been accepted and confirmed.",
  },
  declined: {
    type: "booking_declined",
    titleKey: "notifications.types.bookingDeclined.title",
    titleFallback: "Booking declined",
    messageKey: "notifications.types.bookingDeclined.message",
    messageFallback: "Your booking request was declined.",
  },
  cancelled: {
    type: "booking_cancelled",
    titleKey: "notifications.types.bookingCancelled.title",
    titleFallback: "Booking cancelled",
    messageKey: "notifications.types.bookingCancelled.message",
    messageFallback: "Your booking was cancelled by the business.",
  },
  completed: {
    type: "booking_completed",
    titleKey: "notifications.types.bookingCompleted.title",
    titleFallback: "Appointment completed",
    messageKey: "notifications.types.bookingCompleted.message",
    messageFallback: "Your appointment has been marked as completed.",
  },
};

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  );
}

function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

async function ensureClaimedBookingNotifications(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  claimedBookings: ClaimedCustomerBooking[],
) {
  if (claimedBookings.length === 0) return;

  const bookingIds = claimedBookings.map((booking) => booking.id);
  const [{ data: profile }, { data: existingRows, error: existingError }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("preferred_language")
        .eq("id", userId)
        .maybeSingle<{ preferred_language?: string | null }>(),
      supabaseAdmin
        .from("notifications")
        .select("booking_id, type")
        .eq("user_id", userId)
        .in("booking_id", bookingIds),
    ]);

  if (existingError) throw existingError;

  const locale: Locale = profile?.preferred_language === "sq" ? "sq" : "en";
  const existingKeys = new Set(
    (existingRows || []).map(
      (row: { booking_id?: string | null; type?: string | null }) =>
        `${row.booking_id || ""}:${row.type || ""}`,
    ),
  );

  const notifications = claimedBookings.flatMap((booking) => {
    const copy = customerNotificationCopy[booking.status];
    if (!copy || existingKeys.has(`${booking.id}:${copy.type}`)) return [];

    return [
      {
        user_id: userId,
        business_id: booking.business_id,
        booking_id: booking.id,
        audience: "customer",
        type: copy.type,
        title: translate(locale, copy.titleKey, copy.titleFallback),
        message: translate(locale, copy.messageKey, copy.messageFallback),
        action_url: `/booking-confirmation?id=${booking.id}`,
      },
    ];
  });

  if (notifications.length === 0) return;

  const { error } = await supabaseAdmin
    .from("notifications")
    .insert(notifications);

  if (error) throw error;
}

function safeBusinessForBooking(business: BusinessRow | null | undefined) {
  if (!business) return null;

  const { user_id: _userId, ...safeBusiness } = business;
  return safeBusiness;
}

function shapeBooking(
  booking: BookingRow,
  businesses: Map<string, BusinessRow>,
  services: Map<string, ServiceRow>,
  staffMembers: Map<string, StaffRow>,
) {
  return {
    ...booking,
    businesses: booking.business_id
      ? safeBusinessForBooking(businesses.get(booking.business_id))
      : null,
    services: booking.service_id
      ? services.get(booking.service_id) || null
      : null,
    staff_members: booking.staff_member_id
      ? staffMembers.get(booking.staff_member_id) || null
      : null,
  };
}

function shapeRequest(
  request: BookingRequestRow,
  staffMembers: Map<string, StaffRow>,
) {
  const { requested_staff_member_id: requestedStaffMemberId, ...safeRequest } =
    request;

  return {
    ...safeRequest,
    requested_staff: requestedStaffMemberId
      ? staffMembers.get(requestedStaffMemberId) || null
      : null,
  };
}

async function loadBusinesses(
  supabaseAdmin: SupabaseAdminClient,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, BusinessRow>();

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, user_id, name, address, city, country, phone")
    .in("id", ids);

  if (error) throw error;
  return indexById((data || []) as BusinessRow[]);
}

async function loadServices(supabaseAdmin: SupabaseAdminClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, ServiceRow>();

  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id, name, duration_minutes, price")
    .in("id", ids);

  if (error) throw error;
  return indexById((data || []) as ServiceRow[]);
}

async function loadStaffMembers(
  supabaseAdmin: SupabaseAdminClient,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, StaffRow>();

  const { data, error } = await supabaseAdmin
    .from("staff_members")
    .select("id, name, role_title")
    .in("id", ids);

  if (error) throw error;
  return indexById((data || []) as StaffRow[]);
}

async function loadBookingRelations(
  supabaseAdmin: SupabaseAdminClient,
  bookings: BookingRow[],
) {
  const businessIds = uniqueStrings(
    bookings.map((booking) => booking.business_id),
  );
  const serviceIds = uniqueStrings(
    bookings.map((booking) => booking.service_id),
  );
  const staffIds = uniqueStrings(
    bookings.map((booking) => booking.staff_member_id),
  );

  const [businesses, services, staffMembers] = await Promise.all([
    loadBusinesses(supabaseAdmin, businessIds),
    loadServices(supabaseAdmin, serviceIds),
    loadStaffMembers(supabaseAdmin, staffIds),
  ]);

  return { businesses, services, staffMembers };
}

async function handleBookingList(
  supabaseAdmin: SupabaseAdminClient,
  response: NextApiResponse,
  userId: string,
) {
  const { data: bookingRows, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("customer_user_id", userId)
    .order("start_at", { ascending: true });

  if (bookingError) throw bookingError;

  const bookings = (bookingRows || []) as BookingRow[];
  const relations = await loadBookingRelations(supabaseAdmin, bookings);

  const { data: requestRows, error: requestError } = await supabaseAdmin
    .from("booking_requests")
    .select(
      "id, booking_id, status, requested_start_at, requested_duration_minutes, response_message, created_at, requested_staff_member_id",
    )
    .eq("customer_user_id", userId)
    .order("created_at", { ascending: false });

  if (requestError) throw requestError;

  const requests = (requestRows || []) as BookingRequestRow[];
  const requestedStaffIds = uniqueStrings(
    requests.map((request) => request.requested_staff_member_id),
  );
  const requestedStaffMembers = await loadStaffMembers(
    supabaseAdmin,
    requestedStaffIds,
  );

  response.status(200).json({
    bookings: bookings.map((booking) =>
      shapeBooking(
        booking,
        relations.businesses,
        relations.services,
        relations.staffMembers,
      ),
    ),
    requests: requests.map((request) =>
      shapeRequest(request, requestedStaffMembers),
    ),
  });
}

async function loadRescheduleContext(
  supabaseAdmin: SupabaseAdminClient,
  businessId: string,
) {
  const { data: staffRows, error: staffError } = await supabaseAdmin
    .from("staff_members")
    .select("id, name, role_title")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (staffError) throw staffError;

  const staffMembers = (staffRows || []) as StaffRow[];
  const staffIds = staffMembers.map((staff) => staff.id);

  let staffServices: StaffServiceRow[] = [];
  let staffAvailability: StaffAvailabilityRow[] = [];

  if (staffIds.length > 0) {
    const [
      { data: staffServiceRows, error: staffServiceError },
      { data: staffAvailabilityRows, error: staffAvailabilityError },
    ] = await Promise.all([
      supabaseAdmin
        .from("staff_services")
        .select("staff_member_id, service_id")
        .in("staff_member_id", staffIds),
      supabaseAdmin
        .from("staff_availability")
        .select("staff_member_id, day_of_week, start_time, end_time, is_closed")
        .in("staff_member_id", staffIds),
    ]);

    if (staffServiceError) throw staffServiceError;
    if (staffAvailabilityError) throw staffAvailabilityError;

    staffServices = (staffServiceRows || []) as StaffServiceRow[];
    staffAvailability = (staffAvailabilityRows || []) as StaffAvailabilityRow[];
  }

  const [
    { data: availabilityRows, error: availabilityError },
    { data: existingBookingRows, error: existingBookingsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("availability")
      .select("day_of_week, start_time, end_time, is_closed")
      .eq("business_id", businessId),
    supabaseAdmin
      .from("bookings")
      .select("id, staff_member_id, start_at, end_at, duration_minutes, status")
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"]),
  ]);

  if (availabilityError) throw availabilityError;
  if (existingBookingsError) throw existingBookingsError;

  return {
    staffMembers,
    staffServices,
    staffAvailability,
    availability: (availabilityRows || []) as AvailabilityRow[],
    existingBookings: (existingBookingRows || []) as ExistingBookingRow[],
  };
}

async function handleBookingDetail(
  supabaseAdmin: SupabaseAdminClient,
  request: NextApiRequest,
  response: NextApiResponse,
  userId: string,
  bookingId: string,
) {
  const { data: bookingRow, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle<BookingRow>();

  if (bookingError) throw bookingError;

  if (!bookingRow) {
    response.status(404).json({ error: "Booking not found." });
    return;
  }

  const relations = await loadBookingRelations(supabaseAdmin, [bookingRow]);
  const business = bookingRow.business_id
    ? relations.businesses.get(bookingRow.business_id) || null
    : null;

  const isCustomerOwner = bookingRow.customer_user_id === userId;
  const isBusinessOwner = business?.user_id === userId;

  if (!isCustomerOwner && !isBusinessOwner) {
    response.status(404).json({ error: "Booking not found." });
    return;
  }

  const viewerRole: ViewerRole =
    isBusinessOwner && !isCustomerOwner ? "business" : "customer";
  const includeReschedule =
    readStringParam(request.query.include) === "reschedule";

  const payload: Record<string, unknown> = {
    booking: shapeBooking(
      bookingRow,
      relations.businesses,
      relations.services,
      relations.staffMembers,
    ),
    viewerRole,
  };

  if (includeReschedule && bookingRow.business_id) {
    payload.rescheduleContext = await loadRescheduleContext(
      supabaseAdmin,
      bookingRow.business_id,
    );
  }

  response.status(200).json(payload);
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const token = bearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      response.status(401).json({ error: "Invalid session." });
      return;
    }

    const claimedBookings = await claimUnlinkedCustomerBookings(
      supabaseAdmin,
      {
        userId: user.id,
        email: user.email,
        accountMode:
          typeof user.user_metadata?.account_mode === "string"
            ? user.user_metadata.account_mode
            : typeof user.user_metadata?.role === "string"
              ? user.user_metadata.role
              : null,
      },
    );

    await ensureClaimedBookingNotifications(
      supabaseAdmin,
      user.id,
      claimedBookings,
    );

    const bookingId = readStringParam(request.query.id);

    if (bookingId) {
      await handleBookingDetail(
        supabaseAdmin,
        request,
        response,
        user.id,
        bookingId,
      );
      return;
    }

    await handleBookingList(supabaseAdmin, response, user.id);
  } catch (error) {
    console.error("[customer-bookings] Request failed", error);
    response.status(500).json({ error: "Could not load bookings." });
  }
}
