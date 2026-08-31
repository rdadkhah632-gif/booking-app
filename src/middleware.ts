import { NextRequest, NextResponse } from "next/server";
import { isBusinessAppHostname } from "./lib/appUrls";
import { LOCALE_COOKIE_NAME } from "./lib/i18n/types";

function requestedLocale(request: NextRequest) {
  const queryLocale = request.nextUrl.searchParams.get("locale");
  if (queryLocale === "en" || queryLocale === "sq") return queryLocale;

  const savedLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (savedLocale === "en" || savedLocale === "sq") return savedLocale;

  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (country === "AL") return "sq";

  const acceptedLanguages =
    request.headers.get("accept-language")?.toLowerCase() || "";
  if (acceptedLanguages.includes("sq")) return "sq";

  return null;
}

export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost =
    forwardedHost?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.hostname;

  const locale = requestedLocale(request);
  let response: NextResponse;

  if (
    request.nextUrl.pathname === "/" &&
    isBusinessAppHostname(requestHost)
  ) {
    const businessUrl = request.nextUrl.clone();
    businessUrl.pathname = "/business";
    response = NextResponse.rewrite(businessUrl);
  } else {
    response = NextResponse.next();
  }

  if (locale && request.cookies.get(LOCALE_COOKIE_NAME)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|icons|manifest.json|favicon.ico|.*\\..*).*)",
  ],
};
