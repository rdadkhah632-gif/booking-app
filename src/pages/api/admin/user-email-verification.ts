import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  emailConfirmationTimestamp,
  getEmailVerificationState,
} from "@/lib/email/verification";

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = bearerToken(req);
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";

  if (!token || !userId) {
    return res.status(400).json({ error: "User and authentication required" });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const {
      data: { user: requester },
    } = await supabaseAdmin.auth.getUser(token);

    if (!requester) return res.status(401).json({ error: "Invalid session" });

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", requester.id)
      .maybeSingle<{ is_admin?: boolean | null }>();

    if (!adminProfile?.is_admin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return res.status(404).json({ error: "Auth user not found" });
    }

    const state = getEmailVerificationState(data.user);

    return res.status(200).json({
      state,
      verified: state === "verified" ? true : state === "unverified" ? false : null,
      emailConfirmedAt: emailConfirmationTimestamp(data.user),
    });
  } catch (error) {
    console.error("[admin] Email verification lookup failed", error);
    return res.status(500).json({ error: "Could not load verification status" });
  }
}
