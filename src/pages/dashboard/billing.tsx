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
      not_configured: t("billing.status.notConfigured", "Early partner access"),
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
        "Your early partner trial is active.",
      );
    if (status === "founding_free")
      return t(
        "billing.status.foundingFreeBody",
        "Your founding-business free period is active.",
      );
    if (status === "active")
      return t(
        "billing.status.activeBody",
        "Your Mirëbook Launch membership is active.",
      );
    if (status === "manual_comped")
      return t(
        "billing.status.manualCompedBody",
        "Mirëbook has recorded complimentary access for this business.",
      );
    if (status === "past_due")
      return t(
        "billing.status.pastDueBody",
        "Your membership needs attention. Your booking tools remain available.",
      );
    if (status === "cancelled")
      return t(
        "billing.status.cancelledBody",
        "This membership is cancelled. Customer bookings are managed separately.",
      );
    if (status === "paused")
      return t(
        "billing.status.pausedBody",
        "This membership is paused. Your booking tools remain available.",
      );

    return t(
      "billing.status.notConfiguredBody",
      "Mirëbook Business is currently available for early partners.",
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
          t("billing.error.load", "Could not load membership details."),
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
      title={t("billing.pageTitle", "Membership")}
      subtitle={
        selectedBusiness
          ? selectedBusiness.name
          : t("billing.pageSubtitle", "Membership details.")
      }
    >
      {loading && (
        <div className="card">
          <p className="muted">
            {t("billing.loading", "Loading membership details...")}
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
                  "Membership checkout complete",
                )}
              </h3>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {billing.billing_status === "active"
                  ? t(
                      "billing.checkout.successSyncedBody",
                      "Mirëbook has synced the active membership status.",
                    )
                  : t(
                      "billing.checkout.successPendingBody",
                      "Membership checkout was accepted. Status may take a moment to sync.",
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
                  "No membership checkout was started. Your Mirëbook access has not changed.",
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
                  "Membership details are being prepared",
                )}
              </h3>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {t(
                  "billing.manualSetupPendingBody",
                  "Your business can keep using bookings, staff tools and its public listing during the early partner period.",
                )}
              </p>
            </div>
          )}

          <div className="card membership-summary-card">
            <div>
              <p className="small muted">
                {t("billing.subscriptionStatus", "Membership status")}
              </p>
              <h2>{statusLabel(billing.billing_status)}</h2>
              <p className="small muted">
                {statusBody(billing.billing_status)}
              </p>
            </div>

            <div className="membership-summary-details">
              <div>
                <span className="small muted">
                  {t("billing.agreedPrice", "Agreed monthly price")}
                </span>
                <strong>
                  {monthlyPrice || t("billing.priceNotSet", "Not agreed yet")}
                </strong>
              </div>
              <div>
                <span className="small muted">
                  {t("billing.offerStatus", "Offer")}
                </span>
                <strong>
                  {billing.founding_business
                    ? t("billing.foundingBusiness", "Founding business")
                    : t("billing.standardLaunch", "Launch plan")}
                </strong>
              </div>
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
              <h2>
                {t("billing.includedTitle", "Included in Mirëbook Launch")}
              </h2>
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
              <h2>{t("billing.onlinePaymentsTitle", "Plans")}</h2>
              <p className="muted" style={{ marginTop: "0.65rem" }}>
                {t(
                  "billing.onlinePaymentsBody",
                  "Mirëbook Business is available for early partners. Customer bookings stay separate from membership.",
                )}
              </p>
              <p className="small muted" style={{ marginTop: "1rem" }}>
                {t(
                  "billing.noAccessRestriction",
                  "Bookings, staff access and your public listing remain available.",
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
                  ? t("billing.checkout.starting", "Opening checkout...")
                  : billing.billing_status === "active"
                    ? t("billing.checkout.runAgain", "Run membership checkout")
                    : t("billing.checkout.start", "Start membership checkout")}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .billing-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .membership-summary-card {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
          gap: 0.85rem;
          align-items: center;
          margin-bottom: 1rem;
          padding: 1rem;
        }

        .membership-summary-card h2,
        .membership-summary-card p {
          margin-top: 0;
        }

        .membership-summary-details {
          display: grid;
          gap: 0.5rem;
        }

        .membership-summary-details div {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.6rem 0.7rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
        }

        .billing-date-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .billing-feature-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.45rem 1rem;
          margin: 0.75rem 0 0;
          padding-left: 1.2rem;
          color: var(--muted);
          font-size: 0.9rem;
        }

        .billing-grid :global(.card) {
          padding: 1rem;
        }

        @media (max-width: 760px) {
          .billing-grid,
          .membership-summary-card,
          .billing-date-grid {
            width: 100%;
          }

          .billing-grid,
          .membership-summary-card,
          .billing-date-grid {
            grid-template-columns: 1fr;
          }

          .membership-summary-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .membership-summary-details div {
            display: grid;
            gap: 0.2rem;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
