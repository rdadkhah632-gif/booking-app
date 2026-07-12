import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type AppProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  preferred_language?: string | null;
};

export type AppBusiness = {
  id: string;
  name?: string | null;
  city?: string | null;
  category?: string | null;
  published?: boolean | null;
  timezone?: string | null;
};

export type AppStaffProfile = {
  id: string;
  business_id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  role_title?: string | null;
  permission_role?: string | null;
  invite_status?: string | null;
  active?: boolean | null;
  businesses?: AppBusiness | AppBusiness[] | null;
};

export type AppContext = {
  supabaseAdmin: SupabaseAdminClient;
  user: {
    id: string;
    email?: string | null;
  };
  profile: AppProfile | null;
  ownedBusinesses: AppBusiness[];
  linkedStaffProfiles: AppStaffProfile[];
  isAdmin: boolean;
  canUseBusiness: boolean;
  canUseStaff: boolean;
  primaryBusinessId: string | null;
  primaryStaffId: string | null;
};

export function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

export function errorResponse(
  res: NextApiResponse,
  status: number,
  code: string,
  error: string,
) {
  return res.status(status).json({ code, error });
}

export function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const daysSinceMonday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - daysSinceMonday);
  return copy;
}

export function safeDateFromInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function defaultRouteForAppContext(context: AppContext) {
  if (context.isAdmin) return "/admin";
  if (context.canUseBusiness) return "/dashboard";
  if (context.canUseStaff) return "/staff";
  return "/my-bookings";
}

export function businessForContext(context: AppContext, businessId?: string) {
  if (!businessId) return context.ownedBusinesses[0] || null;
  return (
    context.ownedBusinesses.find((business) => business.id === businessId) ||
    null
  );
}

export function staffForContext(context: AppContext, staffId?: string) {
  if (!staffId) return context.linkedStaffProfiles[0] || null;
  return (
    context.linkedStaffProfiles.find((staff) => staff.id === staffId) || null
  );
}

export async function loadAppContext(req: NextApiRequest): Promise<AppContext> {
  const token = bearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Authentication required"), {
      statusCode: 401,
      code: "auth_required",
    });
  }

  let supabaseAdmin: SupabaseAdminClient;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    throw Object.assign(new Error("App API is not configured"), {
      statusCode: 500,
      code: "server_not_configured",
    });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    throw Object.assign(new Error("Invalid session"), {
      statusCode: 401,
      code: "invalid_session",
    });
  }

  const [{ data: profile }, { data: businesses }, { data: staffProfiles }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, phone, role, is_admin, preferred_language")
        .eq("id", user.id)
        .maybeSingle<AppProfile>(),
      supabaseAdmin
        .from("businesses")
        .select("id, name, city, category, published, timezone")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .returns<AppBusiness[]>(),
      supabaseAdmin
        .from("staff_members")
        .select(
          `
          id,
          business_id,
          user_id,
          name,
          email,
          role_title,
          permission_role,
          invite_status,
          active,
          businesses (
            id,
            name,
            city,
            category,
            published,
            timezone
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .returns<AppStaffProfile[]>(),
    ]);

  const ownedBusinesses = businesses || [];
  const linkedStaffProfiles = (staffProfiles || []).map((staff) => ({
    ...staff,
    businesses: firstRelation(staff.businesses),
  }));

  return {
    supabaseAdmin,
    user: {
      id: user.id,
      email: user.email || profile?.email || null,
    },
    profile: profile || null,
    ownedBusinesses,
    linkedStaffProfiles,
    isAdmin: Boolean(profile?.is_admin),
    canUseBusiness: ownedBusinesses.length > 0,
    canUseStaff:
      linkedStaffProfiles.length > 0 ||
      profile?.role === "staff" ||
      user.user_metadata?.account_mode === "staff",
    primaryBusinessId: ownedBusinesses[0]?.id || null,
    primaryStaffId: linkedStaffProfiles[0]?.id || null,
  };
}

export function handleAppApiError(res: NextApiResponse, error: unknown) {
  const details = error as {
    statusCode?: number;
    code?: string;
    message?: string;
  };

  return errorResponse(
    res,
    details.statusCode || 500,
    details.code || "app_api_error",
    details.message || "Could not load app data",
  );
}
