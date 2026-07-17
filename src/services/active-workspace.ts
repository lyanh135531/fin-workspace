import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const activeWorkspaceCookie = "fin-workspace-id";

export async function resolveActiveWorkspaceId(userId: string) {
  const store = await cookies();
  const preferredId = store.get(activeWorkspaceCookie)?.value;
  const where = { userId, status: "active" as const, deletedAt: null, workspace: { status: "active" as const, deletedAt: null } };
  if (preferredId) {
    const preferred = await prisma.workspaceMember.findFirst({ where: { ...where, workspaceId: preferredId }, select: { workspaceId: true } });
    if (preferred) return preferred.workspaceId;
  }
  const fallback = await prisma.workspaceMember.findFirst({ where, select: { workspaceId: true }, orderBy: { createdAt: "asc" } });
  return fallback?.workspaceId ?? null;
}
