import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { createInitialWorkspaceForUser } from "@/services/workspace-service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const input = {
  name: "Tài chính cá nhân",
  description: "Không gian quản lý tài chính cá nhân",
  baseCurrency: "VND",
  timeZone: "Asia/Ho_Chi_Minh",
};

describe("createInitialWorkspaceForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing active workspace instead of creating another one", async () => {
    const workspace = { id: "workspace-existing", name: "Nhóm gia đình" };
    const tx = {
      workspaceMember: {
        findFirst: vi.fn().mockResolvedValue({ workspace }),
      },
      workspace: { create: vi.fn() },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await createInitialWorkspaceForUser("user-1", input);

    expect(result).toEqual({ workspace, created: false });
    expect(tx.workspace.create).not.toHaveBeenCalled();
  });

  it("creates the default workspace, wallet, membership and categories together", async () => {
    const workspace = { id: "workspace-new", name: input.name };
    const tx = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "user-1" }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: "role-admin" }),
      },
      workspace: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(workspace),
      },
      workspaceMember: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      wallet: {
        create: vi.fn().mockResolvedValue({ id: "wallet-main" }),
      },
      workspaceWallet: {
        create: vi.fn().mockResolvedValue({}),
      },
      category: {
        createMany: vi.fn().mockResolvedValue({ count: 11 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await createInitialWorkspaceForUser("user-1", input);

    expect(result).toEqual({ workspace, created: true });
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Tài chính cá nhân",
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
      }),
    });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-new",
        userId: "user-1",
        roleId: "role-admin",
      },
    });
    expect(tx.wallet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Ví chính",
        openingBalance: expect.anything(),
        currentBalance: expect.anything(),
      }),
    });
    expect(tx.workspaceWallet.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-new",
        walletId: "wallet-main",
      },
    });
    expect(tx.category.createMany).toHaveBeenCalled();
    const categoryData = tx.category.createMany.mock.calls[0]?.[0]?.data;
    expect(categoryData).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INCOME_SALARY", jarCode: null }),
      expect.objectContaining({ code: "EXPENSE_EDUCATION", jarCode: "DEVELOPMENT" }),
      expect.objectContaining({ code: "EXPENSE_SOCIAL_GIFTS", jarCode: "GIVING" }),
      expect.objectContaining({ code: "EXPENSE_INVESTMENT", jarCode: "INVESTMENT" }),
    ]));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-new",
        actorUserId: "user-1",
        action: "workspace.created",
      }),
    });
  });
});
