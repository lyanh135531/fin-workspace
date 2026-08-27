import { beforeEach, describe, expect, it, vi } from "vitest";
import argon2 from "argon2";

const mockPrisma = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  oAuthAccount: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  oAuthLinkIntent: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("new-hash"),
    verify: vi.fn().mockResolvedValue(false),
  },
}));

import {
  beginGoogleLink,
  completeGoogleProfile,
  resolveGoogleSignIn,
  unlinkGoogleAccount,
} from "@/services/google-auth-service";

const profile = {
  providerAccountId: "google-123",
  email: "verified@example.com",
  displayName: "Verified User",
  imageUrl: null,
};

describe("google auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
  });

  it("resolves an existing Google identity to the local Felix user", async () => {
    const user = {
      id: "user-1",
      username: "felix-user",
      passwordHash: "hash",
      profileCompletedAt: new Date(),
      status: "active",
      deletedAt: null,
    };
    mockPrisma.oAuthAccount.findUnique.mockResolvedValue({ userId: user.id, user });

    await expect(resolveGoogleSignIn(profile, { allowCreate: true })).resolves.toEqual({
      user,
      intentKind: null,
    });
  });

  it("does not create a new Google user when creation is forbidden on Portal", async () => {
    mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);

    await expect(resolveGoogleSignIn(profile, { allowCreate: false })).rejects.toThrow(
      "Hãy đăng ký hoặc liên kết Google trên ứng dụng Felix trước.",
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("creates a provisional user without username, password or workspace", async () => {
    const provisional = {
      id: "user-new",
      username: null,
      passwordHash: null,
      profileCompletedAt: null,
      status: "active",
      deletedAt: null,
    };
    mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(provisional);
    mockPrisma.oAuthAccount.create.mockResolvedValue({ id: "oauth-1" });

    await expect(resolveGoogleSignIn(profile, { allowCreate: true })).resolves.toEqual({
      user: provisional,
      intentKind: null,
    });
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: { username: null, passwordHash: null, profileCompletedAt: null },
    });
    expect(mockPrisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-new",
        provider: "google",
        providerAccountId: "google-123",
        email: "verified@example.com",
      }),
    });
  });

  it("rejects a username already owned by another Felix user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "another-user" });

    await expect(completeGoogleProfile("user-new", "taken-name")).rejects.toThrow(
      "Tên đăng nhập này đã được sử dụng.",
    );
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("completes the provisional profile and issues its login grant atomically", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.oAuthLinkIntent.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.oAuthLinkIntent.create.mockResolvedValue({ id: "grant-1" });

    const grant = await completeGoogleProfile("user-new", "chosen-name");

    expect(grant.token).toEqual(expect.any(String));
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "user-new",
        profileCompletedAt: null,
      }),
      data: {
        username: "chosen-name",
        profileCompletedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.oAuthLinkIntent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-new",
        kind: "complete_profile",
        tokenHash: expect.any(String),
      }),
    });
  });

  it("rejects linking a Google identity already owned by another Felix user", async () => {
    mockPrisma.oAuthLinkIntent.findUnique.mockResolvedValue({
      id: "intent-1",
      userId: "user-1",
      kind: "link",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user-1", status: "active", deletedAt: null },
    });
    mockPrisma.oAuthAccount.findUnique.mockResolvedValue({
      id: "oauth-other",
      userId: "user-2",
      providerAccountId: profile.providerAccountId,
    });

    await expect(
      resolveGoogleSignIn(profile, { intentToken: "secret-intent", allowCreate: true }),
    ).rejects.toThrow("Tài khoản Google này đã liên kết với một tài khoản Felix khác.");
  });

  it("requires the current password before creating a link intent", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ passwordHash: "existing-hash" });

    await expect(beginGoogleLink("user-1", "wrong-password", "link")).rejects.toThrow(
      "Mật khẩu hiện tại không đúng.",
    );
    expect(mockPrisma.oAuthLinkIntent.create).not.toHaveBeenCalled();
  });

  it("invalidates pending OAuth intents when Google is unlinked", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ passwordHash: "existing-hash" });
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);
    mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.oAuthLinkIntent.deleteMany.mockResolvedValue({ count: 2 });

    await unlinkGoogleAccount("user-1", "correct-password");

    expect(mockPrisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", provider: "google" },
    });
    expect(mockPrisma.oAuthLinkIntent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", consumedAt: null },
    });
  });
});
