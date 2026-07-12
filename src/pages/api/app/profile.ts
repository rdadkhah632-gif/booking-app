import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { appSessionContextResponse } from "./session-context";

type ProfileUpdateBody = {
  fullName?: unknown;
  phone?: unknown;
  preferredLanguage?: unknown;
};

function nullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function preferredLanguage(value: unknown) {
  return value === "sq" ? "sq" : "en";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const context = await loadAppContext(req);
    const body = (req.body || {}) as ProfileUpdateBody;

    const { error } = await context.supabaseAdmin
      .from("profiles")
      .update({
        full_name: nullableText(body.fullName),
        phone: nullableText(body.phone),
        preferred_language: preferredLanguage(body.preferredLanguage),
      })
      .eq("id", context.user.id);

    if (error) throw error;

    const refreshedContext = await loadAppContext(req);
    return res.status(200).json(appSessionContextResponse(refreshedContext));
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
