import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    financialPlan: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    requireWorkspaceMember: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: mocks.requireWorkspaceMember,
}));

vi.mock("@/lib/date", () => ({
  getBusinessDateInTimeZone: vi.fn(() => "2026-08-25"),
}));

vi.mock("@/services/financial-plan-ledger", () => ({
  combinedExpenseByJar: vi.fn(),
  getFinancialPlanMonthLedger: vi.fn(),
  getWorkspaceBalance: vi.fn(),
}));

import { deleteFinancialPlan } from "@/services/financial-plan-service";

const userId = "10000000-0000-0000-0000-000000000001";
const workspaceId = "20000000-0000-0000-0000-000000000002";
const planId = "30000000-0000-0000-0000-000000000003";
const deletedAt = new Date("2026-08-25T07:00:00.000Z");

function plan(status: "draft" | "active" | "completed" | "cancelled") {
  return { id: planId, workspaceId, status, deletedAt: null, allocations: [], months: [] };
}

describe("deleteFinancialPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspaceMember.mockResolvedValue({ role: { code: "ADMIN" } });
    mocks.tx.$executeRaw.mockResolvedValue(0);
  });

  it("rejects an active plan without changing it", async () => {
    mocks.tx.financialPlan.findFirst.mockResolvedValue(plan("active"));

    await expect(
      deleteFinancialPlan(userId, workspaceId, planId, deletedAt),
    ).rejects.toThrow("Không thể xóa kế hoạch đang chạy.");

    expect(mocks.tx.financialPlan.update).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("soft-deletes a non-active plan and records its previous status", async () => {
    const cancelled = plan("cancelled");
    mocks.tx.financialPlan.findFirst.mockResolvedValue(cancelled);
    mocks.tx.financialPlan.update.mockResolvedValue({ ...cancelled, deletedAt });

    await deleteFinancialPlan(userId, workspaceId, planId, deletedAt);

    expect(mocks.tx.financialPlan.update).toHaveBeenCalledWith({
      where: { id: planId },
      data: { deletedAt },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "financial_plan.deleted",
        entityId: planId,
        metadata: { previousStatus: "cancelled" },
      }),
    });
  });
});
