import argon2 from "argon2";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;
        const user = await prisma.user.findFirst({
          where: { username: credentials.username, status: "active", deletedAt: null },
        });
        if (!user || !(await argon2.verify(user.passwordHash, credentials.password))) return null;
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
