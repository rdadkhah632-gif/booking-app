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
  phone?: string | null;
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
  profile?: unknown;
  active?: unknown;
  confirmFutureBookings?: unknown;
  confirmOwnerProfile?: unknown;
  confirmIncompleteSetup?: unknown;
};

type TeamProfileInput = {
  name: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
};

type ExistingStaffProfile = {
  id: string;
  email?: string | null;
  user_id?: string | null;
  invite_status?: string | null;
};

type ActivationStaffRow = {
  id: string;
  business_id: string;
  user_id?: string | null;
  active?: boolean | null;
};

type ActivationPreview = {
  staffId: string;
  currentActive: boolean;
  targetActive: boolean;
  upcomingBookingCount: number;
  ownerProfile: boolean;
  missingActiveServices: boolean;
  missingWorkingHours: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function inputError(code: string, message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode, code });
}

function profileText(value: unknown, maxLength: number, fieldName: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw inputError("invalid_staff_profile", `${fieldName} is invalid`);
  }

  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength || /[\r\n]/.test(cleaned)) {
    throw inputError("invalid_staff_profile", `${fieldName} is invalid`);
  }
  return cleaned;
}

function normaliseProfile(value: unknown): TeamProfileInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw inputError("invalid_staff_profile", "Staff profile is required");
  }

  const input = value as Record<string, unknown>;
  const name = profileText(input.name, 120, "Staff name");
  if (!name) {
    throw inputError("staff_name_required", "Staff name is required");
  }

  const email = profileText(input.email, 320, "Email")?.toLowerCase() || null;
  if (email && !EMAIL_PATTERN.test(email)) {
    throw inputError("invalid_staff_email", "Enter a valid staff email");
  }

  return {
    name,
    roleTitle: profileText(input.roleTitle, 120, "Role title"),
    email,
    phone: profileText(input.phone, 50, "Phone"),
  };
}

async function loadTeam(context: AppContext, businessId: string) {
  const [
    { data: staff, error: staffError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    context.supabaseAdmin
      .from("staff_members")
      .select(
        "id, business_id, name, role_title, email, phone, permission_role, invite_status, active, user_id",
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
        phone: member.phone || null,
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

async function ensureEmailAvailable(
  context: AppContext,
  businessId: string,
  email: string | null,
  excludingStaffId?: string,
) {
  if (!email) return;

  let query = context.supabaseAdmin
    .from("staff_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("email", email)
    .limit(1);

  if (excludingStaffId) {
    query = query.neq("id", excludingStaffId);
  }

  const { data, error } = await query.returns<Array<{ id: string }>>();
  if (error) throw error;
  if ((data || []).length > 0) {
    throw inputError(
      "staff_email_in_use",
      "That email is already used by this team",
      409,
    );
  }
}

async function createStaffProfile(
  context: AppContext,
  businessId: string,
  body: TeamMutationBody,
) {
  const profile = normaliseProfile(body.profile);
  await ensureEmailAvailable(context, businessId, profile.email);

  const { error } = await context.supabaseAdmin.from("staff_members").insert({
    business_id: businessId,
    name: profile.name,
    role_title: profile.roleTitle,
    email: profile.email,
    phone: profile.phone,
    permission_role: "staff",
    invite_status: "not_invited",
    active: true,
  });

  if (error) throw error;
}

async function updateStaffProfile(
  context: AppContext,
  businessId: string,
  body: TeamMutationBody,
) {
  const staffId = cleanText(body.staffId, 100);
  if (!staffId) {
    throw inputError("staff_required", "Staff member is required");
  }

  const profile = normaliseProfile(body.profile);
  const { data: existing, error: existingError } = await context.supabaseAdmin
    .from("staff_members")
    .select("id, email, user_id, invite_status")
    .eq("id", staffId)
    .eq("business_id", businessId)
    .maybeSingle<ExistingStaffProfile>();

  if (existingError) throw existingError;
  if (!existing) {
    throw inputError("staff_not_found", "Staff member is not available", 404);
  }

  const existingEmail = existing.email?.trim().toLowerCase() || null;
  const emailChanged = profile.email !== existingEmail;
  if (emailChanged && existing.user_id) {
    throw inputError(
      "linked_staff_email_locked",
      "A linked staff email cannot be changed here",
      409,
    );
  }

  const inviteStatus = existing.invite_status?.trim().toLowerCase() || "";
  if (emailChanged && ["invited", "pending"].includes(inviteStatus)) {
    throw inputError(
      "pending_invite_email_locked",
      "Revoke the pending invitation before changing this email",
      409,
    );
  }

  if (emailChanged) {
    const { data: openInvite, error: inviteError } = await context.supabaseAdmin
      .from("staff_invite_tokens")
      .select("id")
      .eq("staff_member_id", staffId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (inviteError) throw inviteError;
    if (openInvite) {
      throw inputError(
        "pending_invite_email_locked",
        "Revoke the pending invitation before changing this email",
        409,
      );
    }

    await ensureEmailAvailable(context, businessId, profile.email, staffId);
  }

  const { error: updateError } = await context.supabaseAdmin
    .from("staff_members")
    .update({
      name: profile.name,
      role_title: profile.roleTitle,
      email: profile.email,
      phone: profile.phone,
    })
    .eq("id", staffId)
    .eq("business_id", businessId);

  if (updateError) throw updateError;
}

async function loadActivationPreview(
  context: AppContext,
  businessId: string,
  body: TeamMutationBody,
): Promise<ActivationPreview> {
  const staffId = cleanText(body.staffId, 100);
  if (!staffId) {
    throw inputError("staff_required", "Staff member is required");
  }
  if (typeof body.active !== "boolean") {
    throw inputError(
      "invalid_staff_active_state",
      "Choose a valid staff active state",
    );
  }

  const { data: staff, error: staffError } = await context.supabaseAdmin
    .from("staff_members")
    .select("id, business_id, user_id, active")
    .eq("id", staffId)
    .eq("business_id", businessId)
    .maybeSingle<ActivationStaffRow>();

  if (staffError) throw staffError;
  if (!staff) {
    throw inputError("staff_not_found", "Staff member is not available", 404);
  }

  const [
    { count: upcomingBookingCount, error: bookingError },
    { count: openDayCount, error: availabilityError },
    { data: assignments, error: assignmentError },
  ] = await Promise.all([
    context.supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("staff_member_id", staff.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", new Date().toISOString()),
    context.supabaseAdmin
      .from("staff_availability")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("staff_member_id", staff.id)
      .eq("is_closed", false),
    context.supabaseAdmin
      .from("staff_services")
      .select("service_id")
      .eq("staff_member_id", staff.id)
      .returns<Array<{ service_id: string }>>(),
  ]);

  if (bookingError) throw bookingError;
  if (availabilityError) throw availabilityError;
  if (assignmentError) throw assignmentError;

  const assignedServiceIds = Array.from(
    new Set((assignments || []).map((assignment) => assignment.service_id)),
  );
  let activeServiceCount = 0;

  if (assignedServiceIds.length > 0) {
    const { count, error } = await context.supabaseAdmin
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("active", true)
      .in("id", assignedServiceIds);

    if (error) throw error;
    activeServiceCount = count || 0;
  }

  return {
    staffId: staff.id,
    currentActive: Boolean(staff.active),
    targetActive: body.active,
    upcomingBookingCount: upcomingBookingCount || 0,
    ownerProfile: Boolean(staff.user_id && staff.user_id === context.user.id),
    missingActiveServices: activeServiceCount === 0,
    missingWorkingHours: (openDayCount || 0) === 0,
  };
}

async function saveActiveState(
  context: AppContext,
  businessId: string,
  body: TeamMutationBody,
) {
  const preview = await loadActivationPreview(context, businessId, body);
  if (preview.targetActive === preview.currentActive) return;

  if (preview.targetActive) {
    if (
      (preview.missingActiveServices || preview.missingWorkingHours) &&
      body.confirmIncompleteSetup !== true
    ) {
      throw inputError(
        "incomplete_setup_confirmation_required",
        "Confirm activation with incomplete services or working hours",
        409,
      );
    }
  } else {
    if (
      preview.upcomingBookingCount > 0 &&
      body.confirmFutureBookings !== true
    ) {
      throw inputError(
        "future_bookings_confirmation_required",
        "Confirm deactivation with upcoming bookings",
        409,
      );
    }
    if (preview.ownerProfile && body.confirmOwnerProfile !== true) {
      throw inputError(
        "owner_profile_confirmation_required",
        "Confirm deactivation of your own staff profile",
        409,
      );
    }
  }

  const { data: updated, error: updateError } = await context.supabaseAdmin
    .from("staff_members")
    .update({ active: preview.targetActive })
    .eq("id", preview.staffId)
    .eq("business_id", businessId)
    .eq("active", preview.currentActive)
    .select("id");

  if (updateError) throw updateError;
  if (!updated || updated.length === 0) {
    throw inputError(
      "stale_staff_active_state",
      "Staff status changed. Refresh and try again",
      409,
    );
  }
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

    const action = cleanText(body.action, 40);
    if (action === "activation_preview") {
      return res.status(200).json({
        preview: await loadActivationPreview(context, business.id, body),
      });
    } else if (action === "set_active") {
      await saveActiveState(context, business.id, body);
    } else if (action === "update_assignments") {
      await saveAssignments(context, business.id, body);
    } else if (action === "create_profile") {
      await createStaffProfile(context, business.id, body);
    } else if (action === "update_profile") {
      await updateStaffProfile(context, business.id, body);
    } else {
      return errorResponse(
        res,
        400,
        "invalid_team_action",
        "Choose a valid team action",
      );
    }

    return res.status(200).json(await loadTeam(context, business.id));
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
