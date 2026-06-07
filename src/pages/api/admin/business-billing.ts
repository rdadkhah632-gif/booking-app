import type { NextApiRequest, NextApiResponse } from "next";
import { BILLING_STATUSES, BillingStatus } from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type BillingPayload = {
  businessId?: unknown;
  billingStatus?: unknown;
  priceAmount?: unknown;
  currency?: unknown;
  trialStart?: unknown;
  trialEnd?: unknown;
  foundingBusiness?: unknown;
  secondMonthFreeEligible?: unknown;
  notes?: unknown;
  changeReason?: unknown;
};

const BILLING_SELECT = `
  id,
  business_id,
  billing_status,
  plan_name,
  price_amount,
  currency,
  trial_start,
  trial_end,
  founding_business,
  second_month_free_eligible,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_end,
  notes,
  created_at,
  updated_at
`;

function getBearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function readBusinessId(request: NextApiRequest) {
  const value =
    request.method === "GET"
      ? request.query.businessId
      : (request.body as BillingPayload | undefined)?.businessId;
  return typeof value === "string" ? value.trim() : "";
}

function nullableDate(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid billing date.");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid billing date.");
  return date.toISOString();
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
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) {
      response.status(404).json({ error: "Business not found." });
      return;
    }

    if (request.method === "GET") {
      const { data, error } = await admin.supabase
        .from("business_billing")
        .select(BILLING_SELECT)
        .eq("business_id", businessId)
        .maybeSingle();

      if (error) throw error;
      response.status(200).json({ billing: data });
      return;
    }

    const body = (request.body || {}) as BillingPayload;
    const billingStatus =
      typeof body.billingStatus === "string"
        ? (body.billingStatus as BillingStatus)
        : null;
    const currency =
      typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
    const notes =
      typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
    const changeReason =
      typeof body.changeReason === "string"
        ? body.changeReason.trim().slice(0, 500)
        : "";

    if (!billingStatus || !BILLING_STATUSES.includes(billingStatus)) {
      response.status(400).json({ error: "Invalid billing status." });
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      response.status(400).json({ error: "Currency must use a 3-letter code." });
      return;
    }
    if (
      body.priceAmount !== null &&
      (!Number.isInteger(body.priceAmount) || Number(body.priceAmount) < 0)
    ) {
      response
        .status(400)
        .json({ error: "Price must be a positive amount in minor units." });
      return;
    }
    if (typeof body.foundingBusiness !== "boolean") {
      response.status(400).json({ error: "Invalid founding-business value." });
      return;
    }
    if (typeof body.secondMonthFreeEligible !== "boolean") {
      response
        .status(400)
        .json({ error: "Invalid second-month eligibility value." });
      return;
    }
    if (changeReason.length < 5) {
      response
        .status(400)
        .json({ error: "Add a short reason for this billing change." });
      return;
    }

    const trialStart = nullableDate(body.trialStart);
    const trialEnd = nullableDate(body.trialEnd);
    if (
      trialStart &&
      trialEnd &&
      new Date(trialEnd).getTime() < new Date(trialStart).getTime()
    ) {
      response
        .status(400)
        .json({ error: "Trial end cannot be before trial start." });
      return;
    }

    const { data: previousBilling, error: previousError } = await admin.supabase
      .from("business_billing")
      .select(BILLING_SELECT)
      .eq("business_id", businessId)
      .maybeSingle();

    if (previousError) throw previousError;

    const update = {
      billing_status: billingStatus,
      price_amount:
        body.priceAmount === null ? null : Number(body.priceAmount),
      currency,
      trial_start: trialStart,
      trial_end: trialEnd,
      founding_business: body.foundingBusiness,
      second_month_free_eligible: body.secondMonthFreeEligible,
      notes: notes || null,
    };

    const { data: billing, error: updateError } = await admin.supabase
      .from("business_billing")
      .upsert(
        {
          business_id: businessId,
          ...update,
        },
        { onConflict: "business_id" },
      )
      .select(BILLING_SELECT)
      .single();

    if (updateError) throw updateError;

    const { error: auditError } = await admin.supabase
      .from("business_billing_admin_audit")
      .insert({
        business_id: businessId,
        admin_user_id: admin.user.id,
        action: "manual_billing_update",
        reason: changeReason,
        previous_state: previousBilling,
        next_state: billing,
      });

    if (auditError) {
      console.warn("Billing update audit record was not stored", {
        businessId,
        adminUserId: admin.user.id,
        message: auditError.message,
      });
    }

    console.info("Admin billing state updated", {
      businessId,
      adminUserId: admin.user.id,
      billingStatus,
      auditStored: !auditError,
    });

    response.status(200).json({
      billing,
      auditStored: !auditError,
    });
  } catch (error) {
    console.error("Admin billing operation failed", error);
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not update billing state.",
    });
  }
}
