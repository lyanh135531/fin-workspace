export const REMEMBER_SESSION_COOKIE = "felix.remember-session";

const nextAuthSessionCookiePattern =
  /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/i;

export type RememberSessionPolicy = "persistent" | "transient" | null;

export function readRememberSessionPolicy(
  cookieHeader: string | null,
): RememberSessionPolicy {
  if (!cookieHeader) return null;

  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REMEMBER_SESSION_COOKIE}=`))
    ?.slice(REMEMBER_SESSION_COOKIE.length + 1);

  if (value === "1") return "persistent";
  if (value === "0") return "transient";
  return null;
}

export function stripAuthSessionCookiePersistence(setCookie: string): string {
  if (!nextAuthSessionCookiePattern.test(setCookie)) return setCookie;

  return setCookie
    .replace(/;\s*Expires=[^;]*/gi, "")
    .replace(/;\s*Max-Age=[^;]*/gi, "");
}

export function containsAuthSessionCookie(setCookies: string[]): boolean {
  return setCookies.some((setCookie) =>
    nextAuthSessionCookiePattern.test(setCookie),
  );
}
