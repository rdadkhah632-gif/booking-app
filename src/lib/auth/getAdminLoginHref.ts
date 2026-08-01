import { safeInternalRedirect } from "@/lib/safeInternalRedirect";

export function getAdminLoginHref(asPath: string, fallbackPath: string) {
  const destination = safeInternalRedirect(asPath);
  const adminDestination = destination?.startsWith("/admin")
    ? destination
    : fallbackPath;

  return `/login?redirectTo=${encodeURIComponent(adminDestination)}`;
}
