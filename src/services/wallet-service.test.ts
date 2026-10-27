import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createWalletForWorkspace,
  reconcileWalletBalanceForWorkspace,
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
        completedAt: null,
        approvalStatus: { not: "rejected" },
        OR: [{ walletId: "wallet-1" }, { toWalletId: "wallet-1" }],
      },
    });
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("creates a zero-balance wallet without a transaction when income funding is zero", async () => {
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
      funding: { type: "income", amount: new Decimal(0) },
    });

    const createData = tx.wallet.create.mock.calls[0][0].data;
    expect(createData.openingBalance.toString()).toBe("0");
    expect(createData.currentBalance.toString()).toBe("0");
    expect(tx.workspaceWallet.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        walletId: "wallet-new",
        sortOrder: 0,
      },
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
    ).rejects.toThrow("Tên ví “tiền mặt” đã tồn tại trong nhóm.");

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
    ).rejects.toThrow("Tên ví “Ngân hàng” đã tồn tại trong nhóm.");

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

  it("allows deactivating a funding wallet when its credit card purchase obligation is fully offset by a refund obligation", async () => {
    const tx = {
      ...transactionClient("active"),
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([
          { cardWalletId: "card-1", amount: new Decimal("100"), paymentAllocations: [] },
          { cardWalletId: "card-1", amount: new Decimal("-100"), paymentAllocations: [] },
        ]),
      },
    };
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
    ).resolves.toBeDefined();

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: { status: "deactive" },
    });
  });

  it("queries only gold lots with remainingQuantityChi > 0 so fully sold gold lots do not block wallet deactivation", async () => {
    const soldOutLots = [
      {
        workspaceId: "workspace-1",
        sourceWalletId: "wallet-1",
        fundingMode: "from_wallet",
        remainingQuantityChi: new Decimal(0),
        deletedAt: null,
      },
    ];
    const tx = {
      ...transactionClient("active"),
      goldPurchaseLot: {
        count: vi.fn().mockImplementation(({ where }) => {
          const matches = soldOutLots.filter(
            (lot) =>
              where?.remainingQuantityChi?.gt !== undefined
                ? lot.remainingQuantityChi.gt(where.remainingQuantityChi.gt)
                : true,
          );
          return Promise.resolve(matches.length);
        }),
      },
    };
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
    ).resolves.toBeDefined();

    expect(tx.goldPurchaseLot.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: "workspace-1",
        sourceWalletId: "wallet-1",
        fundingMode: "from_wallet",
        remainingQuantityChi: { gt: 0 },
      }),
    });

    // When an open gold lot still holds remainingQuantityChi > 0, deactivation is blocked
    tx.goldPurchaseLot.count.mockResolvedValueOnce(1);
    await expect(
      setWalletStatusForWorkspace(
        "admin-1",
        "workspace-1",
        "wallet-1",
        "deactive",
      ),
    ).rejects.toThrow("lô vàng");
  });
});

describe("reconcileWalletBalanceForWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-admin",
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
  });

  it("records a balance_only negative adjustment with purpose=balance_reconciliation and updates currentBalance", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue({
          wallet: {
            id: "wallet-cash",
            name: "Tiền mặt",
            kind: "asset",
            status: "active",
            currentBalance: "1500000",
          },
        }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: "tx-reconcile-1" }),
      },
      wallet: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await reconcileWalletBalanceForWorkspace(
      "admin-1",
      "workspace-1",
      {
        walletId: "wallet-cash",
        actualBalance: new Decimal("1350000"),
        mode: "balance_only",
        categoryId: null,
        note: "Tiền lẻ phát sinh chưa ghi",
      },
    );

    expect(requireWorkspaceMember).toHaveBeenCalledWith(
      "admin-1",
      "workspace-1",
      true,
    );
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: "member-admin",
        walletId: "wallet-cash",
        toWalletId: null,
        categoryId: null,
        jarCode: null,
        type: "expense",
        purpose: "balance_reconciliation",
        amount: new Decimal("150000"),
        description: "Đối soát số dư: Tiền lẻ phát sinh chưa ghi",
        workflowStatus: "approved",
      }),
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-cash" },
      data: { currentBalance: new Decimal("1350000") },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        actorUserId: "admin-1",
        action: "workspace.wallet_reconciled",
        entityId: "wallet-cash",
      }),
    });
    expect(result).toEqual({
      walletId: "wallet-cash",
      transactionId: "tx-reconcile-1",
      previousBalance: "1500000",
      actualBalance: "1350000",
      delta: "-150000",
      mode: "balance_only",
    });
  });

  it("records a record_cashflow expense adjustment using selected category and jar", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue({
          wallet: {
            id: "wallet-bank",
            name: "Techcombank",
            kind: "asset",
            status: "active",
            currentBalance: "2000000",
          },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            walletId: "wallet-bank",
            wallet: {
              kind: "asset",
              currentBalance: "2000000",
              creditCardProfile: null,
            },
          },
        ]),
      },
      category: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cat-food",
          type: "expense",
          jarCode: "NEC",
        }),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "tx-cashflow-1",
            ...data,
          }),
        ),
      },
      wallet: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      reconcileWalletBalanceForWorkspace("admin-1", "workspace-1", {
        walletId: "wallet-bank",
        actualBalance: new Decimal("1800000"),
        mode: "record_cashflow",
        categoryId: null,
      }),
    ).rejects.toThrow("danh mục chi tiêu");

    const result = await reconcileWalletBalanceForWorkspace(
      "admin-1",
      "workspace-1",
      {
        walletId: "wallet-bank",
        actualBalance: new Decimal("1800000"),
        mode: "record_cashflow",
        categoryId: "cat-food",
      },
    );

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: "wallet-bank",
        categoryId: "cat-food",
        jarCode: "NEC",
        type: "expense",
        amount: new Decimal("200000"),
        workflowStatus: "approved",
      }),
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-bank" },
      data: { currentBalance: { decrement: new Decimal("200000") } },
    });
    expect(result.delta).toBe("-200000");
    expect(result.mode).toBe("record_cashflow");
  });

  it("rejects zero delta, credit card wallets, and deactivated wallets", async () => {
    const makeTx = (walletOverrides: Record<string, unknown>) => ({
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue({
          wallet: {
            id: "wallet-1",
            name: "Ví test",
            kind: "asset",
            status: "active",
            currentBalance: "500000",
            ...walletOverrides,
          },
        }),
      },
      transaction: { create: vi.fn() },
      wallet: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    });

    const zeroTx = makeTx({});
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (cb: (client: typeof zeroTx) => unknown) => cb(zeroTx),
    );
    await expect(
      reconcileWalletBalanceForWorkspace("admin-1", "workspace-1", {
        walletId: "wallet-1",
        actualBalance: new Decimal("500000"),
        mode: "balance_only",
        categoryId: null,
      }),
    ).rejects.toThrow("khớp với số dư trên hệ thống");

    const creditTx = makeTx({ kind: "credit_card" });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (cb: (client: typeof creditTx) => unknown) => cb(creditTx),
    );
    await expect(
      reconcileWalletBalanceForWorkspace("admin-1", "workspace-1", {
        walletId: "wallet-1",
        actualBalance: new Decimal("600000"),
        mode: "balance_only",
        categoryId: null,
      }),
    ).rejects.toThrow("ví thanh toán");

    const deactiveTx = makeTx({ status: "deactive" });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (cb: (client: typeof deactiveTx) => unknown) => cb(deactiveTx),
    );
    await expect(
      reconcileWalletBalanceForWorkspace("admin-1", "workspace-1", {
        walletId: "wallet-1",
        actualBalance: new Decimal("600000"),
        mode: "balance_only",
        categoryId: null,
      }),
    ).rejects.toThrow("kích hoạt lại ví");
  });
});

