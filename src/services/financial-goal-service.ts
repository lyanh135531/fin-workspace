import Decimal from "decimal.js";
import { Prisma, type FinancialPlanStatus } from "@/generated/prisma/client";
import {
  FINANCIAL_JAR_CODES,
  allocateGoalFundingByPriority,
  createFinancialPlanWithGoalsSchema,
  deriveGoalHealth,
  financialPlanPreviewSchema,
  monthsInclusive,
  requiredGoalAmountForMonth,
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
import { catchUpFinancialPlan } from "@/services/financial-plan-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

type TransactionClient = Prisma.TransactionClient;
const ZERO = new Decimal(0);
const DRAFT_ALLOCATION_MONTH = "1970-01";

function currentBusinessMonth(now = new Date(), timeZone = "Asia/Ho_Chi_Minh") {
  return monthToDatabaseDate(formatInTimeZone(now, timeZone, "yyyy-MM"));
}

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
    // Plan aggregates and month snapshots require whole VND. Never count more
    // progress than the linked wallet actually holds; keep its balance untouched.
    return Decimal.max(wallet?.currentBalance.toString() ?? 0, ZERO).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  }
  const total = await tx.financialGoalFundingEntry.aggregate({
    where: { goalId: goal.id, status: "approved" },
    _sum: { amount: true },
  });
  return Decimal.max(total._sum.amount?.toString() ?? 0, ZERO).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
}

export function getFinancialGoalProgress(
  tx: TransactionClient,
  goal: { id: string; trackingMode: "manual" | "linked_wallet"; linkedWalletId: string | null },
) {
  return goalProgress(tx, goal);
}

async function goalProgressBeforeBoundary(
  tx: TransactionClient,
  goal: {
    id: string;
    trackingMode: "manual" | "linked_wallet";
    linkedWalletId: string | null;
  },
  boundaryDate: Date,
  options?: {
    includeOpeningAndAdjustment?: boolean;
    asOfEnd?: Date;
    activatedAt?: Date | null;
  },
) {
  if (goal.trackingMode === "linked_wallet") {
    if (!goal.linkedWalletId) return ZERO;
    const wallet = await tx.wallet.findFirst({
      where: { id: goal.linkedWalletId, deletedAt: null },
      select: { currentBalance: true },
    });
    let balance = new Decimal(wallet?.currentBalance.toString() ?? 0);
    const laterTransactions =
      (await tx.transaction?.findMany?.({
        where: {
          deletedAt: null,
          workflowStatus: "approved",
          date: { gte: boundaryDate },
          ...(options?.activatedAt && options.activatedAt > boundaryDate
            ? { createdAt: { gte: options.activatedAt } }
            : {}),
          OR: [
            { walletId: goal.linkedWalletId },
            { toWalletId: goal.linkedWalletId },
          ],
        },
        select: {
          type: true,
          purpose: true,
          amount: true,
          walletId: true,
          toWalletId: true,
        },
      })) ?? [];
    for (const record of laterTransactions) {
      const amount = new Decimal(record.amount.toString());
      if (record.type === "income" && record.walletId === goal.linkedWalletId) {
        balance = balance.minus(amount);
      } else if (
        record.type === "expense" &&
        record.walletId === goal.linkedWalletId
      ) {
        balance = balance.plus(amount);
      } else if (record.type === "transfer") {
        if (record.walletId === goal.linkedWalletId) {
          balance = balance.plus(amount);
        }
        if (record.toWalletId === goal.linkedWalletId) {
          balance = balance.minus(amount);
        }
      }
    }
    return Decimal.max(balance, ZERO).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  }
  const total = await tx.financialGoalFundingEntry.aggregate({
    where: options?.includeOpeningAndAdjustment
      ? {
          goalId: goal.id,
          status: "approved",
          OR: [
            { effectiveDate: { lt: boundaryDate } },
            {
              effectiveDate: {
                gte: boundaryDate,
                ...(options.asOfEnd ? { lt: options.asOfEnd } : {}),
              },
              kind: { in: ["opening", "adjustment"] },
              reversedBy: { none: {} },
            },
          ],
        }
      : {
          goalId: goal.id,
          status: "approved",
          effectiveDate: { lt: boundaryDate },
        },
    _sum: { amount: true },
  });
  return Decimal.max(total._sum.amount?.toString() ?? 0, ZERO).toDecimalPlaces(
    0,
    Decimal.ROUND_FLOOR,
  );
}

export async function getPlanGoalProgressSummary(
  tx: TransactionClient,
  planId: string,
  options?: { monthStart?: Date; asOfEnd?: Date },
) {
  const plan = await tx.financialPlan?.findFirst?.({
    where: { id: planId, deletedAt: null },
    select: {
      status: true,
      cancelledAt: true,
      activatedAt: true,
      existingGoalAmount: true,
    },
  });
  let goals = await tx.financialPlanGoal.findMany({
    where: {
      financialPlanId: planId,
      deletedAt: null,
      status: {
        in:
          plan?.status === "cancelled"
            ? ["draft", "active", "completed", "cancelled"]
            : ["draft", "active", "completed"],
      },
    },
  });
  if (plan?.status === "cancelled" && plan.cancelledAt) {
    const cancelledWithPlan = goals.filter(
      (goal) =>
        goal.status !== "cancelled" ||
        (goal.cancelledAt && goal.cancelledAt.getTime() >= plan.cancelledAt!.getTime()),
    );
    if (cancelledWithPlan.length > 0) {
      goals = cancelledWithPlan;
    }
  } else if (goals.length === 0) {
    goals = await tx.financialPlanGoal.findMany({
      where: { financialPlanId: planId, deletedAt: null },
    });
  }
  let totalProgress = ZERO;
  let workspaceReserved = ZERO;
  const progressByGoal = new Map<string, Decimal>();
  const liveReservedByGoal = new Map<string, Decimal>();
  for (const goal of goals) {
    const rawProgress = options?.asOfEnd
      ? await goalProgressBeforeBoundary(tx, goal, options.asOfEnd)
      : await goalProgress(tx, goal);
    const liveProgress = Decimal.min(rawProgress, goal.targetAmount.toString());
    const completedAsOf =
      goal.status === "completed" &&
      (!options?.asOfEnd || !goal.completedAt || goal.completedAt < options.asOfEnd);
    const effectiveProgress = completedAsOf
      ? new Decimal(goal.targetAmount.toString())
      : liveProgress;
    progressByGoal.set(goal.id, effectiveProgress);
    liveReservedByGoal.set(goal.id, liveProgress);
    totalProgress = totalProgress.plus(effectiveProgress);
    workspaceReserved = workspaceReserved.plus(liveProgress);
  }
  const manualGoals = goals.filter((goal) => goal.trackingMode === "manual");
  let openingProgress = ZERO;
  for (const goal of manualGoals) {
    const openingAgg = await tx.financialGoalFundingEntry.aggregate({
      where: {
        goalId: goal.id,
        status: "approved",
        kind: { in: ["opening", "adjustment"] },
        reversedBy: { none: {} },
      },
      _sum: { amount: true },
    });
    const goalOpening = Decimal.min(
      Decimal.max(openingAgg?._sum?.amount?.toString() ?? 0, ZERO),
      progressByGoal.get(goal.id) ?? ZERO,
    );
    openingProgress = openingProgress.plus(goalOpening);
  }
  if (
    openingProgress.eq(ZERO) &&
    goals.length > 0 &&
    goals.every((goal) => goal.trackingMode === "linked_wallet") &&
    plan?.existingGoalAmount &&
    new Decimal(plan.existingGoalAmount.toString()).gt(ZERO)
  ) {
    openingProgress = Decimal.min(
      new Decimal(plan.existingGoalAmount.toString()),
      totalProgress,
    );
  }

  let progressBeforeMonth = openingProgress;
  let workspaceReservedBeforeMonth = openingProgress;
  if (options?.monthStart) {
    progressBeforeMonth = ZERO;
    workspaceReservedBeforeMonth = ZERO;
    for (const goal of goals) {
      const rawBefore = await goalProgressBeforeBoundary(
        tx,
        goal,
        options.monthStart,
        {
          includeOpeningAndAdjustment: true,
          asOfEnd: options.asOfEnd,
          activatedAt: plan?.activatedAt ?? null,
        },
      );
      const liveReserved = liveReservedByGoal.get(goal.id) ?? ZERO;
      const clampedReservedBefore = Decimal.min(
        Decimal.min(rawBefore, goal.targetAmount.toString()),
        liveReserved,
      );
      const completedBeforeMonth =
        goal.status === "completed" &&
        Boolean(goal.completedAt && goal.completedAt < options.monthStart);
      const effectiveBefore = completedBeforeMonth
        ? new Decimal(goal.targetAmount.toString())
        : clampedReservedBefore;
      progressBeforeMonth = progressBeforeMonth.plus(effectiveBefore);
      workspaceReservedBeforeMonth =
        workspaceReservedBeforeMonth.plus(clampedReservedBefore);
    }
  }

  return {
    totalProgress,
    workspaceReserved,
    openingProgress: openingProgress.toFixed(0),
    progressBeforeMonth,
    workspaceReservedBeforeMonth,
    hasGoals: goals.length > 0,
  };
}

async function managedGoal(tx: TransactionClient, workspaceId: string, goalId: string) {
  const goal = await tx.financialPlanGoal.findFirst({
    where: { id: goalId, deletedAt: null, financialPlan: { workspaceId, deletedAt: null } },
    include: { financialPlan: true },
  });
  if (!goal) throw new AppError("NOT_FOUND", "Không tìm thấy mục tiêu trong workspace này.");
  return goal;
}

export async function syncPlanAggregate(tx: TransactionClient, planId: string) {
  const plan = await tx.financialPlan.findFirst?.({
    where: { id: planId, deletedAt: null },
    select: {
      targetMonth: true,
      startMonth: true,
      status: true,
      workspace: { select: { timeZone: true } },
    },
  });
  const goals = await tx.financialPlanGoal.findMany({
    where: { financialPlanId: planId, deletedAt: null, status: { in: ["draft", "active", "completed"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (!goals.length) return;
  let target = ZERO;
  let progress = ZERO;
  const activeGoals = goals.filter((goal) => goal.status === "draft" || goal.status === "active");
  const monthGoals = activeGoals.length > 0 ? activeGoals : goals;
  let maxGoalTargetMonth = monthGoals[0].targetMonth;
  for (const goal of goals) {
    target = target.plus(goal.targetAmount.toString());
    progress = progress.plus(goal.status === "completed"
      ? goal.targetAmount.toString()
      : Decimal.min(await goalProgress(tx, goal), goal.targetAmount.toString()));
  }
  for (const goal of monthGoals) {
    if (goal.targetMonth > maxGoalTargetMonth) maxGoalTargetMonth = goal.targetMonth;
  }
  let targetMonth = maxGoalTargetMonth;
  if (plan?.status !== "draft") {
    if (plan?.startMonth && targetMonth < plan.startMonth) targetMonth = plan.startMonth;
    const lastClosed = await tx.financialPlanMonth?.findFirst?.({
      where: { financialPlanId: planId },
      orderBy: { month: "desc" },
      select: { month: true },
    });
    if (lastClosed?.month && targetMonth < lastClosed.month) targetMonth = lastClosed.month;
    const currentMonth = currentBusinessMonth(new Date(), plan?.workspace?.timeZone);
    if (plan?.status === "active" && targetMonth < currentMonth) targetMonth = currentMonth;
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
    const progress = await goalProgress(tx, {
      ...goal,
      trackingMode: input.trackingMode,
      linkedWalletId: input.trackingMode === "linked_wallet" ? input.linkedWalletId ?? null : null,
    });
    if (input.trackingMode === "manual" && input.targetAmount.lessThan(progress)) {
      throw new AppError("VALIDATION_ERROR", "Mục tiêu mới không được nhỏ hơn số tiền đã xác nhận.");
    }
    if (goal.status === "draft" && goal.trackingMode === "manual" && input.trackingMode === "linked_wallet") {
      await tx.financialGoalFundingEntry.deleteMany?.({
        where: { goalId: goal.id, kind: { in: ["opening", "adjustment"] } },
      });
    }
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
    const entry = await tx.financialGoalFundingEntry.findFirst({
      where: { id: entryId, status: "pending", goal: { financialPlan: { workspaceId, deletedAt: null } } },
      include: { goal: { include: { financialPlan: true } } },
    });
    if (!entry) throw new AppError("NOT_FOUND", "Yêu cầu đóng góp không còn chờ duyệt.");
    if (
      !["draft", "active"].includes(entry.goal.status) ||
      (entry.goal.financialPlan && !["draft", "active"].includes(entry.goal.financialPlan.status))
    ) {
      throw new AppError("CONFLICT", "Mục tiêu hoặc kế hoạch đã kết thúc, không thể thay đổi khoản đóng góp.");
    }
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
    const entry = await tx.financialGoalFundingEntry.findFirst({
      where: { id: entryId, status: "approved", kind: { not: "reversal" }, goal: { financialPlan: { workspaceId } } },
      include: { goal: { include: { financialPlan: true } }, reversedBy: true },
    });
    if (!entry || entry.reversedBy.length) throw new AppError("CONFLICT", "Khoản này không thể hoàn tác hoặc đã được hoàn tác.");
    if (
      (entry.goal.status && !["draft", "active"].includes(entry.goal.status)) ||
      (entry.goal.financialPlan?.status && !["draft", "active"].includes(entry.goal.financialPlan.status))
    ) {
      throw new AppError("CONFLICT", "Mục tiêu hoặc kế hoạch đã kết thúc, không thể thay đổi khoản đóng góp.");
    }
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
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const targetGoal = await prisma.financialPlanGoal?.findFirst?.({
    where: { id: goalId, deletedAt: null },
    select: { financialPlanId: true },
  });
  if (targetGoal) {
    await catchUpFinancialPlan(targetGoal.financialPlanId);
  }
  return prisma.$transaction(async (tx) => {
    const goal = await managedGoal(tx, workspaceId, goalId);
    const now = new Date();
    if (goal.status === "draft" && status === "cancelled") {
      const count = await tx.financialPlanGoal.count({
        where: { financialPlanId: goal.financialPlanId, deletedAt: null },
      });
      if (count <= 1) {
        throw new AppError("VALIDATION_ERROR", "Kế hoạch phải có ít nhất 1 mục tiêu.");
      }
      await tx.financialGoalFundingEntry.updateMany?.({
        where: { goalId: goal.id, status: "pending" },
        data: { status: "rejected", reviewerMemberId: member.id, reviewedAt: now },
      });
      const updated = await tx.financialPlanGoal.update({
        where: { id: goal.id },
        data: { status: "cancelled", cancelledAt: now, deletedAt: now },
      });
      await syncPlanAggregate(tx, goal.financialPlanId);
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "financial_goal.cancelled", entityType: "financial_plan_goal", entityId: goal.id } });
      return updated;
    }
    if (goal.status !== "active") throw new AppError("CONFLICT", "Chỉ mục tiêu đang chạy mới có thể kết thúc.");
    const progress = await goalProgress(tx, goal);
    if (status === "completed" && progress.lessThan(goal.targetAmount.toString())) throw new AppError("VALIDATION_ERROR", "Mục tiêu chưa đủ tiền để hoàn thành.");
    await tx.financialGoalFundingEntry.updateMany?.({
      where: { goalId: goal.id, status: "pending" },
      data: { status: "rejected", reviewerMemberId: member.id, reviewedAt: now },
    });
    const updated = await tx.financialPlanGoal.update({ where: { id: goal.id }, data: { status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }) } });
    await syncPlanAggregate(tx, goal.financialPlanId);
    const remaining = await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, status: "active", deletedAt: null } });
    if (remaining === 0) {
      const completed = await tx.financialPlanGoal.count({ where: { financialPlanId: goal.financialPlanId, status: "completed", deletedAt: null } });
      await tx.financialPlan.update({ where: { id: goal.financialPlanId }, data: completed > 0 ? { status: "completed", completedAt: now } : { status: "cancelled", cancelledAt: now } });
      await tx.financialGoalFundingEntry.updateMany?.({
        where: { goal: { financialPlanId: goal.financialPlanId }, status: "pending" },
        data: { status: "rejected", reviewerMemberId: member.id, reviewedAt: now },
      });
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
        _count: { select: { fundingEntries: true } },
        financialPlan: { select: { startMonth: true } },
        linkedWallet: { select: { id: true, name: true, currentBalance: true } },
        fundingEntries: {
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          take: 30,
          include: {
            requester: { include: { user: { select: { username: true } } } },
            reviewer: { include: { user: { select: { username: true } } } },
            reversedBy: { select: { id: true } },
          },
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
    const isDraftPlan = !goals[0]?.financialPlan.startMonth;
    const effectiveCapacity = isDraftPlan
      ? Decimal.max(
          monthlyFundingCapacity,
          candidates.reduce(
            (sum, candidate) =>
              sum.plus(
                requiredGoalAmountForMonth(
                  candidate.targetAmount,
                  candidate.actualProgress,
                  businessMonth,
                  candidate.targetMonth,
                ),
              ),
            ZERO,
          ),
        )
      : monthlyFundingCapacity;
    const allocation = new Map(allocateGoalFundingByPriority(candidates, effectiveCapacity, businessMonth).map((item) => [item.goalId, item]));
    const simulation = candidates.some((candidate) => candidate.targetMonth >= businessMonth)
      ? simulateGoalFunding({ goals: candidates, monthlyFundingCapacity: effectiveCapacity, startMonth: businessMonth })
      : { months: [], projectedByGoal: new Map(candidates.map((candidate) => [candidate.id, new Decimal(candidate.actualProgress)])) };
    const startMonth = goals[0]?.financialPlan.startMonth?.toISOString().slice(0, 7) ?? businessMonth;
    return goals.map((goal) => {
      const actual = actualByGoal.get(goal.id) ?? ZERO;
      const target = new Decimal(goal.targetAmount.toString());
      const projected = simulation.projectedByGoal.get(goal.id) ?? actual;
      const goalTargetMonth = goal.targetMonth.toISOString().slice(0, 7);
      const totalMonths = goalTargetMonth < startMonth ? 1 : monthsInclusive(startMonth, goalTargetMonth).length;
      const elapsedMonths =
        isDraftPlan || businessMonth <= startMonth
          ? 0
          : Math.min(monthsInclusive(startMonth, businessMonth).length - 1, totalMonths);
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
        totalFundingEntriesCount: goal._count?.fundingEntries ?? goal.fundingEntries.length,
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
          reversedBy: entry.reversedBy?.[0] ?? null,
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
