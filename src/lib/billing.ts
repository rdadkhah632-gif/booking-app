export const BILLING_STATUSES = [
  "not_configured",
  "free_trial",
  "founding_free",
  "active",
  "manual_comped",
  "past_due",
  "cancelled",
  "paused",
] as const;

export type BillingStatus = (typeof BILLING_STATUSES)[number];

export type BillingState = {
  id?: string;
  business_id: string;
  billing_status: BillingStatus;
  plan_name: string;
  price_amount: number | null;
  currency: string;
  trial_start: string | null;
  trial_end: string | null;
  founding_business: boolean;
  second_month_free_eligible: boolean;
  current_period_end: string | null;
  created_at?: string;
  updated_at?: string;
};

export function defaultBillingState(businessId: string): BillingState {
  return {
    business_id: businessId,
    billing_status: "not_configured",
    plan_name: "Mirëbook Launch",
    price_amount: null,
    currency: "GBP",
    trial_start: null,
    trial_end: null,
    founding_business: false,
    second_month_free_eligible: false,
    current_period_end: null,
  };
}

export function formatBillingAmount(
  amountMinor: number,
  currency = "GBP",
) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountMinor / 100).toFixed(2)}`;
  }
}
