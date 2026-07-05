import { supabase } from "@/lib/supabaseClient";

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function clearSupabaseBrowserSession() {
  if (typeof window === "undefined") return;

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage)
      .filter(
        (key) =>
          key.startsWith("sb-") ||
          key.includes("supabase.auth") ||
          key.includes("supabase.auth.token") ||
          key.includes("supabase.auth.refreshToken"),
      )
      .forEach((key) => storage.removeItem(key));
  });

  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (!name) return;

    if (name.startsWith("sb-") || name.includes("supabase")) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    }
  });
}

export async function signOutCurrentSession(redirectTo = "/") {
  clearSupabaseBrowserSession();

  await Promise.race([
    supabase.auth.signOut({ scope: "local" }).catch(() => null),
    wait(800),
  ]);

  clearSupabaseBrowserSession();

  if (typeof window !== "undefined") {
    window.location.assign(redirectTo);
  }
}
