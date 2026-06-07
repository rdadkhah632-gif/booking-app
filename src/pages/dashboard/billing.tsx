import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import {
  BillingState,
  defaultBillingState,
  formatBillingAmount,
} from "@/lib/billing";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type Business = {
  id: string;
  name: string;
  published?: boolean | null;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

export default function DashboardBillingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [billingByBusiness, setBillingByBusiness] = useState<
    Record<string, BillingState>
  >({});
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [schemaAvailable, setSchemaAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const selectedBusiness = useMemo(
    () =>
      businesses.find((business) => business.id === selectedBusinessId) || null,
    [businesses, selectedBusinessId],
  );

  const billing = useMemo(
    () =>
      billingByBusiness[selectedBusinessId] ||
      defaultBillingState(selectedBusinessId),
    [billingByBusiness, selectedBusinessId],
  );

  function statusLabel(status: BillingState["billing_status"]) {
    const labels: Record<BillingState["billing_status"], string> = {
      not_configured: t("billing.status.notConfigured", "Not configured"),
      free_trial: t("billing.status.freeTrial", "Free trial"),
      founding_free: t("billing.status.foundingFree", "Founding free period"),
      active: t("billing.status.active", "Active"),
      manual_comped: t("billing.status.manualComped", "Complimentary"),
      past_due: t("billing.status.pastDue", "Past due"),
      cancelled: t("billing.status.cancelled", "Cancelled"),
      paused: t("billing.status.paused", "Paused"),
    };

    return labels[status];
  }

  function statusBody(status: BillingState["billing_status"]) {
    if (status === "free_trial")
      return t(
        "billing.status.freeTrialBody",
        "Your launch trial is active. No payment is being taken yet.",
      );
    if (status === "founding_free")
      return t(
        "billing.status.foundingFreeBody",
        "Your founding-business free period is active.",
      );
    if (status === "active")
      return t(
        "billing.status.activeBody",
        "Your Mirëbook Launch subscription is recorded as active.",
      );
    if (status === "manual_comped")
      return t(
        "billing.status.manualCompedBody",
        "Mirëbook has recorded complimentary access for this business.",
      );
    if (status === "past_due")
      return t(
        "billing.status.pastDueBody",
        "Your billing record needs attention. Your booking tools remain available.",
      );
    if (status === "cancelled")
      return t(
        "billing.status.cancelledBody",
        "This subscription record is cancelled. Your booking tools are not restricted in this batch.",
      );
    if (status === "paused")
      return t(
        "billing.status.pausedBody",
        "This billing record is paused. Your booking tools remain available.",
      );

    return t(
      "billing.status.notConfiguredBody",
      "Mirëbook has not configured a manual billing record for this business yet.",
    );
  }

  async function loadBilling() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/dashboard/billing");
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("id, name, published")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      if (businessError) throw businessError;

      const ownedBusinesses = (businessData || []) as Business[];
      setBusinesses(ownedBusinesses);

      const queryBusinessId =
        typeof router.query.businessId === "string"
          ? router.query.businessId
          : "";
      const nextBusiness =
        ownedBusinesses.find((business) => business.id === queryBusinessId) ||
        ownedBusinesses[0] ||
        null;

      setSelectedBusinessId(nextBusiness?.id || "");

      if (ownedBusinesses.length > 0) {
        const { data: billingData, error: billingError } = await supabase
          .from("business_billing")
          .select(
            "id, business_id, billing_status, plan_name, price_amount, currency, trial_start, trial_end, founding_business, second_month_free_eligible, current_period_end, created_at, updated_at",
          )
          .in(
            "business_id",
            ownedBusinesses.map((business) => business.id),
          );

        if (billingError) {
          setSchemaAvailable(false);
          setBillingByBusiness({});
        } else {
          setSchemaAvailable(true);
          setBillingByBusiness(
            ((billingData || []) as BillingState[]).reduce(
              (map, row) => {
                map[row.business_id] = row;
                return map;
              },
              {} as Record<string, BillingState>,
            ),
          );
        }
      }
    } catch (err: any) {
      setError(
        err.message ||
          t("billing.error.load", "Could not load billing details."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadBilling();
  }, [router.isReady]);

  function selectBusiness(businessId: string) {
    setSelectedBusinessId(businessId);
    router.replace(`/dashboard/billing?businessId=${businessId}`, undefined, {
      shallow: true,
    });
  }

  async function startCheckout() {
    if (!selectedBusiness || startingCheckout) return;

    setStartingCheckout(true);
    setCheckoutError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login?redirectTo=/dashboard/billing");
        return;
      }

      const checkoutResponse = await fetch(
        "/api/stripe/create-checkout-session",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: selectedBusiness.id,
          }),
        },
      );
      const checkoutData = (await checkoutResponse.json()) as {
        url?: string;
        error?: string;
      };

      if (!checkoutResponse.ok || !checkoutData.url) {
        throw new Error(
          checkoutData.error ||
            t(
              "billing.checkout.error",
              "Could not start Stripe Checkout. Please try again.",
            ),
        );
      }

      window.location.assign(checkoutData.url);
    } catch (checkoutError: any) {
      setCheckoutError(
        checkoutError.message ||
          t(
            "billing.checkout.error",
            "Could not start Stripe Checkout. Please try again.",
          ),
      );
      setStartingCheckout(false);
    }
  }

  const trialEnd = formatDate(billing.trial_end);
  const currentPeriodEnd = formatDate(billing.current_period_end);
  const monthlyPrice =
    billing.price_amount === null
      ? null
      : formatBillingAmount(billing.price_amount, billing.currency);

  return (
    <DashboardLayout
      title={t("billing.pageTitle", "Billing")}
      subtitle={
        selectedBusiness
          ? t(
              "billing.pageSubtitleBusiness",
              "Subscription details for {{business}}.",
            ).replace("{{business}}", selectedBusiness.name)
          : t(
              "billing.pageSubtitle",
              "View your Mirëbook business subscription details.",
            )
      }
    >
      {loading && (
        <div className="card">
          <p className="muted">
            {t("billing.loading", "Loading billing details...")}
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="card" style={{ borderColor: "rgba(255,77,109,0.35)" }}>
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {!loading && !error && businesses.length === 0 && (
        <div className="card">
          <h2>{t("billing.noBusinessTitle", "Create a business first")}</h2>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "billing.noBusinessBody",
              "Billing details become available after you create a Mirëbook business profile.",
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

      {!loading && !error && selectedBusiness && (
        <>
          {router.query.checkout === "success" && (
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                borderColor: "rgba(45,212,191,0.35)",
                background: "rgba(45,212,191,0.06)",
              }}
            >
              <h3>
                {t(
                  "billing.checkout.successTitle",
                  "Test Checkout completed",
                )}
              </h3>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.checkout.successBody",
                  "Stripe accepted the test subscription. Billing status will remain informational until webhook synchronization is added.",
                )}
              </p>
            </div>
          )}

          {router.query.checkout === "cancelled" && (
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                borderColor: "rgba(255,190,11,0.35)",
              }}
            >
              <h3>
                {t("billing.checkout.cancelledTitle", "Checkout cancelled")}
              </h3>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.checkout.cancelledBody",
                  "No test subscription was started. Your Mirëbook access has not changed.",
                )}
              </p>
            </div>
          )}

          {checkoutError && (
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                borderColor: "rgba(255,77,109,0.35)",
              }}
            >
              <p style={{ color: "var(--danger)" }}>{checkoutError}</p>
            </div>
          )}

          {businesses.length > 1 && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <label className="small muted" htmlFor="billing-business">
                {t("billing.selectedBusiness", "Selected business")}
              </label>
              <select
                id="billing-business"
                value={selectedBusinessId}
                onChange={(event) => selectBusiness(event.target.value)}
                style={{ marginTop: "0.5rem" }}
              >
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!schemaAvailable && (
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                borderColor: "rgba(255,190,11,0.35)",
              }}
            >
              <h3>
                {t(
                  "billing.manualSetupPendingTitle",
                  "Billing setup is being prepared",
                )}
              </h3>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.manualSetupPendingBody",
                  "Your business can keep using bookings, staff tools and its public listing while Mirëbook prepares the manual billing record.",
                )}
              </p>
            </div>
          )}

          <div className="billing-hero card">
            <div>
              <p className="small" style={{ color: "var(--accent)" }}>
                {t("billing.heroKicker", "Business subscription")}
              </p>
              <h2 style={{ marginTop: "0.25rem" }}>
                {billing.plan_name ||
                  t("billing.launchPlan", "Mirëbook Launch")}
              </h2>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.heroBody",
                  "One clear subscription for the tools your business uses to manage bookings and customers.",
                )}
              </p>
            </div>
            <Link href="/support/business" className="btn btn-ghost">
              {t("billing.contactSupport", "Contact Mirëbook")}
            </Link>
          </div>

          <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <p className="small muted">
                {t("billing.subscriptionStatus", "Billing status")}
              </p>
              <h3>{statusLabel(billing.billing_status)}</h3>
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                {statusBody(billing.billing_status)}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t("billing.agreedPrice", "Agreed monthly price")}
              </p>
              <h3>
                {monthlyPrice ||
                  t("billing.priceNotSet", "Not agreed yet")}
              </h3>
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.noChargeYet",
                  "No real payment is taken while Checkout is in test mode.",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t("billing.offerStatus", "Offer status")}
              </p>
              <h3>
                {billing.founding_business
                  ? t("billing.foundingBusiness", "Founding business")
                  : t("billing.standardLaunch", "Launch plan")}
              </h3>
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                {billing.second_month_free_eligible
                  ? t(
                      "billing.secondMonthFree",
                      "Eligible for the second month free.",
                    )
                  : t(
                      "billing.offerRecordedManually",
                      "Offer details are recorded manually by Mirëbook.",
                    )}
              </p>
            </div>
          </div>

          {(trialEnd || currentPeriodEnd) && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h2>{t("billing.importantDates", "Important dates")}</h2>
              <div className="billing-date-grid">
                {trialEnd && (
                  <div>
                    <p className="small muted">
                      {t("billing.trialEnd", "Trial end")}
                    </p>
                    <strong>{trialEnd}</strong>
                  </div>
                )}
                {currentPeriodEnd && (
                  <div>
                    <p className="small muted">
                      {t("billing.currentPeriodEnd", "Current period end")}
                    </p>
                    <strong>{currentPeriodEnd}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="billing-grid">
            <div className="card">
              <h2>{t("billing.includedTitle", "Included in Mirëbook Launch")}</h2>
              <ul className="billing-feature-list">
                <li>{t("billing.included.bookings", "Booking management")}</li>
                <li>
                  {t(
                    "billing.included.staffServices",
                    "Staff and service management",
                  )}
                </li>
                <li>{t("billing.included.publicListing", "Public listing")}</li>
                <li>{t("billing.included.notifications", "Notifications")}</li>
                <li>
                  {t(
                    "billing.included.noCommission",
                    "No normal booking commission",
                  )}
                </li>
                <li>
                  {t(
                    "billing.included.noCustomerFee",
                    "No customer booking fee",
                  )}
                </li>
              </ul>
            </div>

            <div className="card">
              <h2>
                {t("billing.onlinePaymentsTitle", "Test subscription Checkout")}
              </h2>
              <p className="muted" style={{ marginTop: "0.65rem" }}>
                {t(
                  "billing.onlinePaymentsBody",
                  "Use Stripe test mode to check the Mirëbook Membership subscription flow. Test Checkout does not change platform access.",
                )}
              </p>
              <p className="small muted" style={{ marginTop: "1rem" }}>
                {t(
                  "billing.noAccessRestriction",
                  "Billing status does not restrict bookings, staff access or your public listing in this stage.",
                )}
              </p>
              <button
                type="button"
                className="btn btn-accent"
                style={{ marginTop: "1rem" }}
                onClick={startCheckout}
                disabled={startingCheckout}
              >
                {startingCheckout
                  ? t(
                      "billing.checkout.starting",
                      "Opening test Checkout...",
                    )
                  : t("billing.checkout.start", "Start test Checkout")}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .billing-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .billing-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .billing-date-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .billing-feature-list {
          display: grid;
          gap: 0.7rem;
          margin: 1rem 0 0;
          padding-left: 1.2rem;
          color: var(--muted);
        }

        @media (max-width: 760px) {
          .billing-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .billing-hero :global(.btn),
          .billing-grid,
          .billing-date-grid {
            width: 100%;
          }

          .billing-grid,
          .billing-date-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
