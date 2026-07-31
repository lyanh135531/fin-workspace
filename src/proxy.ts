import { withAuth } from "next-auth/middleware";

export const proxy = withAuth({
  pages: {
    signIn: "/sign-in",
  },
});

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
  ],
};
