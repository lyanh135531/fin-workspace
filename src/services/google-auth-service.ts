import { createHash, randomBytes } from "node:crypto";

import argon2 from "argon2";
import type { OAuthIntentKind } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_INTENT_COOKIE = "felix.google-intent";
export const OAUTH_INTENT_MAX_AGE_MS = 10 * 60 * 1000;

export type VerifiedGoogleProfile = {
  providerAccountId: string;
  email: string;
  displayName: string | null;
  imageUrl: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function activeUserWhere(id: string) {
  return { id, status: "active" as const, deletedAt: null };
}

export async function createOAuthIntent(
  userId: string,
  kind: OAuthIntentKind,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + OAUTH_INTENT_MAX_AGE_MS);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: activeUserWhere(userId),
      select: { id: true },
    });
    if (!user) throw new AppError("AUTHENTICATION_REQUIRED", "Phiên đăng nhập không còn hợp lệ.");

    await tx.oAuthLinkIntent.deleteMany({
      where: {
        userId,
        OR: [
          { kind, consumedAt: null },
          { expiresAt: { lte: new Date() } },
          { consumedAt: { not: null } },
        ],
      },
    });
    await tx.oAuthLinkIntent.create({
      data: { userId, kind, tokenHash: hashToken(token), expiresAt },
    });
  });

  return { token, expiresAt };
}

export async function resolveGoogleSignIn(
  profile: VerifiedGoogleProfile,
  options: { intentToken?: string | null; allowCreate: boolean },
) {
  if (options.intentToken) {
    return consumeGoogleIntent(options.intentToken, profile);
  }

  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: GOOGLE_PROVIDER,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (linked) {
    if (linked.user.status !== "active" || linked.user.deletedAt) {
      throw new AppError("FORBIDDEN", "Tài khoản Felix này không còn hoạt động.");
    }
    return { user: linked.user, intentKind: null };
  }

  if (!options.allowCreate) {
    throw new AppError("FORBIDDEN", "Hãy đăng ký hoặc liên kết Google trên ứng dụng Felix trước.");
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: null,
          passwordHash: null,
          profileCompletedAt: null,
        },
      });
      await tx.oAuthAccount.create({
        data: {
          userId: created.id,
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
          displayName: profile.displayName,
          imageUrl: profile.imageUrl,
        },
      });
      return created;
    });
    return { user, intentKind: null };
  } catch {
    const raced = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (!raced || raced.user.status !== "active" || raced.user.deletedAt) {
      throw new AppError("CONFLICT", "Không thể tạo tài khoản Google. Vui lòng thử lại.");
    }
    return { user: raced.user, intentKind: null };
  }
}

async function consumeGoogleIntent(
  token: string,
  profile: VerifiedGoogleProfile,
) {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.oAuthLinkIntent.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !intent ||
      intent.consumedAt ||
      intent.expiresAt.getTime() <= Date.now() ||
      intent.user.status !== "active" ||
      intent.user.deletedAt
    ) {
      throw new AppError("FORBIDDEN", "Yêu cầu xác minh Google đã hết hạn. Vui lòng thử lại.");
    }

    const incoming = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.providerAccountId,
        },
      },
    });

    if (intent.kind === "set_password") {
      if (!incoming || incoming.userId !== intent.userId) {
        throw new AppError("FORBIDDEN", "Bạn phải xác minh đúng tài khoản Google đang liên kết.");
      }
      await tx.oAuthLinkIntent.update({
        where: { id: intent.id },
        data: { verifiedAt: new Date() },
      });
      return { user: intent.user, intentKind: intent.kind };
    }

    if (incoming && incoming.userId !== intent.userId) {
      throw new AppError("CONFLICT", "Tài khoản Google này đã liên kết với một tài khoản Felix khác.");
    }

    const current = await tx.oAuthAccount.findUnique({
      where: { userId_provider: { userId: intent.userId, provider: GOOGLE_PROVIDER } },
    });
    if (intent.kind === "link" && current && current.providerAccountId !== profile.providerAccountId) {
      throw new AppError("CONFLICT", "Tài khoản Felix đã có một liên kết Google.");
    }

    if (!incoming) {
      if (current) await tx.oAuthAccount.delete({ where: { id: current.id } });
      await tx.oAuthAccount.create({
        data: {
          userId: intent.userId,
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
          displayName: profile.displayName,
          imageUrl: profile.imageUrl,
        },
      });
    } else {
      await tx.oAuthAccount.update({
        where: { id: incoming.id },
        data: { email: profile.email, displayName: profile.displayName, imageUrl: profile.imageUrl },
      });
    }

    await tx.oAuthLinkIntent.update({
      where: { id: intent.id },
      data: { verifiedAt: new Date(), consumedAt: new Date() },
    });
    return { user: intent.user, intentKind: intent.kind };
  });
}

export async function completeGoogleProfile(userId: string, username: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + OAUTH_INTENT_MAX_AGE_MS);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new AppError("CONFLICT", "Tên đăng nhập này đã được sử dụng.");
      }

      const updated = await tx.user.updateMany({
        where: {
          id: userId,
          status: "active",
          deletedAt: null,
          profileCompletedAt: null,
          oauthAccounts: { some: { provider: GOOGLE_PROVIDER } },
        },
        data: { username, profileCompletedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new AppError(
          "CONFLICT",
          "Hồ sơ Google đã được hoàn tất hoặc không còn hợp lệ.",
        );
      }

      await tx.oAuthLinkIntent.deleteMany({
        where: { userId, kind: "complete_profile", consumedAt: null },
      });
      await tx.oAuthLinkIntent.create({
        data: {
          userId,
          kind: "complete_profile",
          tokenHash: hashToken(token),
          expiresAt,
        },
      });
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError("CONFLICT", "Tên đăng nhập này đã được sử dụng.");
    }
    throw error;
  }

  return { token, expiresAt };
}

export async function consumeProfileCompletionGrant(token: string) {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.oAuthLinkIntent.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !intent || intent.kind !== "complete_profile" || intent.consumedAt ||
      intent.expiresAt.getTime() <= Date.now() || !intent.user.profileCompletedAt ||
      !intent.user.username || intent.user.status !== "active" || intent.user.deletedAt
    ) return null;
    await tx.oAuthLinkIntent.update({
      where: { id: intent.id },
      data: { consumedAt: new Date() },
    });
    return intent.user;
  });
}

export async function getAccountSecurityState(userId: string) {
  const user = await prisma.user.findFirst({
    where: activeUserWhere(userId),
    select: {
      passwordHash: true,
      oauthAccounts: {
        where: { provider: GOOGLE_PROVIDER },
        select: { email: true, displayName: true, imageUrl: true },
        take: 1,
      },
    },
  });
  if (!user) throw new AppError("AUTHENTICATION_REQUIRED", "Phiên đăng nhập không còn hợp lệ.");
  return {
    hasPassword: Boolean(user.passwordHash),
    googleAccount: user.oauthAccounts[0] ?? null,
  };
}

export async function beginGoogleLink(
  userId: string,
  password: string,
  kind: "link" | "replace",
) {
  const user = await prisma.user.findFirst({
    where: activeUserWhere(userId),
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
    throw new AppError("FORBIDDEN", "Mật khẩu hiện tại không đúng.");
  }
  return createOAuthIntent(userId, kind);
}

export async function beginGooglePasswordSetup(userId: string) {
  const state = await getAccountSecurityState(userId);
  if (state.hasPassword) throw new AppError("CONFLICT", "Tài khoản đã có mật khẩu Felix.");
  if (!state.googleAccount) throw new AppError("NOT_FOUND", "Tài khoản chưa liên kết Google.");
  return createOAuthIntent(userId, "set_password");
}

export async function setPasswordAfterGoogleVerification(
  userId: string,
  intentToken: string,
  newPassword: string,
) {
  const tokenHash = hashToken(intentToken);
  const passwordHash = await argon2.hash(newPassword);
  const result = await prisma.$transaction(async (tx) => {
    const intent = await tx.oAuthLinkIntent.findUnique({ where: { tokenHash } });
    if (
      !intent || intent.userId !== userId || intent.kind !== "set_password" ||
      !intent.verifiedAt || intent.consumedAt || intent.expiresAt.getTime() <= Date.now()
    ) return false;
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.oAuthLinkIntent.update({ where: { id: intent.id }, data: { consumedAt: new Date() } });
    return true;
  });
  if (!result) throw new AppError("FORBIDDEN", "Phiên xác minh Google đã hết hạn. Vui lòng thử lại.");
}

export async function unlinkGoogleAccount(userId: string, password: string) {
  const user = await prisma.user.findFirst({
    where: activeUserWhere(userId),
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
    throw new AppError("FORBIDDEN", "Mật khẩu hiện tại không đúng.");
  }
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.oAuthAccount.deleteMany({
      where: { userId, provider: GOOGLE_PROVIDER },
    });
    if (!deleted.count) {
      throw new AppError("NOT_FOUND", "Tài khoản chưa liên kết Google.");
    }
    await tx.oAuthLinkIntent.deleteMany({
      where: { userId, consumedAt: null },
    });
  });
}
