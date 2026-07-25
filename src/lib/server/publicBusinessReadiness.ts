import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ReadinessService = {
  id: string;
  active?: boolean | null;
  staff_services?: { staff_member_id: string }[] | null;
};

type ReadinessStaff = {
  id: string;
  active?: boolean | null;
};

type ReadinessAvailability = {
  is_closed?: boolean | null;
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
  business_id: string;
  is_closed?: boolean | null;
};

export function isPublicBusinessBookable(
  services: ReadinessService[],
  staffMembers: ReadinessStaff[],
  availability: ReadinessAvailability[],
) {
  const activeStaffIds = new Set(
    staffMembers.filter((staff) => staff.active).map((staff) => staff.id),
  );
  const activeServices = services.filter((service) => service.active);
  const hasAssignedService = activeServices.some((service) =>
    (service.staff_services || []).some((assignment) =>
      activeStaffIds.has(assignment.staff_member_id),
    ),
  );
  const hasOpenDay = availability.some((row) => row.is_closed !== true);

  return (
    activeServices.length > 0 &&
    activeStaffIds.size > 0 &&
    hasAssignedService &&
    hasOpenDay
  );
}

export async function publicBookableBusinessIds(
  supabase: SupabaseAdminClient,
  requestedBusinessIds: string[],
) {
  const businessIds = Array.from(
    new Set(requestedBusinessIds.filter(Boolean)),
  );
  if (businessIds.length === 0) return new Set<string>();

  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .in("id", businessIds)
    .eq("published", true)
    .returns<{ id: string }[]>();

  if (businessError) throw businessError;

  const publishedIds = (businesses || []).map((business) => business.id);
  if (publishedIds.length === 0) return new Set<string>();

  const [
    { data: services, error: serviceError },
    { data: staffMembers, error: staffError },
    { data: availability, error: availabilityError },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, business_id, active")
      .in("business_id", publishedIds)
      .eq("active", true)
      .returns<ServiceRow[]>(),
    supabase
      .from("staff_members")
      .select("id, business_id, active")
      .in("business_id", publishedIds)
      .eq("active", true)
      .returns<StaffRow[]>(),
    supabase
      .from("availability")
      .select("business_id, is_closed")
      .in("business_id", publishedIds)
      .returns<AvailabilityRow[]>(),
  ]);

  if (serviceError) throw serviceError;
  if (staffError) throw staffError;
  if (availabilityError) throw availabilityError;

  const serviceIds = (services || []).map((service) => service.id);
  const staffIds = (staffMembers || []).map((staff) => staff.id);
  const { data: assignments, error: assignmentError } =
    serviceIds.length > 0 && staffIds.length > 0
      ? await supabase
          .from("staff_services")
          .select("staff_member_id, service_id")
          .in("service_id", serviceIds)
          .in("staff_member_id", staffIds)
          .returns<StaffServiceRow[]>()
      : { data: [] as StaffServiceRow[], error: null };

  if (assignmentError) throw assignmentError;

  const assignmentsByService = new Map<string, StaffServiceRow[]>();
  for (const assignment of assignments || []) {
    const current = assignmentsByService.get(assignment.service_id) || [];
    current.push(assignment);
    assignmentsByService.set(assignment.service_id, current);
  }

  const servicesByBusiness = new Map<string, ReadinessService[]>();
  for (const service of services || []) {
    const current = servicesByBusiness.get(service.business_id) || [];
    current.push({
      id: service.id,
      active: service.active,
      staff_services: assignmentsByService.get(service.id) || [],
    });
    servicesByBusiness.set(service.business_id, current);
  }

  const staffByBusiness = new Map<string, ReadinessStaff[]>();
  for (const staff of staffMembers || []) {
    const current = staffByBusiness.get(staff.business_id) || [];
    current.push({ id: staff.id, active: staff.active });
    staffByBusiness.set(staff.business_id, current);
  }

  const availabilityByBusiness = new Map<
    string,
    ReadinessAvailability[]
  >();
  for (const row of availability || []) {
    const current = availabilityByBusiness.get(row.business_id) || [];
    current.push({ is_closed: row.is_closed });
    availabilityByBusiness.set(row.business_id, current);
  }

  return new Set(
    publishedIds.filter((businessId) =>
      isPublicBusinessBookable(
        servicesByBusiness.get(businessId) || [],
        staffByBusiness.get(businessId) || [],
        availabilityByBusiness.get(businessId) || [],
      ),
    ),
  );
}
