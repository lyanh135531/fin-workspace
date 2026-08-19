import { prisma } from "@/lib/prisma";

/**
 * Dashboard overview statistics.
 */
export async function getPortalDashboardStats() {
  const [total, active, deactive, newLast30] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { status: "deactive" } }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return { total, active, deactive, newLast30 };
}

/**
 * User registrations grouped by month for the last 12 months.
 * Uses raw query for efficient grouping.
 */
export async function getUserRegistrationsByMonth() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    Array<{ month: string; count: bigint }>
  >`
    SELECT to_char("created_at", 'YYYY-MM') AS month,
           COUNT(*)::bigint                  AS count
    FROM "USERS"
    WHERE "created_at" >= ${twelveMonthsAgo}
    GROUP BY month
    ORDER BY month ASC
  `;

  return rows.map((row) => ({
    month: row.month,
    count: Number(row.count),
  }));
}

/**
 * System activity (audit log count) grouped by day for the last 30 days.
 */
export async function getSystemActivityByDay() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    Array<{ day: string; count: bigint }>
  >`
    SELECT to_char("created_at", 'YYYY-MM-DD') AS day,
           COUNT(*)::bigint                     AS count
    FROM "AUDIT_LOG"
    WHERE "created_at" >= ${thirtyDaysAgo}
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day: row.day,
    count: Number(row.count),
  }));
}

/**
 * Daily active users (distinct actors in audit log) for the last 30 days.
 */
export async function getDailyActiveUsers() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    Array<{ day: string; dau: bigint }>
  >`
    SELECT to_char("created_at", 'YYYY-MM-DD') AS day,
           COUNT(DISTINCT "actor_user_id")::bigint AS dau
    FROM "AUDIT_LOG"
    WHERE "created_at" >= ${thirtyDaysAgo}
      AND "actor_user_id" IS NOT NULL
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day: row.day,
    dau: Number(row.dau),
  }));
}

/**
 * Top active users ranked by total audit log actions.
 */
export async function getTopActiveUsers(limit = 10) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; username: string; action_count: bigint; last_active: Date }>
  >`
    SELECT u."id", u."username", COUNT(a."id")::bigint AS action_count, MAX(a."created_at") AS last_active
    FROM "USERS" u
    JOIN "AUDIT_LOG" a ON a."actor_user_id" = u."id"
    GROUP BY u."id", u."username"
    ORDER BY action_count DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    actionCount: Number(row.action_count),
    lastActive: row.last_active,
  }));
}

export type TopActiveUserRecord = Awaited<
  ReturnType<typeof getTopActiveUsers>
>[number];

/**
 * Recent system-wide activity with actor username.
 */
export async function getRecentSystemActivity(limit = 10) {
  return prisma.auditLog.findMany({
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      actor: {
        select: { username: true },
      },
      workspace: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type RecentActivityRecord = Awaited<
  ReturnType<typeof getRecentSystemActivity>
>[number];
