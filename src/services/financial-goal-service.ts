import Decimal from "decimal.js";
import { Prisma, type FinancialPlanStatus } from "@/generated/prisma/client";
import {
  FINANCIAL_JAR_CODES,
  allocateGoalFundingByPriority,
  createFinancialPlanWithGoalsSchema,
  deriveGoalHealth,
  financialPlanPreviewSchema,
  monthsInclusive,
  simulateGoalFunding,
  validateJarPercentages,
  type CreateFinancialPlanGoalInput,
  type CreateFinancialPlanWithGoalsInput,
  type PlanJarPercentagesInput,
  type UpdateFinancialPlanGoalInput,
} from "@/domain";
import { isAdminRole } from "@/domain/role-policy";
import { formatInTimeZone } from "date-fns-tz";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { monthToDatabaseDate } from "@/domain/financial-plan/month";
import { requireWorkspaceMember } from "@/services/workspace-access";

type TransactionClient = Prisma.TransactionClient;
const ZERO = new Decimal(0);
const DRAFT_ALLOCATION_MONTH = "1970-01";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
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

async function assertLinkedWallet(
  tx: TransactionClient,
  workspaceId: string,
  walletId: string,
  excludeGoalId?: string,
) {
  const link = await tx.workspaceWallet.findFirst({
    where: {
      workspaceId,
      walletId,
      wallet: { kind: "asset", status: "active", deletedAt: null },
    },
    include: { wallet: true },
  });
  if (!link) throw new AppError("VALIDATION_ERROR", "Chỉ có thể liên kết ví tài sản đang hoạt động trong workspace này.");
  const conflict = await tx.financialPlanGoal.findFirst({
    where: {
      linkedWalletId: walletId,
      deletedAt: null,
      status: { in: ["draft", "active"] },
      ...(excludeGoalId ? { id: { not: excludeGoalId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) throw new AppError("CONFLICT", "Ví này đang được dùng để theo dõi một mục tiêu khác.");
  return link.wallet;
}

async function goalProgress(tx: TransactionClient, goal: {
  id: string;
  trackingMode: "manual" | "linked_wallet";
  linkedWalletId: string | null;
}) {
  if (goal.trackingMode === "linked_wallet") {
    if (!goal.linkedWalletId) return ZERO;
    const wallet = await tx.wallet.findFirst({ where: { id: goal.linkedWalletId, deletedAt: null }, select: { currentBalance: true } });
    return Decimal.max(wallet?.currentBalance.toString() ?? 0, ZERO);
  }
  const total = await tx.financialGoalFundingEntry.aggregate({
    where: { goalId: goal.id, status: "approved" },
    _sum: { amount: true },
  });
  return Decimal.max(total._sum.amount?.toString() ?? 0, ZERO);
}

export function getFinancialGoalProgress(
  tx: TransactionClient,
  goal: { id: string; trackingMode: "manual" | "linked_wallet"; linkedWalletId: string | null },
) {
  return goalProgress(tx, goal);
}

export async function getPlanGoalProgressSummary(tx: TransactionClient, planId: string) {
  const goals = await tx.financialPlanGoal.findMany({
    where: { financialPlanId: planId, deletedAt: null, status: { in: ["draft", "active", "completed"] } },
  });
  let totalProgress = ZERO;
  let workspaceReserved = ZERO;
  for (const goal of goals) {
    const liveProgress = Decimal.min(await goalProgress(tx, goal), goal.targetAmount.toString());
    totalProgress = totalProgress.plus(goal.status === "completed" ? goal.targetAmount.toString() : liveProgress);
    if (goal.trackingMode === "linked_wallet") workspaceReserved = workspaceReserved.plus(liveProgress);
  }
  return { totalProgress, workspaceReserved, hasGoals: goals.length > 0 };
}

async function managedGoal(tx: TransactionClient, workspaceId: string, goalId: string) {
  const goal = await tx.financialPlanGoal.findFirst({
    where: { id: goalId, deletedAt: null, financialPlan: { workspaceId, deletedAt: null } },
    include: { financialPlan: true },
  });
  if (!goal) throw new AppError("NOT_FOUND", "Không tìm thấy mục tiêu trong workspace này.");
  return goal;
}

async function syncPlanAggregate(tx: TransactionClient, planId: string) {
  const goals = await tx.financialPlanGoal.findMany({
    where: { financialPlanId: planId, deletedAt: null, status: { in: ["draft", "active", "completed"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (!goals.length) return;
  let target = ZERO;
  let progress = ZERO;
  let targetMonth = goals[0].targetMonth;
  for (const goal of goals) {
    target = target.plus(goal.targetAmount.toString());
    progress = progress.plus(goal.status === "completed"
      ? goal.targetAmount.toString()
      : Decimal.min(await goalProgress(tx, goal), goal.targetAmount.toString()));
    if (goal.targetMonth > targetMonth) targetMonth = goal.targetMonth;
  }
  await tx.financialPlan.update({
    where: { id: planId },
    data: { targetAmount: target, existingGoalAmount: progress, targetMonth },
  });
}

async function createGoalRecord(
  tx: TransactionClient,
  input: CreateFinancialPlanGoalInput | (CreateFinancialPlanWithGoalsInput["goals"][number] & { planId: string }),
  memberId: string,
  workspaceId: string,
  status: FinancialPlanStatus,
  sortOrder: number,
) {
  if (input.trackingMode === "linked_wallet") {
    await assertLinkedWallet(tx, workspaceId, input.linkedWalletId!);
  }
  const goal = await tx.financialPlanGoal.create({
    data: {
      financialPlanId: input.planId,
      name: input.name,
      targetAmount: input.targetAmount,
      targetMonth: monthToDatabaseDate(input.targetMonth),
      trackingMode: input.trackingMode,
      linkedWalletId: input.trackingMode === "linked_wallet" ? input.linkedWalletId : null,
      sortOrder,
      status,
      createdByMemberId: memberId,
    },
  });
  if (input.trackingMode === "manual" && input.existingAmount.greaterThan(0)) {
    await tx.financialGoalFundingEntry.create({
      data: {
        goalId: goal.id,
        amount: input.existingAmount,
        kind: "opening",
        status: "approved",
        effectiveDate: new Date(),
        requesterMemberId: memberId,
        reviewerMemberId: memberId,
        reviewedAt: new Date(),
        note: "Số tiền đã xác nhận khi tạo mục tiêu",
      },
    });
  }
  return goal;
}

export async function createFinancialPlanWithGoals(
  userId: string,
  workspaceId: string,
  rawInput: CreateFinancialPlanWithGoalsInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const input = createFinancialPlanWithGoalsSchema.parse(rawInput);
  validateJarPercentages(input.percentages);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-plan-workspace:${workspaceId}`}))`);
    const active = await tx.financialPlan.findFirst({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true } });
    if (active) throw new AppError("CONFLICT", "Workspace đã có một kế hoạch tổng đang hoạt động.");
    const targetAmount = input.goals.reduce((sum, goal) => sum.plus(goal.targetAmount), ZERO);
    const targetMonth = input.goals.reduce((latest, goal) => goal.targetMonth > latest ? goal.targetMonth : latest, input.goals[0].targetMonth);
    const manualOpening = input.goals.reduce((sum, goal) => goal.trackingMode === "manual" ? sum.plus(goal.existingAmount) : sum, ZERO);
    const plan = await tx.financialPlan.create({
      data: {
        workspaceId,
        createdByMemberId: member.id,
        name: input.name,
        targetAmount,
        existingGoalAmount: manualOpening,
        targetMonth: monthToDatabaseDate(targetMonth),
      },
    });
    for (const [index, goal] of input.goals.entries()) {
      await createGoalRecord(tx, { ...goal, planId: plan.id }, member.id, workspaceId, "draft", index);
    }
    await tx.planJarAllocation.createMany({ data: allocationRows(plan.id, DRAFT_ALLOCATION_MONTH, input.percentages) });
    await syncPlanAggregate(tx, plan.id);
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "financial_plan.draft_created",
        entityType: "financial_plan",
        entityId: plan.id,
        metadata: { goalCount: input.goals.length, version: 2 },
      },
    });
    return plan;
  });
}

export async function createFinancialPlanGoal(
  userId: string,
  workspaceId: string,
  input: CreateFinancialPlanGoalInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const plan = await tx.financialPlan.findFirst({ where: { id: input.planId, workspaceId, deletedAt: null } });
    if (!plan || !["draft", "active"].includes(plan.status)) throw new AppError("CONFLICT", "Chỉ có thể thêm mục tiêu vào kế hoạch nháp hoặc đang chạy.");
    if (plan.status === "active" && input.targetMonth < formatInTimeZone(new Date(), member.workspace.timeZone, "yyyy-MM")) {
      throw new AppError("VALIDATION_ERROR", "Deadline mục tiêu không được trước tháng hiện tại.");
    }
    const count = await tx.financialPlanGoal.count({ where: { financialPlanId: plan.id, deletedAt: null } });
    const goal = await createGoalRecord(tx, input, member.id, workspaceId, plan.status, count);
    await syncPlanAggregate(tx, plan.id);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.created", entityType: "financial_plan_goal", entityId: goal.id } });
    return goal;
  });
}

export async function updateFinancialPlanGoal(
  userId: string,
  workspaceId: string,
  input: UpdateFinancialPlanGoalInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const goal = await managedGoal(tx, workspaceId, input.goalId);
    if (!["draft", "active"].includes(goal.status)) throw new AppError("CONFLICT", "Mục tiêu đã kết thúc và chỉ có thể xem.");
    if (goal.status === "active" && input.targetMonth < formatInTimeZone(new Date(), member.workspace.timeZone, "yyyy-MM")) {
      throw new AppError("VALIDATION_ERROR", "Deadline mục tiêu không được trước tháng hiện tại.");
    }
    if (goal.status === "active" && (input.trackingMode !== goal.trackingMode || (input.linkedWalletId ?? null) !== goal.linkedWalletId)) {
      throw new AppError("CONFLICT", "Không thể đổi nguồn theo dõi sau khi mục tiêu đã kích hoạt.");
    }
    if (input.trackingMode === "linked_wallet") await assertLinkedWallet(tx, workspaceId, input.linkedWalletId!, goal.id);
    const progress = await goalProgress(tx, goal);
    if (input.targetAmount.lessThan(progress)) throw new AppError("VALIDATION_ERROR", "Mục tiêu mới không được nhỏ hơn số tiền đã xác nhận.");
    const updated = await tx.financialPlanGoal.update({
      where: { id: goal.id },
      data: {
        name: input.name,
        targetAmount: input.targetAmount,
        targetMonth: monthToDatabaseDate(input.targetMonth),
        trackingMode: input.trackingMode,
        linkedWalletId: input.trackingMode === "linked_wallet" ? input.linkedWalletId : null,
      },
    });
    await syncPlanAggregate(tx, goal.financialPlanId);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.updated", entityType: "financial_plan_goal", entityId: goal.id } });
    return updated;
  });
}

export async function reorderFinancialPlanGoals(userId: string, workspaceId: string, planId: string, goalIds: string[]) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const goals = await tx.financialPlanGoal.findMany({ where: { financialPlanId: planId, financialPlan: { workspaceId }, deletedAt: null }, select: { id: true } });
    if (goals.length !== goalIds.length || goals.some((goal) => !goalIds.includes(goal.id))) throw new AppError("VALIDATION_ERROR", "Danh sách ưu tiên mục tiêu không hợp lệ.");
    for (const [sortOrder, id] of goalIds.entries()) await tx.financialPlanGoal.update({ where: { id }, data: { sortOrder } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.reordered", entityType: "financial_plan", entityId: planId, metadata: { goalIds } } });
  });
}

export async function createFinancialGoalFunding(
  userId: string,
  workspaceId: string,
  input: { goalId: string; amount: Decimal; effectiveDate: string; note?: string },
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const admin = isAdminRole(member.role.code);
  return prisma.$transaction(async (tx) => {
    const goal = await managedGoal(tx, workspaceId, input.goalId);
    if (goal.trackingMode !== "manual") throw new AppError("VALIDATION_ERROR", "Mục tiêu liên kết ví tự lấy tiến độ từ số dư ví.");
    if (!["draft", "active"].includes(goal.status)) throw new AppError("CONFLICT", "Mục tiêu đã kết thúc.");
    const entry = await tx.financialGoalFundingEntry.create({
      data: {
        goalId: goal.id,
        amount: input.amount,
        kind: "contribution",
        status: admin ? "approved" : "pending",
        effectiveDate: dateOnly(input.effectiveDate),
        note: input.note || null,
        requesterMemberId: member.id,
        ...(admin ? { reviewerMemberId: member.id, reviewedAt: new Date() } : {}),
      },
    });
    if (admin) await syncPlanAggregate(tx, goal.financialPlanId);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: admin ? "financial_goal.funding_recorded" : "financial_goal.funding_requested", entityType: "financial_goal_funding", entityId: entry.id, metadata: { goalId: goal.id, amount: input.amount.toFixed(0) } } });
    return entry;
  });
}

export async function reviewFinancialGoalFunding(userId: string, workspaceId: string, entryId: string, approve: boolean) {
  const reviewer = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-goal-funding:${entryId}`}))`);
    const entry = await tx.financialGoalFundingEntry.findFirst({ where: { id: entryId, status: "pending", goal: { status: { in: ["draft", "active"] }, financialPlan: { workspaceId } } }, include: { goal: true } });
    if (!entry) throw new AppError("NOT_FOUND", "Yêu cầu đóng góp không còn chờ duyệt.");
    const updated = await tx.financialGoalFundingEntry.update({ where: { id: entry.id }, data: { status: approve ? "approved" : "rejected", reviewerMemberId: reviewer.id, reviewedAt: new Date() } });
    if (approve) await syncPlanAggregate(tx, entry.goal.financialPlanId);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: approve ? "financial_goal.funding_approved" : "financial_goal.funding_rejected", entityType: "financial_goal_funding", entityId: entry.id, metadata: { goalId: entry.goalId } } });
    return updated;
  });
}

export async function reverseFinancialGoalFunding(userId: string, workspaceId: string, entryId: string, effectiveDate: string, note?: string) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`financial-goal-funding:${entryId}`}))`);
    const entry = await tx.financialGoalFundingEntry.findFirst({ where: { id: entryId, status: "approved", kind: { not: "reversal" }, goal: { financialPlan: { workspaceId } } }, include: { goal: true, reversedBy: true } });
    if (!entry || entry.reversedBy.length) throw new AppError("CONFLICT", "Khoản này không thể hoàn tác hoặc đã được hoàn tác.");
    const reversal = await tx.financialGoalFundingEntry.create({ data: {
      goalId: entry.goalId,
      amount: new Decimal(entry.amount.toString()).negated(),
      kind: "reversal",
      status: "approved",
      effectiveDate: dateOnly(effectiveDate),
      note: note || `Hoàn tác khoản ${entry.id}`,
      requesterMemberId: member.id,
      reviewerMemberId: member.id,
      reviewedAt: new Date(),
      reversesEntryId: entry.id,
    } });
    await syncPlanAggregate(tx, entry.goal.financialPlanId);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.funding_reversed", entityType: "financial_goal_funding", entityId: reversal.id, metadata: { originalEntryId: entry.id } } });
    return reversal;
  });
}

export async function finishFinancialPlanGoal(userId: string, workspaceId: string, goalId: string, status: "completed" | "cancelled") {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const goal = await managedGoal(tx, workspaceId, goalId);
    if (goal.status !== "active") throw new AppError("CONFLICT", "Chỉ mục tiêu đang chạy mới có thể kết thúc.");
    const progress = await goalProgress(tx, goal);
    if (status === "completed" && progress.lessThan(goal.targetAmount.toString())) throw new AppError("VALIDATION_ERROR", "Mục tiêu chưa đủ tiền để hoàn thành.");
    const now = new Date();
    const updated = await tx.financialPlanGoal.update({ where: { id: goal.id }, data: { status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }) } });
    const remaining = await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, status: "active", deletedAt: null } });
    if (remaining === 0) {
      const completed = await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, status: "completed", deletedAt: null } });
      await tx.financialPlan.update({ where: { id: goal.financialPlanId }, data: completed > 0 ? { status: "completed", completedAt: now } : { status: "cancelled", cancelledAt: now } });
    } else {
      await syncPlanAggregate(tx, goal.financialPlanId);
    }
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: `financial_goal.${status}`, entityType: "financial_plan_goal", entityId: goal.id } });
    return updated;
  });
}

export async function activateFinancialPlanGoals(tx: TransactionClient, workspaceId: string, planId: string, currentMonth: string) {
  const goals = await tx.financialPlanGoal.findMany({ where: { financialPlanId: planId, deletedAt: null, status: "draft" } });
  if (!goals.length) throw new AppError("VALIDATION_ERROR", "Kế hoạch phải có ít nhất một mục tiêu trước khi kích hoạt.");
  for (const goal of goals) {
    if (goal.targetMonth.toISOString().slice(0, 7) < currentMonth) {
      throw new AppError("VALIDATION_ERROR", `Deadline của mục tiêu “${goal.name}” không được trước tháng hiện tại.`);
    }
    if (goal.trackingMode === "linked_wallet") await assertLinkedWallet(tx, workspaceId, goal.linkedWalletId!, goal.id);
  }
  await tx.financialPlanGoal.updateMany({ where: { financialPlanId: planId, status: "draft", deletedAt: null }, data: { status: "active" } });
  await syncPlanAggregate(tx, planId);
}

export async function getFinancialPlanGoalPortfolio(
  userId: string,
  workspaceId: string,
  planId: string,
  monthlyFundingCapacity: Decimal.Value,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const businessMonth = formatInTimeZone(now, member.workspace.timeZone, "yyyy-MM");
  return prisma.$transaction(async (tx) => {
    const goals = await tx.financialPlanGoal.findMany({
      where: { financialPlanId: planId, deletedAt: null, financialPlan: { workspaceId, deletedAt: null } },
      include: {
        financialPlan: { select: { startMonth: true } },
        linkedWallet: { select: { id: true, name: true, currentBalance: true } },
        fundingEntries: {
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          take: 30,
          include: { requester: { include: { user: { select: { username: true } } } }, reviewer: { include: { user: { select: { username: true } } } } },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { targetMonth: "asc" }, { createdAt: "asc" }],
    });
    const candidates = [];
    const actualByGoal = new Map<string, Decimal>();
    for (const goal of goals) {
      const actual = goal.status === "completed"
        ? new Decimal(goal.targetAmount.toString())
        : await goalProgress(tx, goal);
      actualByGoal.set(goal.id, actual);
      if (goal.status === "active" || goal.status === "draft") candidates.push({ id: goal.id, targetAmount: goal.targetAmount.toString(), actualProgress: actual, targetMonth: goal.targetMonth.toISOString().slice(0, 7), sortOrder: goal.sortOrder, createdAt: goal.createdAt });
    }
    const allocation = new Map(allocateGoalFundingByPriority(candidates, monthlyFundingCapacity, businessMonth).map((item) => [item.goalId, item]));
    const simulation = simulateGoalFunding({ goals: candidates, monthlyFundingCapacity, startMonth: businessMonth });
    const startMonth = goals[0]?.financialPlan.startMonth?.toISOString().slice(0, 7) ?? businessMonth;
    return goals.map((goal) => {
      const actual = actualByGoal.get(goal.id) ?? ZERO;
      const target = new Decimal(goal.targetAmount.toString());
      const projected = simulation.projectedByGoal.get(goal.id) ?? actual;
      const totalMonths = monthsInclusive(startMonth, goal.targetMonth.toISOString().slice(0, 7)).length;
      const elapsedMonths = Math.min(monthsInclusive(startMonth, businessMonth).length, totalMonths);
      const expected = target.times(elapsedMonths).dividedToIntegerBy(totalMonths);
      const monthly = allocation.get(goal.id);
      return {
        id: goal.id,
        name: goal.name,
        status: goal.status,
        trackingMode: goal.trackingMode,
        linkedWallet: goal.linkedWallet ? { id: goal.linkedWallet.id, name: goal.linkedWallet.name, balance: goal.linkedWallet.currentBalance.toString() } : null,
        targetAmount: target.toFixed(0),
        targetMonth: goal.targetMonth.toISOString().slice(0, 7),
        sortOrder: goal.sortOrder,
        actualProgress: actual.toFixed(0),
        progressPercentage: Decimal.min(actual.dividedBy(target).times(100), 100).toDecimalPlaces(1).toString(),
        requiredThisMonth: monthly?.requiredAmount.toFixed(0) ?? "0",
        projectedThisMonth: monthly?.allocatedAmount.toFixed(0) ?? "0",
        shortfallThisMonth: monthly?.shortfall.toFixed(0) ?? "0",
        projectedAtDeadline: projected.toFixed(0),
        health: deriveGoalHealth({ currentMonth: businessMonth, targetMonth: goal.targetMonth.toISOString().slice(0, 7), targetAmount: target, actualProgress: actual, projectedAtDeadline: projected, expectedProgressNow: expected }),
        fundingEntries: goal.fundingEntries.map((entry) => ({
          id: entry.id,
          amount: entry.amount.toString(),
          kind: entry.kind,
          status: entry.status,
          effectiveDate: entry.effectiveDate.toISOString().slice(0, 10),
          note: entry.note,
          requester: entry.requester.user.username ?? "Người dùng",
          reviewer: entry.reviewer?.user.username ?? null,
          reversesEntryId: entry.reversesEntryId,
        })),
        canManage: isAdminRole(member.role.code),
      };
    });
  });
}

export function previewFinancialPlan(rawInput: unknown) {
  const input = financialPlanPreviewSchema.parse(rawInput);
  const candidates = input.goals.map((goal, index) => ({
    id: `goal-${index}`,
    targetAmount: goal.targetAmount,
    actualProgress: goal.existingAmount,
    targetMonth: goal.targetMonth,
    sortOrder: index,
  }));
  const simulation = simulateGoalFunding({ goals: candidates, monthlyFundingCapacity: input.monthlyFundingCapacity, startMonth: input.startMonth });
  const firstMonth = simulation.months[0];
  return {
    goals: input.goals.map((goal, index) => {
      const allocation = firstMonth?.allocations.find((item) => item.goalId === `goal-${index}`);
      return {
        name: goal.name,
        requiredThisMonth: allocation?.requiredAmount.toFixed(0) ?? "0",
        projectedThisMonth: allocation?.allocatedAmount.toFixed(0) ?? "0",
        shortfallThisMonth: allocation?.shortfall.toFixed(0) ?? "0",
        projectedAtDeadline: simulation.projectedByGoal.get(`goal-${index}`)?.toFixed(0) ?? goal.existingAmount.toFixed(0),
        targetAmount: goal.targetAmount.toFixed(0),
      };
    }),
  };
}
