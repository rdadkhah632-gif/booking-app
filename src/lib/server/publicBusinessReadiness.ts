import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ReadinessService = {
  id: string;
  active?: boolean | null;
  booking_type?: string | null;
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
  booking_type?: string | null;
};

type DepartureRow = {
  id: string;
  business_id: string;
  service_id: string;
  capacity: number;
};

type DepartureBookingRow = {
  departure_id: string;
  party_size?: number | null;
  booking_option?: string | null;
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
  scheduledDepartureServiceIds: Set<string> = new Set(),
) {
  const activeStaffIds = new Set(
    staffMembers.filter((staff) => staff.active).map((staff) => staff.id),
  );
  const activeServices = services.filter((service) => service.active);
  const activeAppointmentServices = activeServices.filter(
    (service) => service.booking_type !== "group",
  );
  const hasAssignedAppointmentService = activeAppointmentServices.some(
    (service) =>
      (service.staff_services || []).some((assignment) =>
        activeStaffIds.has(assignment.staff_member_id),
      ),
  );
  const hasOpenDay = availability.some((row) => row.is_closed !== true);
  const hasScheduledGroupDeparture = activeServices.some(
    (service) =>
      service.booking_type === "group" &&
      scheduledDepartureServiceIds.has(service.id),
  );

  return (
    hasScheduledGroupDeparture ||
    (activeAppointmentServices.length > 0 &&
      activeStaffIds.size > 0 &&
      hasAssignedAppointmentService &&
      hasOpenDay)
  );
}

export async function publicBookableBusinessIds(
  supabase: SupabaseAdminClient,
  requestedBusinessIds: string[],
) {
  const businessIds = Array.from(new Set(requestedBusinessIds.filter(Boolean)));
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
      .select("id, business_id, active, booking_type")
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

  const groupServiceIds = (services || [])
    .filter((service) => service.booking_type === "group")
    .map((service) => service.id);
  const { data: departures, error: departureError } =
    groupServiceIds.length > 0
      ? await supabase
          .from("service_departures")
          .select("id, business_id, service_id, capacity")
          .in("business_id", publishedIds)
          .in("service_id", groupServiceIds)
          .eq("status", "scheduled")
          .gte("start_at", new Date().toISOString())
          .returns<DepartureRow[]>()
      : { data: [] as DepartureRow[], error: null };

  if (departureError) throw departureError;
  const departureIds = (departures || []).map((departure) => departure.id);
  const { data: departureBookings, error: departureBookingError } =
    departureIds.length > 0
      ? await supabase
          .from("bookings")
          .select("departure_id, party_size, booking_option")
          .in("departure_id", departureIds)
          .in("status", ["pending", "confirmed"])
          .returns<DepartureBookingRow[]>()
      : { data: [] as DepartureBookingRow[], error: null };

  if (departureBookingError) throw departureBookingError;
  const departureById = new Map(
    (departures || []).map((departure) => [departure.id, departure]),
  );
  const reservedByDeparture = new Map<string, number>();
  for (const booking of departureBookings || []) {
    const departure = departureById.get(booking.departure_id);
    if (!departure) continue;
    const reserved =
      booking.booking_option === "private"
        ? departure.capacity
        : Math.max(Number(booking.party_size || 1), 1);
    reservedByDeparture.set(
      departure.id,
      (reservedByDeparture.get(departure.id) || 0) + reserved,
    );
  }
  const departureServicesByBusiness = new Map<string, Set<string>>();
  for (const departure of departures || []) {
    if ((reservedByDeparture.get(departure.id) || 0) >= departure.capacity) {
      continue;
    }
    const current =
      departureServicesByBusiness.get(departure.business_id) || new Set();
    current.add(departure.service_id);
    departureServicesByBusiness.set(departure.business_id, current);
  }

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
      booking_type: service.booking_type,
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

  const availabilityByBusiness = new Map<string, ReadinessAvailability[]>();
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
        departureServicesByBusiness.get(businessId) || new Set(),
      ),
    ),
  );
}
