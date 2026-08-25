import "dotenv/config";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PLAN_JAR_PERCENTAGES } from "@/domain/financial-plan/calculator";
import { prisma } from "@/lib/prisma";
import {
  activateFinancialPlan,
  cancelFinancialPlan,
  catchUpFinancialPlan,
  createFinancialPlanDraft,
  getFinancialPlanView,
  updateFinancialPlanAllocations,
  updateFinancialPlanDeadline,
} from "@/services/financial-plan-service";

describe("financial plan service database invariants", () => {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  const readOnlyUserId = randomUUID();
  const readOnlyMemberId = randomUUID();
  const walletId = randomUUID();
  const categoryId = randomUUID();
  const percentages = Object.fromEntries(
    Object.entries(DEFAULT_PLAN_JAR_PERCENTAGES).map(([jarCode, value]) => [jarCode, new Decimal(value)]),
  ) as typeof DEFAULT_PLAN_JAR_PERCENTAGES;

  beforeAll(async () => {
    const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" }, select: { id: true } });
    const memberRole = await prisma.role.findUnique({ where: { code: "MEMBER" }, select: { id: true } });
    if (!adminRole || !memberRole) throw new Error("Database test requires ADMIN and MEMBER role seeds.");
    await prisma.user.create({ data: { id: userId, username: `plan-test-${userId}`, passwordHash: "integration-test" } });
    await prisma.user.create({ data: { id: readOnlyUserId, username: `plan-member-${readOnlyUserId}`, passwordHash: "integration-test" } });
    await prisma.workspace.create({ data: { id: workspaceId, name: "Financial plan integration", timeZone: "Asia/Ho_Chi_Minh" } });
    await prisma.workspaceMember.create({ data: { id: memberId, workspaceId, userId, roleId: adminRole.id } });
    await prisma.workspaceMember.create({ data: { id: readOnlyMemberId, workspaceId, userId: readOnlyUserId, roleId: memberRole.id } });
    await prisma.wallet.create({ data: { id: walletId, name: "Plan test wallet", openingBalance: new Decimal(20_000_000), currentBalance: new Decimal(20_000_000) } });
    await prisma.workspaceWallet.create({ data: { workspaceId, walletId } });
    await prisma.category.create({ data: {
      id: categoryId, workspaceId, name: "Chi QA", code: "PLAN_QA_EXPENSE",
      color: "#64748B", type: "expense", jarCode: "ESSENTIAL",
    } });
  });

  afterAll(async () => {
    const plans = await prisma.financialPlan.findMany({ where: { workspaceId }, select: { id: true } });
    const planIds = plans.map((plan) => plan.id);
    const months = await prisma.financialPlanMonth.findMany({ where: { financialPlanId: { in: planIds } }, select: { id: true } });
    await prisma.$transaction(async (tx) => {
      await tx.financialPlanMonthJar.deleteMany({ where: { financialPlanMonthId: { in: months.map((month) => month.id) } } });
      await tx.financialPlanMonth.deleteMany({ where: { financialPlanId: { in: planIds } } });
      await tx.planJarAllocation.deleteMany({ where: { financialPlanId: { in: planIds } } });
      await tx.financialPlan.deleteMany({ where: { workspaceId } });
    });
    await prisma.auditLog.deleteMany({ where: { workspaceId } });
    await prisma.transaction.deleteMany({ where: { memberId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.workspaceWallet.deleteMany({ where: { workspaceId } });
    await prisma.wallet.deleteMany({ where: { id: walletId } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.deleteMany({ where: { id: readOnlyUserId } });
    await prisma.$disconnect();
  });

  it("serializes concurrent activation and closes missed months idempotently", async () => {
    const draftInput = {
      name: "Mục tiêu 30 triệu", targetAmount: new Decimal(30_000_000), existingGoalAmount: new Decimal(0),
      targetMonth: "2026-10", percentages,
    };
    const [first, second] = await Promise.all([
      createFinancialPlanDraft(userId, workspaceId, draftInput),
      createFinancialPlanDraft(userId, workspaceId, { ...draftInput, name: "Kế hoạch cạnh tranh" }),
    ]);
    const activations = await Promise.allSettled([
      activateFinancialPlan(userId, workspaceId, first.id, new Date("2026-08-15T05:00:00.000Z")),
      activateFinancialPlan(userId, workspaceId, second.id, new Date("2026-08-15T05:00:00.000Z")),
    ]);
    expect(activations.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.financialPlan.count({ where: { workspaceId, status: "active" } })).toBe(1);

    const active = await prisma.financialPlan.findFirstOrThrow({ where: { workspaceId, status: "active" } });
    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: walletId },
        data: { status: "deactive", currentBalance: new Decimal(8_000_000) },
      });
      await tx.transaction.create({ data: {
        memberId, walletId, categoryId, type: "expense", workflowStatus: "approved",
        amount: new Decimal(12_000_000), date: new Date("2026-08-20T00:00:00.000Z"),
        jarCode: "ESSENTIAL", description: "Live reforecast overspend",
      } });
    });
    const view = await getFinancialPlanView(userId, workspaceId, active.id, new Date("2026-08-15T05:00:00.000Z"));
    expect(view.status).toBe("active");
    if (!("months" in view) || !view.months) throw new Error("Active plan view must include its month schedule.");
    expect(view.months[0]?.rawGrossBudget).toBe("10000000");
    expect(view.months[0]?.availableToSpend).toBe("-2000000");
    expect(view.months[0]?.projectedActualGoalAmount).toBe("8000000");
    expect(view.months[1]?.adjustedRequiredAmount).toBe("11000000");

    const firstCatchUp = await catchUpFinancialPlan(active.id, new Date("2026-10-01T00:00:00.000Z"));
    const secondCatchUp = await catchUpFinancialPlan(active.id, new Date("2026-10-01T00:00:00.000Z"));
    expect(firstCatchUp.closed).toBe(2);
    expect(secondCatchUp.closed).toBe(0);
    expect(await prisma.financialPlanMonth.count({ where: { financialPlanId: active.id } })).toBe(2);
    expect(await prisma.financialPlanMonthJar.count({ where: { financialPlanMonth: { financialPlanId: active.id } } })).toBe(12);
    const snapshot = await prisma.financialPlanMonth.findFirstOrThrow({ where: { financialPlanId: active.id } });
    await expect(prisma.financialPlanMonth.update({ where: { id: snapshot.id }, data: { calculatorVersion: "tampered" } }))
      .rejects.toThrow("immutable");
    await expect(prisma.planJarAllocation.create({ data: {
      financialPlanId: active.id, effectiveMonth: new Date("2026-10-01T00:00:00.000Z"),
      jarCode: "ESSENTIAL", percentage: new Decimal(100),
    } })).rejects.toThrow("six jars");

    await updateFinancialPlanDeadline(userId, workspaceId, active.id, "2026-11", new Date("2026-10-01T00:00:00.000Z"));
    await updateFinancialPlanAllocations(userId, workspaceId, active.id, percentages, new Date("2026-10-01T00:00:00.000Z"));
    expect(await prisma.planJarAllocation.count({ where: { financialPlanId: active.id, effectiveMonth: new Date("2026-11-01T00:00:00.000Z") } })).toBe(6);
    await cancelFinancialPlan(userId, workspaceId, active.id, new Date("2026-10-01T00:00:00.000Z"));
    const nextPlan = first.id === active.id ? second : first;
    await activateFinancialPlan(userId, workspaceId, nextPlan.id, new Date("2026-10-01T00:00:00.000Z"));
    expect(await prisma.financialPlan.count({ where: { workspaceId, status: "active" } })).toBe(1);
    expect(await prisma.financialPlan.count({ where: { workspaceId, status: "cancelled" } })).toBe(1);
    const memberView = await getFinancialPlanView(readOnlyUserId, workspaceId, nextPlan.id, new Date("2026-10-01T00:00:00.000Z"));
    expect(memberView.canManage).toBe(false);
    await expect(cancelFinancialPlan(readOnlyUserId, workspaceId, nextPlan.id, new Date("2026-10-01T00:00:00.000Z"))).rejects.toThrow("quyền truy cập");
    await expect(getFinancialPlanView(userId, randomUUID(), nextPlan.id, new Date("2026-10-01T00:00:00.000Z"))).rejects.toThrow("quyền truy cập");
  });
});
