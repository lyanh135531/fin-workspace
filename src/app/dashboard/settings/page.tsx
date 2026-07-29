import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { WorkspaceSettingsTabsClient } from "@/app/dashboard/settings/workspace-settings-tabs-client";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { manageableCategoryWhere } from "@/services/category-visibility";
import { isAdminRole, WORKSPACE_ROLE_CODES } from "@/domain/role-policy";
import { getUserTemplatesForImport } from "@/services/import-category-service";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null }, include: { workspace: true, role: true } });
  if (!membership) redirect("/overview");

  const isAdmin = isAdminRole(membership.role.code);

  if (!isAdmin) redirect("/dashboard");

  const [members, categories, templates, roles, joinRequests] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId, status: "active", deletedAt: null },
      select: {
        id: true,
        userId: true,
        role: { select: { code: true, name: true } },
        user: { select: { username: true } },
      },
    }),
    prisma.category.findMany({ where: manageableCategoryWhere(workspaceId), include: { _count: { select: { transactions: { where: { deletedAt: null } } } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getUserTemplatesForImport(session.user.id),
    prisma.role.findMany({
      where: { code: { in: [...WORKSPACE_ROLE_CODES] } },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workspaceJoinRequest.findMany({
      where: { workspaceId, status: "pending" },
      select: {
        id: true,
        requester: { select: { username: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const existingCodes = categories.map((c) => c.code);

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container space-y-6">
        {/* ── Page Header ── */}
        <div className="page-header">
          <h1 className="page-title">Cài đặt</h1>
        </div>

        <WorkspaceSettingsTabsClient
          workspace={{
            name: membership.workspace.name,
            description: membership.workspace.description,
            baseCurrency: membership.workspace.baseCurrency,
            timeZone: membership.workspace.timeZone,
            approvalRequired: membership.workspace.approvalRequired,
            status: membership.workspace.status,
            inviteCode: membership.workspace.inviteCode,
          }}
          isAdmin={isAdmin}
          templates={templates}
          existingCodes={existingCodes}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            code: category.code,
            color: category.color,
            type: category.type,
            icon: category.icon,
            parentId: category.parentId,
            status: category.status,
            transactionCount: category._count.transactions,
          }))}
          members={members.map((m) => ({
            id: m.id,
            username: m.user.username,
            roleCode: m.role.code,
            isSelf: m.userId === session.user.id,
          }))}
          roles={roles.map((r) => ({ code: r.code, name: r.name }))}
          joinRequests={joinRequests.map((request) => ({
            id: request.id,
            username: request.requester.username,
          }))}
          initialTab={params.tab === "members" || params.tab === "joinRequests"
            ? "members"
            : params.tab === "categories"
              ? "categories"
              : "general"}
        />
      </div>
    </div>
  );
}
