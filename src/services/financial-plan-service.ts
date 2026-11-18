import Decimal from "decimal.js";
import { Prisma, type FinancialPlanStatus } from "@/generated/prisma/client";
import {
  calculateMonthlyPlanBudget,
  databaseDateToMonth,
  decimalMap,
  deriveFinancialPlanHealth,
  monthToDatabaseDate,
  monthsInclusive,
  splitVndAcrossMonths,
  validateJarPercentages,
  type CreateFinancialPlanInput,
  type FinancialJarCode,
  type JarDecimalMap,
  type PlanJarPercentagesInput,
  type UpdateFinancialPlanDraftInput,
} from "@/domain";
import { formatInTimeZone } from "date-fns-tz";
import { FINANCIAL_JAR_CODES } from "@/domain/financial-jar/jars";
import { addMonths, monthDateRange } from "@/domain/financial-plan/month";
import { isAdminRole } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  combinedExpenseByJar,
  getFinancialPlanMonthLedger,
} from "@/services/financial-plan-ledger";
import { getFinancialPlanNetBalance } from "@/services/financial-plan-progress";
import { requiredGoalAmountForMonth } from "@/domain/financial-plan/goal-calculator";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { activateFinancialPlanGoals, allocateAutomaticProgress, createFinancialPlanWithGoals, getPlanGoalProgressSummary, syncPlanAggregate } from "@/services/financial-goal-service";

type TransactionClient = Prisma.TransactionClient;
const DRAFT_ALLOCATION_MONTH = "1970-01";
const ZERO = new Decimal(0);

function appValidation(error: unknown): never {
  throw new AppError("VALIDATION_ERROR", error instanceof Error ? error.message : "Dữ liệu kế hoạch không hợp lệ.");
}

function currentMonth(timeZone: string, now: Date) {
  return formatInTimeZone(now, timeZone, "yyyy-MM");
}

function allocationRows(planId: string, effectiveMonth: string, percentages: PlanJarPercentagesInput) {
  const valid = validateJarPercentages(percentages);
  return FINANCIAL_JAR_CODES.map((jarCode) => ({
    financialPlanId: planId,
    jarCode,
    percentage: valid[jarCode],
    effectiveMonth: monthToDatabaseDate(effectiveMonth),
  }));
}

function allocationForMonth(
  allocations: Array<{ jarCode: FinancialJarCode; percentage: { toString(): string }; effectiveMonth: Date }>,
  month: string,
): JarDecimalMap {
  const result = decimalMap();
  const selected = new Set<FinancialJarCode>();
  for (const allocation of [...allocations].sort((a, b) => b.effectiveMonth.getTime() - a.effectiveMonth.getTime())) {
    if (databaseDateToMonth(allocation.effectiveMonth) > month || selected.has(allocation.jarCode)) continue;
    result[allocation.jarCode] = new Decimal(allocation.percentage.toString());
    selected.add(allocation.jarCode);
  }
  if (selected.size !== FINANCIAL_JAR_CODES.length) throw new AppError("CONFLICT", "Kế hoạch thiếu cấu hình tỷ lệ sáu hũ.");
  return validateJarPercentages(result);
}

async function advisoryWorkspaceLock(tx: TransactionClient, workspaceId: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-plan-workspace:${workspaceId}`}))`);
}

async function advisoryPlanLock(tx: TransactionClient, planId: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-plan:${planId}`}))`);
}

async function managedPlan(tx: TransactionClient, workspaceId: string, planId: string) {
  const plan = await tx.financialPlan.findFirst({
    where: { id: planId, workspaceId, deletedAt: null },
    include: { allocations: true, months: { include: { jars: true }, orderBy: { month: "asc" } } },
  });
  if (!plan) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch trong workspace này.");
  return plan;
}

export async function createFinancialPlanDraft(userId: string, workspaceId: string, input: CreateFinancialPlanInput) {
  return createFinancialPlanWithGoals(userId, workspaceId, {
    name: input.name, percentages: input.percentages,
    goals: [{ name: input.name, targetAmount: input.targetAmount, targetMonth: input.targetMonth,
      existingAmount: ZERO, trackingMode: "manual", linkedWalletId: null }],
  });
}

export async function updateFinancialPlanDraft(
  userId: string,
  workspaceId: string,
  input: UpdateFinancialPlanDraftInput,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  try { validateJarPercentages(input.percentages); } catch (error) { appValidation(error); }
  return prisma.$transaction(async (tx) => {
    await advisoryPlanLock(tx, input.planId);
    const plan = await managedPlan(tx, workspaceId, input.planId);
    if (plan.status !== "draft") throw new AppError("CONFLICT", "Chỉ kế hoạch nháp mới được sửa toàn bộ.");
    const goals = await tx.financialPlanGoal.findMany({
      where: { financialPlanId: plan.id, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const hasMultipleGoals = goals.length > 1;
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: {
      name: input.name, existingGoalAmount: ZERO,
      ...(!hasMultipleGoals ? {
        targetAmount: input.targetAmount,

        targetMonth: monthToDatabaseDate(input.targetMonth),
      } : {}),
    } });
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id } });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, DRAFT_ALLOCATION_MONTH, input.percentages) });
    const primaryGoal = goals[0];
    if (primaryGoal && !hasMultipleGoals) {
      await tx.financialPlanGoal.update({
        where: { id: primaryGoal.id },
        data: {
          name: primaryGoal.name === plan.name ? input.name : primaryGoal.name,
          targetAmount: input.targetAmount,
          targetMonth: monthToDatabaseDate(input.targetMonth),
        },
      });
    }
    await syncPlanAggregate(tx, plan.id);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.draft_updated", entityType: "financial_plan", entityId: plan.id } });
    return updated;
  });
}

export async function deleteFinancialPlan(userId: string, workspaceId: string, planId: string, now = new Date()) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await advisoryWorkspaceLock(tx, workspaceId);
    await advisoryPlanLock(tx, planId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status === "active") throw new AppError("CONFLICT", "Không thể xóa kế hoạch đang chạy.");
    const deleted = await tx.financialPlan.update({
      where: { id: plan.id },
      data: { deletedAt: now },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "financial_plan.deleted",
        entityType: "financial_plan",
        entityId: plan.id,
        metadata: { previousStatus: plan.status },
      },
    });
    return deleted;
  });
}

export async function activateFinancialPlan(
  userId: string,
  workspaceId: string,
  planId: string,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const month = currentMonth(member.workspace.timeZone, now);
  return prisma.$transaction(async (tx) => {
    await advisoryWorkspaceLock(tx, workspaceId);
    await advisoryPlanLock(tx, planId);
    let plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "draft") throw new AppError("CONFLICT", "Kế hoạch không còn ở trạng thái nháp.");
    if (databaseDateToMonth(plan.targetMonth) < month) throw new AppError("VALIDATION_ERROR", "Deadline không được trước tháng hiện tại.");
    const active = await tx.financialPlan.findFirst({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true } });
    if (active) throw new AppError("CONFLICT", "Nhóm tài chính đã có một kế hoạch đang hoạt động.");
    const planGoals = await tx.financialPlanGoal?.findMany?.({
      where: { financialPlanId: plan.id, status: { in: ["draft", "active"] }, deletedAt: null },
      select: { targetMonth: true },
    }) ?? [];
    if (planGoals.some((goal) => databaseDateToMonth(goal.targetMonth) < month)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Có mục tiêu trong kế hoạch đã qua tháng hạn hoàn thành. Vui lòng cập nhật hạn mục tiêu trước khi kích hoạt.",
      );
    }
    await activateFinancialPlanGoals(tx, workspaceId, plan.id, month);
    plan = await managedPlan(tx, workspaceId, planId);
    // Wallets retain four decimal places; the activation snapshot requires whole VND.
    const balance = (await getFinancialPlanNetBalance(tx, workspaceId)).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
    const draftPercentages = allocationForMonth(plan.allocations, DRAFT_ALLOCATION_MONTH);
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id } });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, month, draftPercentages) });
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: {
      status: "active", startMonth: monthToDatabaseDate(month), activatedAt: now,
      activationWorkspaceBalance: balance,
      existingGoalAmount: Decimal.min(Decimal.max(balance, ZERO), plan.targetAmount.toString()),
    } });
    await tx.auditLog.create({ data: {
      workspaceId, actorUserId: userId, action: "financial_plan.activated", entityType: "financial_plan", entityId: plan.id,
      metadata: { startMonth: month, targetMonth: databaseDateToMonth(plan.targetMonth), activationWorkspaceBalance: balance.toFixed(0) },
    } });
    return updated;
  });
}

function sumJarMap(values: JarDecimalMap) {
  return FINANCIAL_JAR_CODES.reduce((sum, jarCode) => sum.plus(values[jarCode]), ZERO);
}

// Version 2 snapshots store a stock (net money at month end), not a monthly
// amount to add repeatedly. Legacy immutable snapshots remain unchanged.
const AUTOMATIC_VERSION = "2.0.0";
async function automaticMonth(tx: TransactionClient, plan: Awaited<ReturnType<typeof managedPlan>>,
  month: string, referenceBalance: Decimal, openingBalance: Decimal, includeForecast: boolean, businessDate: string) {
  const end = monthDateRange(month).end;
  const goals = await tx.financialPlanGoal.findMany({
    where: { financialPlanId: plan.id, createdAt: { lt: end },
      AND: [
        { OR: [{ deletedAt: null }, { deletedAt: { gte: end } }] },
        { OR: [{ status: { in: ["draft", "active", "completed"] } }, { cancelledAt: { gte: end } }] },
      ],
    }, orderBy: [{ sortOrder: "asc" }, { targetMonth: "asc" }, { createdAt: "asc" }],
  });
  const openingProgress = allocateAutomaticProgress(goals, openingBalance);
  const candidates = goals.filter(g => g.status !== "completed" || (g.completedAt && g.completedAt >= end));
  const required = candidates.reduce((sum,g) => sum.plus(requiredGoalAmountForMonth(
    g.targetAmount.toString(), openingProgress.get(g.id) ?? ZERO, month, databaseDateToMonth(g.targetMonth),
  )), ZERO);
  const reserve = Decimal.min(Decimal.max(openingBalance, ZERO), plan.targetAmount.toString()).plus(required);
  const ledger = await getFinancialPlanMonthLedger(tx, plan.workspaceId, month, includeForecast, { businessDate });
  const percentages = allocationForMonth(plan.allocations, month);
  const result = calculateMonthlyPlanBudget({
    rawGrossBudget: referenceBalance.plus(sumJarMap(ledger.approvedExpenseByJar))
      .plus(includeForecast ? ledger.forecastIncome : ZERO)
      .plus(includeForecast ? ledger.forecastReservedCardExpense : ZERO).minus(reserve),
    requiredGoalAmount: required, eligibleExpensesByJar: combinedExpenseByJar(ledger, includeForecast), percentages,
  });
  return { result, ledger, required, percentages, reserve, openingProgress, goals };
}

async function closeOneFinancialPlanMonth(planId: string, month: string, now: Date) {
  return prisma.$transaction(async tx => {
    await advisoryPlanLock(tx, planId);
    const plan = await tx.financialPlan.findFirst({
      where: { id: planId, status: "active", deletedAt: null },
      include: { allocations: true, months: { include: { jars: true }, orderBy: { month: "asc" } }, workspace: true },
    });
    if (!plan?.startMonth) return { kind: "skipped" as const };
    const start = databaseDateToMonth(plan.startMonth);
    const target = databaseDateToMonth(plan.targetMonth);
    if (month < start || month > target || plan.months.some(m => databaseDateToMonth(m.month) === month)) return { kind: "skipped" as const };
    const firstUnclosed = monthsInclusive(start, month).find(candidate => !plan.months.some(m => databaseDateToMonth(m.month) === candidate));
    if (firstUnclosed !== month) throw new AppError("CONFLICT", "Phải đóng tháng theo đúng thứ tự.");
    const range = monthDateRange(month);
    const endBalance = await getFinancialPlanNetBalance(tx, plan.workspaceId, range.end);
    const opening = month === start && plan.activationWorkspaceBalance !== null
      ? new Decimal(plan.activationWorkspaceBalance.toString())
      : await getFinancialPlanNetBalance(tx, plan.workspaceId, range.start);
    const calc = await automaticMonth(tx, plan, month, endBalance, opening, false, month + "-01");
    const snapshot = await tx.financialPlanMonth.create({ data: {
      financialPlanId: plan.id, month: range.start, baseRequiredAmount: calc.required,
      adjustedRequiredAmount: calc.required, rawGrossBudget: calc.result.rawGrossBudget,
      allocatableGrossBudget: calc.result.allocatableGrossBudget, resourceShortfall: calc.result.resourceShortfall,
      closedEligibleExpense: calc.result.eligibleExpense, closedActualGoalAmount: Decimal.max(endBalance, ZERO),
      closedAt: now, calculatorVersion: AUTOMATIC_VERSION,
    } });
    await tx.financialPlanMonthJar.createMany({ data: FINANCIAL_JAR_CODES.map(jarCode => ({
      financialPlanMonthId: snapshot.id, jarCode, percentage: calc.percentages[jarCode],
      allocatedAmount: calc.result.allocatedByJar[jarCode], closedActualAmount: calc.result.expenseByJar[jarCode],
    })) });
    const progress = allocateAutomaticProgress(calc.goals, endBalance);
    for (const goal of calc.goals) {
      const actual = progress.get(goal.id) ?? ZERO;
      await tx.financialPlanGoalMonth.create({ data: {
        goalId: goal.id, financialPlanMonthId: snapshot.id, month: range.start,
        requiredAmount: requiredGoalAmountForMonth(goal.targetAmount.toString(), calc.openingProgress.get(goal.id) ?? ZERO, month, databaseDateToMonth(goal.targetMonth)),
        projectedContribution: Decimal.max(actual.minus(calc.openingProgress.get(goal.id) ?? ZERO), ZERO),
        actualContribution: actual.minus(calc.openingProgress.get(goal.id) ?? ZERO),
        closingProgress: actual, remainingAmount: Decimal.max(new Decimal(goal.targetAmount.toString()).minus(actual), ZERO),
      } });
    }
    await tx.auditLog.create({ data: { workspaceId: plan.workspaceId, action: "financial_plan.month_closed", entityType: "financial_plan", entityId: plan.id,
      metadata: { month, netBalance: endBalance.toFixed(0), openingNetBalance: opening.toFixed(0), calculatorVersion: AUTOMATIC_VERSION } } });
    const completed = month === target && endBalance.gte(plan.targetAmount.toString());
    if (completed) {
      await tx.financialPlan.update({ where: { id: plan.id }, data: { status: "completed", completedAt: now, existingGoalAmount: plan.targetAmount } });
      await tx.financialPlanGoal.updateMany({ where: { financialPlanId: plan.id, status: "active", deletedAt: null }, data: { status: "completed", completedAt: now } });
      await tx.auditLog.create({ data: { workspaceId: plan.workspaceId, action: "financial_plan.completed", entityType: "financial_plan", entityId: plan.id, metadata: { automatic: true, realizedProgress: endBalance.toFixed(0) } } });
    }
    return { kind: "closed" as const, completed };
  });
}

export async function catchUpFinancialPlan(planId: string, now = new Date()) {
  const plan = await prisma.financialPlan.findFirst({
    where: { id: planId, status: "active", deletedAt: null },
    include: { workspace: { select: { timeZone: true } }, months: { select: { month: true } } },
  });
  if (!plan?.startMonth) return { closed: 0, completed: false };
  const startMonth = databaseDateToMonth(plan.startMonth);
  const rawTargetMonth = databaseDateToMonth(plan.targetMonth);
  const targetMonth = rawTargetMonth < startMonth ? startMonth : rawTargetMonth;
  const openMonth = currentMonth(plan.workspace.timeZone, now);
  const lastCloseable = [addMonths(openMonth, -1), targetMonth].sort()[0];
  const monthsToClose = monthsInclusive(startMonth, targetMonth).filter(
    (month) =>
      month <= lastCloseable &&
      !plan.months.some((item) => databaseDateToMonth(item.month) === month),
  );
  let closed = 0;
  let completed = false;
  for (const month of monthsToClose) {
    const result = await closeOneFinancialPlanMonth(plan.id, month, now);
    if (result.kind === "closed") {
      closed += 1;
      completed = result.completed;
      if (completed) break;
    }
  }
  return { closed, completed };
}

export async function updateFinancialPlanDeadline(
  userId: string, workspaceId: string, planId: string, targetMonth: string, now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const accessible = await prisma.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!accessible) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch trong workspace này.");
  await catchUpFinancialPlan(planId, now);
  const current = currentMonth(member.workspace.timeZone, now);
  if (targetMonth < current) throw new AppError("VALIDATION_ERROR", "Deadline mới không được trước tháng hiện tại.");
  return prisma.$transaction(async (tx) => {
    await advisoryPlanLock(tx, planId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "active") throw new AppError("CONFLICT", "Chỉ kế hoạch đang hoạt động mới được đổi deadline.");
    const activeGoals = await tx.financialPlanGoal?.findMany?.({
      where: { financialPlanId: plan.id, status: { in: ["active", "draft"] }, deletedAt: null },
      select: { id: true, targetMonth: true },
    }) ?? [];
    const previous = databaseDateToMonth(plan.targetMonth);
    const nextTargetDate = monthToDatabaseDate(targetMonth);
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: { targetMonth: nextTargetDate } });
    const goalsToSync =
      activeGoals.length === 1
        ? activeGoals
        : activeGoals.filter(
            (goal) =>
              databaseDateToMonth(goal.targetMonth) === previous ||
              databaseDateToMonth(goal.targetMonth) > targetMonth,
          );
    if (goalsToSync.length > 0) {
      await tx.financialPlanGoal?.updateMany?.({
        where: { id: { in: goalsToSync.map((goal) => goal.id) } },
        data: { targetMonth: nextTargetDate },
      });
    }
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.deadline_updated", entityType: "financial_plan", entityId: plan.id,
      metadata: { previousTargetMonth: previous, targetMonth } } });
    return updated;
  });
}

export async function updateFinancialPlanAllocations(
  userId: string, workspaceId: string, planId: string, percentages: PlanJarPercentagesInput, now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  try { validateJarPercentages(percentages); } catch (error) { appValidation(error); }
  const accessible = await prisma.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!accessible) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch trong workspace này.");
  await catchUpFinancialPlan(planId, now);
  const effectiveMonth = currentMonth(member.workspace.timeZone, now);
  return prisma.$transaction(async (tx) => {
    await advisoryPlanLock(tx, planId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "active") throw new AppError("CONFLICT", "Chỉ kế hoạch đang hoạt động mới được đổi tỷ lệ.");
    if (plan.months.some(m => databaseDateToMonth(m.month) === effectiveMonth)) throw new AppError("CONFLICT", "Không được sửa tỷ lệ tháng đã chốt.");
    // Remove legacy future overrides so this change remains effective until edited again.
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id, effectiveMonth: { gt: monthToDatabaseDate(effectiveMonth) } } });
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id, effectiveMonth: monthToDatabaseDate(effectiveMonth) } });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, effectiveMonth, percentages) });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.allocation_updated", entityType: "financial_plan", entityId: plan.id,
      metadata: { effectiveMonth, previousPercentages: percentagesToStrings(allocationForMonth(plan.allocations, effectiveMonth)), percentages: Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [jarCode, percentages[jarCode].toString()])) } } });
    return { effectiveMonth };
  });
}

async function finishFinancialPlan(
  userId: string, workspaceId: string, planId: string, status: Extract<FinancialPlanStatus, "completed" | "cancelled">, now: Date,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const accessible = await prisma.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!accessible) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch trong workspace này.");
  await catchUpFinancialPlan(planId, now);
  return prisma.$transaction(async (tx) => {
    await advisoryWorkspaceLock(tx, workspaceId);
    await advisoryPlanLock(tx, planId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "active") throw new AppError("CONFLICT", "Kế hoạch không còn hoạt động.");
    const progress = await getPlanGoalProgressSummary(tx, plan.id);
    if (status === "completed" && progress.totalProgress.lt(plan.targetAmount.toString())) throw new AppError("VALIDATION_ERROR", "Chưa đạt mục tiêu nên không thể hoàn thành.");
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: {
      status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }),
      existingGoalAmount: Decimal.min(progress.totalProgress, plan.targetAmount.toString()),
    } });
    await tx.financialPlanGoal.updateMany({
      where: { financialPlanId: plan.id, status: "active", deletedAt: null },
      data: { status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }) },
    });
    await tx.financialGoalFundingEntry?.updateMany?.({
      where: { goal: { financialPlanId: plan.id }, status: "pending" },
      data: { status: "rejected", reviewerMemberId: member.id, reviewedAt: now },
    });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: `financial_plan.${status}`, entityType: "financial_plan", entityId: plan.id,
      metadata: { automatic: false } } });
    return updated;
  });
}

export function completeFinancialPlan(userId: string, workspaceId: string, planId: string, now = new Date()) {
  return finishFinancialPlan(userId, workspaceId, planId, "completed", now);
}

export function cancelFinancialPlan(userId: string, workspaceId: string, planId: string, now = new Date()) {
  return finishFinancialPlan(userId, workspaceId, planId, "cancelled", now);
}

function percentagesToStrings(values: JarDecimalMap) {
  return Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [jarCode, values[jarCode].toString()])) as Record<FinancialJarCode, string>;
}

export async function getFinancialPlanView(userId: string, workspaceId: string, planId: string, now = new Date()) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const accessible = await prisma.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null } });
  if (!accessible || (accessible.status === "draft" && !isAdminRole(member.role.code))) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch trong nhóm này.");
  await catchUpFinancialPlan(planId, now);
  return prisma.$transaction(async tx => {
    const plan = await managedPlan(tx, workspaceId, planId);
    const summary = await getPlanGoalProgressSummary(tx, planId);
    if (plan.status === "draft" || !plan.startMonth) return {
      id: plan.id, name: plan.name, status: "draft" as const, targetAmount: plan.targetAmount.toString(),
      existingGoalAmount: summary.totalProgress.toFixed(0),
      startMonth: null, targetMonth: databaseDateToMonth(plan.targetMonth),
      percentages: percentagesToStrings(allocationForMonth(plan.allocations, DRAFT_ALLOCATION_MONTH)), canManage: isAdminRole(member.role.code),
    };
    const startMonth = databaseDateToMonth(plan.startMonth);
    const targetMonth = databaseDateToMonth(plan.targetMonth);
    const businessMonth = currentMonth(member.workspace.timeZone, now);
    const businessDate = formatInTimeZone(now, member.workspace.timeZone, "yyyy-MM-dd");
    const baseline = new Decimal(plan.activationWorkspaceBalance?.toString() ?? 0);
    const baselineByGoal = allocateAutomaticProgress(summary.goals, baseline);
    const expectedThrough = (month: string) => summary.goals.reduce((sum,g) => {
      const initial = baselineByGoal.get(g.id) ?? ZERO;
      const deadline = databaseDateToMonth(g.targetMonth);
      const schedule = splitVndAcrossMonths(Decimal.max(new Decimal(g.targetAmount.toString()).minus(initial), ZERO), monthsInclusive(startMonth, deadline < startMonth ? startMonth : deadline).length);
      const count = month < startMonth ? 0 : Math.min(monthsInclusive(startMonth, month).length, schedule.length);
      return sum.plus(initial).plus(schedule.slice(0,count).reduce((total,value) => total.plus(value), ZERO));
    }, ZERO);
    let closedSnapshotProgress = new Decimal(plan.existingGoalAmount.toString());
    const closedMonths = [];
    for (const m of plan.months) {
      const month = databaseDateToMonth(m.month);
      const net = await getFinancialPlanNetBalance(tx, workspaceId, monthDateRange(month).end);
      const stock = new Decimal(m.closedActualGoalAmount.toString());
      closedSnapshotProgress = m.calculatorVersion === AUTOMATIC_VERSION ? stock : closedSnapshotProgress.plus(stock);
      const ledger = await getFinancialPlanMonthLedger(tx, workspaceId, month, false);
      closedMonths.push({
        month, closed: true, baseRequiredAmount:m.baseRequiredAmount.toString(),adjustedRequiredAmount:m.adjustedRequiredAmount.toString(),
        rawGrossBudget:m.rawGrossBudget.toString(),allocatableGrossBudget:m.allocatableGrossBudget.toString(),resourceShortfall:m.resourceShortfall.toString(),
        availableToSpend:new Decimal(m.allocatableGrossBudget.toString()).minus(m.closedEligibleExpense.toString()).minus(m.resourceShortfall.toString()).toFixed(0),
        approvedIncome:ledger.approvedIncome.toFixed(0),remainingForecastIncome:"0",approvedExpenseFromMonthStart:sumJarMap(ledger.approvedExpenseByJar).toFixed(0),
        accumulationAtEnd:m.calculatorVersion === AUTOMATIC_VERSION ? stock.toFixed(0) : undefined,closedActualGoalAmount:stock.toFixed(0),adjustedActualGoalAmount:Decimal.max(net,ZERO).toFixed(0),
        adjustedDelta:Decimal.max(net,ZERO).minus(closedSnapshotProgress).toFixed(0),
        jars:m.jars.map(j => ({jarCode:j.jarCode,percentage:j.percentage.toString(),allocatedAmount:j.allocatedAmount.toString(),closedActualAmount:j.closedActualAmount.toString()})),
      });
    }
    const open = plan.status === "active" ? monthsInclusive(startMonth,targetMonth).filter(month => !plan.months.some(m => databaseDateToMonth(m.month) === month)) : [];
    const realized = summary.totalProgress;
    let projectedNet = summary.netBalance;
    let projectedCurrent = realized;
    const projectedMonths = [];
    for (const month of open) {
      const current = month <= businessMonth;
      const opening = month === startMonth ? baseline : current
        ? await getFinancialPlanNetBalance(tx, workspaceId, monthDateRange(month).start)
        : projectedNet;
      const reference = current ? await getFinancialPlanNetBalance(tx, workspaceId, month < businessMonth ? monthDateRange(month).end : undefined) : projectedNet;
      const calc = await automaticMonth(tx, plan, month, reference, opening, month >= businessMonth, businessDate);
      projectedNet = reference.plus(calc.ledger.forecastNetChange);
      if (month === businessMonth) projectedCurrent = Decimal.max(projectedNet,ZERO);
      const result = calc.result;
      projectedMonths.push({
        month,closed:false,baseRequiredAmount:calc.required.toFixed(0),adjustedRequiredAmount:calc.required.toFixed(0),
        rawGrossBudget:result.rawGrossBudget.toFixed(0),allocatableGrossBudget:result.allocatableGrossBudget.toFixed(0),resourceShortfall:result.resourceShortfall.toFixed(0),
        availableToSpend:result.budgetVariance.toFixed(0),eligibleExpense:result.eligibleExpense.toFixed(0),
        approvedIncome:calc.ledger.approvedIncome.toFixed(0),remainingForecastIncome:calc.ledger.forecastIncome.toFixed(0),
        approvedExpenseFromMonthStart:sumJarMap(calc.ledger.approvedExpenseByJar).toFixed(0),
        totalRemaining:result.totalRemaining.toFixed(0),totalOverspend:result.totalOverspend.toFixed(0),
        accumulationAtEnd:Decimal.max(projectedNet,ZERO).toFixed(0),
        projectedActualGoalAmount:Decimal.max(projectedNet,ZERO).minus(Decimal.max(opening,ZERO)).toFixed(0),
        pendingIncome:calc.ledger.pendingIncome.toFixed(0),pendingExpense:calc.ledger.pendingExpense.toFixed(0),
        jars:FINANCIAL_JAR_CODES.map(jarCode => ({jarCode,percentage:calc.percentages[jarCode].toFixed(2),allocatedAmount:result.allocatedByJar[jarCode].toFixed(0),expenseAmount:result.expenseByJar[jarCode].toFixed(0),remainingAmount:result.remainingByJar[jarCode].toFixed(0),overspendAmount:result.overspendByJar[jarCode].toFixed(0)})),
      });
    }
    const health = deriveFinancialPlanHealth({ currentMonth:businessMonth,targetMonth,targetAmount:plan.targetAmount.toString(),
      realizedProgress:realized,requiredProgressThroughClosedMonths:expectedThrough(addMonths(businessMonth,-1)),projectedEndOfPlanProgress:Decimal.max(projectedNet,ZERO) });
    const percentage = (amount:Decimal) => Decimal.min(amount.div(plan.targetAmount.toString()).times(100),100).toDecimalPlaces(1).toString();
    return {
      id:plan.id,name:plan.name,status:plan.status as "active"|"completed"|"cancelled",health,targetAmount:plan.targetAmount.toString(),
      existingGoalAmount:Decimal.max(baseline,ZERO).toFixed(0),startMonth,targetMonth,realizedProgress:realized.toFixed(0),
      closedSnapshotProgress:closedSnapshotProgress.toFixed(0),adjustedActualProgress:realized.toFixed(0),
      projectedEndOfCurrentMonthProgress:projectedCurrent.toFixed(0),projectedEndOfPlanProgress:Decimal.max(projectedNet,ZERO).toFixed(0),
      realizedProgressPercentage:percentage(realized),projectedCurrentProgressPercentage:percentage(projectedCurrent),businessMonth,
      canComplete:realized.gte(plan.targetAmount.toString()),months:[...closedMonths,...projectedMonths],canManage:isAdminRole(member.role.code),
    };
  });
}

export async function getWorkspaceFinancialPlans(userId: string, workspaceId: string, now = new Date()) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const active = await prisma.financialPlan.findFirst({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true } });
  if (active) await catchUpFinancialPlan(active.id, now);
  return prisma.financialPlan.findMany({ where: { workspaceId, deletedAt: null, ...(!isAdminRole(member.role.code) ? { status: { not: "draft" as const } } : {}) }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, status: true, targetAmount: true, existingGoalAmount: true, startMonth: true, targetMonth: true, updatedAt: true } });
}

export async function processAllFinancialPlanMonthClosures(now = new Date()) {
  const plans = await prisma.financialPlan.findMany({ where: { status: "active", deletedAt: null }, select: { id: true }, orderBy: { createdAt: "asc" } });
  let closed = 0;
  let completed = 0;
  for (const plan of plans) {
    const result = await catchUpFinancialPlan(plan.id, now);
    closed += result.closed;
    if (result.completed) completed += 1;
  }
  return { handledPlans: plans.length, closedMonths: closed, completedPlans: completed };
}
