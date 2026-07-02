import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type BusinessRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  address?: string | null;
  image_url?: string | null;
  auto_accept_bookings?: boolean | null;
  published?: boolean | null;
  created_at?: string | null;
};

type ServiceRow = {
  id: string;
  business_id: string;
  active?: boolean | null;
};

type StaffRow = {
  id: string;
  business_id: string;
  active?: boolean | null;
};

type StaffServiceRow = {
  staff_member_id: string;
  service_id: string;
};

type AvailabilityRow = {
  id: string;
  business_id: string;
  is_closed?: boolean | null;
};

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, T[]>>((groups, row) => {
    const value = String(row[key] || "");
    if (!value) return groups;
    if (!groups[value]) groups[value] = [];
    groups[value].push(row);
    return groups;
  }, {});
}

function isBookable(
  services: Array<ServiceRow & { staff_services: StaffServiceRow[] }>,
  staffMembers: StaffRow[],
  availability: AvailabilityRow[],
) {
  const activeStaffIds = new Set(
    staffMembers.filter((staff) => staff.active).map((staff) => staff.id),
  );
  const activeServices = services.filter((service) => service.active);
  const assignedServices = activeServices.filter((service) =>
    service.staff_services.some((assignment) =>
      activeStaffIds.has(assignment.staff_member_id),
    ),
  );
  const openDays = availability.filter((row) => row.is_closed !== true);

  return (
    activeServices.length > 0 &&
    activeStaffIds.size > 0 &&
    assignedServices.length > 0 &&
    openDays.length > 0
  );
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

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    response.status(503).json({ error: "Marketplace is not configured." });
    return;
  }

  try {
    const { data: businessRows, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select(
        "id, name, description, category, city, country, phone, address, image_url, auto_accept_bookings, published, created_at",
      )
      .eq("published", true)
      .order("created_at", { ascending: false })
      .returns<BusinessRow[]>();

    if (businessError) throw businessError;

    const businesses = businessRows || [];
    const businessIds = businesses.map((business) => business.id);

    if (businessIds.length === 0) {
      response.status(200).json({ businesses: [] });
      return;
    }

    const [
      { data: serviceRows, error: serviceError },
      { data: staffRows, error: staffError },
      { data: availabilityRows, error: availabilityError },
    ] = await Promise.all([
      supabaseAdmin
        .from("services")
        .select("id, business_id, active")
        .in("business_id", businessIds)
        .eq("active", true)
        .returns<ServiceRow[]>(),
      supabaseAdmin
        .from("staff_members")
        .select("id, business_id, active")
        .in("business_id", businessIds)
        .eq("active", true)
        .returns<StaffRow[]>(),
      supabaseAdmin
        .from("availability")
        .select("id, business_id, is_closed")
        .in("business_id", businessIds)
        .returns<AvailabilityRow[]>(),
    ]);

    if (serviceError) throw serviceError;
    if (staffError) throw staffError;
    if (availabilityError) throw availabilityError;

    const staffIds = (staffRows || []).map((staff) => staff.id);
    const { data: staffServiceRows, error: staffServiceError } =
      staffIds.length > 0
        ? await supabaseAdmin
            .from("staff_services")
            .select("staff_member_id, service_id")
            .in("staff_member_id", staffIds)
            .returns<StaffServiceRow[]>()
        : { data: [], error: null };

    if (staffServiceError) throw staffServiceError;

    const servicesByBusiness = groupBy(serviceRows || [], "business_id");
    const staffByBusiness = groupBy(staffRows || [], "business_id");
    const availabilityByBusiness = groupBy(
      availabilityRows || [],
      "business_id",
    );
    const staffServicesByService = groupBy(
      staffServiceRows || [],
      "service_id",
    );

    const marketplaceBusinesses = businesses
      .map((business) => {
        const services = (servicesByBusiness[business.id] || []).map(
          (service) => ({
            id: service.id,
            active: Boolean(service.active),
            staff_services: (staffServicesByService[service.id] || []).map(
              (assignment) => ({
                staff_member_id: assignment.staff_member_id,
              }),
            ),
          }),
        );
        const staff_members = (staffByBusiness[business.id] || []).map(
          (staff) => ({
            id: staff.id,
            active: Boolean(staff.active),
          }),
        );
        const availability = (availabilityByBusiness[business.id] || []).map(
          (row) => ({
            id: row.id,
            is_closed: row.is_closed,
          }),
        );

        return {
          ...business,
          services,
          staff_members,
          availability,
        };
      })
      .filter((business) =>
        isBookable(
          business.services as Array<
            ServiceRow & { staff_services: StaffServiceRow[] }
          >,
          business.staff_members as StaffRow[],
          business.availability as AvailabilityRow[],
        ),
      );

    response.status(200).json({ businesses: marketplaceBusinesses });
  } catch (error) {
    console.error("[public-explore] Could not load marketplace", error);
    response.status(500).json({ error: "Could not load marketplace." });
  }
}
