import type { NextApiRequest, NextApiResponse } from "next";
import {
  handleAppApiError,
  loadAppContext,
  type AppContext,
} from "@/lib/server/app-api/context";

export function customerAppSessionContextResponse(context: AppContext) {
  return {
    user: {
      id: context.user.id,
      email: context.user.email || "",
      name: context.profile?.full_name || null,
      phone: context.profile?.phone || null,
      preferredLanguage: context.profile?.preferred_language || "en",
    },
    access: {
      canUseCustomer: true,
      canUseBusiness: context.canUseBusiness,
      canUseStaff: context.canUseStaff,
      isAdmin: context.isAdmin,
    },
  };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({
      code: "method_not_allowed",
      error: "Method not allowed",
    });
  }

  try {
    const context = await loadAppContext(request);
    return response
      .status(200)
      .json(customerAppSessionContextResponse(context));
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
