import { createHash, randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { staffInviteEmailTemplate } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { getAppBaseUrl } from "@/lib/server/appBaseUrl";

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function inviteStorageMissing(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  const text = candidate?.message?.toLowerCase() || "";
  return (
    candidate?.code === "42P01" ||
    candidate?.code === "PGRST205" ||
    text.includes("staff_invite_tokens")
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();

    if (req.method === "GET") {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) return res.status(400).json({ error: "Invite token required" });

      const { data: invite, error } = await supabaseAdmin
        .from("staff_invite_tokens")
        .select("id, invited_email, expires_at, accepted_at, revoked_at")
        .eq("token_hash", hashToken(token))
        .maybeSingle<{
          id: string;
          invited_email: string;
          expires_at: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
        }>();

      if (error) {
        if (inviteStorageMissing(error)) {
          return res.status(503).json({
            error: "Staff invite email storage is not configured",
            sqlRequired: "sources/sql/08_staff_invite_tokens.sql",
          });
        }
        return res.status(500).json({ error: "Could not verify invite" });
      }

      const valid = Boolean(
        invite &&
          !invite.accepted_at &&
          !invite.revoked_at &&
          new Date(invite.expires_at).getTime() > Date.now(),
      );

      return res.status(200).json({
        valid,
        invitedEmailHint: valid
          ? invite!.invited_email.replace(/^(.{2}).*(@.*)$/, "$1***$2")
          : null,
      });
    }

    const authToken = bearerToken(req);
    if (!authToken) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(authToken);

    if (userError || !user?.email) {
      return res.status(401).json({ error: "Invalid session" });
    }

    if (typeof req.body?.staffMemberId === "string") {
      const staffMemberId = req.body.staffMemberId;
      const { data: staff, error: staffError } = await supabaseAdmin
        .from("staff_members")
        .select("id, business_id, email, user_id")
        .eq("id", staffMemberId)
        .maybeSingle<{
          id: string;
          business_id: string;
          email?: string | null;
          user_id?: string | null;
        }>();

      if (staffError || !staff?.email) {
        return res.status(404).json({ error: "Staff invite not found" });
      }

      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("id, user_id, name")
        .eq("id", staff.business_id)
        .maybeSingle<{
          id: string;
          user_id: string;
          name: string;
        }>();

      if (!business || business.user_id !== user.id) {
        return res.status(403).json({ error: "Invite not permitted" });
      }

      if (staff.user_id) {
        return res.status(409).json({ error: "Staff account already linked" });
      }

      const appUrl = getAppBaseUrl();
      if (!appUrl) {
        return res.status(200).json({
          inviteSaved: true,
          delivery: { status: "failed", reason: "config_missing" },
          manualInviteUrl: null,
        });
      }

      const { error: revokeError } = await supabaseAdmin
        .from("staff_invite_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("staff_member_id", staff.id)
        .is("accepted_at", null)
        .is("revoked_at", null);

      if (revokeError) {
        if (inviteStorageMissing(revokeError)) {
          return res.status(200).json({
            inviteSaved: true,
            delivery: {
              status: "skipped",
              reason: "invite_storage_not_configured",
            },
            sqlRequired: "sources/sql/08_staff_invite_tokens.sql",
          });
        }
        return res.status(500).json({
          error: "Could not safely replace the existing invite link",
        });
      }

      const rawToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from("staff_invite_tokens")
        .insert({
          staff_member_id: staff.id,
          business_id: staff.business_id,
          invited_email: staff.email.trim().toLowerCase(),
          token_hash: hashToken(rawToken),
          expires_at: expiresAt,
          created_by: user.id,
        });

      if (insertError) {
        if (inviteStorageMissing(insertError)) {
          return res.status(200).json({
            inviteSaved: true,
            delivery: {
              status: "skipped",
              reason: "invite_storage_not_configured",
            },
            sqlRequired: "sources/sql/08_staff_invite_tokens.sql",
          });
        }
        return res.status(500).json({ error: "Could not create invite link" });
      }

      const inviteUrl = `${appUrl}/staff/invite?token=${encodeURIComponent(rawToken)}`;
      const delivery = await sendTransactionalEmail(
        staffInviteEmailTemplate({
          recipientEmail: staff.email,
          businessName: business.name,
          inviteUrl,
        }),
      );

      return res.status(200).json({
        inviteSaved: true,
        delivery,
        manualInviteUrl: delivery.status === "sent" ? null : inviteUrl,
      });
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token) return res.status(400).json({ error: "Invite token required" });

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("staff_invite_tokens")
      .select(
        "id, staff_member_id, invited_email, expires_at, accepted_at, revoked_at",
      )
      .eq("token_hash", hashToken(token))
      .maybeSingle<{
        id: string;
        staff_member_id: string;
        invited_email: string;
        expires_at: string;
        accepted_at?: string | null;
        revoked_at?: string | null;
      }>();

    if (inviteError || !invite) {
      return res.status(404).json({ error: "Invite is invalid or expired" });
    }

    if (
      invite.accepted_at ||
      invite.revoked_at ||
      new Date(invite.expires_at).getTime() <= Date.now()
    ) {
      return res.status(410).json({ error: "Invite is invalid or expired" });
    }

    if (user.email.trim().toLowerCase() !== invite.invited_email) {
      return res.status(403).json({
        error: "This invite was sent to a different email address",
      });
    }

    const { data: currentStaff, error: currentStaffError } = await supabaseAdmin
      .from("staff_members")
      .select("id, user_id")
      .eq("id", invite.staff_member_id)
      .maybeSingle<{ id: string; user_id?: string | null }>();

    if (currentStaffError || !currentStaff) {
      return res.status(404).json({ error: "Staff profile not found" });
    }

    if (currentStaff.user_id && currentStaff.user_id !== user.id) {
      return res.status(409).json({ error: "Staff profile already linked" });
    }

    const newlyLinked = !currentStaff.user_id;
    const { data: linkedStaff, error: linkError } = currentStaff.user_id
      ? { data: currentStaff, error: null }
      : await supabaseAdmin
          .from("staff_members")
          .update({ user_id: user.id, invite_status: "linked" })
          .eq("id", invite.staff_member_id)
          .is("user_id", null)
          .select("id, user_id")
          .maybeSingle<{ id: string; user_id?: string | null }>();

    if (linkError || !linkedStaff || linkedStaff.user_id !== user.id) {
      return res.status(409).json({ error: "Staff profile could not be linked" });
    }

    const { data: acceptedInvite, error: acceptError } = await supabaseAdmin
      .from("staff_invite_tokens")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invite.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (acceptError || !acceptedInvite) {
      if (newlyLinked) {
        const { error: rollbackError } = await supabaseAdmin
          .from("staff_members")
          .update({ user_id: null, invite_status: "invited" })
          .eq("id", invite.staff_member_id)
          .eq("user_id", user.id);

        if (rollbackError) {
          console.error(
            "[staff-invite] Could not roll back incomplete acceptance",
            {
              staffMemberId: invite.staff_member_id,
            },
          );
        }
      }

      return res.status(500).json({
        error: "Invite acceptance could not be finalized. Please try again.",
      });
    }

    return res.status(200).json({ linked: true, redirectTo: "/staff" });
  } catch (error) {
    console.error("[staff-invite] Request failed", error);
    return res.status(500).json({ error: "Staff invite request failed" });
  }
}
