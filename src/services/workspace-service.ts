import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function generateUniqueInviteCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const code = `${num.toString().slice(0, 3)}-${num.toString().slice(3)}`;
    const existing = await tx.workspace.findFirst({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${num.toString().slice(0, 3)}-${num.toString().slice(3)}`;
}

export async function createWorkspaceForUser(userId: string, input: { name: string; description?: string; baseCurrency: string; timeZone: string; }) {
  const user = await prisma.user.findFirst({ where: { id: userId, status: "active", deletedAt: null } });
  if (!user) throw new AppError("AUTHENTICATION_REQUIRED", "Active user is required.");
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { code: "ADMIN" } });
    if (!role) throw new AppError("NOT_FOUND", "The ADMIN role is missing.");
    const inviteCode = await generateUniqueInviteCode(tx);
    const workspace = await tx.workspace.create({ data: { ...input, inviteCode } });
    await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, roleId: role.id } });

    // Create a default wallet with 0 balance for the new workspace
    const zero = new Decimal(0);
    const wallet = await tx.wallet.create({
      data: {
        name: "Ví chính",
        description: "Ví mặc định",
        openingBalance: zero,
        currentBalance: zero,
      },
    });
    await tx.workspaceWallet.create({
      data: {
        workspaceId: workspace.id,
        walletId: wallet.id,
      },
    });

    await tx.auditLog.create({ data: { workspaceId: workspace.id, actorUserId: userId, action: "workspace.created", entityType: "workspace", entityId: workspace.id, metadata: { creatorRole: "ADMIN" } } });
    return workspace;
  });
}

export async function regenerateWorkspaceInviteCode(userId: string, workspaceId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const inviteCode = await generateUniqueInviteCode(tx);
    await tx.workspace.update({ where: { id: workspaceId }, data: { inviteCode } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "workspace.invite_code_regenerated", entityType: "workspace", entityId: workspaceId, metadata: { inviteCode } } });
    return inviteCode;
  });
}

export async function updateWorkspaceSettings(userId: string, workspaceId: string, input: { name: string; description?: string; baseCurrency: string; timeZone: string; status: "active" | "deactive" }) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: input });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "workspace.settings_updated", entityType: "workspace", entityId: workspaceId, metadata: { status: input.status, baseCurrency: input.baseCurrency, timeZone: input.timeZone } } });
    return workspace;
  });
}

export async function deleteWorkspaceForUser(userId: string, workspaceId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.deletedAt) throw new AppError("NOT_FOUND", "Workspace was not found.");
    await tx.workspace.update({ where: { id: workspaceId }, data: { status: "deactive", deletedAt: new Date() } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "workspace.deleted", entityType: "workspace", entityId: workspaceId, metadata: { softDeleted: true } } });
    return workspace;
  });
}
