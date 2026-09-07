import { safeInternalRedirect } from "@/lib/safeInternalRedirect";

export function getRoleLoginHref(asPath: string, fallbackPath: string) {
  const browserPath =
    typeof window === "undefined"
      ? null
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const destination =
    safeInternalRedirect(browserPath) ||
    safeInternalRedirect(asPath) ||
    fallbackPath;
  return `/login?redirectTo=${encodeURIComponent(destination)}`;
}
