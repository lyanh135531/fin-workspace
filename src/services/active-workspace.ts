import { cookies } from "next/headers";
import { ADMIN_ROLE_CODES } from "@/domain/role-policy";
import { prisma } from "@/lib/prisma";

export const activeWorkspaceCookie = "fin-workspace-id";

export async function resolveActiveWorkspaceId(userId: string) {
  const store = await cookies();
  const preferredId = store.get(activeWorkspaceCookie)?.value;
  const where = {
    userId,
    status: "active" as const,
    deletedAt: null,
    OR: [
      { workspace: { status: "active" as const, deletedAt: null } },
      { workspace: { deletedAt: null }, role: { code: { in: [...ADMIN_ROLE_CODES] } } },
    ],
  };
  if (preferredId) {
    const preferred = await prisma.workspaceMember.findFirst({ where: { ...where, workspaceId: preferredId }, select: { workspaceId: true } });
    if (preferred) return preferred.workspaceId;
  }
  const fallback = await prisma.workspaceMember.findFirst({
    where,
    select: { workspaceId: true },
    orderBy: [{ workspace: { status: "asc" } }, { createdAt: "asc" }],
  });
  return fallback?.workspaceId ?? null;
}
