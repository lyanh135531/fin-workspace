export { default } from "next-auth/middleware";

/**
 * Centralized route protection via NextAuth middleware.
 *
 * Any route matching the patterns below requires an authenticated session.
 * Unauthenticated visitors are redirected to the sign-in page automatically.
 *
 * Public routes (/sign-in, /setup, /api/auth/*, /api/internal/*) are
 * intentionally excluded from the matcher so they remain accessible.
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
  ],
};
