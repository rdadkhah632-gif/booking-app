import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type BusinessBilling = {
  id: string;
  name: string;
  published?: boolean | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  subscription_price_monthly?: number | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  trial_ends_at?: string | null;
  billing_email?: string | null;
};

const PLAN_OPTIONS = [
  { value: "starter" },
  { value: "growth" },
  { value: "pro" },
  { value: "custom" },
];

const STATUS_OPTIONS = [
  { value: "trial" },
  { value: "active" },
  { value: "past_due" },
  { value: "paused" },
  { value: "cancelled" },
];

function defaultBilling(business: BusinessBilling): BusinessBilling {
  return {
    ...business,
    subscription_status: business.subscription_status || "trial",
    subscription_plan: business.subscription_plan || "starter",
    subscription_price_monthly: Number(
      business.subscription_price_monthly || 0,
    ),
    billing_email: business.billing_email || "",
    trial_ends_at: business.trial_ends_at || null,
  };
}

function statusTone(status?: string | null) {
  if (status === "active") return "success";
  if (status === "trial") return "accent";
  if (status === "past_due") return "warning";
  if (status === "paused") return "muted";
  if (status === "cancelled") return "warning";
  return "muted";
}

function statusLabel(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string,
) {
  if (status === "trial") return t("billing.status.trial", "Trial");
  if (status === "active") return t("billing.status.active", "Active");
  if (status === "past_due") return t("billing.status.pastDue", "Past due");
  if (status === "paused") return t("billing.status.paused", "Paused");
  if (status === "cancelled") return t("billing.status.cancelled", "Cancelled");
  return t("billing.status.notSet", "Not set");
}

function planLabel(
  plan: string | null | undefined,
  t: (key: string, fallback?: string) => string,
) {
  if (plan === "growth") return t("billing.planGrowth", "Growth");
  if (plan === "pro") return t("billing.planPro", "Pro");
  if (plan === "custom") return t("billing.planCustom", "Custom");
  return t("billing.planStarter", "Starter");
}

export default function DashboardBillingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [businesses, setBusinesses] = useState<BusinessBilling[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [billing, setBilling] = useState<BusinessBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedBusiness = useMemo(() => {
    return (
      businesses.find((business) => business.id === selectedBusinessId) || null
    );
  }, [businesses, selectedBusinessId]);

  function trialEndsText() {
    if (!billing?.trial_ends_at)
      return t("billing.noTrialConfigured", "No trial date configured.");

    return t("billing.trialEndsOn", "Trial ends on {{date}}").replace(
      "{{date}}",
      new Date(billing.trial_ends_at).toLocaleDateString(),
    );
  }

  async function loadBilling() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/dashboard/billing");
        return;
      }

      const { data, error } = await supabase
        .from("businesses")
        .select(
          `
          id,
          name,
          published,
          subscription_status,
          subscription_plan,
          subscription_price_monthly,
          stripe_customer_id,
          stripe_subscription_id,
          trial_ends_at,
          billing_email
        `,
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const ownedBusinesses = (data || []) as BusinessBilling[];
      setBusinesses(ownedBusinesses);

      const queryBusinessId =
        typeof router.query.businessId === "string"
          ? router.query.businessId
          : "";

      const nextSelectedBusiness =
        ownedBusinesses.find((business) => business.id === queryBusinessId) ||
        ownedBusinesses[0] ||
        null;

      if (nextSelectedBusiness) {
        setSelectedBusinessId(nextSelectedBusiness.id);
        setBilling(defaultBilling(nextSelectedBusiness));
      } else {
        setSelectedBusinessId("");
        setBilling(null);
      }

      setLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t("billing.error.load", "Could not load billing details."),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadBilling();
  }, [router.isReady]);

  function selectBusiness(businessId: string) {
    const business = businesses.find((item) => item.id === businessId);
    if (!business) return;

    setSelectedBusinessId(business.id);
    setBilling(defaultBilling(business));
    router.replace(`/dashboard/billing?businessId=${business.id}`, undefined, {
      shallow: true,
    });
  }

  function updateBilling<K extends keyof BusinessBilling>(
    key: K,
    value: BusinessBilling[K],
  ) {
    setBilling((current) => {
      if (!current) return current;

      return {
        ...current,
        [key]: value,
      };
    });
  }

  async function saveBillingGroundwork() {
    if (!billing) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      subscription_status: billing.subscription_status || "trial",
      subscription_plan: billing.subscription_plan || "starter",
      subscription_price_monthly: Number(
        billing.subscription_price_monthly || 0,
      ),
      billing_email: billing.billing_email?.trim() || null,
      trial_ends_at: billing.trial_ends_at || null,
    };

    const { error } = await supabase
      .from("businesses")
      .update(payload)
      .eq("id", billing.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      t("billing.success.saved", "Mirëbook billing groundwork saved."),
    );
    await loadBilling();
  }

  function stripeStatusText() {
    if (!billing)
      return t("billing.stripe.noBusiness", "No business selected.");

    if (billing.stripe_subscription_id) {
      return t(
        "billing.stripe.subscriptionStored",
        "Stripe subscription reference is stored for this business.",
      );
    }

    if (billing.stripe_customer_id) {
      return t(
        "billing.stripe.customerOnly",
        "Stripe customer reference is stored, but no subscription reference is linked yet.",
      );
    }

    return t(
      "billing.stripe.notConnected",
      "Stripe is not connected yet. This page is groundwork for business subscriptions, not customer booking payments.",
    );
  }

  return (
    <DashboardLayout
      title={t("billing.pageTitle", "Billing")}
      subtitle={
        selectedBusiness
          ? t(
              "billing.pageSubtitleBusiness",
              "Manage Mirëbook subscription groundwork for {{business}}.",
            ).replace("{{business}}", selectedBusiness.name)
          : t(
              "billing.pageSubtitle",
              "Prepare business subscription billing for Mirëbook.",
            )
      }
    >
      {loading && (
        <div className="card">
          <p className="muted">
            {t("billing.loading", "Loading Mirëbook billing details...")}
          </p>
        </div>
      )}

      {!loading && businesses.length === 0 && (
        <div className="card">
          <p className="small" style={{ color: "var(--warning)" }}>
            {t("billing.noBusinessKicker", "No business profile found")}
          </p>
          <h2
            style={{ fontFamily: "var(--font-display)", marginTop: "0.35rem" }}
          >
            {t("billing.noBusinessTitle", "Create a business first")}
          </h2>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "billing.noBusinessBody",
              "Billing becomes available after you create a Mirëbook business profile.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "1rem" }}
          >
            {t("billing.openSetupHub", "Open setup hub")}
          </Link>
        </div>
      )}

      {!loading && businesses.length > 0 && billing && (
        <>
          {error && (
            <div
              className="card"
              style={{
                borderColor: "rgba(255,77,109,0.35)",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "var(--danger)" }}>{error}</p>
            </div>
          )}

          {success && (
            <div
              className="card"
              style={{
                borderColor: "rgba(45,212,191,0.35)",
                background: "rgba(45,212,191,0.06)",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "var(--success)" }}>{success}</p>
            </div>
          )}

          <div className="billing-hero card">
            <div>
              <p className="small" style={{ color: "var(--accent)" }}>
                {t("billing.heroKicker", "Business subscription billing")}
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  marginTop: "0.25rem",
                }}
              >
                {t("billing.heroTitle", "Mirëbook billing groundwork")}
              </h2>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.heroBody",
                  "Customers should not pay to book appointments. This page is for future business subscription billing, where businesses pay Mirëbook monthly.",
                )}
              </p>
            </div>

            <div className="billing-hero-actions">
              <Link href="/dashboard/settings" className="btn btn-ghost">
                {t("billing.businessSettings", "Business settings")}
              </Link>
              <button
                className="btn btn-accent"
                onClick={saveBillingGroundwork}
                disabled={saving}
              >
                {saving
                  ? t("common.saving", "Saving...")
                  : t("billing.saveGroundwork", "Save billing groundwork")}
              </button>
            </div>
          </div>

          <div
            className="card billing-trial-banner"
            style={{
              marginBottom: "1.5rem",
              borderColor:
                billing.subscription_status === "trial"
                  ? "rgba(45,212,191,0.35)"
                  : "rgba(255,190,11,0.35)",
            }}
          >
            <p className="small muted">
              {t("billing.subscriptionStatus", "Subscription status")}
            </p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {billing.subscription_status === "trial"
                ? t("billing.trialActive", "Trial active")
                : statusLabel(billing.subscription_status, t)}
            </h3>
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              {trialEndsText()}
            </p>
          </div>

          <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <p className="small muted">
                {t("billing.selectedBusiness", "Selected business")}
              </p>
              <h3>
                {selectedBusiness?.name ||
                  t("billing.businessFallback", "Business")}
              </h3>
              <p className="muted small">
                {selectedBusiness?.published
                  ? t("billing.published", "Published on Mirëbook")
                  : t("billing.hiddenDraft", "Hidden / draft")}
              </p>
            </div>

            <div
              className="card"
              style={{
                borderColor:
                  statusTone(billing.subscription_status) === "success"
                    ? "rgba(45,212,191,0.28)"
                    : "var(--border)",
              }}
            >
              <p className="small muted">
                {t("billing.subscriptionStatus", "Subscription status")}
              </p>
              <h3>{statusLabel(billing.subscription_status, t)}</h3>
              <p className="muted small">
                {t("billing.planSummary", "{{plan}} plan").replace(
                  "{{plan}}",
                  planLabel(billing.subscription_plan, t),
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t("billing.currentPlan", "Current plan")}
              </p>
              <h3>{planLabel(billing.subscription_plan, t)}</h3>
              <p className="muted small">
                {statusLabel(billing.subscription_status, t)}
              </p>
            </div>
          </div>

          {businesses.length > 1 && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <p className="small muted">
                {t("billing.manageAnotherBusiness", "Manage another business")}
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  marginTop: "0.25rem",
                }}
              >
                {t("billing.chooseBillingProfile", "Choose billing profile")}
              </h2>

              <div className="billing-business-list">
                {businesses.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    className={
                      business.id === selectedBusinessId
                        ? "billing-business-card billing-business-card-active"
                        : "billing-business-card"
                    }
                    onClick={() => selectBusiness(business.id)}
                  >
                    <strong>{business.name}</strong>
                    <span>
                      {business.published
                        ? t("billing.publishedShort", "Published")
                        : t("billing.hiddenDraft", "Hidden / draft")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="billing-grid">
            <div className="card billing-card">
              <div>
                <p className="small muted">
                  {t("billing.emailLabel", "Billing email")}
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t("billing.paymentContact", "Payment contact")}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "billing.paymentContactBody",
                    "This should be the email used for future invoices, receipts and subscription notices.",
                  )}
                </p>
              </div>

              <input
                type="email"
                value={billing.billing_email || ""}
                onChange={(e) => updateBilling("billing_email", e.target.value)}
                placeholder="billing@example.com"
              />
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">{t("billing.plan", "Plan")}</p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t("billing.businessPlan", "Business plan")}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "billing.businessPlanBody",
                    "Pricing can stay flexible while you onboard early Albanian and international businesses.",
                  )}
                </p>
              </div>

              <select
                value={billing.subscription_plan || "starter"}
                onChange={(e) =>
                  updateBilling("subscription_plan", e.target.value)
                }
              >
                {PLAN_OPTIONS.map((plan) => (
                  <option key={plan.value} value={plan.value}>
                    {planLabel(plan.value, t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">
                  {t("billing.monthlyPrice", "Monthly price")}
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t(
                    "billing.subscriptionAmount",
                    "Business subscription amount",
                  )}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "billing.subscriptionAmountBody",
                    "This is an internal groundwork field for now. Stripe charging is not wired yet.",
                  )}
                </p>
              </div>

              <input
                type="number"
                min={0}
                step="0.01"
                value={billing.subscription_price_monthly ?? 0}
                onChange={(e) =>
                  updateBilling(
                    "subscription_price_monthly",
                    Number(e.target.value),
                  )
                }
                placeholder="0.00"
              />
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">{t("billing.status", "Status")}</p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t("billing.subscriptionState", "Subscription state")}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "billing.subscriptionStateBody",
                    "This can later control access, trial banners, payment reminders and subscription enforcement.",
                  )}
                </p>
              </div>

              <select
                value={billing.subscription_status || "trial"}
                onChange={(e) =>
                  updateBilling("subscription_status", e.target.value)
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {statusLabel(status.value, t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">
                  {t("billing.trialEndDate", "Trial end date")}
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t("billing.freeTrialTracking", "Free trial tracking")}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "billing.freeTrialTrackingBody",
                    "Useful for early onboarding offers, such as first month free or manual trial extensions.",
                  )}
                </p>
              </div>

              <input
                type="date"
                value={
                  billing.trial_ends_at
                    ? billing.trial_ends_at.slice(0, 10)
                    : ""
                }
                onChange={(e) => {
                  updateBilling(
                    "trial_ends_at",
                    e.target.value
                      ? new Date(`${e.target.value}T12:00:00`).toISOString()
                      : null,
                  );
                }}
              />
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">
                  {t("billing.stripeReadiness", "Stripe readiness")}
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t(
                    "billing.paymentProviderStatus",
                    "Payment provider status",
                  )}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {stripeStatusText()}
                </p>
              </div>

              <div className="billing-provider-box">
                <p className="small muted">
                  {t("billing.stripeCustomer", "Stripe customer")}
                </p>
                <strong>
                  {billing.stripe_customer_id ||
                    t("billing.notConnected", "Not connected")}
                </strong>

                <p className="small muted" style={{ marginTop: "0.75rem" }}>
                  {t("billing.stripeSubscription", "Stripe subscription")}
                </p>
                <strong>
                  {billing.stripe_subscription_id ||
                    t("billing.notConnected", "Not connected")}
                </strong>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              marginTop: "1.5rem",
              borderColor: "rgba(255,190,11,0.28)",
            }}
          >
            <p className="small muted">
              {t("billing.howItWorks", "How Mirëbook subscriptions work")}
            </p>
            <h3 style={{ marginTop: "0.25rem" }}>
              {t(
                "billing.businessSubscriptionsTitle",
                "Business subscriptions power the platform",
              )}
            </h3>
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              {t(
                "billing.businessSubscriptionsBody",
                "Businesses pay Mirëbook a subscription to access booking tools, staff management, notifications and future platform features.",
              )}
            </p>
            <p className="muted small" style={{ marginTop: "0.75rem" }}>
              {t(
                "billing.customerPaymentsSeparate",
                "Customer appointment payments, deposits and checkout processes remain separate from the Mirëbook subscription.",
              )}
            </p>
          </div>
          <div className="grid-4" style={{ marginTop: "1.5rem" }}>
            <div className="card">
              <p className="small muted">
                {t("billing.planStarter", "Starter")}
              </p>
              <h3>{t("billing.planStarterTitle", "Independent businesses")}</h3>
              <p className="muted small">
                {t(
                  "billing.planStarterBody",
                  "Early-stage businesses and solo operators.",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">{t("billing.planGrowth", "Growth")}</p>
              <h3>{t("billing.planGrowthTitle", "Growing teams")}</h3>
              <p className="muted small">
                {t(
                  "billing.planGrowthBody",
                  "Additional staff and higher booking volume.",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">{t("billing.planPro", "Pro")}</p>
              <h3>{t("billing.planProTitle", "Established businesses")}</h3>
              <p className="muted small">
                {t(
                  "billing.planProBody",
                  "Advanced tools and operational features.",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">{t("billing.planCustom", "Custom")}</p>
              <h3>{t("billing.planCustomTitle", "Enterprise")}</h3>
              <p className="muted small">
                {t(
                  "billing.planCustomBody",
                  "Multi-location and tailored solutions.",
                )}
              </p>
            </div>
          </div>
          <div className="billing-final-actions">
            <Link href="/dashboard/businesses" className="btn btn-ghost">
              {t("billing.setupHub", "Setup hub")}
            </Link>

            <Link href="/dashboard/settings" className="btn btn-ghost">
              {t("billing.businessSettings", "Business settings")}
            </Link>

            <button
              className="btn btn-accent"
              onClick={saveBillingGroundwork}
              disabled={saving}
            >
              {saving
                ? t("common.saving", "Saving...")
                : t("billing.saveGroundwork", "Save billing groundwork")}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .billing-hero {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.12),
            rgba(45, 212, 191, 0.08)
          );
          border-color: rgba(255, 107, 53, 0.25);
        }

        .billing-hero-actions,
        .billing-final-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .billing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        .billing-card {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .billing-business-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .billing-business-card {
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          padding: 1rem;
          text-align: left;
          cursor: pointer;
        }

        .billing-business-card span {
          display: block;
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-top: 0.25rem;
        }

        .billing-business-card-active {
          border-color: rgba(255, 107, 53, 0.45);
          background: var(--accent-dim);
        }

        .billing-provider-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .billing-final-actions {
          margin-top: 1.5rem;
          justify-content: flex-start;
        }

        @media (max-width: 640px) {
          .billing-hero,
          .billing-final-actions {
            display: grid;
          }

          .billing-hero-actions,
          .billing-final-actions,
          .billing-hero-actions :global(.btn),
          .billing-final-actions :global(.btn),
          .billing-hero-actions button,
          .billing-final-actions button,
          .billing-hero-actions a,
          .billing-final-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
