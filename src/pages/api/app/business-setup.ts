import type { NextApiRequest, NextApiResponse } from "next";
import {
  businessForContext,
  errorResponse,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  type AppContext,
} from "@/lib/server/app-api/context";

type BusinessSetupRow = {
  id: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  image_url?: string | null;
  published?: boolean | null;
  auto_accept_bookings?: boolean | null;
  timezone?: string | null;
  currency?: string | null;
};

type AvailabilityRow = {
  id?: string | null;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type AvailabilityInput = {
  dayOfWeek?: number;
  day_of_week?: number;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  isClosed?: boolean;
  is_closed?: boolean;
};

type SetupUpdateBody = {
  businessId?: unknown;
  section?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  city?: unknown;
  country?: unknown;
  address?: unknown;
  phone?: unknown;
  autoAcceptBookings?: unknown;
  rows?: unknown;
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function cleanText(value: unknown, maxLength = 2_000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function nullableText(value: unknown, maxLength?: number) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function normaliseTime(value: unknown) {
  const cleaned = cleanText(value, 8);
  if (!TIME_PATTERN.test(cleaned)) return "";
  const [hour, minute] = cleaned.split(":");
  return `${hour}:${minute}`;
}

function defaultAvailabilityRow(businessId: string, dayOfWeek: number) {
  return {
    id: null,
    businessId,
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
    isClosed: dayOfWeek === 0,
  };
}

function mergeAvailabilityRows(businessId: string, rows: AvailabilityRow[]) {
  const rowsByDay = new Map(rows.map((row) => [row.day_of_week, row]));
  return DAY_ORDER.map((dayOfWeek) => {
    const row = rowsByDay.get(dayOfWeek);
    if (!row) return defaultAvailabilityRow(businessId, dayOfWeek);

    return {
      id: row.id || null,
      businessId,
      dayOfWeek,
      startTime: normaliseTime(row.start_time) || "09:00",
      endTime: normaliseTime(row.end_time) || "17:00",
      isClosed: Boolean(row.is_closed),
    };
  });
}

function normaliseAvailabilityRows(value: unknown) {
  if (!Array.isArray(value) || value.length !== 7) return null;

  const rows = value.map((rawValue) => {
    const row = (rawValue || {}) as AvailabilityInput;
    const dayOfWeek = row.dayOfWeek ?? row.day_of_week;
    const startTime = normaliseTime(row.startTime ?? row.start_time);
    const endTime = normaliseTime(row.endTime ?? row.end_time);
    const isClosed = row.isClosed ?? row.is_closed;

    if (
      !Number.isInteger(dayOfWeek) ||
      Number(dayOfWeek) < 0 ||
      Number(dayOfWeek) > 6 ||
      !startTime ||
      !endTime ||
      typeof isClosed !== "boolean" ||
      (!isClosed && startTime >= endTime)
    ) {
      return null;
    }

    return {
      day_of_week: Number(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      is_closed: isClosed,
    };
  });

  if (rows.some((row) => !row)) return null;
  if (new Set(rows.map((row) => row?.day_of_week)).size !== 7) return null;

  return rows as Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_closed: boolean;
  }>;
}

async function loadBusinessSetup(context: AppContext, businessId: string) {
  const [
    { data: business, error: businessError },
    { data: availability, error: availabilityError },
    { data: services, error: servicesError },
    { data: staff, error: staffError },
  ] = await Promise.all([
    context.supabaseAdmin
      .from("businesses")
      .select(
        "id, name, description, category, city, country, address, phone, image_url, published, auto_accept_bookings, timezone, currency",
      )
      .eq("id", businessId)
      .maybeSingle<BusinessSetupRow>(),
    context.supabaseAdmin
      .from("availability")
      .select("id, business_id, day_of_week, start_time, end_time, is_closed")
      .eq("business_id", businessId)
      .order("day_of_week")
      .returns<AvailabilityRow[]>(),
    context.supabaseAdmin
      .from("services")
      .select("id")
      .eq("business_id", businessId)
      .eq("active", true)
      .returns<Array<{ id: string }>>(),
    context.supabaseAdmin
      .from("staff_members")
      .select("id")
      .eq("business_id", businessId)
      .eq("active", true)
      .returns<Array<{ id: string }>>(),
  ]);

  if (businessError) throw businessError;
  if (availabilityError) throw availabilityError;
  if (servicesError) throw servicesError;
  if (staffError) throw staffError;
  if (!business) {
    throw Object.assign(new Error("Business setup is not available"), {
      statusCode: 404,
      code: "business_not_found",
    });
  }

  const serviceIds = (services || []).map((service) => service.id);
  const staffIds = (staff || []).map((staffMember) => staffMember.id);
  const { data: assignments, error: assignmentsError } =
    serviceIds.length > 0 && staffIds.length > 0
      ? await context.supabaseAdmin
          .from("staff_services")
          .select("id")
          .in("service_id", serviceIds)
          .in("staff_member_id", staffIds)
          .returns<Array<{ id: string }>>()
      : { data: [], error: null };

  if (assignmentsError) throw assignmentsError;

  const rows = mergeAvailabilityRows(businessId, availability || []);
  const profileComplete = Boolean(
    business.name?.trim() &&
    business.category?.trim() &&
    business.city?.trim() &&
    business.description?.trim() &&
    business.phone?.trim(),
  );
  const activeServices = serviceIds.length;
  const activeStaff = staffIds.length;
  const staffServiceAssignments = assignments?.length || 0;
  const workingDays = rows.filter((row) => !row.isClosed).length;
  const bookingReady = Boolean(
    activeServices && activeStaff && staffServiceAssignments && workingDays,
  );

  return {
    business: {
      id: business.id,
      name: business.name || "Business",
      description: business.description || "",
      category: business.category || "",
      city: business.city || "",
      country: business.country || "",
      address: business.address || "",
      phone: business.phone || "",
      imageUrl: business.image_url || null,
      published: Boolean(business.published),
      autoAcceptBookings: business.auto_accept_bookings ?? true,
      timezone: business.timezone || null,
      currency: business.currency || null,
    },
    availability: rows,
    readiness: {
      profileComplete,
      hasBusinessImage: Boolean(business.image_url?.trim()),
      activeServices,
      activeStaff,
      staffServiceAssignments,
      workingDays,
      bookingReady,
      publicListingReady: Boolean(business.published && bookingReady),
    },
  };
}

async function saveProfile(
  context: AppContext,
  businessId: string,
  body: SetupUpdateBody,
) {
  const name = cleanText(body.name, 120);
  if (!name) {
    throw Object.assign(new Error("Business name is required"), {
      statusCode: 400,
      code: "business_name_required",
    });
  }

  const { error } = await context.supabaseAdmin
    .from("businesses")
    .update({
      name,
      description: nullableText(body.description, 2_000),
      category: nullableText(body.category, 100),
      city: nullableText(body.city, 100),
      country: nullableText(body.country, 100),
      address: nullableText(body.address, 240),
      phone: nullableText(body.phone, 60),
    })
    .eq("id", businessId);

  if (error) throw error;
}

async function saveBookingMode(
  context: AppContext,
  businessId: string,
  body: SetupUpdateBody,
) {
  if (typeof body.autoAcceptBookings !== "boolean") {
    throw Object.assign(new Error("Choose a valid booking mode"), {
      statusCode: 400,
      code: "invalid_booking_mode",
    });
  }

  const { error } = await context.supabaseAdmin
    .from("businesses")
    .update({ auto_accept_bookings: body.autoAcceptBookings })
    .eq("id", businessId);

  if (error) throw error;
}

async function saveAvailability(
  context: AppContext,
  businessId: string,
  body: SetupUpdateBody,
) {
  const rows = normaliseAvailabilityRows(body.rows);
  if (!rows) {
    throw Object.assign(
      new Error("Seven valid working-hour rows are required"),
      {
        statusCode: 400,
        code: "invalid_business_availability",
      },
    );
  }

  for (const row of rows) {
    const rowUpdate = {
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed,
    };
    const { data: updatedRows, error: updateError } =
      await context.supabaseAdmin
        .from("availability")
        .update(rowUpdate)
        .eq("business_id", businessId)
        .eq("day_of_week", row.day_of_week)
        .select("id");

    if (updateError) throw updateError;

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await context.supabaseAdmin
        .from("availability")
        .insert({
          business_id: businessId,
          day_of_week: row.day_of_week,
          ...rowUpdate,
        });

      if (insertError) throw insertError;
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const context = await loadAppContext(req);
    const body = (req.body || {}) as SetupUpdateBody;
    const requestedBusinessId =
      req.method === "GET"
        ? readStringParam(req.query.businessId)
        : cleanText(body.businessId, 100);
    const business = businessForContext(context, requestedBusinessId);

    if (!business) {
      return errorResponse(
        res,
        403,
        "business_not_available",
        "Business setup is not available",
      );
    }

    if (req.method === "GET") {
      return res
        .status(200)
        .json(await loadBusinessSetup(context, business.id));
    }

    const section = cleanText(body.section, 40);
    if (section === "profile") {
      await saveProfile(context, business.id, body);
    } else if (section === "availability") {
      await saveAvailability(context, business.id, body);
    } else if (section === "booking_mode") {
      await saveBookingMode(context, business.id, body);
    } else {
      return errorResponse(
        res,
        400,
        "invalid_setup_section",
        "Choose a valid setup section",
      );
    }

    return res.status(200).json(await loadBusinessSetup(context, business.id));
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
