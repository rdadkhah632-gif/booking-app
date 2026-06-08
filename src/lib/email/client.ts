import { supabase } from "@/lib/supabaseClient";
import { TransactionalEmailRequest } from "./types";

export async function requestTransactionalEmail(
  request: TransactionalEmailRequest,
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    await fetch("/api/email/transactional", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[email] Could not request transactional delivery", error);
    }
  }
}
