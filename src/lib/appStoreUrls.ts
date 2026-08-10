function configuredStoreUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getCustomerAppStoreUrl(): string | null {
  return configuredStoreUrl(process.env.NEXT_PUBLIC_CUSTOMER_APP_STORE_URL);
}

export function getBusinessAppStoreUrl(): string | null {
  return configuredStoreUrl(process.env.NEXT_PUBLIC_BUSINESS_APP_STORE_URL);
}

export function getPublicSiteOrigin(): string | null {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}
