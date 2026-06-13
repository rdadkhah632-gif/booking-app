import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { getEmailVerificationState } from "@/lib/email/verification";

const REVIEW_STATUSES = [
  "pending",
  "needs_review",
  "potentially_eligible",
  "approved",
  "declined",
] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

type ReviewPayload = {
  businessId?: unknown;
  reviewStatus?: unknown;
  notes?: unknown;
};

type BookingRow = {
  id: string;
  status: string | null;
  customer_user_id: string | null;
  customer_email: string | null;
  created_at: string | null;
};

function getBearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function readBusinessId(request: NextApiRequest) {
  const value =
    request.method === "GET"
      ? request.query.businessId
      : (request.body as ReviewPayload | undefined)?.businessId;
  return typeof value === "string" ? value.trim() : "";
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isMissingReviewSchema(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message?.toLowerCase() || "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("founding_offer_reviews")
  );
}

async function requireAdmin(request: NextApiRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) return null;
  return { supabase, user };
}

function customerIdentity(booking: BookingRow) {
  const email = booking.customer_email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  if (booking.customer_user_id) return `user:${booking.customer_user_id}`;
  return null;
}

async function loadVerificationCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bookings: BookingRow[],
) {
  const customerUserIds = Array.from(
    new Set(
      bookings
        .map((booking) => booking.customer_user_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let verified = 0;
  let unverified = 0;
  let unknown = 0;

  for (const userId of customerUserIds) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user) {
      unknown += 1;
      continue;
    }

    const state = getEmailVerificationState(data.user);
    if (state === "verified") verified += 1;
    else if (state === "unverified") unverified += 1;
    else unknown += 1;
  }

  const guestIdentityCount = new Set(
    bookings
      .filter((booking) => !booking.customer_user_id)
      .map(customerIdentity)
      .filter((value): value is string => Boolean(value)),
  ).size;

  return {
    verified,
    unverified,
    unknown: unknown + guestIdentityCount,
  };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (!["GET", "POST"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      response.status(403).json({ error: "Admin access required." });
      return;
    }

    const businessId = readBusinessId(request);
    if (!businessId) {
      response.status(400).json({ error: "A business is required." });
      return;
    }

    const { data: business, error: businessError } = await admin.supabase
      .from("businesses")
      .select("id, name, created_at")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) {
      response.status(404).json({ error: "Business not found." });
      return;
    }

    if (request.method === "POST") {
      const body = (request.body || {}) as ReviewPayload;
      const reviewStatus =
        typeof body.reviewStatus === "string"
          ? (body.reviewStatus as ReviewStatus)
          : null;
      const notes =
        typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

      if (!reviewStatus || !REVIEW_STATUSES.includes(reviewStatus)) {
        response.status(400).json({ error: "Invalid review status." });
        return;
      }

      const { data: review, error: reviewError } = await admin.supabase
        .from("founding_offer_reviews")
        .upsert(
          {
            business_id: businessId,
            review_status: reviewStatus,
            reviewed_at: new Date().toISOString(),
            reviewed_by: admin.user.id,
            notes: notes || null,
          },
          { onConflict: "business_id" },
        )
        .select(
          "business_id, review_status, reviewed_at, reviewed_by, notes, created_at, updated_at",
        )
        .single();

      if (reviewError) {
        if (isMissingReviewSchema(reviewError)) {
          response.status(503).json({
            error: "Founding offer review SQL has not been installed.",
            sqlRequired: "sources/sql/07_founding_offer_reviews.sql",
          });
          return;
        }
        throw reviewError;
      }

      response.status(200).json({ review });
      return;
    }

    const { data: billing, error: billingError } = await admin.supabase
      .from("business_billing")
      .select(
        "business_id, billing_status, trial_start, trial_end, current_period_end, founding_business, second_month_free_eligible, created_at",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (billingError) throw billingError;

    const windowStart = new Date(
      billing?.trial_start || business.created_at || billing?.created_at,
    );
    const safeWindowStart = Number.isNaN(windowStart.getTime())
      ? new Date()
      : windowStart;
    const windowEnd = addDays(safeWindowStart, 30);

    const { data: bookingData, error: bookingError } = await admin.supabase
      .from("bookings")
      .select(
        "id, status, customer_user_id, customer_email, created_at",
      )
      .eq("business_id", businessId)
      .gte("created_at", safeWindowStart.toISOString())
      .lt("created_at", windowEnd.toISOString())
      .limit(5000);

    if (bookingError) throw bookingError;

    const bookings = (bookingData || []) as BookingRow[];
    const statusCount = (status: string) =>
      bookings.filter(
        (booking) => booking.status?.toLowerCase() === status,
      ).length;
    const qualifyingBookings = bookings.filter((booking) =>
      ["confirmed", "completed"].includes(
        booking.status?.toLowerCase() || "",
      ),
    );
    const uniqueCustomerIdentities = new Set(
      bookings
        .map(customerIdentity)
        .filter((value): value is string => Boolean(value)),
    ).size;
    const qualifyingUniqueCustomers = new Set(
      qualifyingBookings
        .map(customerIdentity)
        .filter((value): value is string => Boolean(value)),
    ).size;
    const verification = await loadVerificationCounts(
      admin.supabase,
      bookings,
    );
    const concentratedActivity =
      qualifyingBookings.length >= 10 &&
      qualifyingUniqueCustomers < Math.ceil(qualifyingBookings.length / 2);

    let guidance = "not_founding";
    if (billing?.founding_business) {
      if (
        qualifyingBookings.length >= 30 &&
        qualifyingUniqueCustomers >= 30
      ) {
        guidance = "potentially_eligible";
      } else if (concentratedActivity || verification.unknown > 0) {
        guidance = "needs_manual_review";
      } else {
        guidance = "needs_more_activity";
      }
    }

    const { data: review, error: reviewError } = await admin.supabase
      .from("founding_offer_reviews")
      .select(
        "business_id, review_status, reviewed_at, reviewed_by, notes, created_at, updated_at",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    let reviewSchemaAvailable = true;
    if (reviewError) {
      if (isMissingReviewSchema(reviewError)) reviewSchemaAvailable = false;
      else throw reviewError;
    }

    response.status(200).json({
      billing: billing || null,
      metrics: {
        windowStart: safeWindowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        totalBookings: bookings.length,
        pendingBookings: statusCount("pending"),
        confirmedBookings: statusCount("confirmed"),
        completedBookings: statusCount("completed"),
        cancelledBookings: statusCount("cancelled"),
        declinedBookings: statusCount("declined"),
        qualifyingBookings: qualifyingBookings.length,
        uniqueCustomers: uniqueCustomerIdentities,
        qualifyingUniqueCustomers,
        verifiedCustomers: verification.verified,
        unverifiedCustomers: verification.unverified,
        unknownVerificationCustomers: verification.unknown,
        concentratedActivity,
        guidance,
      },
      review: review || null,
      reviewSchemaAvailable,
      sqlRequired: reviewSchemaAvailable
        ? null
        : "sources/sql/07_founding_offer_reviews.sql",
    });
  } catch (error) {
    console.error("Founding offer review operation failed", error);
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not load founding offer review.",
    });
  }
}
