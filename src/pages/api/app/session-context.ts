import type { NextApiRequest, NextApiResponse } from "next";
import {
  defaultRouteForAppContext,
  handleAppApiError,
  loadAppContext,
} from "@/lib/server/app-api/context";

function appTabs(context: Awaited<ReturnType<typeof loadAppContext>>) {
  if (context.canUseBusiness) {
    return ["today", "calendar", "inbox", "setup", "account"];
  }

  if (context.canUseStaff) {
    return ["today", "calendar", "availability", "inbox", "account"];
  }

  return ["account"];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ code: "method_not_allowed", error: "Method not allowed" });
  }

  try {
    const context = await loadAppContext(req);
    const primaryBusiness = context.ownedBusinesses[0] || null;
    const primaryStaff = context.linkedStaffProfiles[0] || null;

    return res.status(200).json({
      user: {
        id: context.user.id,
        email: context.user.email,
        name: context.profile?.full_name || null,
        preferredLanguage: context.profile?.preferred_language || null,
      },
      access: {
        isAdmin: context.isAdmin,
        canUseBusiness: context.canUseBusiness,
        canUseStaff: context.canUseStaff,
        defaultRoute: defaultRouteForAppContext(context),
        appMode: context.canUseBusiness
          ? "business"
          : context.canUseStaff
            ? "staff"
            : "unsupported",
        tabs: appTabs(context),
      },
      business: primaryBusiness
        ? {
            id: primaryBusiness.id,
            name: primaryBusiness.name,
            city: primaryBusiness.city,
            category: primaryBusiness.category,
            published: primaryBusiness.published,
            timezone: primaryBusiness.timezone,
          }
        : null,
      staff: primaryStaff
        ? {
            id: primaryStaff.id,
            businessId: primaryStaff.business_id,
            name: primaryStaff.name,
            roleTitle: primaryStaff.role_title,
            active: primaryStaff.active,
            business: primaryStaff.businesses,
          }
        : null,
      ownedBusinesses: context.ownedBusinesses.map((business) => ({
        id: business.id,
        name: business.name,
        city: business.city,
        category: business.category,
        published: business.published,
      })),
      linkedStaffProfiles: context.linkedStaffProfiles.map((staff) => ({
        id: staff.id,
        businessId: staff.business_id,
        name: staff.name,
        roleTitle: staff.role_title,
        active: staff.active,
        business: staff.businesses,
      })),
    });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
