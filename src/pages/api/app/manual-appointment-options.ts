import type { NextApiRequest, NextApiResponse } from "next";
import {
  businessForContext,
  errorResponse,
  firstRelation,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  staffForContext,
} from "@/lib/server/app-api/context";

type ServiceRow = {
  id: string;
  business_id: string;
  name?: string | null;
  duration_minutes?: number | null;
  price?: number | null;
  active?: boolean | null;
};

type StaffRow = {
  id: string;
  business_id: string;
  name?: string | null;
  role_title?: string | null;
  active?: boolean | null;
};

type StaffServiceRow = {
  staff_member_id: string;
  service_id: string;
};

function shapeService(
  service: ServiceRow,
  assignments: StaffServiceRow[],
  allowedStaffIds: Set<string>,
) {
  const staffIds = assignments
    .filter(
      (assignment) =>
        assignment.service_id === service.id &&
        allowedStaffIds.has(assignment.staff_member_id),
    )
    .map((assignment) => assignment.staff_member_id);

  return {
    id: service.id,
    businessId: service.business_id,
    name: service.name || "Service",
    durationMinutes: service.duration_minutes || 30,
    price: service.price ?? null,
    staffIds,
  };
}

function shapeStaff(staff: StaffRow) {
  return {
    id: staff.id,
    businessId: staff.business_id,
    name: staff.name || "Staff member",
    roleTitle: staff.role_title || null,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const context = await loadAppContext(req);
    const requestedScope = readStringParam(req.query.scope);
    const scope: "business" | "staff" =
      requestedScope === "staff" || !context.canUseBusiness
        ? "staff"
        : "business";

    let businessId = "";
    let businessName = "";
    let businessTimezone: string | null = null;
    let allowedStaffId = "";

    if (scope === "business") {
      const business = businessForContext(
        context,
        readStringParam(req.query.businessId),
      );

      if (!business) {
        return errorResponse(
          res,
          403,
          "business_not_available",
          "Business appointment options are not available",
        );
      }

      businessId = business.id;
      businessName = business.name || "Business";
      businessTimezone = business.timezone || null;
    } else {
      const staff = staffForContext(context, readStringParam(req.query.staffId));
      if (!staff?.id) {
        return errorResponse(
          res,
          403,
          "staff_not_available",
          "Staff appointment options are not available",
        );
      }

      businessId = staff.business_id;
      allowedStaffId = staff.id;
      const business = firstRelation(staff.businesses);
      businessName = business?.name || "Business";
      businessTimezone = business?.timezone || null;
    }

    const [{ data: services, error: servicesError }, { data: staff, error: staffError }] =
      await Promise.all([
        context.supabaseAdmin
          .from("services")
          .select("id, business_id, name, duration_minutes, price, active")
          .eq("business_id", businessId)
          .eq("active", true)
          .order("name", { ascending: true })
          .returns<ServiceRow[]>(),
        context.supabaseAdmin
          .from("staff_members")
          .select("id, business_id, name, role_title, active")
          .eq("business_id", businessId)
          .eq("active", true)
          .order("name", { ascending: true })
          .returns<StaffRow[]>(),
      ]);

    if (servicesError) throw servicesError;
    if (staffError) throw staffError;

    const allowedStaff = (staff || []).filter((staffMember) =>
      allowedStaffId ? staffMember.id === allowedStaffId : true,
    );
    const allowedStaffIds = new Set(allowedStaff.map((staffMember) => staffMember.id));
    const serviceIds = (services || []).map((service) => service.id);

    const { data: assignments, error: assignmentsError } =
      serviceIds.length > 0
        ? await context.supabaseAdmin
            .from("staff_services")
            .select("staff_member_id, service_id")
            .in("service_id", serviceIds)
            .returns<StaffServiceRow[]>()
        : { data: [], error: null };

    if (assignmentsError) throw assignmentsError;

    const shapedServices = (services || [])
      .map((service) => shapeService(service, assignments || [], allowedStaffIds))
      .filter((service) => service.staffIds.length > 0);

    return res.status(200).json({
      scope,
      business: {
        id: businessId,
        name: businessName,
        timezone: businessTimezone,
      },
      services: shapedServices,
      staff: allowedStaff.map(shapeStaff),
    });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
