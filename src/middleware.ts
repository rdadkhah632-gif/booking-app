import { NextRequest, NextResponse } from "next/server";
import { isBusinessAppHostname } from "./lib/appUrls";

export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost =
    forwardedHost?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.hostname;

  if (
    request.nextUrl.pathname === "/" &&
    isBusinessAppHostname(requestHost)
  ) {
    const businessUrl = request.nextUrl.clone();
    businessUrl.pathname = "/business";
    return NextResponse.rewrite(businessUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
