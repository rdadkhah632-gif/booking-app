import type { NextApiRequest, NextApiResponse } from "next";
import {
  businessForContext,
  errorResponse,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  type AppContext,
} from "@/lib/server/app-api/context";

type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number | string;
  image_url?: string | null;
  active: boolean;
};

type ServiceMutationBody = {
  action?: unknown;
  businessId?: unknown;
  serviceId?: unknown;
  name?: unknown;
  description?: unknown;
  durationMinutes?: unknown;
  price?: unknown;
  active?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function readFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normaliseService(body: ServiceMutationBody) {
  const name = cleanText(body.name, 120);
  const description = cleanText(body.description, 2_000);
  const durationMinutes = readFiniteNumber(body.durationMinutes);
  const price = readFiniteNumber(body.price);

  if (!name) {
    throw Object.assign(new Error("Service name is required"), {
      statusCode: 400,
      code: "service_name_required",
    });
  }

  if (
    durationMinutes === null ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 1_440
  ) {
    throw Object.assign(
      new Error("Service duration must be between 5 and 1440 minutes"),
      {
        statusCode: 400,
        code: "invalid_service_duration",
      },
    );
  }

  if (price === null || price < 0 || price > 1_000_000) {
    throw Object.assign(new Error("Enter a valid service price"), {
      statusCode: 400,
      code: "invalid_service_price",
    });
  }

  if (typeof body.active !== "boolean") {
    throw Object.assign(new Error("Choose a valid service visibility"), {
      statusCode: 400,
      code: "invalid_service_visibility",
    });
  }

  return {
    name,
    description: description || null,
    duration_minutes: durationMinutes,
    price,
    active: body.active,
  };
}

async function loadServices(context: AppContext, businessId: string) {
  const { data: services, error: servicesError } = await context.supabaseAdmin
    .from("services")
    .select(
      "id, business_id, name, description, duration_minutes, price, image_url, active",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .returns<ServiceRow[]>();

  if (servicesError) throw servicesError;

  const serviceIds = (services || []).map((service) => service.id);
  const { data: assignments, error: assignmentsError } =
    serviceIds.length > 0
      ? await context.supabaseAdmin
          .from("staff_services")
          .select("service_id")
          .in("service_id", serviceIds)
          .returns<Array<{ service_id: string }>>()
      : { data: [], error: null };

  if (assignmentsError) throw assignmentsError;

  const assignmentCounts = new Map<string, number>();
  for (const assignment of assignments || []) {
    assignmentCounts.set(
      assignment.service_id,
      (assignmentCounts.get(assignment.service_id) || 0) + 1,
    );
  }

  return {
    services: (services || []).map((service) => ({
      id: service.id,
      businessId: service.business_id,
      name: service.name,
      description: service.description || "",
      durationMinutes: service.duration_minutes,
      price: Number(service.price),
      imageUrl: service.image_url || null,
      active: Boolean(service.active),
      assignedStaffCount: assignmentCounts.get(service.id) || 0,
    })),
  };
}

async function createService(
  context: AppContext,
  businessId: string,
  body: ServiceMutationBody,
) {
  const service = normaliseService(body);
  const { error } = await context.supabaseAdmin.from("services").insert({
    business_id: businessId,
    ...service,
    image_url: null,
  });

  if (error) throw error;
}

async function updateService(
  context: AppContext,
  businessId: string,
  body: ServiceMutationBody,
) {
  const serviceId = cleanText(body.serviceId, 100);
  if (!serviceId) {
    throw Object.assign(new Error("Service is required"), {
      statusCode: 400,
      code: "service_required",
    });
  }

  const { data: existing, error: existingError } = await context.supabaseAdmin
    .from("services")
    .select("id")
    .eq("id", serviceId)
    .eq("business_id", businessId)
    .maybeSingle<{ id: string }>();

  if (existingError) throw existingError;
  if (!existing) {
    throw Object.assign(new Error("Service is not available"), {
      statusCode: 404,
      code: "service_not_found",
    });
  }

  const { error } = await context.supabaseAdmin
    .from("services")
    .update(normaliseService(body))
    .eq("id", serviceId)
    .eq("business_id", businessId);

  if (error) throw error;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  try {
    const context = await loadAppContext(req);
    const body = (req.body || {}) as ServiceMutationBody;
    const requestedBusinessId =
      req.method === "GET"
        ? readStringParam(req.query.businessId)
        : cleanText(body.businessId, 100);
    const business = businessForContext(context, requestedBusinessId);

    if (!business) {
      return errorResponse(
        res,
        403,
        "business_not_available",
        "Service management is not available",
      );
    }

    if (req.method === "GET") {
      return res.status(200).json(await loadServices(context, business.id));
    }

    const action = cleanText(body.action, 20);
    if (action === "create") {
      await createService(context, business.id, body);
    } else if (action === "update") {
      await updateService(context, business.id, body);
    } else {
      return errorResponse(
        res,
        400,
        "invalid_service_action",
        "Choose a valid service action",
      );
    }

    return res
      .status(action === "create" ? 201 : 200)
      .json(await loadServices(context, business.id));
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
