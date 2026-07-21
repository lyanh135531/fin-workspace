import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureCurrentMonthlyWorkspace } from "@/services/monthly-workspace-service";

export const activeWorkspaceCookie = "fin-workspace-id";

export async function resolveActiveWorkspaceId(userId: string) {
  const monthlyWorkspaceId = await ensureCurrentMonthlyWorkspace(userId);
  const store = await cookies();
  const preferredId = store.get(activeWorkspaceCookie)?.value;
  const where = { userId, status: "active" as const, deletedAt: null, workspace: { status: "active" as const, deletedAt: null } };
  if (preferredId) {
    const preferred = await prisma.workspaceMember.findFirst({ where: { ...where, workspaceId: preferredId }, select: { workspaceId: true } });
    if (preferred) return preferred.workspaceId;
  }
  const monthlyMembership = await prisma.workspaceMember.findFirst({ where: { ...where, workspaceId: monthlyWorkspaceId }, select: { workspaceId: true } });
  if (monthlyMembership) return monthlyMembership.workspaceId;
  const fallback = await prisma.workspaceMember.findFirst({ where, select: { workspaceId: true }, orderBy: { createdAt: "asc" } });
  return fallback?.workspaceId ?? null;
}
