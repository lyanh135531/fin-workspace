import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function createWorkspaceForUser(userId: string, input: { name: string; description?: string; baseCurrency: string; timeZone: string; approvalRequired: boolean }) {
  const user = await prisma.user.findFirst({ where: { id: userId, status: "active", deletedAt: null } });
  if (!user) throw new AppError("AUTHENTICATION_REQUIRED", "Active user is required.");
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { code: "ADMIN" } });
    if (!role) throw new AppError("NOT_FOUND", "The ADMIN role is missing.");
    const workspace = await tx.workspace.create({ data: input });
    await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, roleId: role.id } });
    await tx.auditLog.create({ data: { workspaceId: workspace.id, actorUserId: userId, action: "workspace.created", entityType: "workspace", entityId: workspace.id, metadata: { creatorRole: "ADMIN" } } });
    return workspace;
  });
}

export async function updateWorkspaceSettings(userId: string, workspaceId: string, input: { name: string; description?: string; baseCurrency: string; timeZone: string; approvalRequired: boolean; status: "active" | "deactive" }) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: input });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "workspace.settings_updated", entityType: "workspace", entityId: workspaceId, metadata: { status: input.status, baseCurrency: input.baseCurrency, timeZone: input.timeZone, approvalRequired: input.approvalRequired } } });
    return workspace;
  });
}

export async function deleteWorkspaceForUser(userId: string, workspaceId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, include: { monthlyRecord: true } });
    if (!workspace || workspace.deletedAt) throw new AppError("NOT_FOUND", "Workspace was not found.");
    if (workspace.monthlyRecord) throw new AppError("FORBIDDEN", "Monthly expense workspaces cannot be deleted. Older months are read-only archives.");
    await tx.workspace.update({ where: { id: workspaceId }, data: { status: "deactive", deletedAt: new Date() } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "workspace.deleted", entityType: "workspace", entityId: workspaceId, metadata: { softDeleted: true } } });
    return workspace;
  });
}
