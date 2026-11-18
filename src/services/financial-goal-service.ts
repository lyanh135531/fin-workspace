import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import {
  FINANCIAL_JAR_CODES, allocateGoalFundingByPriority, createFinancialPlanWithGoalsSchema,
  deriveGoalHealth, financialPlanPreviewSchema, monthsInclusive,
  simulateGoalFunding, validateJarPercentages, type CreateFinancialPlanGoalInput,
  type CreateFinancialPlanWithGoalsInput, type PlanJarPercentagesInput, type UpdateFinancialPlanGoalInput,
} from "@/domain";
import { formatInTimeZone } from "date-fns-tz";
import { databaseDateToMonth, monthToDatabaseDate } from "@/domain/financial-plan/month";
import { isAdminRole } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getFinancialPlanNetBalance } from "@/services/financial-plan-progress";
import { requireWorkspaceMember } from "@/services/workspace-access";

type TransactionClient = Prisma.TransactionClient;
const ZERO = new Decimal(0);
export function allocateAutomaticProgress(
  goals: Array<{ id: string; targetAmount: { toString(): string }; sortOrder: number; targetMonth: Date; createdAt: Date }>,
  balance: Decimal.Value,
) {
  let remaining = Decimal.max(balance, ZERO);
  const progress = new Map<string, Decimal>();
  for (const goal of [...goals].sort((a,b) => a.sortOrder-b.sortOrder || a.targetMonth.getTime()-b.targetMonth.getTime() || a.createdAt.getTime()-b.createdAt.getTime() || a.id.localeCompare(b.id))) {
    const allocated = Decimal.min(remaining, goal.targetAmount.toString());
    progress.set(goal.id, allocated);
    remaining = remaining.minus(allocated);
  }
  return progress;
}

export async function getPlanGoalProgressSummary(tx: TransactionClient, planId: string, options?: { asOfEnd?: Date; monthStart?: Date }) {
  const plan = await tx.financialPlan.findFirstOrThrow({ where: { id: planId, deletedAt: null } });
  const goals = await tx.financialPlanGoal.findMany({
    where: { financialPlanId: planId, deletedAt: null,
      ...(plan.status === "cancelled" && plan.cancelledAt
        ? { OR: [{ status: { in: ["draft", "active", "completed"] } }, { status: "cancelled", cancelledAt: { gte: plan.cancelledAt } }] }
        : { status: { in: ["draft", "active", "completed"] } }),
    },
    orderBy: [{ sortOrder: "asc" }, { targetMonth: "asc" }, { createdAt: "asc" }],
  });
  const terminal = plan.status === "completed" || plan.status === "cancelled";
  const netBalance = terminal && !options?.asOfEnd
    ? new Decimal(plan.existingGoalAmount.toString())
    : await getFinancialPlanNetBalance(tx, plan.workspaceId, options?.asOfEnd);
  return {
    hasGoals: goals.length > 0, netBalance,
    totalProgress: Decimal.max(netBalance, ZERO),
    progressByGoal: allocateAutomaticProgress(goals, netBalance),
    goals,
  };
}

async function managedGoal(tx: TransactionClient, workspaceId: string, goalId: string) {
  const goal = await tx.financialPlanGoal.findFirst({
    where: { id: goalId, deletedAt: null, financialPlan: { workspaceId, deletedAt: null } },
    include: { financialPlan: true },
  });
  if (!goal) throw new AppError("NOT_FOUND", "Không tìm thấy mục tiêu trong workspace này.");
  if (!["draft", "active"].includes(goal.financialPlan.status)) throw new AppError("CONFLICT", "Kế hoạch đã kết thúc.");
  return goal;
}
export async function syncPlanAggregate(tx: TransactionClient, planId: string) {
  const plan = await tx.financialPlan.findFirstOrThrow({ where: { id: planId, deletedAt: null } });
  const goals = await tx.financialPlanGoal.findMany({
    where: { financialPlanId: planId, deletedAt: null, status: { in: ["draft", "active", "completed"] } },
  });
  if (!goals.length) return;
  const target = goals.reduce((sum,g) => sum.plus(g.targetAmount.toString()), ZERO);
  let targetMonth = goals.reduce((latest,g) => g.targetMonth > latest ? g.targetMonth : latest, goals[0].targetMonth);
  if (plan.startMonth && targetMonth < plan.startMonth) targetMonth = plan.startMonth;
  const closed = await tx.financialPlanMonth.findFirst({ where: { financialPlanId: planId }, orderBy: { month: "desc" } });
  if (closed && targetMonth < closed.month) targetMonth = closed.month;
  // Never silently extend an overdue plan and never turn funding entries into progress.
  await tx.financialPlan.update({ where: { id: planId }, data: {
    targetAmount: target, targetMonth,
    existingGoalAmount: Decimal.min(target, Decimal.max(plan.existingGoalAmount.toString(), ZERO)),
  } });
}

async function closeBeforeGoalMutation(tx: TransactionClient, workspaceId: string, planId: string) {
  const owned = await tx.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null } });
  if (!owned) throw new AppError("NOT_FOUND", "Plan not found in workspace.");
  const { catchUpFinancialPlanInTransaction } = await import("./financial-plan-service");
  await catchUpFinancialPlanInTransaction(tx, planId);
}

async function lockPlan(tx: TransactionClient, planId: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-plan:${planId}`}))`);
}
function rows(planId: string, percentages: PlanJarPercentagesInput) {
  const valid = validateJarPercentages(percentages);
  return FINANCIAL_JAR_CODES.map(jarCode => ({ financialPlanId: planId, jarCode, percentage: valid[jarCode], effectiveMonth: monthToDatabaseDate("1970-01") }));
}
async function createGoal(tx: TransactionClient, planId: string, input: CreateFinancialPlanWithGoalsInput["goals"][number], memberId: string, status: "draft" | "active", sortOrder: number) {
  return tx.financialPlanGoal.create({ data: {
    financialPlanId: planId, name: input.name, targetAmount: input.targetAmount,
    targetMonth: monthToDatabaseDate(input.targetMonth), trackingMode: "manual",
    linkedWalletId: null, createdByMemberId: memberId, status, sortOrder,
  } });
}
export async function createFinancialPlanWithGoals(userId: string, workspaceId: string, rawInput: CreateFinancialPlanWithGoalsInput) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const input = createFinancialPlanWithGoalsSchema.parse(rawInput);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-plan-workspace:${workspaceId}`}))`);
    const active = await tx.financialPlan.findFirst({ where: { workspaceId, status: "active", deletedAt: null } });
    if (active) throw new AppError("CONFLICT", "Workspace đã có một kế hoạch đang hoạt động.");
    const targetAmount = input.goals.reduce((sum,g) => sum.plus(g.targetAmount), ZERO);
    const targetMonth = input.goals.reduce((latest,g) => g.targetMonth > latest ? g.targetMonth : latest, input.goals[0].targetMonth);
    const plan = await tx.financialPlan.create({ data: {
      workspaceId, createdByMemberId: member.id, name: input.name, targetAmount,
      existingGoalAmount: ZERO, targetMonth: monthToDatabaseDate(targetMonth),
    } });
    for (const [index, goal] of input.goals.entries()) await createGoal(tx, plan.id, goal, member.id, "draft", index);
    await tx.planJarAllocation.createMany({ data: rows(plan.id, input.percentages) });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_plan.draft_created", entityType: "financial_plan", entityId: plan.id, metadata: { goalCount: input.goals.length, progressSource: "workspace_net_balance" } } });
    return plan;
  });
}
export async function createFinancialPlanGoal(userId: string, workspaceId: string, input: CreateFinancialPlanGoalInput) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async tx => {
    await lockPlan(tx, input.planId);
    await closeBeforeGoalMutation(tx, workspaceId, input.planId);
    const plan = await tx.financialPlan.findFirst({ where: { id: input.planId, workspaceId, deletedAt: null } });
    if (!plan || !["draft","active"].includes(plan.status)) throw new AppError("CONFLICT", "Chỉ thêm mục tiêu vào kế hoạch nháp hoặc đang chạy.");
    if (input.targetMonth < formatInTimeZone(new Date(), member.workspace.timeZone, "yyyy-MM")) throw new AppError("VALIDATION_ERROR", "Deadline không được trước tháng hiện tại.");
    const count = await tx.financialPlanGoal.count({ where: { financialPlanId: plan.id, deletedAt: null } });
    if (count >= 20) throw new AppError("VALIDATION_ERROR", "Kế hoạch có tối đa 20 mục tiêu.");
    const goal = await createGoal(tx, plan.id, input, member.id, plan.status === "draft" ? "draft" : "active", count);
    await syncPlanAggregate(tx, plan.id);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.created", entityType: "financial_plan_goal", entityId: goal.id } });
    return goal;
  });
}
export async function updateFinancialPlanGoal(userId: string, workspaceId: string, input: UpdateFinancialPlanGoalInput) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async tx => {
    const candidate = await managedGoal(tx, workspaceId, input.goalId);
    await lockPlan(tx, candidate.financialPlanId);
    await closeBeforeGoalMutation(tx, workspaceId, candidate.financialPlanId);
    const goal = await managedGoal(tx, workspaceId, input.goalId);
    if (!["draft","active"].includes(goal.status)) throw new AppError("CONFLICT", "Mục tiêu đã kết thúc.");
    if (input.targetMonth < formatInTimeZone(new Date(), member.workspace.timeZone, "yyyy-MM")) throw new AppError("VALIDATION_ERROR", "Deadline không được trước tháng hiện tại.");
    const updated = await tx.financialPlanGoal.update({ where: { id: goal.id }, data: {
      name: input.name, targetAmount: input.targetAmount, targetMonth: monthToDatabaseDate(input.targetMonth),
    } });
    await syncPlanAggregate(tx, goal.financialPlanId);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.updated", entityType: "financial_plan_goal", entityId: goal.id } });
    return updated;
  });
}
export async function reorderFinancialPlanGoals(userId: string, workspaceId: string, planId: string, goalIds: string[]) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async tx => {
    await lockPlan(tx, planId);
    await closeBeforeGoalMutation(tx, workspaceId, planId);
    const plan = await tx.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null, status: { in: ["draft","active"] } } });
    if (!plan) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch đang chỉnh sửa.");
    const goals = await tx.financialPlanGoal.findMany({ where: { financialPlanId: planId, deletedAt: null }, select: { id: true } });
    if (new Set(goalIds).size !== goalIds.length || goals.length !== goalIds.length || goals.some(g => !goalIds.includes(g.id))) throw new AppError("VALIDATION_ERROR", "Danh sách ưu tiên không hợp lệ.");
    for (const [sortOrder,id] of goalIds.entries()) await tx.financialPlanGoal.update({ where: { id }, data: { sortOrder } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.reordered", entityType: "financial_plan", entityId: planId, metadata: { goalIds } } });
  });
}
// Retain callable compatibility for old clients, but no manual entry may mutate progress.
export async function createFinancialGoalFunding(..._args: unknown[]): Promise<never> { void _args; throw new AppError("CONFLICT", "Tiến độ được tính tự động từ số dư ví sau dư nợ thẻ. Không còn nhập đóng góp thủ công."); }
export const reviewFinancialGoalFunding = createFinancialGoalFunding;
export const reverseFinancialGoalFunding = createFinancialGoalFunding;

export async function finishFinancialPlanGoal(userId: string, workspaceId: string, goalId: string, status: "completed" | "cancelled") {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async tx => {
    const candidate = await managedGoal(tx, workspaceId, goalId);
    await lockPlan(tx, candidate.financialPlanId);
    await closeBeforeGoalMutation(tx, workspaceId, candidate.financialPlanId);
    const goal = await managedGoal(tx, workspaceId, goalId);
    const now = new Date();
    if (goal.status === "draft" && status === "cancelled") {
      if (await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, deletedAt: null } }) <= 1) throw new AppError("VALIDATION_ERROR", "Kế hoạch phải có ít nhất một mục tiêu.");
      const updated = await tx.financialPlanGoal.update({ where: { id: goal.id }, data: { status, cancelledAt: now, deletedAt: now } });
      await syncPlanAggregate(tx, goal.financialPlanId);
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.cancelled", entityType: "financial_plan_goal", entityId: goal.id } });
      return updated;
    }
    if (goal.status !== "active") throw new AppError("CONFLICT", "Chỉ mục tiêu đang chạy mới có thể kết thúc.");
    const progress = await getPlanGoalProgressSummary(tx, goal.financialPlanId);
    if (status === "completed" && (progress.progressByGoal.get(goal.id) ?? ZERO).lt(goal.targetAmount.toString())) throw new AppError("VALIDATION_ERROR", "Mục tiêu chưa đủ tiền để hoàn thành.");
    const updated = await tx.financialPlanGoal.update({ where: { id: goal.id }, data: { status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }) } });
    await syncPlanAggregate(tx, goal.financialPlanId);
    const remaining = await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, status: "active", deletedAt: null } });
    if (!remaining) {
      const completed = await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, status: "completed", deletedAt: null } });
      const refreshed = await tx.financialPlan.findUniqueOrThrow({ where: { id: goal.financialPlanId } });
      await tx.financialPlan.update({ where: { id: goal.financialPlanId }, data: {
        status: completed ? "completed" : "cancelled", ...(completed ? { completedAt: now } : { cancelledAt: now }),
        existingGoalAmount: Decimal.min(progress.totalProgress, refreshed.targetAmount.toString()),
      } });
    }
    await tx.financialGoalFundingEntry.updateMany({ where: { goalId, status: "pending" }, data: { status: "rejected", reviewerMemberId: member.id, reviewedAt: now } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: `financial_goal.${status}`, entityType: "financial_plan_goal", entityId: goalId } });
    return updated;
  });
}
export async function activateFinancialPlanGoals(tx: TransactionClient, _workspaceId: string, planId: string, month: string) {
  const goals = await tx.financialPlanGoal.findMany({ where: { financialPlanId: planId, status: "draft", deletedAt: null } });
  if (!goals.length) throw new AppError("VALIDATION_ERROR", "Kế hoạch phải có ít nhất một mục tiêu.");
  if (goals.some(g => databaseDateToMonth(g.targetMonth) < month)) throw new AppError("VALIDATION_ERROR", "Có mục tiêu đã qua tháng hoàn thành.");
  await tx.financialPlanGoal.updateMany({ where: { financialPlanId: planId, status: "draft", deletedAt: null }, data: { status: "active", trackingMode: "manual", linkedWalletId: null } });
  await syncPlanAggregate(tx, planId);
}
export async function getFinancialPlanGoalPortfolio(userId: string, workspaceId: string, planId: string, monthlyFundingCapacity: Decimal.Value, now = new Date(), projectedBalances: Array<{ month: string; balance: string }> = []) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const month = formatInTimeZone(now, member.workspace.timeZone, "yyyy-MM");
  return prisma.$transaction(async tx => {
    const plan = await tx.financialPlan.findFirst({ where: { id: planId, workspaceId, deletedAt: null } });
    if (!plan || (plan.status === "draft" && !isAdminRole(member.role.code))) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch.");
    const summary = await getPlanGoalProgressSummary(tx, planId);
    const goals = await tx.financialPlanGoal.findMany({ where: { financialPlanId: planId, deletedAt: null }, orderBy: [{ sortOrder:"asc" },{ targetMonth:"asc" },{ createdAt:"asc" }] });
    const candidates = summary.goals.filter(g => ["draft","active"].includes(g.status)).map(g => ({
      id:g.id, targetAmount:g.targetAmount.toString(), actualProgress:summary.progressByGoal.get(g.id) ?? ZERO,
      targetMonth:databaseDateToMonth(g.targetMonth), sortOrder:g.sortOrder, createdAt:g.createdAt,
    }));
    const openingBalance = plan.status === "draft" ? summary.netBalance
      : plan.progressBaselineAt && formatInTimeZone(plan.progressBaselineAt, member.workspace.timeZone, "yyyy-MM") === month
        ? new Decimal(plan.progressBaselineBalance?.toString() ?? 0)
        : plan.startMonth && databaseDateToMonth(plan.startMonth) === month
        ? new Decimal(plan.activationWorkspaceBalance?.toString() ?? 0)
        : plan.status === "active" ? await getFinancialPlanNetBalance(tx, workspaceId, monthToDatabaseDate(month)) : summary.netBalance;
    const openingProgress = allocateAutomaticProgress(summary.goals, openingBalance);
    const monthlyCandidates = candidates.map(candidate => ({...candidate, actualProgress: openingProgress.get(candidate.id) ?? ZERO}));
    const allocations = new Map(allocateGoalFundingByPriority(monthlyCandidates, monthlyFundingCapacity, month).map(a => [a.goalId,a]));
    const simulation = simulateGoalFunding({ goals:candidates, monthlyFundingCapacity, startMonth:month });
    const baseline = allocateAutomaticProgress(summary.goals, plan.progressBaselineBalance?.toString() ?? plan.activationWorkspaceBalance?.toString() ?? summary.netBalance);
    const start = plan.progressBaselineAt ? formatInTimeZone(plan.progressBaselineAt, member.workspace.timeZone, "yyyy-MM") : plan.startMonth ? databaseDateToMonth(plan.startMonth) : month;
    return goals.map(g => {
      const actual = summary.progressByGoal.get(g.id) ?? ZERO;
      const target = new Decimal(g.targetAmount.toString());
      const deadline = databaseDateToMonth(g.targetMonth);
      const deadlineBalance = projectedBalances.find(item => item.month === deadline);
      const projected = deadlineBalance
        ? allocateAutomaticProgress(summary.goals, deadlineBalance.balance).get(g.id) ?? ZERO
        : simulation.projectedByGoal.get(g.id) ?? actual;
      const elapsed = month <= start ? 0 : Math.min(monthsInclusive(start, month).length-1, monthsInclusive(start, deadline < start ? start : deadline).length);
      const initial = baseline.get(g.id) ?? ZERO;
      const expected = initial.plus(Decimal.max(target.minus(initial),ZERO).times(elapsed).dividedToIntegerBy(monthsInclusive(start, deadline < start ? start : deadline).length));
      return {
        id:g.id, name:g.name, status:g.status, progressSource:"workspace_net_balance" as const,
        targetAmount:target.toFixed(0), targetMonth:deadline, sortOrder:g.sortOrder,
        actualProgress:actual.toFixed(0), progressPercentage:Decimal.min(actual.div(target).times(100),100).toDecimalPlaces(1).toString(),
        requiredThisMonth:allocations.get(g.id)?.requiredAmount.toFixed(0) ?? "0",
        projectedThisMonth:allocations.get(g.id)?.allocatedAmount.toFixed(0) ?? "0",
        shortfallThisMonth:allocations.get(g.id)?.shortfall.toFixed(0) ?? "0",
        projectedAtDeadline:projected.toFixed(0),
        health:deriveGoalHealth({ currentMonth:month,targetMonth:deadline,targetAmount:target,actualProgress:actual,projectedAtDeadline:projected,expectedProgressNow:expected }),
        canManage:isAdminRole(member.role.code),
      };
    });
  });
}
export function previewFinancialPlan(rawInput: unknown, balance: Decimal.Value = ZERO) {
  const input = financialPlanPreviewSchema.parse(rawInput);
  let remaining = Decimal.max(balance,ZERO);
  const candidates = input.goals.map((g,index) => {
    const actualProgress = Decimal.min(remaining,g.targetAmount); remaining = remaining.minus(actualProgress);
    return { id:`goal-${index}`,targetAmount:g.targetAmount,actualProgress,targetMonth:g.targetMonth,sortOrder:index };
  });
  const simulation = simulateGoalFunding({goals:candidates,monthlyFundingCapacity:input.monthlyFundingCapacity,startMonth:input.startMonth});
  return {goals:input.goals.map((g,index) => {
    const allocation = simulation.months[0]?.allocations.find(a => a.goalId === `goal-${index}`);
    return {name:g.name,requiredThisMonth:allocation?.requiredAmount.toFixed(0) ?? "0",projectedThisMonth:allocation?.allocatedAmount.toFixed(0) ?? "0",shortfallThisMonth:allocation?.shortfall.toFixed(0) ?? "0",projectedAtDeadline:simulation.projectedByGoal.get(`goal-${index}`)?.toFixed(0) ?? "0",targetAmount:g.targetAmount.toFixed(0)};
  })};
}
