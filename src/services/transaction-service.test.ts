import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  approveTransactionChange,
  approveTransaction,
  deleteOrRequestTransaction,
  deleteTransaction,
  updateTransaction,
  applyBalance,
  createTransaction,
} from "@/services/transaction-service";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { refreshHistoricalCardStatements } from "@/services/credit-card-statement-service";

vi.mock("@/services/credit-card-statement-service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/credit-card-statement-service")>(),
  refreshHistoricalCardStatements: vi.fn().mockResolvedValue(undefined),
}));

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

describe("admin credit card payment deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "admin-member", role: { code: "ADMIN" },
    } as Awaited<ReturnType<typeof requireWorkspaceMember>>);
  });

  function paymentClient(status: "approved" | "pending" | "scheduled" | "rejected" = "approved") {
    const record = {
      ...transaction, id: "payment-1", memberId: "another-member", walletId: "card-1",
      purpose: "credit_card_payment", type: "transfer", workflowStatus: status,
      amount: new Decimal("100.0001"), creditCardStatementId: "statement-1",
      wallet: { kind: "credit_card" }, creditCardStatement: { id: "statement-1" },
    };
    const sources = [
      { sourceWalletId: "source-1", amount: new Decimal("60.0001") },
      { sourceWalletId: "source-2", amount: new Decimal("40") },
    ];
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      transaction: {
        findFirst: vi.fn().mockResolvedValue(record),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      workspaceWallet: { findMany: vi.fn().mockResolvedValue(walletLinks()) },
      wallet: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal("100.0001") }),
        update: vi.fn().mockResolvedValue({}),
      },
      creditCardPaymentSource: { findMany: vi.fn().mockResolvedValue(sources) },
      creditCardPaymentAllocation: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      creditCardPaymentReservation: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "statement-1", status: "paid", payments: [],
          items: sources.map((source, index) => ({
            obligationEntryId: `obligation-${index}`, fundingWalletId: source.sourceWalletId,
            amount: source.amount, createdAt: new Date("2026-07-01"),
          })),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      creditCardInstallmentPlan: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue(sources.map((source, index) => ({
          id: `obligation-${index}`, fundingWalletId: source.sourceWalletId,
          amount: source.amount, paymentAllocations: [],
        }))),
        deleteMany: vi.fn(),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      (callback as (client: unknown) => Promise<unknown>)(tx));
    return tx;
  }

  function walletLinks() {
    return ["card-1", "source-1", "source-2"].map((walletId) => ({ walletId }));
  }

  it("reverses an approved payment from multiple wallets and reopens the statement and completed plans", async () => {
    const tx = paymentClient();
    await expect(deleteOrRequestTransaction("admin", "workspace-1", "payment-1", ""))
      .resolves.toEqual({ kind: "deleted", id: "payment-1" });
    expect(tx.wallet.update.mock.calls.map(([update]) => [update.where.id, update.data.currentBalance.increment.toString()]))
      .toEqual([["source-1", "60.0001"], ["source-2", "40"], ["card-1", "100.0001"]]);
    expect(tx.creditCardPaymentAllocation.deleteMany).toHaveBeenCalledWith({ where: { paymentTransactionId: "payment-1" } });
    expect(tx.creditCardStatement.update).toHaveBeenCalledWith({
      where: { id: "statement-1" }, data: { status: "issued", paidAt: null },
    });
    expect(tx.creditCardInstallmentPlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "active", completedAt: null },
    }));
    expect(tx.creditCardObligationEntry.deleteMany).not.toHaveBeenCalled();
    expect(refreshHistoricalCardStatements).toHaveBeenCalledWith(tx, "workspace-1", "card-1", "2026-07-20");
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "transaction.deleted", metadata: { workflowStatus: "approved", balanceReversed: true } }),
    }));
  });

  it("preserves other partial payments on the same statement", async () => {
    const tx = paymentClient();
    const statement = await tx.creditCardStatement.findUnique();
    statement.payments = [{
      creditCardPaymentSources: [{ sourceWalletId: "source-1", amount: new Decimal("20") }],
      creditCardPaymentAllocations: [{ obligationEntryId: "obligation-0", amount: new Decimal("20") }],
    }] as never;
    tx.wallet.findUniqueOrThrow.mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal("80.0001") });
    const obligations = await tx.creditCardObligationEntry.findMany();
    obligations[0].paymentAllocations = [{ amount: new Decimal("20") }] as never;
    await deleteOrRequestTransaction("admin", "workspace-1", "payment-1", "");
    expect(tx.creditCardPaymentAllocation.deleteMany).toHaveBeenCalledWith({ where: { paymentTransactionId: "payment-1" } });
    expect(tx.creditCardStatement.update).toHaveBeenCalledWith({ where: { id: "statement-1" }, data: { status: "issued", paidAt: null } });
  });

  it.each(["pending", "scheduled", "rejected"] as const)("deletes a %s payment without changing balances", async (status) => {
    const tx = paymentClient(status);
    await deleteOrRequestTransaction("admin", "workspace-1", "payment-1", "");
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.creditCardStatement.update).not.toHaveBeenCalled();
    expect(tx.creditCardInstallmentPlan.updateMany).not.toHaveBeenCalled();
    expect(tx.creditCardPaymentReservation.updateMany).toHaveBeenCalledWith({
      where: { paymentTransactionId: "payment-1", releasedAt: null }, data: { releasedAt: expect.any(Date) },
    });
  });

  it("prevents a member from deleting or requesting deletion of a card payment", async () => {
    const tx = paymentClient();
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "another-member", role: { code: "MEMBER" },
    } as Awaited<ReturnType<typeof requireWorkspaceMember>>);
    await expect(deleteOrRequestTransaction("member", "workspace-1", "payment-1", "Nhập nhầm"))
      .rejects.toThrow("Giao dịch thẻ chuyên biệt không thể xóa trực tiếp.");
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("rejects payment sources outside the workspace before changing money", async () => {
    const tx = paymentClient();
    tx.workspaceWallet.findMany.mockResolvedValue([{ walletId: "card-1" }]);
    await expect(deleteOrRequestTransaction("admin", "workspace-1", "payment-1", ""))
      .rejects.toThrow("Thẻ hoặc ví thanh toán không thuộc nhóm này.");
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("does not reverse the balance twice if the delete has already been claimed", async () => {
    const tx = paymentClient();
    tx.transaction.updateMany.mockResolvedValue({ count: 0 });
    await expect(deleteOrRequestTransaction("admin", "workspace-1", "payment-1", ""))
      .rejects.toThrow("Giao dịch đã được xóa trước đó.");
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("rejects a transaction outside the workspace", async () => {
    const tx = paymentClient();
    tx.transaction.findFirst.mockResolvedValue(null as never);
    await expect(deleteOrRequestTransaction("admin", "workspace-1", "payment-1", ""))
      .rejects.toThrow("Không tìm thấy giao dịch trong nhóm này.");
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("supports the admin bulk-delete entry point", async () => {
    const tx = paymentClient();
    await expect(deleteTransaction("admin", "workspace-1", "payment-1"))
      .resolves.toEqual({ kind: "deleted", id: "payment-1" });
    expect(requireWorkspaceMember).toHaveBeenCalledWith("admin", "workspace-1", true);
    expect(tx.wallet.update).toHaveBeenCalledTimes(3);
  });

  it("rejects a reversal that would leave the cached debt inconsistent with obligations", async () => {
    const tx = paymentClient();
    tx.wallet.findUniqueOrThrow.mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal("999") });
    await expect(deleteOrRequestTransaction("admin", "workspace-1", "payment-1", ""))
      .rejects.toThrow("Dư nợ cache của thẻ lệch obligation ledger; giao dịch đã bị hủy.");
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("historical purchase creation", () => {
  it.each(["ADMIN", "MEMBER"])("refreshes billing only when a %s purchase is approved", async (role) => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1", role: { code: role }, workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as Awaited<ReturnType<typeof requireWorkspaceMember>>);
    const record = {
      ...transaction, walletId: "card-1", purpose: "standard", workflowStatus: role === "ADMIN" ? "approved" : "pending",
      creditCardAllocations: [{ fundingWalletId: "source-1", amount: new Decimal("125000") }],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: { findMany: vi.fn().mockImplementation(({ where }) => where.walletId.in.map((walletId: string) => ({
        walletId, wallet: walletId === "card-1"
          ? { kind: "credit_card", creditCardProfile: { defaultFundingWalletId: "source-1" } }
          : { kind: "asset" },
      }))) },
      category: { findFirst: vi.fn().mockResolvedValue({ id: "category-1", type: "expense", jarCode: "NEC" }) },
      transaction: { create: vi.fn().mockResolvedValue(record), findFirst: vi.fn().mockResolvedValue(record) },
      creditCardAllocation: { deleteMany: vi.fn(), createMany: vi.fn() },
      creditCardObligationEntry: {
        upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: "obligation-1", amount: new Decimal("125000"), paymentAllocations: [] }]),
      },
      wallet: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal("125000") }) },
      auditLog: { create: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      (callback as (client: unknown) => Promise<unknown>)(tx));
    await createTransaction("user-1", "workspace-1", {
      walletId: "card-1", type: "expense", categoryId: "category-1",
      amount: new Decimal("125000"), date: "2026-06-20",
    });
    if (role === "ADMIN") {
      expect(refreshHistoricalCardStatements).toHaveBeenCalledWith(tx, "workspace-1", "card-1", "2026-07-27");
      expect(tx.creditCardObligationEntry.upsert).toHaveBeenCalled();
    } else {
      expect(refreshHistoricalCardStatements).not.toHaveBeenCalled();
      expect(tx.wallet.update).not.toHaveBeenCalled();
    }
  });
});

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

    it("allows editing a paid historical purchase while preserving the original payment allocations", async () => {
      const paidStatementItem = {
        ...creditCardTransaction,
        creditCardObligationEntries: [
          {
            id: "obl-1",
            paymentAllocations: [{ id: "payment-allocation-1" }],
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
          findFirst: vi.fn().mockResolvedValueOnce(paidStatementItem).mockResolvedValueOnce(paidStatementItem).mockResolvedValue({
            ...creditCardTransaction,
            amount: new Decimal("200000"), workflowStatus: "approved",
            creditCardAllocations: [{ fundingWalletId: "wallet-asset-1", amount: new Decimal("200000") }],
          }),
          update: vi.fn().mockResolvedValue({ ...creditCardTransaction, amount: new Decimal("200000"), workflowStatus: "approved" }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
        },
        wallet: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: "credit_card", currentBalance: new Decimal("75000") }),
          update: vi.fn().mockResolvedValue({}),
        },
        creditCardObligationEntry: {
          update: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          upsert: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([
            { id: "obl-1", amount: new Decimal(0), fundingWalletId: "wallet-asset-1", paymentAllocations: [{ amount: new Decimal("125000") }] },
            { id: "obl-2", amount: new Decimal("200000"), fundingWalletId: "wallet-asset-1", paymentAllocations: [] },
          ]),
        },
        creditCardStatementItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        creditCardAllocation: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
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
      ).resolves.toEqual({ kind: "updated", id: "transaction-1" });
      expect(tx.creditCardObligationEntry.update).toHaveBeenCalledWith({
        where: { id: "obl-1" }, data: { amount: new Decimal(0), idempotencyKey: "retired:obl-1" },
      });
      expect(refreshHistoricalCardStatements).toHaveBeenCalledWith(tx, "workspace-1", "card-1", "2026-07-27");
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
        where: { transactionId: "transaction-1", paymentAllocations: { none: {} } },
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
        tx as unknown as Parameters<typeof applyBalance>[0],
        {
          id: "tx-transfer-1",
          type: "transfer",
          purpose: "standard",
          amount: new Decimal("500000"),
          walletId: "card-1",
          toWalletId: "wallet-asset-1",
        } as unknown as Parameters<typeof applyBalance>[1],
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
        tx as unknown as Parameters<typeof applyBalance>[0],
        {
          id: "tx-transfer-1",
          type: "transfer",
          purpose: "standard",
          amount: new Decimal("500000"),
          walletId: "card-1",
          toWalletId: "wallet-asset-1",
        } as unknown as Parameters<typeof applyBalance>[1],
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

    it("allows credit card expense exceeding credit limit", async () => {
      const tx = {
        wallet: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            kind: "credit_card",
            currentBalance: new Decimal(19000000),
            creditCardProfile: { creditLimit: new Decimal(20000000) },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      await expect(
        applyBalance(
          tx as unknown as Parameters<typeof applyBalance>[0],
          {
            id: "tx-overlimit-1",
            type: "expense",
            purpose: "standard",
            amount: new Decimal("3000000"), // 19M + 3M = 22M > 20M limit
            walletId: "card-1",
          } as unknown as Parameters<typeof applyBalance>[1],
        ),
      ).resolves.toBeUndefined();

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { increment: expect.any(Decimal) } },
      });
    });

    it("allows credit card transfer exceeding credit limit", async () => {
      const tx = {
        wallet: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            kind: "credit_card",
            currentBalance: new Decimal(19500000),
            creditCardProfile: { creditLimit: new Decimal(20000000) },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      await expect(
        applyBalance(
          tx as unknown as Parameters<typeof applyBalance>[0],
          {
            id: "tx-overlimit-transfer-1",
            type: "transfer",
            purpose: "standard",
            amount: new Decimal("2000000"), // 19.5M + 2M = 21.5M > 20M limit
            walletId: "card-1",
            toWalletId: "wallet-asset-1",
          } as unknown as Parameters<typeof applyBalance>[1],
        ),
      ).resolves.toBeUndefined();

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { currentBalance: { increment: expect.any(Decimal) } },
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-asset-1" },
        data: { currentBalance: { increment: expect.any(Decimal) } },
      });
    });
  });
});


