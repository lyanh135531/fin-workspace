import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PortalUserSearch } from "@/domain/platform-user/schemas";

export const PORTAL_USER_PAGE_SIZE = 20;

export const portalUserSelect = {
  id: true,
  username: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type PortalUserRecord = Prisma.UserGetPayload<{
  select: typeof portalUserSelect;
}>;

function buildPortalUserWhere(
  filters: Pick<PortalUserSearch, "q" | "status">,
): Prisma.UserWhereInput {
  return {
    ...(filters.q
      ? { username: { contains: filters.q, mode: "insensitive" } }
      : {}),
    ...(filters.status === "all" ? {} : { status: filters.status }),
  };
}

export async function listPortalUsers(filters: PortalUserSearch) {
  const where = buildPortalUserWhere(filters);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: portalUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * PORTAL_USER_PAGE_SIZE,
      take: PORTAL_USER_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  // Batch-fetch last activity timestamp for each user
  const userIds = users.map((u) => u.id);
  const lastActivityRows =
    userIds.length > 0
      ? await prisma.$queryRaw<
          Array<{ actor_user_id: string; last_at: Date }>
        >`
          SELECT "actor_user_id", MAX("created_at") AS last_at
          FROM "AUDIT_LOG"
          WHERE "actor_user_id" = ANY(${userIds}::uuid[])
          GROUP BY "actor_user_id"
        `
      : [];

  const lastActivityMap = new Map(
    lastActivityRows.map((r) => [r.actor_user_id, r.last_at]),
  );

  const usersWithActivity = users.map((user) => ({
    ...user,
    lastActivityAt: lastActivityMap.get(user.id) ?? null,
  }));

  return {
    users: usersWithActivity,
    total,
    page: filters.page,
    pageSize: PORTAL_USER_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PORTAL_USER_PAGE_SIZE)),
  };
}

export function getPortalUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: portalUserSelect,
  });
}

/**
 * Get all workspaces a user belongs to, with their role.
 */
export async function getPortalUserWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      role: {
        select: { name: true, code: true },
      },
      workspace: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type PortalUserWorkspace = Awaited<
  ReturnType<typeof getPortalUserWorkspaces>
>[number];

const PORTAL_USER_ACTIVITY_PAGE_SIZE = 20;

/**
 * Audit log entries where the user is the actor.
 */
export async function getPortalUserActivityLogs(
  userId: string,
  page: number = 1,
) {
  const where = { actorUserId: userId };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        workspace: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PORTAL_USER_ACTIVITY_PAGE_SIZE,
      take: PORTAL_USER_ACTIVITY_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize: PORTAL_USER_ACTIVITY_PAGE_SIZE,
    totalPages: Math.max(
      1,
      Math.ceil(total / PORTAL_USER_ACTIVITY_PAGE_SIZE),
    ),
  };
}

export type PortalUserActivityLog = Awaited<
  ReturnType<typeof getPortalUserActivityLogs>
>["logs"][number];

/**
 * Get the timestamp of the most recent audit log entry for a user.
 */
export async function getPortalUserLastActivity(
  userId: string,
): Promise<Date | null> {
  const log = await prisma.auditLog.findFirst({
    where: { actorUserId: userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return log?.createdAt ?? null;
}
