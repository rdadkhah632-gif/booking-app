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
  user_id?: string | null;
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
  isStaffIntent: boolean;
  hasLinkedStaffProfile: boolean;
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

function normaliseEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function staffInviteCanBeLinked(inviteStatus?: string | null) {
  const status = inviteStatus?.trim().toLowerCase() || "";
  return ["", "invited", "pending", "not_invited", "ready_to_link"].includes(status);
}

export async function linkStaffInviteByEmail(
  userId: string,
  email?: string | null,
) {
  const cleanEmail = normaliseEmail(email);
  if (!cleanEmail) return null;

  // Temporary Stage 1 invite linking: until secure invite tokens are added,
  // only auto-link an unclaimed staff row when it matches the authenticated
  // user's email exactly after normalisation. This keeps the match scoped to
  // the signed-in auth email and avoids changing broader RLS policies.
  const { data: possibleInvites, error: inviteError } = await supabase
    .from("staff_members")
    .select(
      "id, business_id, user_id, name, email, role_title, permission_role, invite_status, active",
    )
    .is("user_id", null)
    .limit(20)
    .returns<AccountStaffProfile[]>();

  const invite = (possibleInvites || []).find(
    (staff) =>
      normaliseEmail(staff.email) === cleanEmail &&
      staffInviteCanBeLinked(staff.invite_status),
  );

  if (inviteError) throw inviteError;
  if (!invite?.id) return null;

  const { error: linkError } = await supabase
    .from("staff_members")
    .update({
      user_id: userId,
      invite_status: "linked",
    })
    .eq("id", invite.id)
    .is("user_id", null);

  if (linkError) throw linkError;

  return {
    ...invite,
    user_id: userId,
    invite_status: "linked",
  };
}

export async function getAccountCapabilities(
  userId: string,
  email?: string | null,
): Promise<AccountCapabilities> {
  const cleanEmail = normaliseEmail(email);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, is_admin, preferred_language")
    .eq("id", userId)
    .maybeSingle<AccountProfile>();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const metadataAccountMode =
    typeof user?.user_metadata?.account_mode === "string"
      ? user.user_metadata.account_mode
      : null;

  const resolvedEmail = cleanEmail || normaliseEmail(profile?.email);

  const { data: ownedBusinesses } = await supabase
    .from("businesses")
    .select("id, name, published")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<AccountBusiness[]>();

  await linkStaffInviteByEmail(userId, resolvedEmail);

  const { data: linkedStaffProfiles } = await supabase
    .from("staff_members")
    .select(
      "id, business_id, user_id, name, email, role_title, permission_role, invite_status, active",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<AccountStaffProfile[]>();

  const businesses = ownedBusinesses || [];
  const staffProfiles = linkedStaffProfiles || [];
  const isAdmin = Boolean(profile?.is_admin);
  const ownsBusiness = businesses.length > 0;
  const isStaffIntent =
    profile?.role === "staff" || metadataAccountMode === "staff";
  const hasLinkedStaffProfile = staffProfiles.length > 0;
  const hasStaffAccess = hasLinkedStaffProfile || isStaffIntent;

  return {
    userId,
    email: resolvedEmail,
    profile: profile || null,
    ownedBusinesses: businesses,
    linkedStaffProfiles: staffProfiles,
    isAdmin,
    ownsBusiness,
    hasStaffAccess,
    isStaffIntent,
    hasLinkedStaffProfile,
    isOwnerAsStaff: ownsBusiness && hasLinkedStaffProfile,
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
