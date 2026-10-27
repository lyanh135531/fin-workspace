import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  processDueRecurringTransactions,
  reviewRecurringTransaction,
  setRecurringTransactionStatus,
  updateRecurringTransaction,
} from "@/services/recurring-transaction-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    workspace: { findFirst: vi.fn() },
    recurringTransaction: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/services/workspace-access", () => ({ requireWorkspaceMember: vi.fn() }));
vi.mock("@/lib/date", () => ({
  getBusinessDateInTimeZone: vi.fn((_timeZone: string, now?: Date) =>
    (now ?? new Date("2026-09-20T00:00:00.000Z")).toISOString().slice(0, 10),
  ),
}));

const input = {
  walletId: "wallet-1",
  type: "income" as const,
  amount: new Decimal("1000000"),
  description: "Lương",
  startDate: "2026-07-05",
  endDate: undefined,
};

function transactionClient(record?: Record<string, unknown>) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workspaceWallet: { findMany: vi.fn().mockResolvedValue([{ walletId: "wallet-1" }]) },
    category: { findFirst: vi.fn() },
    recurringTransaction: {
      create: vi.fn().mockImplementation(({ data }) => ({ id: "recurring-1", ...data })),
      findFirst: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockImplementation(({ data }) => ({ id: "recurring-1", ...record, ...data })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("recurring transaction approval workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a member schedule as pending and inactive", async () => {
    const tx = transactionClient();
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await createRecurringTransaction("user-1", "workspace-1", input);

    expect(tx.recurringTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdByMemberId: "member-1",
        status: "deactive",
        approvalStatus: "pending",
        approvedAt: null,
      }),
    });
  });

  it("approves without backfilling occurrences before the review date", async () => {
    const existing = {
      id: "recurring-1",
      workspaceId: "workspace-1",
      createdByMemberId: "member-1",
      walletId: "wallet-1",
      toWalletId: null,
      categoryId: null,
      type: "income" as const,
      amount: new Decimal("1000000"),
      description: "Lương",
      dayOfMonth: 5,
      startDate: new Date("2026-07-05T00:00:00.000Z"),
      endDate: null,
      nextExecutionDate: new Date("2026-07-05T00:00:00.000Z"),
      status: "deactive" as const,
      approvalStatus: "pending" as const,
      reviewedByMemberId: null,
      reviewedAt: null,
      approvedAt: null,
      completedAt: null,
      lastError: null,
      deletedAt: null,
    };
    const tx = transactionClient(existing);
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "admin-1",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await reviewRecurringTransaction(
      "admin-user",
      "workspace-1",
      "recurring-1",
      true,
      new Date("2026-09-20T00:00:00.000Z"),
    );

    expect(tx.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "recurring-1" },
      data: expect.objectContaining({
        approvalStatus: "approved",
        status: "active",
        nextExecutionDate: new Date("2026-10-05T00:00:00.000Z"),
      }),
    });
  });

  it("only asks the worker for approved active schedules", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({ timeZone: "Asia/Ho_Chi_Minh" } as never);
    vi.mocked(prisma.recurringTransaction.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.recurringTransaction.findFirst).mockResolvedValue(null);

    await processDueRecurringTransactions("workspace-1", new Date("2026-09-20T00:00:00.000Z"));

    expect(prisma.recurringTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ approvalStatus: "approved", status: "active" }),
      }),
    );
  });

  it("lets a member pause their own approved schedule immediately", async () => {
    const existing = {
      id: "recurring-1",
      createdByMemberId: "member-1",
      status: "active" as const,
      approvalStatus: "approved" as const,
    };
    const tx = transactionClient(existing);
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await setRecurringTransactionStatus("user-1", "workspace-1", "recurring-1", "deactive");

    expect(tx.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "recurring-1" },
      data: { status: "deactive" },
    });
  });

  it("sends a member reactivation request back to pending without activating it", async () => {
    const existing = {
      id: "recurring-1",
      createdByMemberId: "member-1",
      status: "deactive" as const,
      approvalStatus: "approved" as const,
    };
    const tx = transactionClient(existing);
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await setRecurringTransactionStatus(
      "user-1",
      "workspace-1",
      "recurring-1",
      "active",
    );

    expect(tx.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "recurring-1" },
      data: {
        approvalStatus: "pending",
        reviewedByMemberId: null,
        reviewedAt: null,
      },
    });
    expect(result).toEqual(expect.objectContaining({
      status: "deactive",
      approvalStatus: "pending",
    }));
  });

  it("prevents a member from deleting a schedule that was approved before", async () => {
    const tx = transactionClient({
      id: "recurring-1",
      createdByMemberId: "member-1",
      status: "deactive",
      approvalStatus: "rejected",
      approvedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await expect(deleteRecurringTransaction(
      "user-1",
      "workspace-1",
      "recurring-1",
    )).rejects.toThrow("Lịch đã từng được duyệt chỉ có thể tạm dừng.");
  });

  it("prevents a member from editing another member's schedule", async () => {
    const tx = transactionClient({
      id: "recurring-1",
      createdByMemberId: "member-2",
      status: "deactive",
      approvalStatus: "pending",
      completedAt: null,
    });
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await expect(updateRecurringTransaction(
      "user-1",
      "workspace-1",
      "recurring-1",
      input,
    )).rejects.toThrow("Bạn chỉ có thể chỉnh sửa lịch do mình tạo.");
    expect(tx.workspaceWallet.findMany).not.toHaveBeenCalled();
  });

  it("preserves next month's nextExecutionDate when reactivating a schedule already executed early in the current month", async () => {
    const existing = {
      id: "recurring-1",
      workspaceId: "workspace-1",
      createdByMemberId: "member-1",
      walletId: "wallet-1",
      toWalletId: null,
      categoryId: null,
      type: "income" as const,
      amount: new Decimal("1000000"),
      description: "Lương",
      dayOfMonth: 25,
      startDate: new Date("2026-08-25T00:00:00.000Z"),
      endDate: null,
      nextExecutionDate: new Date("2026-10-25T00:00:00.000Z"),
      status: "deactive" as const,
      approvalStatus: "approved" as const,
      reviewedByMemberId: "admin-1",
      reviewedAt: new Date("2026-08-01T00:00:00.000Z"),
      approvedAt: new Date("2026-08-01T00:00:00.000Z"),
      completedAt: null,
      lastError: null,
      deletedAt: null,
    };
    const tx = transactionClient(existing);
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "admin-1",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await setRecurringTransactionStatus(
      "admin-user",
      "workspace-1",
      "recurring-1",
      "active",
      new Date("2026-09-20T00:00:00.000Z"),
    );

    expect(tx.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "recurring-1" },
      data: expect.objectContaining({
        status: "active",
        nextExecutionDate: new Date("2026-10-25T00:00:00.000Z"),
      }),
    });
  });

  it("schedules for the current month when changing dayOfMonth to a future day in the current month without an existing occurrence", async () => {
    const existing = {
      id: "recurring-1",
      workspaceId: "workspace-1",
      createdByMemberId: "member-1",
      walletId: "wallet-1",
      toWalletId: null,
      categoryId: null,
      type: "income" as const,
      amount: new Decimal("1000000"),
      description: "Lương",
      dayOfMonth: 5,
      startDate: new Date("2026-08-05T00:00:00.000Z"),
      endDate: null,
      nextExecutionDate: new Date("2026-10-05T00:00:00.000Z"),
      status: "active" as const,
      approvalStatus: "approved" as const,
      reviewedByMemberId: "admin-1",
      reviewedAt: new Date("2026-08-01T00:00:00.000Z"),
      approvedAt: new Date("2026-08-01T00:00:00.000Z"),
      completedAt: null,
      lastError: null,
      deletedAt: null,
    };
    const tx = {
      ...transactionClient(existing),
      transaction: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "admin-1",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await updateRecurringTransaction(
      "admin-user",
      "workspace-1",
      "recurring-1",
      {
        ...input,
        startDate: "2026-08-25",
      },
      new Date("2026-09-20T00:00:00.000Z"),
    );

    expect(tx.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "recurring-1" },
      data: expect.objectContaining({
        dayOfMonth: 25,
        nextExecutionDate: new Date("2026-09-25T00:00:00.000Z"),
      }),
    });
  });

  it("only auto-completes approved paused schedules past endDate so pending schedules are never stamped completedAt", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({ timeZone: "Asia/Ho_Chi_Minh" } as never);
    vi.mocked(prisma.recurringTransaction.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.recurringTransaction.findFirst).mockResolvedValue(null);

    await processDueRecurringTransactions("workspace-1", new Date("2026-09-20T00:00:00.000Z"));

    expect(prisma.recurringTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          status: "deactive",
          approvalStatus: "approved",
          completedAt: null,
        }),
      }),
    );
  });

  it("allows a member to edit their own pending schedule even if completedAt was set and clears completedAt", async () => {
    const existing = {
      id: "recurring-1",
      workspaceId: "workspace-1",
      createdByMemberId: "member-1",
      walletId: "wallet-1",
      toWalletId: null,
      categoryId: null,
      type: "income" as const,
      amount: new Decimal("1000000"),
      description: "Lương",
      dayOfMonth: 5,
      startDate: new Date("2026-07-05T00:00:00.000Z"),
      endDate: new Date("2026-08-05T00:00:00.000Z"),
      nextExecutionDate: null,
      status: "deactive" as const,
      approvalStatus: "pending" as const,
      reviewedByMemberId: null,
      reviewedAt: null,
      approvedAt: null,
      completedAt: new Date("2026-09-01T00:00:00.000Z"),
      lastError: null,
      deletedAt: null,
    };
    const tx = {
      ...transactionClient(existing),
      transaction: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await updateRecurringTransaction(
      "user-1",
      "workspace-1",
      "recurring-1",
      {
        ...input,
        startDate: "2026-09-25",
        endDate: "2026-12-25",
      },
      new Date("2026-09-20T00:00:00.000Z"),
    );

    expect(tx.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "recurring-1" },
      data: expect.objectContaining({
        approvalStatus: "pending",
        status: "deactive",
        completedAt: null,
        nextExecutionDate: new Date("2026-09-25T00:00:00.000Z"),
      }),
    });
  });

  it("rejects a member edit when endDate leaves no valid execution occurrence instead of saving a deadlocked pending+completed row", async () => {
    const existing = {
      id: "recurring-1",
      workspaceId: "workspace-1",
      createdByMemberId: "member-1",
      walletId: "wallet-1",
      toWalletId: null,
      categoryId: null,
      type: "income" as const,
      amount: new Decimal("1000000"),
      description: "Lương",
      dayOfMonth: 25,
      startDate: new Date("2026-07-25T00:00:00.000Z"),
      endDate: null,
      nextExecutionDate: new Date("2026-09-25T00:00:00.000Z"),
      status: "deactive" as const,
      approvalStatus: "pending" as const,
      reviewedByMemberId: null,
      reviewedAt: null,
      approvedAt: null,
      completedAt: null,
      lastError: null,
      deletedAt: null,
    };
    const tx = {
      ...transactionClient(existing),
      transaction: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await expect(
      updateRecurringTransaction(
        "user-1",
        "workspace-1",
        "recurring-1",
        {
          ...input,
          startDate: "2026-07-25",
          endDate: "2026-08-25",
        },
        new Date("2026-09-20T00:00:00.000Z"),
      ),
    ).rejects.toThrow("Không còn kỳ thực thi hợp lệ trước ngày kết thúc. Vui lòng gia hạn ngày kết thúc.");
    expect(tx.recurringTransaction.update).not.toHaveBeenCalled();
  });
});
