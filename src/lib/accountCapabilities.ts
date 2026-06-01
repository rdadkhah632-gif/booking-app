import { supabase } from "@/lib/supabaseClient";

export type AccountProfile = {
  id: string;
  email?: string | null;
  role?: "customer" | "business" | "staff" | string | null;
  is_admin?: boolean | null;
  preferred_language?: string | null;
};

export type AccountBusiness = {
  id: string;
  name?: string | null;
  published?: boolean | null;
};

export type AccountStaffProfile = {
  id: string;
  business_id: string;
  name?: string | null;
  email?: string | null;
  role_title?: string | null;
  permission_role?: string | null;
  invite_status?: string | null;
  active?: boolean | null;
};

export type AccountCapabilities = {
  userId: string;
  email: string | null;
  profile: AccountProfile | null;
  ownedBusinesses: AccountBusiness[];
  linkedStaffProfiles: AccountStaffProfile[];
  isAdmin: boolean;
  ownsBusiness: boolean;
  hasStaffAccess: boolean;
  isOwnerAsStaff: boolean;
  canUseCustomer: boolean;
  canUseBusiness: boolean;
  canUseStaff: boolean;
  canUseAdmin: boolean;
  primaryBusinessId: string | null;
  primaryStaffId: string | null;
  defaultRoute: string;
};

export function defaultRouteForCapabilities(
  capabilities: Pick<
    AccountCapabilities,
    "isAdmin" | "ownsBusiness" | "hasStaffAccess"
  >,
) {
  if (capabilities.isAdmin) return "/admin";
  if (capabilities.ownsBusiness) return "/dashboard";
  if (capabilities.hasStaffAccess) return "/staff";
  return "/my-bookings";
}

export async function linkStaffInviteByEmail(
  userId: string,
  email?: string | null,
) {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) return null;

  const { data: invite, error: inviteError } = await supabase
    .from("staff_members")
    .select(
      "id, business_id, name, email, role_title, permission_role, invite_status, active",
    )
    .eq("email", cleanEmail)
    .is("user_id", null)
    .limit(1)
    .maybeSingle<AccountStaffProfile>();

  if (inviteError) throw inviteError;
  if (!invite?.id) return null;

  const { error: linkError } = await supabase
    .from("staff_members")
    .update({
      user_id: userId,
      invite_status: "linked",
    })
    .eq("id", invite.id);

  if (linkError) throw linkError;

  return {
    ...invite,
    invite_status: "linked",
  };
}

export async function getAccountCapabilities(
  userId: string,
  email?: string | null,
): Promise<AccountCapabilities> {
  const cleanEmail = email?.trim().toLowerCase() || null;

  await linkStaffInviteByEmail(userId, cleanEmail);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, is_admin, preferred_language")
    .eq("id", userId)
    .maybeSingle<AccountProfile>();

  const { data: ownedBusinesses } = await supabase
    .from("businesses")
    .select("id, name, published")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<AccountBusiness[]>();

  const { data: linkedStaffProfiles } = await supabase
    .from("staff_members")
    .select(
      "id, business_id, name, email, role_title, permission_role, invite_status, active",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<AccountStaffProfile[]>();

  const businesses = ownedBusinesses || [];
  const staffProfiles = linkedStaffProfiles || [];
  const isAdmin = Boolean(profile?.is_admin);
  const ownsBusiness = businesses.length > 0;
  const hasStaffAccess = staffProfiles.length > 0;

  return {
    userId,
    email: cleanEmail || profile?.email || null,
    profile: profile || null,
    ownedBusinesses: businesses,
    linkedStaffProfiles: staffProfiles,
    isAdmin,
    ownsBusiness,
    hasStaffAccess,
    isOwnerAsStaff: ownsBusiness && hasStaffAccess,
    canUseCustomer: true,
    canUseBusiness: ownsBusiness,
    canUseStaff: hasStaffAccess,
    canUseAdmin: isAdmin,
    primaryBusinessId: businesses[0]?.id || null,
    primaryStaffId: staffProfiles[0]?.id || null,
    defaultRoute: defaultRouteForCapabilities({
      isAdmin,
      ownsBusiness,
      hasStaffAccess,
    }),
  };
}
