import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    financialPlanGoal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    financialGoalFundingEntry: { create: vi.fn(), aggregate: vi.fn(), findFirst: vi.fn() },
    financialPlan: { findFirstOrThrow: vi.fn(), update: vi.fn() },
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
  finishFinancialPlanGoal,
  getPlanGoalProgressSummary,
  reverseFinancialGoalFunding,
  syncPlanAggregate,
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
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(2_500_000) } })
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(100_000) } });

    const result = await getPlanGoalProgressSummary(mocks.tx as never, "plan-1");

    expect(result.totalProgress.toFixed(0)).toBe("2600000");
    expect(result.workspaceReserved.toFixed(0)).toBe("2600000");
    expect(result.openingProgress).toBe("100000");
    expect(mocks.tx.financialPlanGoal.findMany).toHaveBeenCalledWith({
      where: {
        financialPlanId: "plan-1",
        deletedAt: null,
        status: { in: ["draft", "active", "completed"] },
      },
    });
  });

  it("includes both manual and linked_wallet goals in workspaceReserved and returns 0 openingProgress for linked_wallet-only plans", async () => {
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([
      { id: "goal-manual", trackingMode: "manual", linkedWalletId: null, targetAmount: new Decimal(1_000_000) },
      { id: "goal-wallet", trackingMode: "linked_wallet", linkedWalletId: "wallet-1", targetAmount: new Decimal(2_000_000) },
    ]);
    mocks.tx.financialGoalFundingEntry.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(400_000) } })
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(150_000) } });
    mocks.tx.wallet.findFirst.mockResolvedValueOnce({
      currentBalance: new Decimal(1_500_000),
    });

    const result = await getPlanGoalProgressSummary(mocks.tx as never, "plan-1");

    expect(result.totalProgress.toFixed(0)).toBe("1900000");
    expect(result.workspaceReserved.toFixed(0)).toBe("1900000");
    expect(result.openingProgress).toBe("150000");
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

  it("syncs draft plan targetMonth backward when a draft goal deadline is shortened", async () => {
    mocks.tx.financialPlan.findFirstOrThrow.mockResolvedValue({
      id: "plan-1",
      status: "draft",
      targetAmount: new Decimal(10_000_000),
      existingGoalAmount: new Decimal(0),
      targetMonth: new Date("2026-12-01T00:00:00.000Z"),
    });
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([
      {
        id: "goal-1",
        status: "draft",
        trackingMode: "manual",
        linkedWalletId: null,
        targetAmount: new Decimal(10_000_000),
        targetMonth: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);
    mocks.tx.financialGoalFundingEntry.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal(0) },
    });

    await syncPlanAggregate(mocks.tx as never, "plan-1");

    expect(mocks.tx.financialPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: expect.objectContaining({
        targetMonth: new Date("2026-10-01T00:00:00.000Z"),
      }),
    });
  });

  it("blocks cancelling the only draft goal in a draft plan", async () => {
    mocks.requireWorkspaceMember.mockResolvedValue({
      id: "admin-1",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    mocks.tx.financialPlanGoal.findFirst.mockResolvedValue({
      id: goalId,
      name: "Goal 1",
      financialPlanId: "plan-1",
      trackingMode: "manual",
      status: "draft",
      financialPlan: { id: "plan-1", workspaceId, status: "draft" },
    });
    mocks.tx.financialPlanGoal.count.mockResolvedValue(1);

    await expect(
      finishFinancialPlanGoal("admin-user", workspaceId, goalId, "cancelled"),
    ).rejects.toThrow("Kế hoạch phải có ít nhất 1 mục tiêu.");
  });
});
