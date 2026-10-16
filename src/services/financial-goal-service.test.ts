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
    financialGoalFundingEntry: {
      create: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    financialPlan: { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn() },
    financialPlanMonth: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    wallet: { findFirst: vi.fn() },
    workspaceWallet: { findFirst: vi.fn() },
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
  getFinancialPlanGoalPortfolio,
  getPlanGoalProgressSummary,
  reverseFinancialGoalFunding,
  syncPlanAggregate,
  updateFinancialPlanGoal,
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
      financialPlan: { id: "plan-1", workspaceId, status: "active" },
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

  it("preserves hasGoals and progress summary when a plan is cancelled", async () => {
    const cancelledAt = new Date("2026-10-01T00:00:00.000Z");
    mocks.tx.financialPlan.findFirst.mockResolvedValue({
      status: "cancelled",
      cancelledAt,
    });
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([
      {
        id: "goal-cancelled",
        status: "cancelled",
        cancelledAt,
        trackingMode: "manual",
        linkedWalletId: null,
        targetAmount: new Decimal(5_000_000),
      },
    ]);
    mocks.tx.financialGoalFundingEntry.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(1_200_000) } })
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(500_000) } });

    const result = await getPlanGoalProgressSummary(mocks.tx as never, "plan-1");

    expect(result.hasGoals).toBe(true);
    expect(result.totalProgress.toFixed(0)).toBe("1200000");
    expect(result.openingProgress).toBe("500000");
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
      include: { goal: { include: { financialPlan: true } }, reversedBy: true },
    });
  });

  it("blocks reversing funding on a completed or cancelled goal or plan", async () => {
    mocks.requireWorkspaceMember.mockResolvedValue({ id: "admin-1", role: { code: "ADMIN" } });
    mocks.tx.financialGoalFundingEntry.findFirst.mockResolvedValue({
      id: "entry-1",
      goalId,
      amount: new Decimal(500_000),
      reversedBy: [],
      goal: {
        id: goalId,
        financialPlanId: "plan-1",
        status: "completed",
        financialPlan: { id: "plan-1", status: "completed" },
      },
    });

    await expect(
      reverseFinancialGoalFunding("admin-user", workspaceId, "entry-1", "2026-09-16"),
    ).rejects.toThrow("Mục tiêu hoặc kế hoạch đã kết thúc");
  });

  it("validates targetAmount against new linked_wallet progress and deletes draft opening entries when switching a draft goal from manual to linked_wallet", async () => {
    mocks.requireWorkspaceMember.mockResolvedValue({
      id: "admin-1",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    mocks.tx.financialPlanGoal.findFirst
      .mockResolvedValueOnce({
        id: goalId,
        financialPlanId: "plan-1",
        trackingMode: "manual",
        linkedWalletId: null,
        status: "draft",
        financialPlan: { id: "plan-1", workspaceId, status: "draft" },
      })
      .mockResolvedValueOnce(null);
    mocks.tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { id: "wallet-1", kind: "asset", status: "active" },
    });
    mocks.tx.wallet.findFirst.mockResolvedValue({
      currentBalance: new Decimal(3_000_000),
    });
    mocks.tx.financialPlanGoal.update.mockResolvedValue({ id: goalId });
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([]);

    await updateFinancialPlanGoal("admin-user", workspaceId, {
      goalId,
      name: "Quỹ dự phòng",
      targetAmount: new Decimal(5_000_000),
      targetMonth: "2026-12",
      trackingMode: "linked_wallet",
      linkedWalletId: "wallet-1",
    });

    expect(mocks.tx.financialGoalFundingEntry.deleteMany).toHaveBeenCalledWith({
      where: { goalId, kind: { in: ["opening", "adjustment"] } },
    });
  });

  it("syncs draft plan targetMonth backward when a draft goal deadline is shortened", async () => {
    mocks.tx.financialPlan.findFirst.mockResolvedValue({
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

  it("syncs active plan targetMonth backward when furthest goal is shortened or cancelled while clamping to closed months", async () => {
    mocks.tx.financialPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      status: "active",
      startMonth: new Date("2026-08-01T00:00:00.000Z"),
      targetMonth: new Date("2026-12-01T00:00:00.000Z"),
    });
    mocks.tx.financialPlanMonth.findFirst.mockResolvedValue({
      month: new Date("2026-09-01T00:00:00.000Z"),
    });
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([
      {
        id: "goal-1",
        status: "active",
        trackingMode: "manual",
        linkedWalletId: null,
        targetAmount: new Decimal(10_000_000),
        targetMonth: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);
    mocks.tx.financialGoalFundingEntry.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal(2_000_000) },
    });

    await syncPlanAggregate(mocks.tx as never, "plan-1");

    expect(mocks.tx.financialPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: expect.objectContaining({
        targetMonth: new Date("2026-10-01T00:00:00.000Z"),
      }),
    });
  });

  it("does not crash getFinancialPlanGoalPortfolio when a draft plan sits across a month boundary", async () => {
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([
      {
        id: goalId,
        name: "Mục tiêu qua tháng",
        status: "draft",
        trackingMode: "manual",
        linkedWalletId: null,
        linkedWallet: null,
        targetAmount: new Decimal(5_000_000),
        targetMonth: new Date("2026-08-01T00:00:00.000Z"),
        sortOrder: 0,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        financialPlan: { startMonth: null },
        fundingEntries: [],
      },
    ]);
    mocks.tx.financialGoalFundingEntry.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal(0) },
    });

    const portfolio = await getFinancialPlanGoalPortfolio(
      "user-1",
      workspaceId,
      "plan-1",
      new Decimal(2_000_000),
      new Date("2026-10-15T00:00:00.000Z"),
    );

    expect(portfolio).toHaveLength(1);
    expect(portfolio[0]?.health).toBe("overdue");
  });
});
