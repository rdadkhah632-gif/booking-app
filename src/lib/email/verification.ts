import type { User } from "@supabase/supabase-js";

export type EmailVerificationState = "verified" | "unverified" | "unknown";

export function getEmailVerificationState(
  user?: Partial<User> | null,
): EmailVerificationState {
  if (!user) return "unknown";

  const authUser = user as Partial<User> & {
    confirmed_at?: string | null;
  };
  const confirmedAt = authUser.email_confirmed_at || authUser.confirmed_at;

  if (confirmedAt) return "verified";

  const hasEmailConfirmedAt = Object.prototype.hasOwnProperty.call(
    authUser,
    "email_confirmed_at",
  );
  const hasConfirmedAt = Object.prototype.hasOwnProperty.call(
    authUser,
    "confirmed_at",
  );

  if (hasEmailConfirmedAt || hasConfirmedAt) return "unverified";

  return "unknown";
}

export function emailConfirmationTimestamp(
  user?: Partial<User> | null,
): string | null {
  if (!user) return null;

  const authUser = user as Partial<User> & {
    confirmed_at?: string | null;
  };

  return authUser.email_confirmed_at || authUser.confirmed_at || null;
}
