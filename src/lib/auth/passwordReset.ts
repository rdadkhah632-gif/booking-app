import { SupabaseClient } from "@supabase/supabase-js";
import { AuthProduct, getAuthAppUrl, getCustomerAppUrl } from "@/lib/appUrls";

type PasswordResetResult = {
  primaryError: Error | null;
  fallbackError: Error | null;
};

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown error");
}

export async function requestPasswordResetEmail(
  supabase: SupabaseClient,
  email: string,
  product: AuthProduct,
  fallbackOrigin: string,
): Promise<PasswordResetResult> {
  const resetPath = `/reset-password?product=${product}`;
  const primaryRedirect = getAuthAppUrl(product, resetPath, fallbackOrigin);
  let primaryError: Error | null = null;
  let fallbackError: Error | null = null;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: primaryRedirect,
    });
    if (!error) return { primaryError: null, fallbackError: null };
    primaryError = error;
  } catch (error) {
    primaryError = toError(error);
  }

  if (product !== "business") {
    return { primaryError, fallbackError };
  }

  const fallbackRedirect = new URL(
    getCustomerAppUrl(resetPath),
    fallbackOrigin,
  ).toString();
  if (fallbackRedirect === primaryRedirect) {
    return { primaryError, fallbackError };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: fallbackRedirect,
    });
    if (error) fallbackError = error;
  } catch (error) {
    fallbackError = toError(error);
  }

  return { primaryError, fallbackError };
}
