import { Prisma } from "@/generated/prisma/client";
import { getBusinessDateRange } from "@/lib/date";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { PortalActivitySearch } from "@/domain/platform-user/portal-activity-schemas";

export const PORTAL_ACTIVITY_PAGE_SIZE = 30;

export function buildPortalActivityWhere(
  filters: Omit<PortalActivitySearch, "page">,
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.q) {
    where.actor = {
      username: { contains: filters.q, mode: "insensitive" },
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = getBusinessDateRange(
      env.APP_TIME_ZONE,
      filters.dateFrom,
      filters.dateTo,
    );
  }

  return where;
}

export async function listPortalAuditLogs(filters: PortalActivitySearch) {
  const where = buildPortalActivityWhere(filters);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: {
          select: { username: true },
        },
        workspace: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PORTAL_ACTIVITY_PAGE_SIZE,
      take: PORTAL_ACTIVITY_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page: filters.page,
    pageSize: PORTAL_ACTIVITY_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PORTAL_ACTIVITY_PAGE_SIZE)),
  };
}

export type PortalAuditLogRecord = Awaited<
  ReturnType<typeof listPortalAuditLogs>
>["logs"][number];
