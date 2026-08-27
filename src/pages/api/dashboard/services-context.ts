import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  handleAppApiError,
  loadAppContext,
  readStringParam,
} from "@/lib/server/app-api/context";

type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number;
  image_url?: string | null;
  active: boolean;
  booking_type?: "appointment" | "group" | null;
  group_capacity?: number | null;
  private_booking_enabled?: boolean | null;
  private_price?: number | null;
  assisted_onboarding_case_id?: string | null;
  owner_review_required?: boolean | null;
};

type StaffRow = {
  id: string;
  business_id: string;
  name: string;
  role_title?: string | null;
  active: boolean;
};

type StaffServiceRow = {
  staff_member_id: string;
  service_id: string;
};

type DepartureRow = {
  service_id: string;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return errorResponse(
      response,
      405,
      "method_not_allowed",
      "Method not allowed",
    );
  }

  response.setHeader("Cache-Control", "private, no-store");

  try {
    const context = await loadAppContext(request);
    const requestedBusinessId = readStringParam(request.query.businessId);
    const business = requestedBusinessId
      ? context.ownedBusinesses.find(
          (candidate) => candidate.id === requestedBusinessId,
        )
      : context.ownedBusinesses[0];

    if (requestedBusinessId && !business) {
      return errorResponse(
        response,
        403,
        "owner_required",
        "You do not have access to this business",
      );
    }

    if (!business) {
      return response.status(200).json({
        ok: true,
        businesses: context.ownedBusinesses,
        business: null,
        services: [],
        staffMembers: [],
        staffServices: [],
        departureCounts: {},
      });
    }

    const [serviceResult, staffResult, departureResult] = await Promise.all([
      context.supabaseAdmin
        .from("services")
        .select(
          "id, business_id, name, description, duration_minutes, price, image_url, active, booking_type, group_capacity, private_booking_enabled, private_price, assisted_onboarding_case_id, owner_review_required",
        )
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .returns<ServiceRow[]>(),
      context.supabaseAdmin
        .from("staff_members")
        .select("id, business_id, name, role_title, active")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .returns<StaffRow[]>(),
      context.supabaseAdmin
        .from("service_departures")
        .select("service_id")
        .eq("business_id", business.id)
        .eq("status", "scheduled")
        .gte("start_at", new Date().toISOString())
        .returns<DepartureRow[]>(),
    ]);

    if (serviceResult.error) throw serviceResult.error;
    if (staffResult.error) throw staffResult.error;
    if (departureResult.error) throw departureResult.error;

    const staffIds = (staffResult.data || []).map((staff) => staff.id);
    const staffServiceResult = staffIds.length
      ? await context.supabaseAdmin
          .from("staff_services")
          .select("staff_member_id, service_id")
          .in("staff_member_id", staffIds)
          .returns<StaffServiceRow[]>()
      : { data: [] as StaffServiceRow[], error: null };

    if (staffServiceResult.error) throw staffServiceResult.error;

    const departureCounts = (departureResult.data || []).reduce<
      Record<string, number>
    >((counts, departure) => {
      counts[departure.service_id] = (counts[departure.service_id] || 0) + 1;
      return counts;
    }, {});

    return response.status(200).json({
      ok: true,
      businesses: context.ownedBusinesses,
      business,
      services: serviceResult.data || [],
      staffMembers: staffResult.data || [],
      staffServices: staffServiceResult.data || [],
      departureCounts,
    });
  } catch (error) {
    return handleAppApiError(response, error);
  }
}
