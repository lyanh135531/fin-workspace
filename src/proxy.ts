import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import {
  getHostnameRedirectTarget,
  isApplicationPath,
} from "@/lib/host-routing";

const authenticatedProxy = withAuth({
  pages: {
    signIn: "/sign-in",
  },
});

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const forwardedHostname = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const requestHostname =
    forwardedHostname ?? request.headers.get("host") ?? request.nextUrl.hostname;
  const hostname = requestHostname.replace(/:\d+$/, "");
  const redirectTarget = getHostnameRedirectTarget(
    hostname,
    request.nextUrl.pathname,
  );

  if (redirectTarget) {
    const redirectUrl = new URL(redirectTarget);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 307);
  }

  if (!isApplicationPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname === "/sign-in" ||
    request.nextUrl.pathname === "/setup"
  ) {
    return NextResponse.next();
  }

  return authenticatedProxy(request as NextRequestWithAuth, event);
}

/**
 * Protects authenticated workspace routes while keeping public authentication
 * and internal API routes outside the proxy boundary.
 */
export const config = {
  matcher: [
    "/",
    "/sign-in",
    "/setup/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/overview/:path*",
    "/workspace/:path*",
    "/workspaces/:path*",
    "/wallets/:path*",
    "/members/:path*",
    "/settings/:path*",
    "/setting/:path*",
    "/recurring-transactions/:path*",
  ],
};
