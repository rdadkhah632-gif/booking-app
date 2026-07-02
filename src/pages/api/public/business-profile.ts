import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type BusinessRow = {
  id: string;
  user_id?: string | null;
  published?: boolean | null;
  name: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  address?: string | null;
  image_url?: string | null;
  auto_accept_bookings?: boolean | null;
  booking_interval_minutes?: number | null;
  min_notice_minutes?: number | null;
  max_advance_days?: number | null;
  buffer_before_minutes?: number | null;
  buffer_after_minutes?: number | null;
  cancellation_policy?: string | null;
  reschedule_policy?: string | null;
  timezone?: string | null;
  currency?: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description?: string | null;
  image_url?: string | null;
};

type StaffRow = {
  id: string;
  name: string;
  role_title?: string | null;
  image_url?: string | null;
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

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function publicBusiness(business: BusinessRow) {
  const { user_id: _userId, ...safeBusiness } = business;
  return safeBusiness;
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

  const businessId = readStringParam(request.query.businessId);
  if (!businessId) {
    response.status(400).json({ error: "A business is required." });
    return;
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    response.status(503).json({ error: "Business profile is not configured." });
    return;
  }

  try {
    const token = bearerToken(request);
    const {
      data: { user },
    } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: { user: null } };

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select(
        "id, user_id, published, name, description, category, city, country, phone, address, image_url, auto_accept_bookings, booking_interval_minutes, min_notice_minutes, max_advance_days, buffer_before_minutes, buffer_after_minutes, cancellation_policy, reschedule_policy, timezone, currency",
      )
      .eq("id", businessId)
      .maybeSingle<BusinessRow>();

    if (businessError) throw businessError;

    const ownerPreview = Boolean(user?.id && business?.user_id === user.id);

    if (!business || (!business.published && !ownerPreview)) {
      response.status(404).json({ error: "Business is not available." });
      return;
    }

    const [
      { data: services, error: serviceError },
      { data: staffMembers, error: staffError },
      { data: availability, error: availabilityError },
    ] = await Promise.all([
      supabaseAdmin
        .from("services")
        .select("id, name, duration_minutes, price, description, image_url")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .returns<ServiceRow[]>(),
      supabaseAdmin
        .from("staff_members")
        .select("id, name, role_title, image_url")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .returns<StaffRow[]>(),
      supabaseAdmin
        .from("availability")
        .select("day_of_week, start_time, end_time, is_closed")
        .eq("business_id", business.id)
        .returns<AvailabilityRow[]>(),
    ]);

    if (serviceError) throw serviceError;
    if (staffError) throw staffError;
    if (availabilityError) throw availabilityError;

    const staffIds = (staffMembers || []).map((staff) => staff.id);
    const serviceIds = new Set((services || []).map((service) => service.id));

    const [
      { data: staffServices, error: staffServiceError },
      { data: staffAvailability, error: staffAvailabilityError },
    ] =
      staffIds.length > 0
        ? await Promise.all([
            supabaseAdmin
              .from("staff_services")
              .select("staff_member_id, service_id")
              .in("staff_member_id", staffIds)
              .returns<StaffServiceRow[]>(),
            supabaseAdmin
              .from("staff_availability")
              .select(
                "staff_member_id, day_of_week, start_time, end_time, is_closed",
              )
              .in("staff_member_id", staffIds)
              .returns<StaffAvailabilityRow[]>(),
          ])
        : [
            { data: [] as StaffServiceRow[], error: null },
            { data: [] as StaffAvailabilityRow[], error: null },
          ];

    if (staffServiceError) throw staffServiceError;
    if (staffAvailabilityError) throw staffAvailabilityError;

    response.status(200).json({
      business: publicBusiness(business),
      services: services || [],
      staffMembers: staffMembers || [],
      staffServices: (staffServices || []).filter((assignment) =>
        serviceIds.has(assignment.service_id),
      ),
      staffAvailability: staffAvailability || [],
      availability: availability || [],
      ownerPreview,
    });
  } catch (error) {
    console.error("[public-business-profile] Could not load profile", error);
    response.status(500).json({ error: "Could not load business profile." });
  }
}
