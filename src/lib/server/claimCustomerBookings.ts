import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ClaimInput = {
  userId: string;
  email?: string | null;
  accountMode?: string | null;
};

function normaliseEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

function normaliseAccountMode(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

export async function claimUnlinkedCustomerBookings(
  supabaseAdmin: SupabaseAdminClient,
  input: ClaimInput,
) {
  const email = normaliseEmail(input.email);
  if (!email || !email.includes("@")) return 0;

  const accountMode = normaliseAccountMode(input.accountMode);
  if (accountMode === "business" || accountMode === "staff") return 0;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, is_admin")
    .eq("id", input.userId)
    .maybeSingle<{ role?: string | null; is_admin?: boolean | null }>();

  if (profileError) throw profileError;

  if (
    profile?.is_admin ||
    normaliseAccountMode(profile?.role) === "business"
  ) {
    return 0;
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ customer_user_id: input.userId })
    .is("customer_user_id", null)
    .ilike("customer_email", email)
    .select("id");

  if (error) throw error;

  return data?.length || 0;
}
