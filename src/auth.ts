import argon2 from "argon2";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { normalizeHostname } from "@/lib/host-routing";
import { isSignInAllowedOnHostname } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const REMEMBERED_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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
        if (!user || !(await argon2.verify(user.passwordHash, credentials.password))) return null;

        const forwardedHost = request.headers?.["x-forwarded-host"];
        const requestHost = normalizeHostname(
          Array.isArray(forwardedHost)
            ? forwardedHost[0]
            : forwardedHost ?? request.headers?.host,
        );
        if (!isSignInAllowedOnHostname(user.username, requestHost)) {
          return null;
        }

        return { id: user.id, username: user.username };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.username = user.username;
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub && token.username) session.user = { id: token.sub, username: token.username };
      return session;
    },
  },
  pages: { signIn: "/sign-in" },
};
