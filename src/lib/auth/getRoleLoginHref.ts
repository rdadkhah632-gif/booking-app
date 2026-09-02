import { safeInternalRedirect } from "@/lib/safeInternalRedirect";

export function getRoleLoginHref(asPath: string, fallbackPath: string) {
  const destination = safeInternalRedirect(asPath) || fallbackPath;
  return `/login?redirectTo=${encodeURIComponent(destination)}`;
}
