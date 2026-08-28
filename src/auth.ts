import argon2 from "argon2";
import { cookies, headers } from "next/headers";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { normalizeHostname } from "@/lib/host-routing";
import { isPortalHostname } from "@/lib/host-routing";
import { isSignInAllowedOnHostname } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import {
  hasCurrentLegalConsent,
  isLegalConsentEnforced,
} from "@/domain/legal-policy/policy-versions";
import {
  consumeProfileCompletionGrant,
  GOOGLE_INTENT_COOKIE,
  resolveGoogleSignIn,
  type VerifiedGoogleProfile,
} from "@/services/google-auth-service";
import { getLegalConsentStatus } from "@/services/legal-consent-service";

export const REMEMBERED_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

type GoogleOAuthProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: REMEMBERED_SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember me", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.username || !credentials.password) return null;
        const user = await prisma.user.findFirst({
          where: { username: credentials.username, status: "active", deletedAt: null },
        });
        if (!user?.username || !user.passwordHash || !(await argon2.verify(user.passwordHash, credentials.password))) return null;

        const forwardedHost = request.headers?.["x-forwarded-host"];
        const requestHost = normalizeHostname(
          Array.isArray(forwardedHost)
            ? forwardedHost[0]
            : forwardedHost ?? request.headers?.host,
        );
        if (!isSignInAllowedOnHostname(user.username, requestHost)) {
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          profileCompleted: Boolean(user.profileCompletedAt),
        };
      },
    }),
    CredentialsProvider({
      id: "google-profile-complete",
      name: "Google profile completion",
      credentials: { token: { label: "Token", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        const user = await consumeProfileCompletionGrant(credentials.token);
        if (!user?.username) return null;
        return { id: user.id, username: user.username, profileCompleted: true };
      },
    }),
    ...(googleAuthEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const google = profile as GoogleOAuthProfile | undefined;
      if (!google?.sub || !google.email || google.email_verified !== true) return false;

      const headerStore = await headers();
      const hostname = normalizeHostname(
        headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
      );
      const cookieStore = await cookies();
      const intentToken = cookieStore.get(GOOGLE_INTENT_COOKIE)?.value;
      const verifiedProfile: VerifiedGoogleProfile = {
        providerAccountId: google.sub,
        email: google.email,
        displayName: google.name ?? null,
        imageUrl: google.picture ?? null,
      };
      let resolved;
      try {
        resolved = await resolveGoogleSignIn(verifiedProfile, {
          intentToken,
          allowCreate: !isPortalHostname(hostname),
        });
      } catch {
        if (intentToken) cookieStore.delete(GOOGLE_INTENT_COOKIE);
        return false;
      }

      if (
        resolved.user.username &&
        !isSignInAllowedOnHostname(resolved.user.username, hostname)
      ) return false;
      if (isPortalHostname(hostname) && !resolved.user.username) return false;

      user.id = resolved.user.id;
      user.username = resolved.user.username;
      user.profileCompleted = Boolean(resolved.user.profileCompletedAt);
      if (resolved.intentKind !== "set_password") {
        cookieStore.delete(GOOGLE_INTENT_COOKIE);
      }
      return true;
    },
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        token.username = user.username;
        token.profileCompleted = user.profileCompleted;
      }
      if (token.sub && (user || trigger === "update")) {
        const consent = await getLegalConsentStatus(token.sub);
        token.acceptedPrivacyVersion = consent.acceptedPrivacyVersion;
        token.acceptedTermsVersion = consent.acceptedTermsVersion;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub) {
        session.user = {
          id: token.sub,
          username: token.username ?? null,
          profileCompleted: token.profileCompleted === true,
          legalConsentSatisfied:
            !isLegalConsentEnforced() ||
            hasCurrentLegalConsent(
              token.acceptedPrivacyVersion,
              token.acceptedTermsVersion,
            ),
        };
      }
      return session;
    },
  },
  pages: { signIn: "/sign-in" },
};
