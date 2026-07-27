import { NotificationsMenu, type NotificationItem } from "@/app/dashboard/notifications-menu";
import { prisma } from "@/lib/prisma";

function changeDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { action: "update" as const, reason: "Đã thông báo" };
  const data = value as Record<string, unknown>;
  return {
    action: data.action === "delete" ? "delete" as const : "update" as const,
    reason: typeof data.reason === "string" && data.reason.trim() ? data.reason : "Đã thông báo",
  };
}

export async function WorkspaceNotifications({
  workspaceId,
  currency,
  isAdmin,
  canAssignOwner,
}: {
  workspaceId: string;
  currency: string;
  isAdmin: boolean;
  canAssignOwner: boolean;
}) {
  if (!isAdmin) return null;
  const [transactions, changes, joinRequests, roles] = await Promise.all([
    prisma.transaction.findMany({
      where: { workflowStatus: { in: ["pending", "scheduled"] }, deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } },
      include: { member: { include: { user: { select: { username: true } } } }, category: { select: { name: true } }, wallet: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.transactionChangeRequest.findMany({
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
    }),
    prisma.workspaceJoinRequest.findMany({
      where: { workspaceId, status: "pending" },
      select: {
        id: true,
        requester: { select: { username: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.role.findMany({
      where: canAssignOwner ? undefined : { code: { not: "OWNER" } },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const items: NotificationItem[] = [
    ...joinRequests.map((item) => ({
      kind: "join" as const,
      id: item.id,
      username: item.requester.username,
    })),
    ...transactions.map((item) => ({ kind: "transaction" as const, id: item.id, username: item.member.user.username, description: item.description, category: item.category?.name ?? null, wallet: item.wallet.name, type: item.type, amount: item.amount.toString(), status: item.workflowStatus as "pending" | "scheduled" })),
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
  return <NotificationsMenu items={items} roles={roles} currency={currency}/>;
}
