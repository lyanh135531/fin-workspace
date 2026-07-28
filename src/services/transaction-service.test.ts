import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  approveTransactionChange,
  deleteOrRequestTransaction,
  importTransactions,
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
});

describe("transaction CSV import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates all rows atomically and applies aggregated wallet balances", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "00000000-0000-0000-0000-000000000101" },
          { walletId: "00000000-0000-0000-0000-000000000102" },
        ]),
      },
      category: {
        findMany: vi.fn().mockResolvedValue([{
          id: "00000000-0000-0000-0000-000000000201",
          name: "Ăn uống",
          code: "AN_UONG",
          type: "expense",
          status: "active",
          sortOrder: 0,
        }]),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      categoryAlias: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
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

    const result = await importTransactions("admin-user", "workspace-1", [
      {
        walletId: "00000000-0000-0000-0000-000000000101",
        categoryId: "00000000-0000-0000-0000-000000000201",
        type: "expense",
        amount: new Decimal(125),
        description: "Ăn tối",
        date: "2026-07-26",
      },
      {
        walletId: "00000000-0000-0000-0000-000000000101",
        toWalletId: "00000000-0000-0000-0000-000000000102",
        type: "transfer",
        amount: new Decimal(50),
        description: "Điều chuyển",
        date: "2026-07-27",
      },
    ], new Date("2026-07-27T10:00:00.000Z"));

    expect(result).toEqual({
      importedCount: 2,
      createdCategoryCount: 0,
      approved: 2,
      pending: 0,
      scheduled: 0,
      rejected: 0,
    });
    expect(tx.transaction.createMany).toHaveBeenCalledTimes(1);
    expect(tx.wallet.update).toHaveBeenCalledTimes(2);
    const sourceBalance = tx.wallet.update.mock.calls[0]?.[0].data.currentBalance.decrement;
    const destinationBalance = tx.wallet.update.mock.calls[1]?.[0].data.currentBalance.increment;
    expect(sourceBalance.toString()).toBe("175");
    expect(destinationBalance.toString()).toBe("50");
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "transaction.csv_imported",
        metadata: expect.objectContaining({ importedCount: 2, approved: 2 }),
      }),
    });
  });

  it("creates missing CSV categories before their transactions", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "00000000-0000-0000-0000-000000000101" },
        ]),
      },
      category: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: "00000000-0000-0000-0000-000000000301",
          name: "Chăm sóc thú cưng",
          code: "CHAM_SOC_THU_CUNG",
          type: "expense",
          status: "active",
          sortOrder: 0,
          parentId: null,
          mergedIntoId: null,
        }),
      },
      categoryAlias: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await importTransactions("user-1", "workspace-1", [{
      walletId: "00000000-0000-0000-0000-000000000101",
      categoryName: "Chăm sóc thú cưng",
      type: "expense",
      amount: new Decimal(250000),
      date: "2026-07-27",
    }], new Date("2026-07-27T10:00:00.000Z"));

    expect(result.createdCategoryCount).toBe(1);
    expect(tx.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Chăm sóc thú cưng",
        code: "CHAM_SOC_THU_CUNG",
        workspaceId: "workspace-1",
        type: "expense",
        parentId: null,
      }),
      select: expect.any(Object),
    });
    const transactionData = tx.transaction.createMany.mock.calls[0]?.[0].data[0];
    expect(transactionData.categoryId).toEqual(expect.any(String));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "category.csv_imported",
        metadata: expect.objectContaining({ createdCategoryCount: 1 }),
      }),
    });
  });

  it("creates imported category ancestors before their child", async () => {
    const rootId = "00000000-0000-0000-0000-000000000310";
    const childId = "00000000-0000-0000-0000-000000000311";
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "00000000-0000-0000-0000-000000000101" },
        ]),
      },
      category: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn()
          .mockResolvedValueOnce({
            id: rootId,
            name: "Sinh hoạt",
            code: "LIVING",
            type: "expense",
            status: "active",
            sortOrder: 0,
            parentId: null,
            mergedIntoId: null,
          })
          .mockResolvedValueOnce({
            id: childId,
            name: "Cà phê",
            code: "COFFEE",
            type: "expense",
            status: "active",
            sortOrder: 1,
            parentId: rootId,
            mergedIntoId: null,
          }),
      },
      categoryAlias: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await importTransactions("user-1", "workspace-1", [{
      walletId: "00000000-0000-0000-0000-000000000101",
      categoryName: "Cà phê",
      categoryCode: "COFFEE",
      categoryPath: "Sinh hoạt > Cà phê",
      categoryCodePath: "LIVING > COFFEE",
      type: "expense",
      amount: new Decimal(50000),
      date: "2026-07-27",
    }], new Date("2026-07-27T10:00:00.000Z"));

    expect(result.createdCategoryCount).toBe(2);
    expect(tx.category.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ name: "Sinh hoạt", parentId: null }),
      }),
    );
    expect(tx.category.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ name: "Cà phê", parentId: rootId }),
      }),
    );
    expect(tx.transaction.createMany.mock.calls[0]?.[0].data[0].categoryId).toBe(childId);
  });
});
