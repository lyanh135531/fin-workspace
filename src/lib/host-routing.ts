export const MARKETING_HOSTNAME = "felixwise.io.vn";
export const APP_HOSTNAME = "app.felixwise.io.vn";
export const APP_ORIGIN = `https://${APP_HOSTNAME}`;

const applicationPathPrefixes = [
  "/dashboard",
  "/members",
  "/onboarding",
  "/overview",
  "/recurring-transactions",
  "/setting",
  "/settings",
  "/setup",
  "/sign-in",
  "/wallets",
  "/workspace",
  "/workspaces",
] as const;

function isPathWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isApplicationPath(pathname: string) {
  return applicationPathPrefixes.some((prefix) =>
    isPathWithin(pathname, prefix),
  );
}

export function getHostnameRedirectTarget(
  hostname: string,
  pathname: string,
): string | null {
  const normalizedHostname = hostname.toLowerCase();

  if (normalizedHostname === APP_HOSTNAME && pathname === "/") {
    return `${APP_ORIGIN}/overview`;
  }

  if (
    normalizedHostname === MARKETING_HOSTNAME &&
    isApplicationPath(pathname)
  ) {
    return `${APP_ORIGIN}${pathname}`;
  }

  return null;
}
