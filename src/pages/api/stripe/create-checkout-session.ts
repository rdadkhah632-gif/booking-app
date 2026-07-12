import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

type CheckoutResponse = { url: string } | { error: string };

function getBearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function requiredEnvironment() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID_LAUNCH;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !stripeSecretKey ||
    !stripePriceId ||
    !appUrl ||
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return null;
  }

  return {
    stripeSecretKey,
    stripePriceId,
    appUrl: appUrl.replace(/\/+$/, ""),
    supabaseUrl,
    supabaseAnonKey,
  };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<CheckoutResponse>,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const environment = requiredEnvironment();
  if (!environment) {
    response
      .status(503)
      .json({ error: "Membership checkout is not available." });
    return;
  }

  if (
    process.env.BILLING_CHECKOUT_ENABLED !== "true" ||
    !environment.stripeSecretKey.startsWith("sk_live_")
  ) {
    response.status(503).json({
      error: "Membership checkout is not available.",
    });
    return;
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const businessId =
    typeof request.body?.businessId === "string"
      ? request.body.businessId.trim()
      : "";

  if (!businessId) {
    response.status(400).json({ error: "A business is required." });
    return;
  }

  try {
    const supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, user_id")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (businessError || !business) {
      response.status(403).json({
        error: "You cannot start Checkout for this business.",
      });
      return;
    }

    const stripe = new Stripe(environment.stripeSecretKey);
    const successUrl = new URL("/dashboard/billing", environment.appUrl);
    successUrl.searchParams.set("businessId", business.id);
    successUrl.searchParams.set("checkout", "success");
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = new URL("/dashboard/billing", environment.appUrl);
    cancelUrl.searchParams.set("businessId", business.id);
    cancelUrl.searchParams.set("checkout", "cancelled");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: environment.stripePriceId,
          quantity: 1,
        },
      ],
      client_reference_id: business.id,
      customer_email: user.email || undefined,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      metadata: {
        business_id: business.id,
        owner_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          business_id: business.id,
          owner_user_id: user.id,
        },
      },
    });

    if (!session.url) {
      response
        .status(502)
        .json({ error: "Stripe did not return a Checkout URL." });
      return;
    }

    response.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Could not create Stripe Checkout Session", error);
    response.status(500).json({
      error: "Could not start Stripe Checkout. Please try again.",
    });
  }
}
