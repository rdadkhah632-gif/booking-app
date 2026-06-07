import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { BillingStatus } from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const config = {
  api: {
    bodyParser: false,
  },
};

type BillingIdentifiers = {
  businessId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
};

type BillingUpdate = BillingIdentifiers & {
  billingStatus?: BillingStatus;
  currentPeriodEnd?: string | null;
};

type StripeReference = string | { id: string } | null;

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

type StripeSubscription = {
  id: string;
  status:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "paused"
    | "trialing"
    | "unpaid";
  customer: StripeReference;
  metadata: Record<string, string>;
  items: {
    data: Array<{
      current_period_end: number;
    }>;
  };
};

type StripeCheckoutSession = {
  client_reference_id: string | null;
  customer: StripeReference;
  metadata: Record<string, string> | null;
  subscription: StripeReference;
};

type StripeInvoice = {
  customer: StripeReference;
  parent: {
    type: string;
    subscription_details: {
      metadata: Record<string, string> | null;
      subscription: StripeReference;
    } | null;
  } | null;
};

type StripeClient = {
  subscriptions: {
    retrieve(subscriptionId: string): Promise<unknown>;
  };
};

function objectId(
  value: StripeReference | undefined,
) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function timestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function subscriptionPeriodEnd(subscription: StripeSubscription) {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));

  if (periodEnds.length === 0) return null;
  return timestamp(Math.max(...periodEnds));
}

function mapSubscriptionStatus(
  status: StripeSubscription["status"],
): BillingStatus | null {
  if (status === "active") return "active";
  if (status === "trialing") return "free_trial";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled") return "cancelled";
  if (status === "paused") return "paused";
  return null;
}

async function readRawBody(request: NextApiRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function findBillingRow(identifiers: BillingIdentifiers) {
  const supabase = createSupabaseAdminClient();

  if (identifiers.businessId) {
    const { data, error } = await supabase
      .from("business_billing")
      .select("id, business_id")
      .eq("business_id", identifiers.businessId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (identifiers.subscriptionId) {
    const { data, error } = await supabase
      .from("business_billing")
      .select("id, business_id")
      .eq("stripe_subscription_id", identifiers.subscriptionId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (identifiers.customerId) {
    const { data, error } = await supabase
      .from("business_billing")
      .select("id, business_id")
      .eq("stripe_customer_id", identifiers.customerId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function syncBillingState(
  event: StripeEvent,
  update: BillingUpdate,
) {
  const supabase = createSupabaseAdminClient();
  const existingRow = await findBillingRow(update);
  const payload = {
    ...(update.billingStatus
      ? { billing_status: update.billingStatus }
      : {}),
    ...(update.customerId
      ? { stripe_customer_id: update.customerId }
      : {}),
    ...(update.subscriptionId
      ? { stripe_subscription_id: update.subscriptionId }
      : {}),
    ...(update.currentPeriodEnd !== undefined
      ? { current_period_end: update.currentPeriodEnd }
      : {}),
  };

  if (existingRow) {
    const { error } = await supabase
      .from("business_billing")
      .update(payload)
      .eq("id", existingRow.id);

    if (error) throw error;
    return true;
  }

  if (update.businessId) {
    const { error } = await supabase.from("business_billing").upsert(
      {
        business_id: update.businessId,
        ...payload,
      },
      {
        onConflict: "business_id",
      },
    );

    if (error) throw error;
    return true;
  }

  console.warn("Stripe webhook billing row not found", {
    eventId: event.id,
    eventType: event.type,
    customerId: update.customerId || null,
    subscriptionId: update.subscriptionId || null,
  });
  return false;
}

function invoiceIdentifiers(invoice: StripeInvoice): BillingIdentifiers {
  const subscriptionDetails =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details
      : null;

  return {
    businessId: subscriptionDetails?.metadata?.business_id || null,
    customerId: objectId(invoice.customer),
    subscriptionId: objectId(subscriptionDetails?.subscription),
  };
}

async function handleCheckoutSession(
  stripe: StripeClient,
  event: StripeEvent,
  session: StripeCheckoutSession,
) {
  const subscriptionId = objectId(session.subscription);
  const customerId = objectId(session.customer);
  let billingStatus: BillingStatus = "active";
  let currentPeriodEnd: string | null | undefined;

  if (subscriptionId) {
    try {
      const subscription = (await stripe.subscriptions.retrieve(
        subscriptionId,
      )) as StripeSubscription;
      billingStatus =
        mapSubscriptionStatus(subscription.status) || billingStatus;
      currentPeriodEnd = subscriptionPeriodEnd(subscription);
    } catch (error) {
      console.warn("Stripe Checkout subscription could not be retrieved", {
        eventId: event.id,
        subscriptionId,
      });
    }
  }

  await syncBillingState(event, {
    businessId: session.metadata?.business_id || session.client_reference_id,
    customerId,
    subscriptionId,
    billingStatus,
    currentPeriodEnd,
  });
}

async function handleSubscription(
  event: StripeEvent,
  subscription: StripeSubscription,
  deleted = false,
) {
  await syncBillingState(event, {
    businessId: subscription.metadata.business_id || null,
    customerId: objectId(subscription.customer),
    subscriptionId: subscription.id,
    billingStatus: deleted
      ? "cancelled"
      : mapSubscriptionStatus(subscription.status) || undefined,
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
  });
}

async function handleInvoice(
  event: StripeEvent,
  invoice: StripeInvoice,
  billingStatus: BillingStatus,
) {
  await syncBillingState(event, {
    ...invoiceIdentifiers(invoice),
    billingStatus,
  });
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    response.status(500).json({ error: "Stripe webhook is not configured." });
    return;
  }

  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    response.status(400).json({ error: "Missing Stripe signature." });
    return;
  }

  const stripe = new Stripe(stripeSecretKey);
  let event: StripeEvent;

  try {
    const rawBody = await readRawBody(request);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    ) as StripeEvent;
  } catch (error) {
    console.warn("Invalid Stripe webhook signature");
    response.status(400).json({ error: "Invalid Stripe signature." });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSession(
          stripe,
          event,
          event.data.object as StripeCheckoutSession,
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscription(
          event,
          event.data.object as StripeSubscription,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscription(
          event,
          event.data.object as StripeSubscription,
          true,
        );
        break;
      case "invoice.payment_succeeded":
        await handleInvoice(
          event,
          event.data.object as StripeInvoice,
          "active",
        );
        break;
      case "invoice.payment_failed":
        await handleInvoice(
          event,
          event.data.object as StripeInvoice,
          "past_due",
        );
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook synchronization failed", {
      eventId: event.id,
      eventType: event.type,
      error,
    });
    response.status(500).json({ error: "Webhook synchronization failed." });
    return;
  }

  response.status(200).json({ received: true });
}
