import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { sampleWorkspaceHeader } from "@/lib/workspace-context";

export const proxy = withAuth(
  function workspaceContextProxy(request) {
    const match = request.nextUrl.pathname.match(/^\/sample\/([^/]+)(?:\/|$)/);
    if (!match) return NextResponse.next();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(sampleWorkspaceHeader, decodeURIComponent(match[1]));
    return NextResponse.next({ request: { headers: requestHeaders } });
  },
  {
    pages: {
      signIn: "/sign-in",
    },
  },
);

/**
 * Protects authenticated workspace routes while keeping public authentication
 * and internal API routes outside the proxy boundary.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/overview/:path*",
    "/workspace/:path*",
    "/workspaces/:path*",
    "/wallets/:path*",
    "/members/:path*",
    "/settings/:path*",
    "/setting/:path*",
    "/recurring-transactions/:path*",
    "/sample/:path*",
  ],
};
