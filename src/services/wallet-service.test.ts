import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createWalletForWorkspace,
  setWalletStatusForWorkspace,
  softDeleteWalletForWorkspace,
  updateWalletForWorkspace,
} from "@/services/wallet-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: vi.fn(),
}));

vi.mock("@/lib/date", () => ({
  getBusinessDateInTimeZone: vi.fn(() => "2026-07-27"),
}));

function transactionClient(walletStatus: "active" | "deactive") {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workspaceWallet: {
      findFirst: vi.fn().mockResolvedValue({
        wallet: {
          id: "wallet-1",
          name: "Ví chính",
          status: walletStatus,
          currentBalance: "0",
        },
      }),
    },
    transaction: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    recurringTransaction: {
      count: vi.fn().mockResolvedValue(0),
    },
    wallet: {
      update: vi.fn().mockResolvedValue({
        id: "wallet-1",
        status: walletStatus,
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("wallet-service lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
  });

  it("blocks deactivation while any non-deleted recurring transaction uses the wallet", async () => {
    const tx = transactionClient("active");
    tx.recurringTransaction.count.mockResolvedValue(2);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      setWalletStatusForWorkspace(
        "admin-1",
        "workspace-1",
        "wallet-1",
        "deactive",
      ),
    ).rejects.toThrow(
      "Ví đang được sử dụng bởi 2 giao dịch định kỳ. Hãy đổi ví hoặc xóa giao dịch định kỳ liên quan trước.",
    );

    expect(tx.recurringTransaction.count).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        deletedAt: null,
        OR: [{ walletId: "wallet-1" }, { toWalletId: "wallet-1" }],
      },
    });
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("creates every wallet with a zero opening and current balance", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{}]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      wallet: {
        create: vi.fn().mockResolvedValue({ id: "wallet-new", name: "Tiền mặt" }),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await createWalletForWorkspace("admin-1", "workspace-1", {
      name: "Tiền mặt",
      description: "Chi tiêu hằng ngày",
    });

    const createData = tx.wallet.create.mock.calls[0][0].data;
    expect(createData.openingBalance.toString()).toBe("0");
    expect(createData.currentBalance.toString()).toBe("0");
    expect(tx.workspaceWallet.create).toHaveBeenCalledWith({
      data: { workspaceId: "workspace-1", walletId: "wallet-new" },
    });
  });

  it("funds a new wallet with an approved income transaction", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{}]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ walletId: "wallet-new" }]),
        create: vi.fn().mockResolvedValue({}),
      },
      wallet: {
        create: vi.fn().mockResolvedValue({ id: "wallet-new", name: "Ví lương" }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: "transaction-income",
          ...data,
          toWalletId: data.toWalletId ?? null,
        })),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await createWalletForWorkspace("admin-1", "workspace-1", {
      name: "Ví lương",
      description: undefined,
      funding: { type: "income", amount: new Decimal("2500000") },
    });

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: "wallet-new",
        toWalletId: null,
        type: "income",
        workflowStatus: "approved",
        description: "Tạo ví mới “Ví lương”",
      }),
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-new" },
      data: { currentBalance: { increment: expect.any(Decimal) } },
    });
  });

  it("funds a new wallet by transferring from an active workspace wallet", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{}]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { walletId: "wallet-source" },
          { walletId: "wallet-new" },
        ]),
        create: vi.fn().mockResolvedValue({}),
      },
      wallet: {
        create: vi.fn().mockResolvedValue({ id: "wallet-new", name: "Ví tiết kiệm" }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: "transaction-transfer",
          ...data,
          toWalletId: data.toWalletId ?? null,
        })),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await createWalletForWorkspace("admin-1", "workspace-1", {
      name: "Ví tiết kiệm",
      description: undefined,
      funding: {
        type: "transfer",
        amount: new Decimal("700000"),
        sourceWalletId: "wallet-source",
      },
    });

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: "wallet-source",
        toWalletId: "wallet-new",
        type: "transfer",
        workflowStatus: "approved",
        description: "Tạo ví mới “Ví tiết kiệm”",
      }),
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-source" },
      data: { currentBalance: { decrement: expect.any(Decimal) } },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-new" },
      data: { currentBalance: { increment: expect.any(Decimal) } },
    });
  });

  it("rejects a case-insensitive duplicate wallet name in the workspace", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{}]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue({ walletId: "wallet-existing" }),
        create: vi.fn(),
      },
      wallet: {
        create: vi.fn(),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      createWalletForWorkspace("admin-1", "workspace-1", {
        name: "tiền mặt",
        description: undefined,
      }),
    ).rejects.toThrow("Tên ví “tiền mặt” đã tồn tại trong workspace.");

    expect(tx.wallet.create).not.toHaveBeenCalled();
  });

  it("rejects renaming a wallet to another wallet's name", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{}]),
      workspaceWallet: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ walletId: "wallet-1" })
          .mockResolvedValueOnce({ walletId: "wallet-2" }),
      },
      wallet: {
        update: vi.fn(),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateWalletForWorkspace("admin-1", "workspace-1", {
        walletId: "wallet-1",
        name: "Ngân hàng",
      }),
    ).rejects.toThrow("Tên ví “Ngân hàng” đã tồn tại trong workspace.");

    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("reactivates a paused wallet without dependency checks", async () => {
    const tx = transactionClient("deactive");
    tx.wallet.update.mockResolvedValue({ id: "wallet-1", status: "active" });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await setWalletStatusForWorkspace(
      "admin-1",
      "workspace-1",
      "wallet-1",
      "active",
    );

    expect(tx.recurringTransaction.count).not.toHaveBeenCalled();
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: { status: "active" },
    });
  });

  it("soft-deletes a paused wallet while preserving its database record", async () => {
    const tx = transactionClient("deactive");
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await softDeleteWalletForWorkspace(
      "admin-1",
      "workspace-1",
      "wallet-1",
    );

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
        currentBalance: expect.any(Decimal),
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "workspace.wallet_deleted",
        entityId: "wallet-1",
        metadata: expect.objectContaining({
          softDeleted: true,
          settlementTransactionId: null,
        }),
      }),
    });
  });

  it("moves a positive balance out before soft-deleting the wallet", async () => {
    const tx = transactionClient("deactive");
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: {
          id: "wallet-1",
          name: "Ví cũ",
          status: "deactive",
          currentBalance: "125.5",
        },
      })
      .mockResolvedValueOnce({ walletId: "wallet-2" });
    tx.transaction.create.mockResolvedValue({ id: "settlement-1" });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await softDeleteWalletForWorkspace(
      "admin-1",
      "workspace-1",
      "wallet-1",
      "wallet-2",
    );

    const settlementData = tx.transaction.create.mock.calls[0][0].data;
    expect(settlementData).toEqual(expect.objectContaining({
      memberId: "member-1",
      walletId: "wallet-1",
      toWalletId: "wallet-2",
      type: "transfer",
      workflowStatus: "approved",
    }));
    expect(settlementData.amount.toString()).toBe("125.5");
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: { currentBalance: { decrement: expect.any(Decimal) } },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-2" },
      data: { currentBalance: { increment: expect.any(Decimal) } },
    });
  });

  it("moves money into a negative wallet before soft-deleting it", async () => {
    const tx = transactionClient("deactive");
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: {
          id: "wallet-1",
          name: "Ví âm",
          status: "deactive",
          currentBalance: "-40",
        },
      })
      .mockResolvedValueOnce({ walletId: "wallet-2" });
    tx.transaction.create.mockResolvedValue({ id: "settlement-2" });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await softDeleteWalletForWorkspace(
      "admin-1",
      "workspace-1",
      "wallet-1",
      "wallet-2",
    );

    const settlementData = tx.transaction.create.mock.calls[0][0].data;
    expect(settlementData.walletId).toBe("wallet-2");
    expect(settlementData.toWalletId).toBe("wallet-1");
    expect(settlementData.amount.toString()).toBe("40");
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-2" },
      data: { currentBalance: { decrement: expect.any(Decimal) } },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: { currentBalance: { increment: expect.any(Decimal) } },
    });
  });
});
