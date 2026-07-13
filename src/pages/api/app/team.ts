import type { NextApiRequest, NextApiResponse } from "next";
import {
  businessForContext,
  errorResponse,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  type AppContext,
} from "@/lib/server/app-api/context";

type TeamStaffRow = {
  id: string;
  business_id: string;
  name?: string | null;
  role_title?: string | null;
  email?: string | null;
  permission_role?: string | null;
  invite_status?: string | null;
  active?: boolean | null;
  user_id?: string | null;
};

type TeamServiceRow = {
  id: string;
  business_id: string;
  name?: string | null;
  duration_minutes?: number | null;
  price?: number | string | null;
  active?: boolean | null;
};

type StaffServiceRow = {
  staff_member_id: string;
  service_id: string;
};

type StaffAvailabilityRow = {
  staff_member_id: string;
  day_of_week: number;
  is_closed?: boolean | null;
};

type TeamMutationBody = {
  action?: unknown;
  businessId?: unknown;
  staffId?: unknown;
  serviceIds?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normaliseServiceIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 500) return null;

  const ids = value.map((item) => cleanText(item, 100));
  if (ids.some((id) => !id)) return null;
  return Array.from(new Set(ids));
}

async function loadTeam(context: AppContext, businessId: string) {
  const [
    { data: staff, error: staffError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    context.supabaseAdmin
      .from("staff_members")
      .select(
        "id, business_id, name, role_title, email, permission_role, invite_status, active, user_id",
      )
      .eq("business_id", businessId)
      .order("name", { ascending: true })
      .returns<TeamStaffRow[]>(),
    context.supabaseAdmin
      .from("services")
      .select("id, business_id, name, duration_minutes, price, active")
      .eq("business_id", businessId)
      .order("name", { ascending: true })
      .returns<TeamServiceRow[]>(),
  ]);

  if (staffError) throw staffError;
  if (servicesError) throw servicesError;

  const staffIds = (staff || []).map((member) => member.id);
  const serviceIds = (services || []).map((service) => service.id);
  const [
    { data: assignments, error: assignmentsError },
    { data: availability, error: availabilityError },
  ] = await Promise.all([
    staffIds.length > 0 && serviceIds.length > 0
      ? context.supabaseAdmin
          .from("staff_services")
          .select("staff_member_id, service_id")
          .in("staff_member_id", staffIds)
          .in("service_id", serviceIds)
          .returns<StaffServiceRow[]>()
      : Promise.resolve({ data: [], error: null }),
    staffIds.length > 0
      ? context.supabaseAdmin
          .from("staff_availability")
          .select("staff_member_id, day_of_week, is_closed")
          .in("staff_member_id", staffIds)
          .returns<StaffAvailabilityRow[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (assignmentsError) throw assignmentsError;
  if (availabilityError) throw availabilityError;

  const serviceRows = services || [];
  return {
    staff: (staff || []).map((member) => {
      const assignedServiceIds = new Set(
        (assignments || [])
          .filter((assignment) => assignment.staff_member_id === member.id)
          .map((assignment) => assignment.service_id),
      );
      const openDays = new Set(
        (availability || [])
          .filter(
            (row) =>
              row.staff_member_id === member.id && row.is_closed !== true,
          )
          .map((row) => row.day_of_week),
      ).size;

      return {
        id: member.id,
        businessId: member.business_id,
        name: member.name || "Staff member",
        roleTitle: member.role_title || null,
        email: member.email || null,
        permissionRole: member.permission_role || "staff",
        inviteStatus: member.invite_status || null,
        active: Boolean(member.active),
        linkedAccount: Boolean(
          member.user_id || member.invite_status === "linked",
        ),
        serviceIds: serviceRows
          .filter((service) => assignedServiceIds.has(service.id))
          .map((service) => service.id),
        openDays,
      };
    }),
    services: serviceRows.map((service) => ({
      id: service.id,
      businessId: service.business_id,
      name: service.name || "Service",
      durationMinutes: service.duration_minutes || 30,
      price: service.price === null ? null : Number(service.price || 0),
      active: Boolean(service.active),
    })),
  };
}

async function saveAssignments(
  context: AppContext,
  businessId: string,
  body: TeamMutationBody,
) {
  const staffId = cleanText(body.staffId, 100);
  const requestedServiceIds = normaliseServiceIds(body.serviceIds);

  if (!staffId) {
    throw Object.assign(new Error("Staff member is required"), {
      statusCode: 400,
      code: "staff_required",
    });
  }
  if (!requestedServiceIds) {
    throw Object.assign(new Error("Choose valid service assignments"), {
      statusCode: 400,
      code: "invalid_service_assignments",
    });
  }

  const [
    { data: member, error: memberError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    context.supabaseAdmin
      .from("staff_members")
      .select("id")
      .eq("id", staffId)
      .eq("business_id", businessId)
      .maybeSingle<{ id: string }>(),
    context.supabaseAdmin
      .from("services")
      .select("id, active")
      .eq("business_id", businessId)
      .returns<Array<{ id: string; active: boolean | null }>>(),
  ]);

  if (memberError) throw memberError;
  if (servicesError) throw servicesError;
  if (!member) {
    throw Object.assign(new Error("Staff member is not available"), {
      statusCode: 404,
      code: "staff_not_found",
    });
  }

  const activeServiceIds = new Set(
    (services || [])
      .filter((service) => service.active)
      .map((service) => service.id),
  );
  if (
    requestedServiceIds.some((serviceId) => !activeServiceIds.has(serviceId))
  ) {
    throw Object.assign(new Error("Only active services can be assigned"), {
      statusCode: 400,
      code: "inactive_or_unknown_service",
    });
  }

  const { data: existing, error: existingError } = await context.supabaseAdmin
    .from("staff_services")
    .select("staff_member_id, service_id")
    .eq("staff_member_id", staffId)
    .returns<StaffServiceRow[]>();

  if (existingError) throw existingError;

  const currentActiveIds = new Set(
    (existing || [])
      .map((assignment) => assignment.service_id)
      .filter((serviceId) => activeServiceIds.has(serviceId)),
  );
  const requestedIds = new Set(requestedServiceIds);
  const toInsert = requestedServiceIds.filter(
    (serviceId) => !currentActiveIds.has(serviceId),
  );
  const toDelete = Array.from(currentActiveIds).filter(
    (serviceId) => !requestedIds.has(serviceId),
  );

  if (toInsert.length > 0) {
    const { error: insertError } = await context.supabaseAdmin
      .from("staff_services")
      .insert(
        toInsert.map((serviceId) => ({
          staff_member_id: staffId,
          service_id: serviceId,
        })),
      );

    if (insertError) throw insertError;
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await context.supabaseAdmin
      .from("staff_services")
      .delete()
      .eq("staff_member_id", staffId)
      .in("service_id", toDelete);

    if (deleteError) throw deleteError;
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
    const body = (req.body || {}) as TeamMutationBody;
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
        "Team management is not available",
      );
    }

    if (req.method === "GET") {
      return res.status(200).json(await loadTeam(context, business.id));
    }

    if (cleanText(body.action, 40) !== "update_assignments") {
      return errorResponse(
        res,
        400,
        "invalid_team_action",
        "Choose a valid team action",
      );
    }

    await saveAssignments(context, business.id, body);
    return res.status(200).json(await loadTeam(context, business.id));
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
