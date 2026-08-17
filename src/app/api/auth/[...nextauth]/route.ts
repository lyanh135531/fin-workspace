import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import {
  authOptions,
  REMEMBERED_SESSION_MAX_AGE_SECONDS,
} from "@/auth";
import {
  containsAuthSessionCookie,
  readRememberSessionPolicy,
  REMEMBER_SESSION_COOKIE,
  stripAuthSessionCookiePersistence,
  type RememberSessionPolicy,
} from "@/lib/auth-session-cookie";

const handler = NextAuth(authOptions);

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

function rememberCookie(policy: Exclude<RememberSessionPolicy, null>) {
  const persistent =
    policy === "persistent"
      ? `; Max-Age=${REMEMBERED_SESSION_MAX_AGE_SECONDS}`
      : "";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = policy === "persistent" ? "1" : "0";
  return `${REMEMBER_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${persistent}${secure}`;
}

function clearRememberCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${REMEMBER_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

function withCookiePolicy(
  response: Response,
  policy: RememberSessionPolicy,
  setPolicyCookie = false,
  clearPolicyCookie = false,
) {
  const setCookies = response.headers.getSetCookie();
  response.headers.delete("set-cookie");

  for (const setCookie of setCookies) {
    response.headers.append(
      "set-cookie",
      policy === "transient"
        ? stripAuthSessionCookiePersistence(setCookie)
        : setCookie,
    );
  }

  if (setPolicyCookie && policy && containsAuthSessionCookie(setCookies)) {
    response.headers.append("set-cookie", rememberCookie(policy));
  }
  if (clearPolicyCookie) {
    response.headers.append("set-cookie", clearRememberCookie());
  }

  return response;
}

async function resolveSignInPolicy(
  request: NextRequest,
): Promise<RememberSessionPolicy> {
  if (!request.nextUrl.pathname.endsWith("/callback/credentials")) {
    return readRememberSessionPolicy(request.headers.get("cookie"));
  }

  const formData = await request.clone().formData();
  return formData.get("rememberMe") === "true" ? "persistent" : "transient";
}

export async function GET(request: NextRequest, context: AuthRouteContext) {
  const response = await handler(request, context);
  const policy = readRememberSessionPolicy(request.headers.get("cookie"));
  return withCookiePolicy(response, policy);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const policy = await resolveSignInPolicy(request);
  const response = await handler(request, context);
  const isCredentialsCallback = request.nextUrl.pathname.endsWith(
    "/callback/credentials",
  );
  const isSignOut = request.nextUrl.pathname.endsWith("/signout");
  return withCookiePolicy(
    response,
    isSignOut ? null : policy,
    isCredentialsCallback,
    isSignOut,
  );
}
