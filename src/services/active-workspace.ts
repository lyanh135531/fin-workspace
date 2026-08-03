import { cookies, headers } from "next/headers";
import { idSchema } from "@/domain/common/schemas";
import { prisma } from "@/lib/prisma";
import { sampleWorkspaceHeader } from "@/lib/workspace-context";

export const activeWorkspaceCookie = "fin-workspace-id";

export async function resolveSampleWorkspaceContextId() {
  const value = (await headers()).get(sampleWorkspaceHeader);
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function resolveActiveWorkspaceId(userId: string) {
  const contextualId = await resolveSampleWorkspaceContextId();
  const membershipWhere = {
    userId,
    status: "active" as const,
    deletedAt: null,
    workspace: { status: "active" as const, deletedAt: null },
  };

  if (contextualId) {
    const contextual = await prisma.workspaceMember.findFirst({
      where: { ...membershipWhere, workspaceId: contextualId },
      select: { workspaceId: true },
    });
    return contextual?.workspaceId ?? null;
  }

  const store = await cookies();
  const preferredId = store.get(activeWorkspaceCookie)?.value;
  const where = {
    ...membershipWhere,
    workspace: { ...membershipWhere.workspace, sampleDatasetKey: null },
  };
  if (preferredId) {
    const preferred = await prisma.workspaceMember.findFirst({ where: { ...where, workspaceId: preferredId }, select: { workspaceId: true } });
    if (preferred) return preferred.workspaceId;
  }
  const fallback = await prisma.workspaceMember.findFirst({ where, select: { workspaceId: true }, orderBy: { createdAt: "asc" } });
  return fallback?.workspaceId ?? null;
}

export async function workspaceNavigationBasePath(workspaceId: string) {
  const contextualId = await resolveSampleWorkspaceContextId();
  return contextualId === workspaceId ? `/sample/${workspaceId}` : "";
}
