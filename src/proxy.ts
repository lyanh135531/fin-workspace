import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import {
  getHostnameRedirectTarget,
  isApplicationPath,
  normalizeHostname,
} from "@/lib/host-routing";
import { isLegalConsentEnforced } from "@/domain/legal-policy/policy-versions";
import { getAuthenticatedPrerequisiteRedirect } from "@/lib/legal-routing";

const authenticatedProxy = withAuth(
  function enforceAuthenticatedPrerequisites(request) {
    const token = request.nextauth.token!;
    const pathname = request.nextUrl.pathname;

    const prerequisiteRedirect = getAuthenticatedPrerequisiteRedirect({
      pathname,
      search: request.nextUrl.search,
      hostname: request.nextUrl.hostname,
      profileCompleted: token.profileCompleted,
      acceptedPrivacyVersion: token.acceptedPrivacyVersion,
      acceptedTermsVersion: token.acceptedTermsVersion,
      consentEnforced: isLegalConsentEnforced(),
    });
    if (prerequisiteRedirect) {
      return NextResponse.redirect(new URL(prerequisiteRedirect, request.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/sign-in" },
    callbacks: { authorized: ({ token }) => Boolean(token) },
  },
);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const forwardedHostname = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostname = normalizeHostname(
    forwardedHostname ?? request.headers.get("host") ?? request.nextUrl.hostname,
  );
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
    "/account/:path*",
    "/consent",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/overview/:path*",
    "/portal/:path*",
    "/workspace/:path*",
    "/workspaces/:path*",
    "/wallets/:path*",
    "/members/:path*",
    "/settings/:path*",
    "/setting/:path*",
    "/recurring-transactions/:path*",
    "/financial-plans/:path*",
  ],
};
