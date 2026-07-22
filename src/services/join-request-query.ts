import { prisma } from "@/lib/prisma";

export type JoinRequestRecord = {
  id: string;
  workspaceName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  respondedAt: Date | null;
};

/**
 * Fetch all join requests made by the given user, most recent first.
 */
export async function getUserJoinRequests(userId: string): Promise<JoinRequestRecord[]> {
  const rows = await prisma.workspaceJoinRequest.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      respondedAt: true,
      workspace: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    workspaceName: row.workspace.name,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
  }));
}

/**
 * Count the number of pending join requests for the current user.
 */
export async function getPendingJoinRequestCount(userId: string): Promise<number> {
  return prisma.workspaceJoinRequest.count({
    where: { requesterId: userId, status: "pending" },
  });
}
