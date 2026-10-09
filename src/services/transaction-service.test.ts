import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  approveTransactionChange,
  approveTransaction,
  deleteOrRequestTransaction,
  updateTransaction,
  applyBalance,
  createTransaction,
} from "@/services/transaction-service";
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

const transaction = {
  id: "transaction-1",
  memberId: "member-1",
  walletId: "wallet-1",
  toWalletId: null,
  categoryId: null,
  type: "expense" as const,
  workflowStatus: "approved" as const,
  amount: "125000",
  description: "Chi phí đi lại",
  date: new Date("2026-07-20T00:00:00.000Z"),
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
  deletedAt: null,
  recurringTransactionId: null,
  recurringPeriod: null,
};

function requestClient(record = transaction) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    transaction: {
      findFirst: vi.fn().mockResolvedValue(record),
    },
    transactionChangeRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "change-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("transaction deletion approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending delete request for the member's own transaction", async () => {
    const tx = requestClient();
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await deleteOrRequestTransaction(
      "user-1",
      "workspace-1",
      "transaction-1",
      "Nhập nhầm giao dịch",
    );

    expect(result).toEqual({ kind: "requested", id: "change-1" });
    expect(tx.transactionChangeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionId: "transaction-1",
        requesterMemberId: "member-1",
        proposedData: {
          action: "delete",
          reason: "Nhập nhầm giao dịch",
        },
      }),
    });
  });

  it("prevents a member from requesting deletion of another member's transaction", async () => {
    const tx = requestClient({ ...transaction, memberId: "member-2" });
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(deleteOrRequestTransaction(
      "user-1",
      "workspace-1",
      "transaction-1",
      "Đã thông báo",
    )).rejects.toThrow("Bạn chỉ có thể gửi yêu cầu xóa giao dịch do mình tạo.");
    expect(tx.transactionChangeRequest.create).not.toHaveBeenCalled();
  });

  it("prevents a member from requesting changes to another member's transaction", async () => {
    const tx = {
      ...requestClient({ ...transaction, memberId: "member-2" }),
      workspaceWallet: { findMany: vi.fn() },
      category: { findFirst: vi.fn() },
    };
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(updateTransaction(
      "user-1",
      "workspace-1",
      "transaction-1",
      {
        walletId: "wallet-1",
        type: "income",
        amount: new Decimal("1000"),
        date: "2026-07-27",
      },
      "Sửa nhầm",
    )).rejects.toThrow("Bạn chỉ có thể gửi yêu cầu sửa giao dịch do mình tạo.");
    expect(tx.workspaceWallet.findMany).not.toHaveBeenCalled();
  });

  it("lets an admin approve deletion and reverses an approved expense", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      transactionChangeRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "change-1",
          transactionId: "transaction-1",
          proposedData: {
            action: "delete",
            reason: "Nhập nhầm giao dịch",
          },
          transaction,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(transaction),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "admin-member",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await approveTransactionChange(
      "admin-user",
      "workspace-1",
      "change-1",
      new Date("2026-07-27T00:00:00.000Z"),
    );

    expect(tx.transactionChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "change-1", status: "pending" },
      data: {
        status: "approved",
        reviewerMemberId: "admin-member",
        reviewedAt: new Date("2026-07-27T00:00:00.000Z"),
      },
    });
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "transaction-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    const balanceUpdate = tx.wallet.update.mock.calls[0]?.[0];
    expect(balanceUpdate.where).toEqual({ id: "wallet-1" });
    expect(balanceUpdate.data.currentBalance.increment).toBeInstanceOf(Decimal);
    expect(balanceUpdate.data.currentBalance.increment.toString()).toBe("125000");
  });

  it("schedules a future member transaction when an admin approves it", async () => {
    const future = {
      ...transaction,
      type: "income" as const,
      workflowStatus: "pending" as const,
      date: new Date("2026-07-30T00:00:00.000Z"),
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      transaction: {
        findFirst: vi.fn().mockResolvedValue(future),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...future, workflowStatus: "scheduled" }),
      },
      workspaceWallet: { findMany: vi.fn().mockResolvedValue([{ walletId: "wallet-1" }]) },
      category: { findFirst: vi.fn() },
      wallet: { update: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "admin-member",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await approveTransaction("admin-user", "workspace-1", "transaction-1");

    expect(tx.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workflowStatus: "scheduled" }),
    }));
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  describe("credit card transaction edit & delete", () => {
    const creditCardTransaction = {
      ...transaction,
      walletId: "card-1",
      wallet: { kind: "credit_card" as const, creditCardProfile: null },
      purpose: "standard",
      installmentPlan: null,
      creditCardStatement: null,
      refundTransactions: [],
      creditCardObligationEntries: [],
    };

    it("allows admin to delete an uncommitted approved credit card expense", async () => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(creditCardTransaction),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        wallet: {
          update: vi.fn().mockResolvedValue({}),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal(0) }),
        },
        creditCardObligationEntry: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        creditCardAllocation: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      const result = await deleteOrRequestTransaction("admin-user", "workspace-1", "transaction-1", "Xóa chi tiêu thẻ nhầm");
      expect(result).toEqual({ kind: "deleted", id: "transaction-1" });

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { decrement: expect.any(Decimal) } },
      });
      expect(tx.creditCardObligationEntry.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: "transaction-1" },
      });
      expect(tx.creditCardAllocation.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: "transaction-1" },
      });
    });

    it("prevents deleting credit card transaction if already statemented", async () => {
      const statemented = {
        ...creditCardTransaction,
        creditCardStatement: { id: "stmt-1" },
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(statemented),
        },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await expect(
        deleteOrRequestTransaction("admin-user", "workspace-1", "transaction-1", "Xóa"),
      ).rejects.toThrow("Giao dịch đã vào kế hoạch trả góp hoặc sao kê và không thể xóa.");
    });

    it("allows admin to delete credit card expense in an unpaid (issued) statement and recalculates statement total", async () => {
      const issuedStatementItem = {
        ...creditCardTransaction,
        creditCardObligationEntries: [
          {
            id: "obl-1",
            paymentAllocations: [],
            statementItems: [
              {
                id: "item-1",
                statementId: "stmt-issued-1",
                statement: { id: "stmt-issued-1", status: "issued" as const },
              },
            ],
          },
        ],
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(issuedStatementItem),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        wallet: {
          update: vi.fn().mockResolvedValue({}),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal(0) }),
        },
        creditCardStatementItem: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        creditCardStatement: {
          findUnique: vi.fn().mockResolvedValue({
            id: "stmt-issued-1",
            status: "issued",
            items: [],
            payments: [],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        creditCardObligationEntry: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        creditCardAllocation: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      const result = await deleteOrRequestTransaction("admin-user", "workspace-1", "transaction-1", "Xóa");
      expect(result).toEqual({ kind: "deleted", id: "transaction-1" });
      expect(tx.creditCardStatementItem.deleteMany).toHaveBeenCalledWith({
        where: { obligationEntry: { transactionId: "transaction-1" } },
      });
      expect(tx.creditCardStatement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "stmt-issued-1" },
        }),
      );
    });

    it("prevents deleting credit card transaction if in a paid statement", async () => {
      const paidStatementItem = {
        ...creditCardTransaction,
        creditCardObligationEntries: [
          {
            id: "obl-1",
            paymentAllocations: [],
            statementItems: [
              {
                id: "item-1",
                statementId: "stmt-paid-1",
                statement: { id: "stmt-paid-1", status: "paid" as const },
              },
            ],
          },
        ],
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(paidStatementItem),
        },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await expect(
        deleteOrRequestTransaction("admin-user", "workspace-1", "transaction-1", "Xóa"),
      ).rejects.toThrow("Giao dịch thuộc kỳ sao kê đã thanh toán và không thể xóa.");
    });

    it("allows admin to delete accidental credit_card_refund when unpaid", async () => {
      const refundTx = {
        ...creditCardTransaction,
        id: "refund-1",
        type: "income" as const,
        purpose: "credit_card_refund",
        amount: "50000",
        creditCardObligationEntries: [
          {
            id: "obl-refund-1",
            paymentAllocations: [],
            statementItems: [],
          },
        ],
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(refundTx),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        wallet: {
          update: vi.fn().mockResolvedValue({}),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal(50000) }),
        },
        creditCardStatementItem: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        creditCardObligationEntry: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([
            { id: "obl-orig", fundingWalletId: "asset-1", amount: new Decimal(50000), paymentAllocations: [] },
          ]),
        },
        creditCardAllocation: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      const result = await deleteOrRequestTransaction("admin-user", "workspace-1", "refund-1", "Bấm nhầm hoàn tiền");
      expect(result).toEqual({ kind: "deleted", id: "refund-1" });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { increment: expect.any(Decimal) } },
      });
    });

    it("prevents updating credit card transaction if in a paid statement", async () => {
      const paidStatementItem = {
        ...creditCardTransaction,
        creditCardObligationEntries: [
          {
            id: "obl-1",
            paymentAllocations: [],
            statementItems: [
              {
                id: "item-1",
                statementId: "stmt-paid-1",
                statement: { id: "stmt-paid-1", status: "paid" as const },
              },
            ],
          },
        ],
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(paidStatementItem),
          aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
        },
        workspaceWallet: {
          findMany: vi.fn().mockImplementation(({ where }: { where: { walletId: { in: string[] } } }) => {
            const inIds = where.walletId.in;
            const all = [
              {
                walletId: "card-1",
                wallet: {
                  kind: "credit_card",
                  currentBalance: new Decimal(0),
                  creditCardProfile: { creditLimit: new Decimal(10000000), defaultFundingWalletId: "wallet-asset-1" },
                },
              },
              {
                walletId: "wallet-asset-1",
                wallet: {
                  kind: "asset",
                  status: "active",
                  deletedAt: null,
                },
              },
            ];
            return Promise.resolve(all.filter((item) => inIds.includes(item.walletId)));
          }),
        },
        category: {
          findFirst: vi.fn().mockResolvedValue({ id: "cat-1", type: "expense", jarCode: "NEC" }),
        },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await expect(
        updateTransaction("admin-user", "workspace-1", "transaction-1", {
          walletId: "card-1",
          categoryId: "cat-1",
          amount: new Decimal("200000"),
          date: "2026-07-20",
          type: "expense",
          allocations: [{ walletId: "wallet-asset-1", amount: new Decimal("200000") }],
        }, "Sửa"),
      ).rejects.toThrow("Giao dịch thuộc kỳ sao kê đã thanh toán và không thể sửa.");
    });

    it("allows admin to update credit card transaction to an asset wallet", async () => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        transaction: {
          findFirst: vi.fn().mockResolvedValue(creditCardTransaction),
          update: vi.fn().mockResolvedValue({
            ...creditCardTransaction,
            walletId: "wallet-asset-1",
            amount: "150000",
          }),
        },
        workspaceWallet: {
          findMany: vi.fn().mockResolvedValue([
            { walletId: "wallet-asset-1", wallet: { kind: "asset" } },
          ]),
        },
        category: { findFirst: vi.fn().mockResolvedValue({ id: "cat-1", type: "expense", jarCode: "NEC" }) },
        wallet: {
          update: vi.fn().mockResolvedValue({}),
          findUniqueOrThrow: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
            if (where.id === "card-1") return Promise.resolve({ kind: "credit_card", currentBalance: new Decimal(0) });
            return Promise.resolve({ kind: "asset", currentBalance: new Decimal(500000) });
          }),
        },
        creditCardObligationEntry: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        creditCardAllocation: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "admin-member",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      const result = await updateTransaction(
        "admin-user",
        "workspace-1",
        "transaction-1",
        {
          walletId: "wallet-asset-1",
          categoryId: "cat-1",
          type: "expense",
          amount: new Decimal("150000"),
          date: "2026-07-20",
          allocations: [],
        },
        "Chuyển sang tiền mặt",
      );

      expect(result.kind).toBe("updated");
      // Reversed old card
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { decrement: expect.any(Decimal) } },
      });
      // Applied new asset wallet
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-asset-1" },
        data: { currentBalance: { decrement: expect.any(Decimal) } },
      });
      expect(tx.creditCardObligationEntry.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: "transaction-1" },
      });
    });
  });

  describe("credit card transfer", () => {
    it("increments debt on card and increments balance on destination asset wallet in applyBalance", async () => {
      const tx = {
        wallet: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            kind: "credit_card",
            currentBalance: new Decimal(100000),
            creditCardProfile: { creditLimit: new Decimal(20000000) },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      await applyBalance(
        tx as any,
        {
          id: "tx-transfer-1",
          type: "transfer",
          purpose: "standard",
          amount: new Decimal("500000"),
          walletId: "card-1",
          toWalletId: "wallet-asset-1",
        } as any,
      );

      // Card debt increased
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { increment: expect.any(Decimal) } },
      });
      // Asset wallet balance increased
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-asset-1" },
        data: { currentBalance: { increment: expect.any(Decimal) } },
      });
    });

    it("reverses credit card transfer correctly by decrementing both", async () => {
      const tx = {
        wallet: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            kind: "credit_card",
            currentBalance: new Decimal(600000),
            creditCardProfile: { creditLimit: new Decimal(20000000) },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      await applyBalance(
        tx as any,
        {
          id: "tx-transfer-1",
          type: "transfer",
          purpose: "standard",
          amount: new Decimal("500000"),
          walletId: "card-1",
          toWalletId: "wallet-asset-1",
        } as any,
        true, // reverse
      );

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { decrement: expect.any(Decimal) } },
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-asset-1" },
        data: { currentBalance: { decrement: expect.any(Decimal) } },
      });
    });

    it("rejects transferring money into a credit card", async () => {
      const tx = {
        workspaceWallet: {
          findMany: vi.fn().mockResolvedValue([
            { walletId: "wallet-asset-1", wallet: { kind: "asset" } },
            { walletId: "card-1", wallet: { kind: "credit_card" } },
          ]),
        },
      };

      (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "member-1",
        role: { code: "ADMIN" },
        workspace: { timeZone: "Asia/Ho_Chi_Minh" },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await expect(
        createTransaction("user-1", "workspace-1", {
          walletId: "wallet-asset-1",
          toWalletId: "card-1",
          type: "transfer",
          amount: new Decimal("500000"),
          date: "2026-07-27",
        }),
      ).rejects.toThrow("Không thể chuyển tiền vào thẻ tín dụng bằng chuyển khoản thông thường; hãy dùng tính năng thanh toán sao kê.");
    });
  });
});


