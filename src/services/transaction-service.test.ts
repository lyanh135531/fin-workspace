import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  approveTransactionChange,
  deleteOrRequestTransaction,
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

  it("prevents investment ledger entries from being deleted outside investment management", async () => {
    const tx = requestClient();
    tx.transaction.findFirst.mockResolvedValueOnce({
      ...transaction,
      type: "investment_buy",
    } as never);
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
    )).rejects.toThrow("Giao dịch đầu tư chỉ được quản lý tại trang Quản lý đầu tư.");
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
