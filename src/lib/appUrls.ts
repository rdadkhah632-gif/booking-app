function configuredOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function appendPath(origin: string, path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${safePath}`;
}

function normaliseHostname(hostname: string): string {
  return hostname
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function getCustomerAppUrl(path = "/"): string {
  const origin = configuredOrigin(process.env.NEXT_PUBLIC_CUSTOMER_APP_URL);
  return origin ? appendPath(origin, path) : path;
}

export function getBusinessAppUrl(path = "/"): string {
  const origin = configuredOrigin(process.env.NEXT_PUBLIC_BUSINESS_APP_URL);
  if (origin) return appendPath(origin, path);
  return path === "/" ? "/business" : path;
}

export function isBusinessAppHostname(hostname: string): boolean {
  const normalisedHostname = normaliseHostname(hostname);
  if (!normalisedHostname) return false;

  const businessOrigin = configuredOrigin(
    process.env.NEXT_PUBLIC_BUSINESS_APP_URL,
  );

  if (businessOrigin) {
    return normalisedHostname === new URL(businessOrigin).hostname.toLowerCase();
  }

  return (
    normalisedHostname.startsWith("business.") &&
    normalisedHostname !== "business.localhost"
  );
}
