import Decimal from "decimal.js";
import { Prisma, type FinancialPlanStatus } from "@/generated/prisma/client";
import {
  FINANCIAL_PLAN_CALCULATOR_VERSION,
  calculateLiveRequiredAmount,
  calculateMonthlyPlanBudget,
  databaseDateToMonth,
  decimalMap,
  deriveFinancialPlanHealth,
  firstMonthRawGrossBudget,
  laterMonthRawGrossBudget,
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
import { FINANCIAL_JAR_CODES } from "@/domain/financial-jar/jars";
import { addMonths, monthDateRange } from "@/domain/financial-plan/month";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { isAdminRole } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  combinedExpenseByJar,
  getFinancialPlanMonthLedger,
  getWorkspaceBalance,
} from "@/services/financial-plan-ledger";
import { requireWorkspaceMember } from "@/services/workspace-access";

type TransactionClient = Prisma.TransactionClient;
const DRAFT_ALLOCATION_MONTH = "1970-01";
const ZERO = new Decimal(0);

function appValidation(error: unknown): never {
  throw new AppError("VALIDATION_ERROR", error instanceof Error ? error.message : "Dữ liệu kế hoạch không hợp lệ.");
}

function currentMonth(timeZone: string, now: Date) {
  return getBusinessDateInTimeZone(timeZone, now).slice(0, 7);
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

export async function createFinancialPlanDraft(
  userId: string,
  workspaceId: string,
  input: CreateFinancialPlanInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  try { validateJarPercentages(input.percentages); } catch (error) { appValidation(error); }
  return prisma.$transaction(async (tx) => {
    const plan = await tx.financialPlan.create({
      data: {
        workspaceId, createdByMemberId: member.id, name: input.name,
        targetAmount: input.targetAmount, existingGoalAmount: input.existingGoalAmount,
        targetMonth: monthToDatabaseDate(input.targetMonth),
      },
    });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, DRAFT_ALLOCATION_MONTH, input.percentages) });
    await tx.auditLog.create({
      data: { workspaceId, actorUserId: userId, action: "financial_plan.draft_created", entityType: "financial_plan", entityId: plan.id,
        metadata: { targetAmount: input.targetAmount.toFixed(0), existingGoalAmount: input.existingGoalAmount.toFixed(0), targetMonth: input.targetMonth } },
    });
    return plan;
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
    const plan = await managedPlan(tx, workspaceId, input.planId);
    if (plan.status !== "draft") throw new AppError("CONFLICT", "Chỉ kế hoạch nháp mới được sửa toàn bộ.");
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: {
      name: input.name, targetAmount: input.targetAmount, existingGoalAmount: input.existingGoalAmount,
      targetMonth: monthToDatabaseDate(input.targetMonth),
    } });
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id } });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, DRAFT_ALLOCATION_MONTH, input.percentages) });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.draft_updated", entityType: "financial_plan", entityId: plan.id } });
    return updated;
  });
}

export async function deleteFinancialPlanDraft(userId: string, workspaceId: string, planId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "draft") throw new AppError("CONFLICT", "Chỉ kế hoạch nháp mới được xóa vĩnh viễn.");
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.draft_deleted", entityType: "financial_plan", entityId: plan.id } });
    return tx.financialPlan.delete({ where: { id: plan.id } });
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
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "draft") throw new AppError("CONFLICT", "Kế hoạch không còn ở trạng thái nháp.");
    if (databaseDateToMonth(plan.targetMonth) < month) throw new AppError("VALIDATION_ERROR", "Deadline không được trước tháng hiện tại.");
    const active = await tx.financialPlan.findFirst({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true } });
    if (active) throw new AppError("CONFLICT", "Workspace đã có một kế hoạch đang hoạt động.");
    const balance = await getWorkspaceBalance(tx, workspaceId);
    const existing = new Decimal(plan.existingGoalAmount.toString());
    if (existing.greaterThan(Decimal.max(balance, ZERO))) {
      throw new AppError("VALIDATION_ERROR", "Tiền đã dành sẵn không được lớn hơn số dư thực tế của workspace.");
    }
    const draftPercentages = allocationForMonth(plan.allocations, DRAFT_ALLOCATION_MONTH);
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id } });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, month, draftPercentages) });
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: {
      status: "active", startMonth: monthToDatabaseDate(month), activatedAt: now,
      activationWorkspaceBalance: balance,
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

async function adjustedClosedActual(tx: TransactionClient, workspaceId: string, month: {
  month: Date; adjustedRequiredAmount: { toString(): string }; allocatableGrossBudget: { toString(): string };
  resourceShortfall: { toString(): string };
}) {
  const ledger = await getFinancialPlanMonthLedger(tx, workspaceId, databaseDateToMonth(month.month), false);
  const expense = sumJarMap(ledger.approvedExpenseByJar);
  return Decimal.max(
    new Decimal(month.adjustedRequiredAmount.toString())
      .plus(month.allocatableGrossBudget.toString()).minus(expense).minus(month.resourceShortfall.toString()),
    ZERO,
  );
}

async function closeOneFinancialPlanMonth(planId: string, month: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    await advisoryPlanLock(tx, planId);
    const plan = await tx.financialPlan.findFirst({
      where: { id: planId, status: "active", deletedAt: null },
      include: { allocations: true, months: { include: { jars: true }, orderBy: { month: "asc" } }, workspace: true },
    });
    if (!plan || !plan.startMonth) return { kind: "skipped" as const };
    const startMonth = databaseDateToMonth(plan.startMonth);
    const targetMonth = databaseDateToMonth(plan.targetMonth);
    if (month < startMonth || month > targetMonth || plan.months.some((item) => databaseDateToMonth(item.month) === month)) {
      return { kind: "skipped" as const };
    }
    const closeOrder = monthsInclusive(startMonth, month);
    const firstUnclosed = closeOrder.find((candidate) => !plan.months.some((item) => databaseDateToMonth(item.month) === candidate));
    if (firstUnclosed !== month) throw new AppError("CONFLICT", "Phải đóng các tháng kế hoạch theo đúng thứ tự.");

    let realized = new Decimal(plan.existingGoalAmount.toString());
    for (const closed of plan.months) realized = realized.plus(await adjustedClosedActual(tx, plan.workspaceId, closed));
    const remainingMonths = monthsInclusive(month, targetMonth);
    const adjustedRequired = splitVndAcrossMonths(Decimal.max(new Decimal(plan.targetAmount.toString()).minus(realized), ZERO), remainingMonths.length)[0];
    const allMonths = monthsInclusive(startMonth, targetMonth);
    const baseAmounts = splitVndAcrossMonths(
      Decimal.max(new Decimal(plan.targetAmount.toString()).minus(plan.existingGoalAmount.toString()), ZERO),
      allMonths.length,
    );
    const baseRequired = baseAmounts[allMonths.indexOf(month)];
    const ledger = await getFinancialPlanMonthLedger(tx, plan.workspaceId, month, false);
    const expenseByJar = ledger.approvedExpenseByJar;
    let rawGrossBudget: Decimal;
    if (month === startMonth) {
      const { end } = monthDateRange(month);
      const balanceAtEnd = await getWorkspaceBalance(tx, plan.workspaceId, end);
      rawGrossBudget = firstMonthRawGrossBudget({
        currentWorkspaceBalance: balanceAtEnd,
        existingGoalAmount: plan.existingGoalAmount.toString(),
        approvedExpenseFromMonthStart: sumJarMap(ledger.approvedExpenseByJar),
        remainingForecastIncome: 0,
        requiredGoalAmount: adjustedRequired,
      });
    } else {
      rawGrossBudget = laterMonthRawGrossBudget({ forecastIncome: ledger.approvedIncome, requiredGoalAmount: adjustedRequired });
    }
    const percentages = allocationForMonth(plan.allocations, month);
    const result = calculateMonthlyPlanBudget({ rawGrossBudget, requiredGoalAmount: adjustedRequired, eligibleExpensesByJar: expenseByJar, percentages });
    const snapshot = await tx.financialPlanMonth.create({ data: {
      financialPlanId: plan.id, month: monthToDatabaseDate(month), baseRequiredAmount: baseRequired,
      adjustedRequiredAmount: adjustedRequired, rawGrossBudget: result.rawGrossBudget,
      allocatableGrossBudget: result.allocatableGrossBudget, resourceShortfall: result.resourceShortfall,
      closedEligibleExpense: result.eligibleExpense, closedActualGoalAmount: result.actualGoalAmountForMonth,
      closedAt: now, calculatorVersion: FINANCIAL_PLAN_CALCULATOR_VERSION,
    } });
    await tx.financialPlanMonthJar.createMany({ data: FINANCIAL_JAR_CODES.map((jarCode) => ({
      financialPlanMonthId: snapshot.id, jarCode, percentage: percentages[jarCode],
      allocatedAmount: result.allocatedByJar[jarCode], closedActualAmount: result.expenseByJar[jarCode],
    })) });
    await tx.auditLog.create({ data: { workspaceId: plan.workspaceId, action: "financial_plan.month_closed", entityType: "financial_plan", entityId: plan.id,
      metadata: { month, adjustedRequiredAmount: adjustedRequired.toFixed(0), actualGoalAmount: result.actualGoalAmountForMonth.toFixed(0), calculatorVersion: FINANCIAL_PLAN_CALCULATOR_VERSION } } });

    const totalAfterClose = realized.plus(result.actualGoalAmountForMonth);
    let completed = false;
    if (month === targetMonth && totalAfterClose.greaterThanOrEqualTo(plan.targetAmount.toString())) {
      await tx.financialPlan.update({ where: { id: plan.id }, data: { status: "completed", completedAt: now } });
      await tx.auditLog.create({ data: { workspaceId: plan.workspaceId, action: "financial_plan.completed", entityType: "financial_plan", entityId: plan.id,
        metadata: { automatic: true, realizedProgress: totalAfterClose.toFixed(0) } } });
      completed = true;
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
  const openMonth = currentMonth(plan.workspace.timeZone, now);
  const lastCloseable = [addMonths(openMonth, -1), databaseDateToMonth(plan.targetMonth)].sort()[0];
  let closed = 0;
  let completed = false;
  for (const month of monthsInclusive(databaseDateToMonth(plan.startMonth), databaseDateToMonth(plan.targetMonth))) {
    if (month > lastCloseable || plan.months.some((item) => databaseDateToMonth(item.month) === month)) continue;
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
  await catchUpFinancialPlan(planId, now);
  const current = currentMonth(member.workspace.timeZone, now);
  if (targetMonth < current) throw new AppError("VALIDATION_ERROR", "Deadline mới không được trước tháng hiện tại.");
  return prisma.$transaction(async (tx) => {
    await advisoryPlanLock(tx, planId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "active") throw new AppError("CONFLICT", "Chỉ kế hoạch đang hoạt động mới được đổi deadline.");
    const previous = databaseDateToMonth(plan.targetMonth);
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: { targetMonth: monthToDatabaseDate(targetMonth) } });
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
  await catchUpFinancialPlan(planId, now);
  const effectiveMonth = addMonths(currentMonth(member.workspace.timeZone, now), 1);
  return prisma.$transaction(async (tx) => {
    await advisoryPlanLock(tx, planId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "active") throw new AppError("CONFLICT", "Chỉ kế hoạch đang hoạt động mới được đổi tỷ lệ.");
    if (effectiveMonth > databaseDateToMonth(plan.targetMonth)) throw new AppError("VALIDATION_ERROR", "Kế hoạch không còn tháng tương lai để áp dụng tỷ lệ mới.");
    await tx.planJarAllocation.deleteMany({ where: { financialPlanId: plan.id, effectiveMonth: monthToDatabaseDate(effectiveMonth) } });
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, effectiveMonth, percentages) });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.allocation_updated", entityType: "financial_plan", entityId: plan.id,
      metadata: { effectiveMonth, percentages: Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [jarCode, percentages[jarCode].toString()])) } } });
    return { effectiveMonth };
  });
}

async function finishFinancialPlan(
  userId: string, workspaceId: string, planId: string, status: Extract<FinancialPlanStatus, "completed" | "cancelled">, now: Date,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  await catchUpFinancialPlan(planId, now);
  return prisma.$transaction(async (tx) => {
    await advisoryWorkspaceLock(tx, workspaceId);
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status !== "active") throw new AppError("CONFLICT", "Kế hoạch không còn hoạt động.");
    if (status === "completed") {
      let realized = new Decimal(plan.existingGoalAmount.toString());
      for (const month of plan.months) realized = realized.plus(await adjustedClosedActual(tx, workspaceId, month));
      if (realized.lessThan(plan.targetAmount.toString())) throw new AppError("VALIDATION_ERROR", "Chưa đạt mục tiêu nên không thể đánh dấu hoàn thành.");
    }
    const updated = await tx.financialPlan.update({ where: { id: plan.id }, data: {
      status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }),
    } });
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

function moneyMapToStrings(values: JarDecimalMap) {
  return Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [jarCode, values[jarCode].toFixed(0)])) as Record<FinancialJarCode, string>;
}

export async function getFinancialPlanView(userId: string, workspaceId: string, planId: string, now = new Date()) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  await catchUpFinancialPlan(planId, now);
  return prisma.$transaction(async (tx) => {
    const plan = await managedPlan(tx, workspaceId, planId);
    if (plan.status === "draft" || !plan.startMonth) {
      const percentages = allocationForMonth(plan.allocations, DRAFT_ALLOCATION_MONTH);
      return {
        id: plan.id, name: plan.name, status: "draft" as const, targetAmount: plan.targetAmount.toString(),
        existingGoalAmount: plan.existingGoalAmount.toString(), startMonth: null,
        targetMonth: databaseDateToMonth(plan.targetMonth), percentages: moneyMapToStrings(percentages),
        canManage: isAdminRole(member.role.code),
      };
    }
    const startMonth = databaseDateToMonth(plan.startMonth);
    const targetMonth = databaseDateToMonth(plan.targetMonth);
    const businessMonth = currentMonth(member.workspace.timeZone, now);
    let closedSnapshotProgress = new Decimal(plan.existingGoalAmount.toString());
    let adjustedActualProgress = new Decimal(plan.existingGoalAmount.toString());
    let requiredProgressThroughClosedMonths = new Decimal(plan.existingGoalAmount.toString());
    const closedMonths = [];
    for (const month of plan.months) {
      const adjustedActual = await adjustedClosedActual(tx, workspaceId, month);
      closedSnapshotProgress = closedSnapshotProgress.plus(month.closedActualGoalAmount.toString());
      adjustedActualProgress = adjustedActualProgress.plus(adjustedActual);
      requiredProgressThroughClosedMonths = requiredProgressThroughClosedMonths.plus(month.adjustedRequiredAmount.toString());
      closedMonths.push({
        month: databaseDateToMonth(month.month), closed: true,
        baseRequiredAmount: month.baseRequiredAmount.toString(), adjustedRequiredAmount: month.adjustedRequiredAmount.toString(),
        rawGrossBudget: month.rawGrossBudget.toString(), allocatableGrossBudget: month.allocatableGrossBudget.toString(),
        resourceShortfall: month.resourceShortfall.toString(), closedActualGoalAmount: month.closedActualGoalAmount.toString(),
        adjustedActualGoalAmount: adjustedActual.toFixed(0), adjustedDelta: adjustedActual.minus(month.closedActualGoalAmount.toString()).toFixed(0),
        jars: month.jars.map((jar) => ({ jarCode: jar.jarCode, percentage: jar.percentage.toString(), allocatedAmount: jar.allocatedAmount.toString(), closedActualAmount: jar.closedActualAmount.toString() })),
      });
    }
    const realizedProgress = plan.status === "active" ? adjustedActualProgress : closedSnapshotProgress;
    const allPlanMonths = monthsInclusive(startMonth, targetMonth);
    const closedSet = new Set(plan.months.map((month) => databaseDateToMonth(month.month)));
    const openMonths = plan.status === "active"
      ? allPlanMonths.filter((month) => !closedSet.has(month))
      : [];
    const baseSchedule = splitVndAcrossMonths(
      Decimal.max(new Decimal(plan.targetAmount.toString()).minus(plan.existingGoalAmount.toString()), ZERO), allPlanMonths.length,
    );
    const currentBalance = openMonths.includes(startMonth) ? await getWorkspaceBalance(tx, workspaceId) : ZERO;
    const projectedMonths = [];
    let projectedProgress = realizedProgress;
    let projectedEndOfCurrentMonthProgress = realizedProgress;
    for (let index = 0; index < openMonths.length; index += 1) {
      const month = openMonths[index];
      const includeForecast = plan.status === "active" && month >= businessMonth;
      const ledger = await getFinancialPlanMonthLedger(tx, workspaceId, month, includeForecast);
      const expenseByJar = combinedExpenseByJar(ledger, includeForecast);
      const required = calculateLiveRequiredAmount({
        targetAmount: plan.targetAmount.toString(),
        projectedProgress,
        remainingOpenMonths: openMonths.length - index,
      });
      const rawGrossBudget = month === startMonth
        ? firstMonthRawGrossBudget({
            currentWorkspaceBalance: currentBalance, existingGoalAmount: plan.existingGoalAmount.toString(),
            approvedExpenseFromMonthStart: sumJarMap(ledger.approvedExpenseByJar),
            remainingForecastIncome: includeForecast ? ledger.forecastIncome : 0, requiredGoalAmount: required,
          })
        : laterMonthRawGrossBudget({ forecastIncome: ledger.approvedIncome.plus(includeForecast ? ledger.forecastIncome : 0), requiredGoalAmount: required });
      const percentages = allocationForMonth(plan.allocations, month);
      const result = calculateMonthlyPlanBudget({ rawGrossBudget, requiredGoalAmount: required, eligibleExpensesByJar: expenseByJar, percentages });
      projectedProgress = projectedProgress.plus(result.actualGoalAmountForMonth);
      if (month === businessMonth) projectedEndOfCurrentMonthProgress = realizedProgress.plus(result.actualGoalAmountForMonth);
      projectedMonths.push({
        month, closed: false, baseRequiredAmount: baseSchedule[allPlanMonths.indexOf(month)].toFixed(0), adjustedRequiredAmount: required.toFixed(0),
        rawGrossBudget: result.rawGrossBudget.toFixed(0), allocatableGrossBudget: result.allocatableGrossBudget.toFixed(0), resourceShortfall: result.resourceShortfall.toFixed(0),
        eligibleExpense: result.eligibleExpense.toFixed(0), totalRemaining: result.totalRemaining.toFixed(0), totalOverspend: result.totalOverspend.toFixed(0),
        projectedActualGoalAmount: result.actualGoalAmountForMonth.toFixed(0), pendingIncome: ledger.pendingIncome.toFixed(0), pendingExpense: ledger.pendingExpense.toFixed(0),
        jars: FINANCIAL_JAR_CODES.map((jarCode) => ({ jarCode, percentage: percentages[jarCode].toString(), allocatedAmount: result.allocatedByJar[jarCode].toFixed(0),
          expenseAmount: result.expenseByJar[jarCode].toFixed(0), remainingAmount: result.remainingByJar[jarCode].toFixed(0), overspendAmount: result.overspendByJar[jarCode].toFixed(0) })),
      });
    }
    const health = deriveFinancialPlanHealth({
      currentMonth: businessMonth, targetMonth, targetAmount: plan.targetAmount.toString(),
      realizedProgress, requiredProgressThroughClosedMonths, projectedEndOfPlanProgress: projectedProgress,
    });
    const percentageOfTarget = (amount: Decimal) => Decimal.min(
      amount.dividedBy(plan.targetAmount.toString()).times(100),
      new Decimal(100),
    ).toDecimalPlaces(1).toString();
    return {
      id: plan.id, name: plan.name, status: plan.status as "active" | "completed" | "cancelled", health,
      targetAmount: plan.targetAmount.toString(), existingGoalAmount: plan.existingGoalAmount.toString(),
      startMonth, targetMonth, realizedProgress: realizedProgress.toFixed(0), closedSnapshotProgress: closedSnapshotProgress.toFixed(0),
      adjustedActualProgress: adjustedActualProgress.toFixed(0), projectedEndOfCurrentMonthProgress: projectedEndOfCurrentMonthProgress.toFixed(0),
      projectedEndOfPlanProgress: projectedProgress.toFixed(0),
      realizedProgressPercentage: percentageOfTarget(realizedProgress),
      projectedCurrentProgressPercentage: percentageOfTarget(projectedEndOfCurrentMonthProgress),
      businessMonth,
      canComplete: realizedProgress.greaterThanOrEqualTo(plan.targetAmount.toString()),
      months: [...closedMonths, ...projectedMonths], canManage: isAdminRole(member.role.code),
    };
  });
}

export async function getWorkspaceFinancialPlans(userId: string, workspaceId: string, now = new Date()) {
  await requireWorkspaceMember(userId, workspaceId);
  const active = await prisma.financialPlan.findFirst({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true } });
  if (active) await catchUpFinancialPlan(active.id, now);
  return prisma.financialPlan.findMany({ where: { workspaceId, deletedAt: null }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
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
