export const MARKETING_HOSTNAME = "felixwise.io.vn";
export const APP_HOSTNAME = "app.felixwise.io.vn";
export const PORTAL_HOSTNAME = "portal.felixwise.io.vn";
export const APP_ORIGIN = `https://${APP_HOSTNAME}`;
export const PORTAL_ORIGIN = `https://${PORTAL_HOSTNAME}`;

const applicationPathPrefixes = [
  "/dashboard",
  "/account",
  "/consent",
  "/financial-plans",
  "/members",
  "/onboarding",
  "/overview",
  "/portal",
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

export function normalizeHostname(hostname: string | null | undefined) {
  return (hostname ?? "")
    .split(",")[0]
    .trim()
    .replace(/:\d+$/, "")
    .toLowerCase();
}

export function isPortalHostname(hostname: string | null | undefined) {
  return normalizeHostname(hostname) === PORTAL_HOSTNAME;
}

export function getPostSignInPath(
  hostname: string,
  callbackUrl: string | undefined,
  currentOrigin: string,
) {
  const portalMode = isPortalHostname(hostname);
  const fallback = portalMode ? "/portal" : "/overview";
  if (!callbackUrl) return fallback;

  try {
    const target = new URL(callbackUrl, currentOrigin);
    if (target.origin !== currentOrigin) return fallback;

    const portalPath = isPathWithin(target.pathname, "/portal");
    if (portalMode !== portalPath) return fallback;

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function getPostConsentPath(
  hostname: string,
  callbackUrl: string | undefined,
  currentOrigin: string,
) {
  const fallback = isPortalHostname(hostname) ? "/portal" : "/overview";
  if (!callbackUrl) return fallback;

  try {
    const target = new URL(callbackUrl, currentOrigin);
    if (target.origin !== currentOrigin) return fallback;
    if (isPathWithin(target.pathname, "/consent")) return fallback;

    const portalPath = isPathWithin(target.pathname, "/portal");
    if (isPortalHostname(hostname) !== portalPath) return fallback;

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
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
  const normalizedHostname = normalizeHostname(hostname);
  const portalPath = isPathWithin(pathname, "/portal");

  if (normalizedHostname === PORTAL_HOSTNAME) {
    if (pathname === "/") return `${PORTAL_ORIGIN}/portal`;
    if (portalPath || pathname === "/sign-in" || pathname === "/consent") return null;
    if (isApplicationPath(pathname)) return `${PORTAL_ORIGIN}/portal`;
  }

  if (normalizedHostname === APP_HOSTNAME && pathname === "/") {
    return `${APP_ORIGIN}/overview`;
  }

  if (normalizedHostname === APP_HOSTNAME && portalPath) {
    return `${PORTAL_ORIGIN}${pathname}`;
  }

  if (normalizedHostname === MARKETING_HOSTNAME && portalPath) {
    return `${PORTAL_ORIGIN}${pathname}`;
  }

  if (
    normalizedHostname === MARKETING_HOSTNAME &&
    isApplicationPath(pathname)
  ) {
    return `${APP_ORIGIN}${pathname}`;
  }

  return null;
}
