import { formatInTimeZone } from "date-fns-tz";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const timeZone = "Asia/Ho_Chi_Minh";

export function currentExpensePeriod(now = new Date()) {
  return formatInTimeZone(now, timeZone, "yyyy-MM");
}

export function expenseWorkspaceName(period: string) {
  const [year, month] = period.split("-");
  return `Chi tiêu ${month}/${year}`;
}

/** Ensures exactly one active, user-owned expense workspace exists for the current month. */
export async function ensureCurrentMonthlyWorkspace(userId: string, now = new Date()) {
  const period = currentExpensePeriod(now);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, status: "active", deletedAt: null }, select: { id: true } });
    if (!user) throw new AppError("AUTHENTICATION_REQUIRED", "Active user is required.");

    const previous = await tx.monthlyWorkspace.findMany({ where: { userId, period: { lt: period }, workspace: { status: "active", deletedAt: null } }, select: { workspaceId: true } });
    if (previous.length) {
      await tx.workspace.updateMany({ where: { id: { in: previous.map((item) => item.workspaceId) } }, data: { status: "deactive" } });
    }

    const existing = await tx.monthlyWorkspace.findUnique({ where: { userId_period: { userId, period } }, include: { workspace: true } });
    if (existing) {
      if (existing.workspace.status !== "active") await tx.workspace.update({ where: { id: existing.workspaceId }, data: { status: "active" } });
      return existing.workspaceId;
    }

    const ownsWorkspace = await tx.workspaceMember.count({ where: { userId, status: "active", deletedAt: null, role: { code: "OWNER" } } });
    const creatorRole = ownsWorkspace ? "OWNER" : "ADMIN";
    const role = await tx.role.findUnique({ where: { code: creatorRole } });
    if (!role) throw new AppError("NOT_FOUND", `The ${creatorRole} role is missing.`);
    const workspace = await tx.workspace.create({ data: { name: expenseWorkspaceName(period), description: `Theo dõi chi tiêu tháng ${period}`, baseCurrency: "VND", timeZone, approvalRequired: true } });
    await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, roleId: role.id } });
    await tx.monthlyWorkspace.create({ data: { userId, period, workspaceId: workspace.id } });
    await tx.auditLog.create({ data: { workspaceId: workspace.id, actorUserId: userId, action: "workspace.monthly_created", entityType: "workspace", entityId: workspace.id, metadata: { period } } });
    return workspace.id;
  });
}
