import type { NextApiRequest, NextApiResponse } from "next";
import {
  errorResponse,
  firstRelation,
  handleAppApiError,
  loadAppContext,
  readStringParam,
  staffForContext,
  type AppContext,
} from "@/lib/server/app-api/context";

type StaffAvailabilityInput = {
  dayOfWeek?: number;
  day_of_week?: number;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  isClosed?: boolean;
  is_closed?: boolean;
};

type StaffAvailabilityRow = {
  id?: string | null;
  business_id: string;
  staff_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type StaffMemberRow = {
  id: string;
  business_id: string;
  user_id?: string | null;
  name?: string | null;
  role_title?: string | null;
  active?: boolean | null;
  businesses?:
    | {
        id: string;
        name?: string | null;
        timezone?: string | null;
        user_id?: string | null;
      }
    | Array<{
        id: string;
        name?: string | null;
        timezone?: string | null;
        user_id?: string | null;
      }>
    | null;
};

const DAY_COUNT = 7;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseTime(value: unknown) {
  const cleaned = cleanText(value);
  if (!TIME_PATTERN.test(cleaned)) return "";
  const [hour, minute] = cleaned.split(":");
  return `${hour}:${minute}`;
}

function defaultRow(staff: StaffMemberRow, dayOfWeek: number) {
  return {
    business_id: staff.business_id,
    staff_member_id: staff.id,
    day_of_week: dayOfWeek,
    start_time: "09:00",
    end_time: "17:00",
    is_closed: dayOfWeek === 0,
  };
}

function shapeRow(row: StaffAvailabilityRow) {
  return {
    id: row.id || null,
    businessId: row.business_id,
    staffId: row.staff_member_id,
    dayOfWeek: row.day_of_week,
    startTime: normaliseTime(row.start_time) || "09:00",
    endTime: normaliseTime(row.end_time) || "17:00",
    isClosed: row.is_closed,
  };
}

function mergeRows(staff: StaffMemberRow, rows: StaffAvailabilityRow[]) {
  return DAY_ORDER.map((dayOfWeek) => {
    const existing = rows.find((row) => row.day_of_week === dayOfWeek);
    return shapeRow(existing || defaultRow(staff, dayOfWeek));
  });
}

function normaliseRows(rows: unknown) {
  if (!Array.isArray(rows)) return null;

  const rowsByDay = new Map<number, StaffAvailabilityInput>();
  rows.forEach((row) => {
    const input = row as StaffAvailabilityInput;
    const dayOfWeek = input.dayOfWeek ?? input.day_of_week;
    if (typeof dayOfWeek !== "number") return;
    if (dayOfWeek < 0 || dayOfWeek >= DAY_COUNT) return;
    rowsByDay.set(dayOfWeek, input);
  });

  if (rowsByDay.size !== DAY_COUNT) return null;

  const normalisedRows = [];

  for (let dayOfWeek = 0; dayOfWeek < DAY_COUNT; dayOfWeek += 1) {
    const row = rowsByDay.get(dayOfWeek);
    if (!row) return null;

    const isClosed = row.isClosed === true || row.is_closed === true;
    const startTime = normaliseTime(row.startTime ?? row.start_time) || "09:00";
    const endTime = normaliseTime(row.endTime ?? row.end_time) || "17:00";

    if (!isClosed && (!startTime || !endTime || startTime >= endTime)) {
      return null;
    }

    normalisedRows.push({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_closed: isClosed,
    });
  }

  return normalisedRows;
}

async function resolveStaff(
  context: AppContext,
  staffId: string,
): Promise<StaffMemberRow | null> {
  const requestedStaffId = staffId || context.primaryStaffId || "";
  if (!requestedStaffId) return null;

  const { data: staff, error } = await context.supabaseAdmin
    .from("staff_members")
    .select(
      `
      id,
      business_id,
      user_id,
      name,
      role_title,
      active,
      businesses (
        id,
        name,
        timezone,
        user_id
      )
    `,
    )
    .eq("id", requestedStaffId)
    .maybeSingle<StaffMemberRow>();

  if (error) throw error;
  if (!staff) return null;

  const business = firstRelation(staff.businesses);
  const ownedBusinessIds = new Set(
    context.ownedBusinesses.map((ownedBusiness) => ownedBusiness.id),
  );
  const isOwnStaffProfile = staff.user_id === context.user.id;
  const ownsStaffBusiness =
    ownedBusinessIds.has(staff.business_id) ||
    (business?.id ? ownedBusinessIds.has(business.id) : false);

  if (!isOwnStaffProfile && !ownsStaffBusiness) return null;
  if (!staff.active) return null;

  return staff;
}

async function readAvailability(context: AppContext, staff: StaffMemberRow) {
  const { data, error } = await context.supabaseAdmin
    .from("staff_availability")
    .select(
      "id, business_id, staff_member_id, day_of_week, start_time, end_time, is_closed",
    )
    .eq("business_id", staff.business_id)
    .eq("staff_member_id", staff.id)
    .order("day_of_week")
    .returns<StaffAvailabilityRow[]>();

  if (error) throw error;

  const business = firstRelation(staff.businesses);
  return {
    staff: {
      id: staff.id,
      businessId: staff.business_id,
      name: staff.name || "Staff member",
      roleTitle: staff.role_title || null,
      businessName: business?.name || null,
      timezone: business?.timezone || null,
    },
    rows: mergeRows(staff, data || []),
  };
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
    const staffId =
      req.method === "GET"
        ? readStringParam(req.query.staffId)
        : cleanText((req.body || {}).staffId);
    const staff = staffId
      ? await resolveStaff(context, staffId)
      : await resolveStaff(context, staffForContext(context)?.id || "");

    if (!staff) {
      return errorResponse(
        res,
        403,
        "staff_not_available",
        "Staff working hours are not available",
      );
    }

    if (req.method === "GET") {
      const response = await readAvailability(context, staff);
      return res.status(200).json(response);
    }

    const rows = normaliseRows((req.body || {}).rows);
    if (!rows) {
      return errorResponse(
        res,
        400,
        "invalid_staff_availability",
        "Seven valid working-hour rows are required",
      );
    }

    for (const row of rows) {
      const rowUpdate = {
        business_id: staff.business_id,
        start_time: row.start_time,
        end_time: row.end_time,
        is_closed: row.is_closed,
      };

      const { data: updatedRows, error: updateError } =
        await context.supabaseAdmin
          .from("staff_availability")
          .update(rowUpdate)
          .eq("staff_member_id", staff.id)
          .eq("day_of_week", row.day_of_week)
          .select("id");

      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertError } = await context.supabaseAdmin
          .from("staff_availability")
          .insert({
            ...rowUpdate,
            staff_member_id: staff.id,
            day_of_week: row.day_of_week,
          });

        if (insertError) throw insertError;
      }
    }

    const response = await readAvailability(context, staff);
    return res.status(200).json({ ok: true, ...response });
  } catch (error) {
    return handleAppApiError(res, error);
  }
}
