import { NotificationsMenu, type NotificationItem } from "@/app/dashboard/notifications-menu";
import { WORKSPACE_ROLE_CODES } from "@/domain/role-policy";
import { getBusinessNotificationRange } from "@/lib/date";
import { prisma } from "@/lib/prisma";

function changeDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { action: "update" as const, reason: "Đã thông báo" };
  }
  const data = value as Record<string, unknown>;
  return {
    action: data.action === "delete" ? "delete" as const : "update" as const,
    reason: typeof data.reason === "string" && data.reason.trim() ? data.reason : "Đã thông báo",
  };
}

export async function WorkspaceNotifications({
  workspaceId,
  currency,
  timeZone,
  isAdmin,
}: {
  workspaceId: string;
  currency: string;
  timeZone: string;
  isAdmin: boolean;
}) {
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

  const transactionsPromise = prisma.transaction.findMany({
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
  });
  const activationLogsPromise = prisma.auditLog.findMany({
    where: {
      workspaceId,
      action: "transaction.scheduled_activated",
      entityType: "transaction",
      entityId: { not: null },
      createdAt: { gte: range.businessDayStart, lt: range.nextBusinessDayStart },
    },
    select: { entityId: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const changesPromise = isAdmin
    ? prisma.transactionChangeRequest.findMany({
      where: { status: "pending", transaction: { deletedAt: null, member: { workspaceId } } },
      include: {
        requester: { include: { user: { select: { username: true } } } },
        transaction: {
          select: {
            description: true,
            amount: true,
            type: true,
            wallet: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    : Promise.resolve([]);
  const joinRequestsPromise = isAdmin
    ? prisma.workspaceJoinRequest.findMany({
      where: { workspaceId, status: "pending" },
      select: { id: true, requester: { select: { username: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    })
    : Promise.resolve([]);
  const rolesPromise = isAdmin
    ? prisma.role.findMany({
      where: { code: { in: [...WORKSPACE_ROLE_CODES] } },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    })
    : Promise.resolve([]);

  const [transactions, activationLogs, changes, joinRequests, roles] = await Promise.all([
    transactionsPromise,
    activationLogsPromise,
    changesPromise,
    joinRequestsPromise,
    rolesPromise,
  ]);
  const activatedTransactionIds = activationLogs
    .map((log) => log.entityId)
    .filter((id): id is string => Boolean(id));
  const executedTransactions = activatedTransactionIds.length
    ? await prisma.transaction.findMany({
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
    : [];

  const transactionItem = (
    item: (typeof transactions)[number] | (typeof executedTransactions)[number],
    status: "pending" | "scheduled" | "executed",
  ): NotificationItem => ({
    kind: "transaction",
    id: item.id,
    username: item.member.user.username,
    description: item.description,
    category: item.category?.name ?? null,
    wallet: item.wallet.name,
    type: item.type,
    amount: item.amount.toString(),
    date: item.date.toISOString(),
    status,
  });

  const items: NotificationItem[] = [
    ...joinRequests.map((item) => ({
      kind: "join" as const,
      id: item.id,
      username: item.requester.username,
    })),
    ...transactions.map((item) => transactionItem(item, item.workflowStatus as "pending" | "scheduled")),
    ...executedTransactions.map((item) => transactionItem(item, "executed")),
    ...changes.map((item) => ({
      kind: "change" as const,
      id: item.id,
      username: item.requester.user.username,
      description: item.transaction.description,
      amount: item.transaction.amount.toString(),
      type: item.transaction.type,
      wallet: item.transaction.wallet.name,
      ...changeDetails(item.proposedData),
    })),
  ];

  return (
    <NotificationsMenu
      workspaceId={workspaceId}
      items={items}
      roles={roles}
      currency={currency}
      canReview={isAdmin}
    />
  );
}
