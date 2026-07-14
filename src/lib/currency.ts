import type { Locale } from "@/lib/i18n";

export type MirebookCurrency = "GBP" | "EUR" | "ALL" | "USD";

const SUPPORTED_CURRENCIES = new Set<MirebookCurrency>([
  "GBP",
  "EUR",
  "ALL",
  "USD",
]);

export function normalizeCurrency(
  currency?: string | null,
): MirebookCurrency {
  const normalized = currency?.trim().toUpperCase() as MirebookCurrency;
  return SUPPORTED_CURRENCIES.has(normalized) ? normalized : "GBP";
}

export function formatCurrencyAmount(
  amount: number,
  currency?: string | null,
  locale: Locale = "en",
) {
  const numericAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    style: "currency",
    currency: normalizeCurrency(currency),
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}
