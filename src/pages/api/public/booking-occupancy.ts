import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type OccupiedBooking = {
  staff_member_id: string;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
};

type OccupancyResponse = { bookings: OccupiedBooking[] } | { error: string };

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function boundedDate(value: string, fallback: Date) {
  if (!value) return fallback;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<OccupancyResponse>,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const businessId = readStringParam(request.query.businessId);
  if (!businessId) {
    response.status(400).json({ error: "A business is required." });
    return;
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    response
      .status(503)
      .json({ error: "Booking availability is not configured." });
    return;
  }

  const token = bearerToken(request);
  const {
    data: { user },
  } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } };

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, user_id, published")
    .eq("id", businessId)
    .maybeSingle<{
      id: string;
      user_id?: string | null;
      published?: boolean | null;
    }>();

  if (businessError) {
    response.status(500).json({ error: "Could not load availability." });
    return;
  }

  const ownerPreview = Boolean(user?.id && business?.user_id === user.id);

  if (!business || (!business.published && !ownerPreview)) {
    response.status(404).json({ error: "Business is not available." });
    return;
  }

  const now = new Date();
  const defaultFrom = addDays(now, -1);
  const defaultTo = addDays(now, 90);
  const requestedFrom = boundedDate(
    readStringParam(request.query.from),
    defaultFrom,
  );
  const requestedTo = boundedDate(readStringParam(request.query.to), defaultTo);
  const maxTo = addDays(requestedFrom, 120);
  const to = requestedTo > maxTo ? maxTo : requestedTo;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("staff_member_id, start_at, end_at, duration_minutes")
    .eq("business_id", business.id)
    .in("status", ["pending", "confirmed"])
    .gte("start_at", requestedFrom.toISOString())
    .lte("start_at", to.toISOString())
    .order("start_at", { ascending: true })
    .limit(2000)
    .returns<OccupiedBooking[]>();

  if (error) {
    response.status(500).json({ error: "Could not load availability." });
    return;
  }

  response.status(200).json({ bookings: data || [] });
}
