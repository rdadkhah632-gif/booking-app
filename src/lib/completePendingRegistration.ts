import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type PendingBusiness = {
  name?: string;
  phone?: string;
  category?: string;
  city?: string;
  country?: string;
  ownerTakesBookings?: boolean;
};

export async function completePendingRegistration(user: User) {
  if (!user.user_metadata?.pending_registration) return;

  const accountMode =
    user.user_metadata.account_mode === "business"
      ? "business"
      : user.user_metadata.account_mode === "staff"
        ? "staff"
        : "customer";
  const profileRole = accountMode === "business" ? "business" : "customer";
  const email = user.email?.trim().toLowerCase() || "";

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle<{ id: string }>();

  if (profileLookupError) throw profileLookupError;

  if (!existingProfile) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      email,
      role: profileRole,
      preferred_language:
        user.user_metadata.preferred_language === "sq" ? "sq" : "en",
    });

    if (profileError) throw profileError;
  }

  if (accountMode !== "business") {
    await clearPendingRegistration();
    return;
  }

  const pendingBusiness = (user.user_metadata.pending_business ||
    {}) as PendingBusiness;

  if (
    !pendingBusiness.name ||
    !pendingBusiness.phone ||
    !pendingBusiness.category ||
    !pendingBusiness.city ||
    !pendingBusiness.country
  ) {
    return;
  }

  const { data: existingBusiness, error: existingBusinessError } =
    await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<{ id: string }>();

  if (existingBusinessError) throw existingBusinessError;

  let businessId = existingBusiness?.id || null;

  if (!businessId) {
    const { data: createdBusiness, error: businessError } = await supabase
      .from("businesses")
      .insert({
        user_id: user.id,
        name: pendingBusiness.name,
        phone: pendingBusiness.phone,
        category: pendingBusiness.category,
        city: pendingBusiness.city,
        country: pendingBusiness.country,
        published: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (businessError) throw businessError;
    businessId = createdBusiness.id;
  }

  if (!pendingBusiness.ownerTakesBookings || !businessId) {
    await clearPendingRegistration();
    return;
  }

  const { data: existingOwnerStaff, error: ownerStaffLookupError } =
    await supabase
      .from("staff_members")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<{ id: string }>();

  if (ownerStaffLookupError) throw ownerStaffLookupError;
  if (existingOwnerStaff) {
    await clearPendingRegistration();
    return;
  }

  const { error: ownerStaffError } = await supabase
    .from("staff_members")
    .insert({
      business_id: businessId,
      user_id: user.id,
      name: email.split("@")[0] || "Owner",
      email,
      role_title:
        user.user_metadata.preferred_language === "sq" ? "Pronar" : "Owner",
      permission_role: "staff",
      invite_status: "linked",
      active: true,
    });

  if (ownerStaffError) throw ownerStaffError;

  await clearPendingRegistration();

  async function clearPendingRegistration() {
    const { error } = await supabase.auth.updateUser({
      data: {
        pending_registration: false,
        pending_business: null,
      },
    });

    if (error && process.env.NODE_ENV !== "production") {
      console.warn("Could not clear pending registration metadata", error);
    }
  }
}
