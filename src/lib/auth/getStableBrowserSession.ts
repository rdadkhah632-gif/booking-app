import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const SESSION_RETRY_DELAYS_MS = [0, 120, 300];

export async function getStableBrowserSession(): Promise<Session | null> {
  for (const delay of SESSION_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) return session;
  }

  return null;
}
