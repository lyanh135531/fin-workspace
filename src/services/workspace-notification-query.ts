import type { NotificationItem } from "@/app/dashboard/notifications-menu";
import { WORKSPACE_ROLE_CODES } from "@/domain/role-policy";
import { getBusinessNotificationRange } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  getTransactionChangeAction,
  getTransactionChangeDetails,
  type TransactionChangeLookups,
} from "@/lib/transaction-change-display";
import { availableCategoryWhere } from "@/services/category-visibility";
import {
  getUserReminderState,
  getWorkspaceDueBillAlerts,
  type UserReminderState,
} from "@/services/reminder-service";

export type WorkspaceNotificationContext = {
  workspaceId: string;
  memberId: string;
  userId: string;
  timeZone: string;
  isAdmin: boolean;
};

export type WorkspaceNotificationBadgeSummary = {
  initialCount: number;
  reminderState: UserReminderState;
};

export type WorkspaceNotificationFeed = {
  items: NotificationItem[];
  roles: Array<{ code: string; name: string }>;
  reminderState: UserReminderState;
};

function changeDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { action: "update" as const, reason: "Đã thông báo" };
  }
  const data = value as Record<string, unknown>;
  return {
    action: getTransactionChangeAction(value) ?? "update",
    reason:
      typeof data.reason === "string" && data.reason.trim()
        ? data.reason
        : "Đã thông báo",
  };
}

function buildNotificationWhereClauses({
  workspaceId,
  memberId,
  timeZone,
  isAdmin,
}: WorkspaceNotificationContext) {
  const range = getBusinessNotificationRange(timeZone);
  const transactionWhere = isAdmin
    ? {
        OR: [
          { workflowStatus: "pending" as const },
          {
            workflowStatus: "scheduled" as const,
            date: { gt: range.todayAsDatabaseDate, lt: range.nextMonthStart },
          },
        ],
      }
    : {
        workflowStatus: "scheduled" as const,
        date: { gt: range.todayAsDatabaseDate, lt: range.nextMonthStart },
      };

  const recurringWhere = {
    workspaceId,
    deletedAt: null,
    ...(isAdmin
      ? { approvalStatus: "pending" as const }
      : {
          createdByMemberId: memberId,
          reviewedByMemberId: { not: memberId },
          approvalStatus: { in: ["approved" as const, "rejected" as const] },
          reviewedAt: {
            gte: range.businessDayStart,
            lt: range.nextBusinessDayStart,
          },
        }),
  };

  const goalFundingWhere = {
    goal: { financialPlan: { workspaceId, deletedAt: null } },
    ...(isAdmin
      ? { status: "pending" as const }
      : {
          requesterMemberId: memberId,
          reviewerMemberId: { not: memberId },
          status: { in: ["approved" as const, "rejected" as const] },
          reviewedAt: {
            gte: range.businessDayStart,
            lt: range.nextBusinessDayStart,
          },
        }),
  };

  return { range, transactionWhere, recurringWhere, goalFundingWhere };
}

export async function getWorkspaceNotificationBadgeSummary(
  ctx: WorkspaceNotificationContext,
): Promise<WorkspaceNotificationBadgeSummary> {
  const { workspaceId, memberId, userId, timeZone, isAdmin } = ctx;
  const { range, transactionWhere, recurringWhere, goalFundingWhere } =
    buildNotificationWhereClauses(ctx);

  const [
    transactionCount,
    activationLogs,
    changeCount,
    joinCount,
    recurringCount,
    goalFundingCount,
    reminderState,
    dueBillAlerts,
  ] = await Promise.all([
    prisma.transaction.count({
      where: {
        ...transactionWhere,
        deletedAt: null,
        member: { workspaceId, status: "active", deletedAt: null },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        workspaceId,
        action: "transaction.scheduled_activated",
        entityType: "transaction",
        entityId: { not: null },
        createdAt: {
          gte: range.businessDayStart,
          lt: range.nextBusinessDayStart,
        },
      },
      select: { entityId: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    isAdmin
      ? prisma.transactionChangeRequest.count({
          where: {
            status: "pending",
            transaction: { deletedAt: null, member: { workspaceId } },
          },
        })
      : Promise.resolve(0),
    isAdmin
      ? prisma.workspaceJoinRequest.count({
          where: { workspaceId, status: "pending" },
        })
      : Promise.resolve(0),
    prisma.recurringTransaction.count({ where: recurringWhere }),
    prisma.financialGoalFundingEntry.count({ where: goalFundingWhere }),
    getUserReminderState(userId, timeZone),
    getWorkspaceDueBillAlerts({
      workspaceId,
      memberId,
      isAdmin,
      timeZone,
    }),
  ]);

  const activatedTransactionIds = activationLogs
    .map((log) => log.entityId)
    .filter((id): id is string => Boolean(id));
  const executedCount = activatedTransactionIds.length
    ? await prisma.transaction.count({
        where: {
          id: { in: activatedTransactionIds },
          workflowStatus: "approved",
          date: { gte: range.currentMonthStart, lt: range.nextMonthStart },
          deletedAt: null,
          member: { workspaceId, status: "active", deletedAt: null },
        },
      })
    : 0;

  const initialCount =
    (reminderState.activeReminderSlot ? 1 : 0) +
    dueBillAlerts.statementAlerts.length +
    dueBillAlerts.recurringAlerts.length +
    Math.min(joinCount, 10) +
    Math.min(transactionCount, 20) +
    executedCount +
    Math.min(changeCount, 10) +
    Math.min(recurringCount, 10) +
    Math.min(goalFundingCount, 10);

  return {
    initialCount,
    reminderState,
  };
}

export async function getWorkspaceNotificationFeed(
  ctx: WorkspaceNotificationContext,
): Promise<WorkspaceNotificationFeed> {
  const { workspaceId, memberId, userId, timeZone, isAdmin } = ctx;
  const { range, transactionWhere, recurringWhere, goalFundingWhere } =
    buildNotificationWhereClauses(ctx);

  const [
    transactions,
    activationLogs,
    changes,
    joinRequests,
    recurringTransactions,
    goalFundingEntries,
    reminderState,
    dueBillAlerts,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        ...transactionWhere,
        deletedAt: null,
        member: { workspaceId, status: "active", deletedAt: null },
      },
      include: {
        member: { include: { user: { select: { username: true } } } },
        category: { select: { name: true } },
        wallet: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: {
        workspaceId,
        action: "transaction.scheduled_activated",
        entityType: "transaction",
        entityId: { not: null },
        createdAt: {
          gte: range.businessDayStart,
          lt: range.nextBusinessDayStart,
        },
      },
      select: { entityId: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    isAdmin
      ? prisma.transactionChangeRequest.findMany({
          where: {
            status: "pending",
            transaction: { deletedAt: null, member: { workspaceId } },
          },
          include: {
            requester: { include: { user: { select: { username: true } } } },
            transaction: {
              select: {
                walletId: true,
                toWalletId: true,
                categoryId: true,
                description: true,
                amount: true,
                type: true,
                date: true,
                wallet: { select: { name: true } },
                toWallet: { select: { name: true } },
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.workspaceJoinRequest.findMany({
          where: { workspaceId, status: "pending" },
          select: { id: true, requester: { select: { username: true } } },
          orderBy: { createdAt: "asc" },
          take: 10,
        })
      : Promise.resolve([]),
    prisma.recurringTransaction.findMany({
      where: recurringWhere,
      include: {
        createdBy: { include: { user: { select: { username: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.financialGoalFundingEntry.findMany({
      where: goalFundingWhere,
      include: {
        goal: { select: { name: true } },
        requester: { include: { user: { select: { username: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    getUserReminderState(userId, timeZone),
    getWorkspaceDueBillAlerts({
      workspaceId,
      memberId,
      isAdmin,
      timeZone,
    }),
  ]);

  const activatedTransactionIds = activationLogs
    .map((log) => log.entityId)
    .filter((id): id is string => Boolean(id));

  const [roles, changeWallets, changeCategories, executedTransactions] =
    await Promise.all([
      isAdmin && joinRequests.length > 0
        ? prisma.role.findMany({
            where: { code: { in: [...WORKSPACE_ROLE_CODES] } },
            select: { code: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      isAdmin && changes.length > 0
        ? prisma.workspaceWallet.findMany({
            where: { workspaceId },
            select: { walletId: true, wallet: { select: { name: true } } },
          })
        : Promise.resolve([]),
      isAdmin && changes.length > 0
        ? prisma.category.findMany({
            where: availableCategoryWhere(workspaceId),
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      activatedTransactionIds.length
        ? prisma.transaction.findMany({
            where: {
              id: { in: activatedTransactionIds },
              workflowStatus: "approved",
              date: { gte: range.currentMonthStart, lt: range.nextMonthStart },
              deletedAt: null,
              member: { workspaceId, status: "active", deletedAt: null },
            },
            include: {
              member: { include: { user: { select: { username: true } } } },
              category: { select: { name: true } },
              wallet: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

  const walletNames = new Map(
    changeWallets.map((item) => [item.walletId, item.wallet.name] as const),
  );
  const categoryNames = new Map(
    changeCategories.map((item) => [item.id, item.name] as const),
  );
  for (const change of changes) {
    walletNames.set(
      change.transaction.walletId,
      change.transaction.wallet.name,
    );
    if (change.transaction.toWalletId && change.transaction.toWallet) {
      walletNames.set(
        change.transaction.toWalletId,
        change.transaction.toWallet.name,
      );
    }
    if (change.transaction.categoryId && change.transaction.category) {
      categoryNames.set(
        change.transaction.categoryId,
        change.transaction.category.name,
      );
    }
  }
  const changeLookups: TransactionChangeLookups = {
    wallets: walletNames,
    categories: categoryNames,
  };

  const transactionItem = (
    item: (typeof transactions)[number] | (typeof executedTransactions)[number],
    status: "pending" | "scheduled" | "executed",
  ): NotificationItem => ({
    kind: "transaction",
    id: item.id,
    username: item.member.user.username ?? "Người dùng",
    description: item.description,
    category: item.category?.name ?? null,
    wallet: item.wallet.name,
    type: item.type,
    amount: item.amount.toString(),
    date: item.date.toISOString(),
    status,
  });

  const items: NotificationItem[] = [
    ...(reminderState.activeReminderSlot
      ? [
          {
            kind: "dailyReminder" as const,
            id: `daily-reminder-${reminderState.activeReminderSlot}`,
            slot: reminderState.activeReminderSlot,
          },
        ]
      : []),
    ...dueBillAlerts.statementAlerts.map((item) => ({
      kind: "statementDue" as const,
      ...item,
    })),
    ...dueBillAlerts.recurringAlerts.map((item) => ({
      kind: "recurringDue" as const,
      ...item,
    })),
    ...joinRequests.map((item) => ({
      kind: "join" as const,
      id: item.id,
      username: item.requester.username ?? "Người dùng",
    })),
    ...transactions.map((item) =>
      transactionItem(item, item.workflowStatus as "pending" | "scheduled"),
    ),
    ...executedTransactions.map((item) => transactionItem(item, "executed")),
    ...changes.map((item) => ({
      kind: "change" as const,
      id: item.id,
      username: item.requester.user.username ?? "Người dùng",
      description: item.transaction.description,
      amount: item.transaction.amount.toString(),
      type: item.transaction.type,
      wallet: item.transaction.wallet.name,
      details: getTransactionChangeDetails(
        item.proposedData,
        {
          walletId: item.transaction.walletId,
          toWalletId: item.transaction.toWalletId,
          categoryId: item.transaction.categoryId,
          type: item.transaction.type,
          amount: item.transaction.amount.toString(),
          description: item.transaction.description,
          date: item.transaction.date.toISOString().slice(0, 10),
        },
        changeLookups,
      ),
      ...changeDetails(item.proposedData),
    })),
    ...recurringTransactions.map((item) => ({
      kind: "recurring" as const,
      id: item.id,
      username: item.createdBy.user.username ?? "Người dùng",
      description: item.description,
      amount: item.amount.toString(),
      type: item.type,
      approvalStatus: item.approvalStatus,
    })),
    ...goalFundingEntries.map((item) => ({
      kind: "goalFunding" as const,
      id: item.id,
      username: item.requester.user.username ?? "Người dùng",
      goalName: item.goal.name,
      amount: item.amount.toString(),
      approvalStatus: item.status,
    })),
  ];

  return {
    items,
    roles,
    reminderState,
  };
}
