import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    financialPlanGoal: { findFirst: vi.fn(), findMany: vi.fn() },
    financialGoalFundingEntry: { create: vi.fn(), aggregate: vi.fn(), findFirst: vi.fn() },
    financialPlan: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    wallet: { findFirst: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    requireWorkspaceMember: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/services/workspace-access", () => ({ requireWorkspaceMember: mocks.requireWorkspaceMember }));

import {
  createFinancialGoalFunding,
  getPlanGoalProgressSummary,
  reverseFinancialGoalFunding,
} from "@/services/financial-goal-service";

const workspaceId = "20000000-0000-0000-0000-000000000002";
const goalId = "30000000-0000-0000-0000-000000000003";

describe("financial goal service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspaceMember.mockResolvedValue({
      id: "member-1",
      role: { code: "MEMBER" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    mocks.tx.financialPlanGoal.findFirst.mockResolvedValue({
      id: goalId,
      financialPlanId: "plan-1",
      trackingMode: "manual",
      status: "active",
      financialPlan: { id: "plan-1", workspaceId },
    });
    mocks.tx.financialGoalFundingEntry.create.mockImplementation(async ({ data }) => ({ id: "entry-1", ...data }));
  });

  it("keeps a member contribution pending and does not count it into the aggregate yet", async () => {
    const entry = await createFinancialGoalFunding("user-1", workspaceId, {
      goalId,
      amount: new Decimal(500_000),
      effectiveDate: "2026-09-16",
      note: "Tiền thưởng",
    });

    expect(entry.status).toBe("pending");
    expect(mocks.tx.financialGoalFundingEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: expect.any(Decimal),
        requesterMemberId: "member-1",
        status: "pending",
      }),
    });
    expect(mocks.tx.financialPlanGoal.findMany).not.toHaveBeenCalled();
    expect(mocks.tx.financialPlan.update).not.toHaveBeenCalled();
  });

  it("keeps completed goals in plan progress and excludes cancelled goals at the query boundary", async () => {
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([
      { id: "goal-active", trackingMode: "manual", linkedWalletId: null, targetAmount: new Decimal(1_000_000) },
      { id: "goal-completed", trackingMode: "manual", linkedWalletId: null, targetAmount: new Decimal(2_000_000) },
    ]);
    mocks.tx.financialGoalFundingEntry.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(600_000) } })
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(2_500_000) } });

    const result = await getPlanGoalProgressSummary(mocks.tx as never, "plan-1");

    expect(result.totalProgress.toFixed(0)).toBe("2600000");
    expect(mocks.tx.financialPlanGoal.findMany).toHaveBeenCalledWith({
      where: {
        financialPlanId: "plan-1",
        deletedAt: null,
        status: { in: ["draft", "active", "completed"] },
      },
    });
  });

  it("never allows a reversal entry to be reversed again", async () => {
    mocks.requireWorkspaceMember.mockResolvedValue({ id: "admin-1", role: { code: "ADMIN" } });
    mocks.tx.financialGoalFundingEntry.findFirst.mockResolvedValue(null);

    await expect(
      reverseFinancialGoalFunding("admin-user", workspaceId, "entry-1", "2026-09-16"),
    ).rejects.toThrow("không thể hoàn tác");

    expect(mocks.tx.financialGoalFundingEntry.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ kind: { not: "reversal" } }),
      include: { goal: true, reversedBy: true },
    });
  });
});
