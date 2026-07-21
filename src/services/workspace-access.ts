import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_CODES } from "@/domain/role-policy";

export async function requireWorkspaceMember(userId: string, workspaceId: string, requireAdmin = false, allowArchived = false) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
      status: "active",
      deletedAt: null,
      user: { status: "active", deletedAt: null },
      workspace: allowArchived ? { deletedAt: null } : { status: "active", deletedAt: null },
      role: requireAdmin ? { code: { in: [...ADMIN_ROLE_CODES] } } : undefined,
    },
    include: { role: true, workspace: { include: { monthlyRecord: true } } },
  });
  if (!member) throw new AppError("FORBIDDEN", "You do not have access to this workspace.");
  return member;
}

export async function requireWorkspaceWallet(workspaceId: string, walletId: string) {
  const link = await prisma.workspaceWallet.findFirst({
    where: { workspaceId, walletId, wallet: { status: "active", deletedAt: null } },
  });
  if (!link) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Wallet is not available in this workspace.");
  return link;
}
