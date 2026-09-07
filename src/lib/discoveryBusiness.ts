import type {
  Business,
  BusinessCardStats,
} from "@/components/explore/exploreTypes";

export function businessCardStats(business: Business): BusinessCardStats {
  const staffIds = new Set(
    (business.staff_members || [])
      .filter((staff) => staff.active)
      .map((staff) => staff.id),
  );
  const services = (business.services || []).filter(
    (service) => service.active,
  );
  return {
    activeServices: services.length,
    activeStaff: staffIds.size,
    openDays: (business.availability || []).filter(
      (day) => day.is_closed !== true,
    ).length,
    assignedServices: services.filter(
      (service) =>
        service.booking_type !== "group" &&
        service.staff_services?.some((assignment) =>
          staffIds.has(assignment.staff_member_id),
        ),
    ).length,
    scheduledServices: services.filter(
      (service) =>
        service.booking_type === "group" &&
        service.has_available_departures === true,
    ).length,
  };
}

export function isDiscoverableBusiness(business: Business) {
  // Public API readiness accounts for available departure seats as well as appointments.
  return business.published === true && business.bookable === true;
}
