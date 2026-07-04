import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type StaffAvailabilityRequest = {
  staffId?: string;
  rows?: StaffAvailabilityInput[];
};

type StaffAvailabilityInput = {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  is_closed?: boolean;
};

type StaffMemberRow = {
  id: string;
  business_id: string;
  businesses?:
    | {
        id: string;
        user_id: string;
      }
    | Array<{
        id: string;
        user_id: string;
      }>
    | null;
};

const DAY_COUNT = 7;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function cleanText(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseTime(value?: string) {
  const cleaned = cleanText(value);
  if (!TIME_PATTERN.test(cleaned)) return "";
  const [hour, minute] = cleaned.split(":");
  return `${hour}:${minute}`;
}

function errorResponse(
  res: NextApiResponse,
  status: number,
  code: string,
  error: string,
) {
  return res.status(status).json({ code, error });
}

function normaliseRows(rows?: StaffAvailabilityInput[]) {
  if (!Array.isArray(rows)) return null;

  const rowsByDay = new Map<number, StaffAvailabilityInput>();

  rows.forEach((row) => {
    if (typeof row.day_of_week !== "number") return;
    if (row.day_of_week < 0 || row.day_of_week >= DAY_COUNT) return;
    rowsByDay.set(row.day_of_week, row);
  });

  if (rowsByDay.size !== DAY_COUNT) return null;

  const normalisedRows = [];

  for (let day = 0; day < DAY_COUNT; day += 1) {
    const row = rowsByDay.get(day);
    if (!row) return null;

    const isClosed = row.is_closed === true;
    const startTime = normaliseTime(row.start_time) || "09:00";
    const endTime = normaliseTime(row.end_time) || "17:00";

    if (!isClosed && (!startTime || !endTime || startTime >= endTime)) {
      return null;
    }

    normalisedRows.push({
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      is_closed: isClosed,
    });
  }

  return normalisedRows;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return errorResponse(res, 405, "method_not_allowed", "Method not allowed");
  }

  const token = bearerToken(req);
  if (!token) {
    return errorResponse(res, 401, "auth_required", "Authentication required");
  }

  const request = (req.body || {}) as StaffAvailabilityRequest;
  const staffId = cleanText(request.staffId);
  const rows = normaliseRows(request.rows);

  if (!staffId || !rows) {
    return errorResponse(
      res,
      400,
      "invalid_request",
      "Invalid staff working hours",
    );
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    return errorResponse(
      res,
      500,
      "server_not_configured",
      "Staff working hours are not configured",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return errorResponse(res, 401, "invalid_session", "Invalid session");
  }

  const { data: staff, error: staffError } = await supabaseAdmin
    .from("staff_members")
    .select(
      `
      id,
      business_id,
      businesses (
        id,
        user_id
      )
    `,
    )
    .eq("id", staffId)
    .maybeSingle<StaffMemberRow>();

  if (staffError) {
    return errorResponse(res, 500, "staff_lookup_failed", staffError.message);
  }

  const linkedBusiness = Array.isArray(staff?.businesses)
    ? staff.businesses[0]
    : staff?.businesses;

  if (!staff || linkedBusiness?.user_id !== user.id) {
    return errorResponse(
      res,
      403,
      "forbidden",
      "Staff working hours are not permitted",
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("staff_availability")
    .delete()
    .eq("staff_member_id", staffId);

  if (deleteError) {
    return errorResponse(res, 500, "delete_failed", deleteError.message);
  }

  const rowsToInsert = rows.map((row) => ({
    business_id: staff.business_id,
    staff_member_id: staffId,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
    is_closed: row.is_closed,
  }));

  const { error: insertError } = await supabaseAdmin
    .from("staff_availability")
    .insert(rowsToInsert);

  if (insertError) {
    return errorResponse(res, 500, "insert_failed", insertError.message);
  }

  return res.status(200).json({ ok: true });
}
