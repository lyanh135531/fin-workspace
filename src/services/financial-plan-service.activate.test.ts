import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    financialPlan: { findFirst: vi.fn(), update: vi.fn() },
    financialPlanGoal: { findMany: vi.fn() },
    planJarAllocation: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    requireWorkspaceMember: vi.fn(),
    getWorkspaceBalance: vi.fn(),
    activateFinancialPlanGoals: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/services/workspace-access", () => ({ requireWorkspaceMember: mocks.requireWorkspaceMember }));
vi.mock("@/services/financial-plan-ledger", () => ({
  getWorkspaceBalance: mocks.getWorkspaceBalance,
  getFinancialPlanMonthLedger: vi.fn(),
  combinedExpenseByJar: vi.fn(),
}));
vi.mock("@/services/financial-goal-service", () => ({
  activateFinancialPlanGoals: mocks.activateFinancialPlanGoals,
  getFinancialGoalProgress: vi.fn(),
  getPlanGoalProgressSummary: vi.fn(),
  syncPlanAggregate: vi.fn(),
}));

import { DEFAULT_PLAN_JAR_PERCENTAGES } from "@/domain/financial-plan/calculator";
import { activateFinancialPlan } from "@/services/financial-plan-service";

describe("activateFinancialPlan", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireWorkspaceMember.mockResolvedValue({
      role: { code: "ADMIN" }, workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    const plan = {
      id: "plan-1", status: "draft", targetMonth: new Date("2027-12-01T00:00:00.000Z"),
      allocations: Object.entries(DEFAULT_PLAN_JAR_PERCENTAGES).map(([jarCode, percentage]) => ({
        jarCode, percentage, effectiveMonth: new Date("1970-01-01T00:00:00.000Z"),
      })),
    };
    mocks.tx.financialPlan.findFirst
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(plan);
    mocks.tx.financialPlanGoal.findMany.mockResolvedValue([]);
  });

  it.each([
    ["1500000.3333", "1500000"],
    ["1500000.9999", "1500001"],
    ["-100.5000", "-101"],
    ["1000", "1000"],
  ])("stores a whole-VND activation snapshot for balance %s", async (balance, expected) => {
    mocks.getWorkspaceBalance.mockResolvedValue(new Decimal(balance));
    await activateFinancialPlan("user-1", "workspace-1", "plan-1", new Date("2026-10-21T09:00:00.000Z"));

    const data = mocks.tx.financialPlan.update.mock.calls[0][0].data;
    expect(data.activationWorkspaceBalance.toString()).toBe(expected);
    expect(data.activationWorkspaceBalance.isInteger()).toBe(true);
    expect(data.status).toBe("active");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.requireWorkspaceMember).toHaveBeenCalledWith("user-1", "workspace-1", true);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ activationWorkspaceBalance: expected }),
      }),
    }));
  });
});
