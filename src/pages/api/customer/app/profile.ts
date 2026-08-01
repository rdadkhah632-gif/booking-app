import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";
import { customerAppSessionContextResponse } from "./session-context";

type ProfileUpdateBody = {
  fullName?: unknown;
  phone?: unknown;
  preferredLanguage?: unknown;
};

function nullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function preferredLanguage(value: unknown) {
  return value === "sq" ? "sq" : "en";
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return errorResponse(
      response,
      405,
      "method_not_allowed",
      "Method not allowed",
    );
  }

  try {
    const context = await loadAppContext(request);
    const body = (request.body || {}) as ProfileUpdateBody;

    const { error } = await context.supabaseAdmin
      .from("profiles")
      .update({
        full_name: nullableText(body.fullName),
        phone: nullableText(body.phone),
        preferred_language: preferredLanguage(body.preferredLanguage),
      })
      .eq("id", context.user.id);

    if (error) throw error;

    const refreshedContext = await loadAppContext(request);
    return response
      .status(200)
      .json(customerAppSessionContextResponse(refreshedContext));
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
