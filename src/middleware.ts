import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Centralized route protection.
 *
 * Any route matching the `config.matcher` patterns below requires an
 * authenticated JWT session. Unauthenticated visitors are redirected to
 * the sign-in page.
 *
 * Public routes (/sign-in, /setup, /api/auth/*, /api/internal/*) are
 * excluded from the matcher and remain accessible without a session.
 */
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

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
  ],
};
