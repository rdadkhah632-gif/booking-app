import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type AdminProfileRequest = {
  userId?: unknown;
  fullName?: unknown;
  phone?: unknown;
  role?: unknown;
  isAdmin?: unknown;
};

const PROFILE_SELECT =
  "id, email, role, full_name, phone, is_admin, created_at";

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function nullableText(value: unknown) {
  if (value === null) return null;
  return typeof value === "string" ? value.trim() || null : undefined;
}

async function requireAdmin(request: NextApiRequest) {
  const token = bearerToken(request);
  if (!token) return null;

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_admin?: boolean | null }>();

  if (profileError || !profile?.is_admin) return null;
  return { supabase, user };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      response.status(403).json({ error: "Admin access required." });
      return;
    }

    const body = (request.body || {}) as AdminProfileRequest;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      response.status(400).json({ error: "User is required." });
      return;
    }

    const update: Record<string, string | boolean | null> = {};
    const fullName = nullableText(body.fullName);
    const phone = nullableText(body.phone);

    if (fullName !== undefined) update.full_name = fullName;
    if (phone !== undefined) update.phone = phone;

    if (body.role !== undefined) {
      if (body.role !== "customer" && body.role !== "business") {
        response.status(400).json({ error: "Invalid account role." });
        return;
      }
      update.role = body.role;
    }

    if (body.isAdmin !== undefined) {
      if (typeof body.isAdmin !== "boolean") {
        response.status(400).json({ error: "Invalid admin access value." });
        return;
      }
      if (userId === admin.user.id && body.isAdmin === false) {
        response
          .status(400)
          .json({ error: "You cannot remove your own admin access." });
        return;
      }
      update.is_admin = body.isAdmin;
    }

    if (Object.keys(update).length === 0) {
      response.status(400).json({ error: "No profile changes supplied." });
      return;
    }

    const { data: profile, error: updateError } = await admin.supabase
      .from("profiles")
      .update(update)
      .eq("id", userId)
      .select(PROFILE_SELECT)
      .maybeSingle();

    if (updateError) throw updateError;
    if (!profile) {
      response.status(404).json({ error: "User profile not found." });
      return;
    }

    response.status(200).json({ profile });
  } catch (error) {
    console.error("[admin-profile] Update failed", error);
    response.status(500).json({ error: "Could not update user profile." });
  }
}
