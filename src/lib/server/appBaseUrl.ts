export function getAppBaseUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configuredUrl) {
    return process.env.NODE_ENV === "production"
      ? null
      : "http://localhost:3000";
  }

  try {
    const parsed = new URL(configuredUrl);
    const allowedProtocol =
      parsed.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && parsed.protocol === "http:");

    if (!allowedProtocol || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}
