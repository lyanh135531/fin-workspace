import { redirect } from "next/navigation";

import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { PageContainer, PageHeader } from "@/components/base";
import { WorkspaceSettingsTabsClient } from "@/app/dashboard/settings/workspace-settings-tabs-client";
import { InviteCodeCard } from "@/app/dashboard/settings/invite-code-card";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { manageableCategoryWhere } from "@/services/category-visibility";
import { regenerateWorkspaceInviteCode } from "@/services/workspace-service";
import { isAdminRole, WORKSPACE_ROLE_CODES } from "@/domain/role-policy";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
    },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/overview");

  const isAdmin = isAdminRole(membership.role.code);
  if (!isAdmin) redirect("/overview");
  const inviteCode = /^\d{3}-\d{3}$/.test(membership.workspace.inviteCode)
    ? membership.workspace.inviteCode
    : await regenerateWorkspaceInviteCode(session.user.id, workspaceId).catch(
        () => membership.workspace.inviteCode,
      );

  const [members, categories, roles, joinRequests] =
    await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId, status: "active", deletedAt: null },
        select: {
          id: true,
          userId: true,
          role: { select: { code: true, name: true } },
          user: { select: { username: true } },
        },
      }),
      prisma.category.findMany({
        where: manageableCategoryWhere(workspaceId),
        include: {
          _count: { select: { transactions: { where: { deletedAt: null } } } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.role.findMany({
        where: { code: { in: [...WORKSPACE_ROLE_CODES] } },
        select: { code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.workspaceJoinRequest.findMany({
        where: {
          workspaceId,
          status: "pending",
          requester: { status: "active", deletedAt: null },
        },
        select: {
          id: true,
          requester: { select: { username: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return (
    <PageContainer className="workspace-settings-page">
      <div className="workspace-settings-container workspace-admin-settings-container flex flex-col gap-3.5 md:block md:space-y-0">
        <div className="md:hidden">
          <InviteCodeCard code={inviteCode} workspaceId={workspaceId} compact />
        </div>

        <PageHeader
          title="Cài đặt nhóm tài chính"
          description="Thiết lập thông tin chung, quản lý danh mục thu chi và thành viên trong nhóm của bạn."
          eyebrow="Cài đặt nhóm"
          className="max-md:hidden md:mb-6 md:pb-0"
          border={false}
        >
          <InviteCodeCard code={inviteCode} workspaceId={workspaceId} compact />
        </PageHeader>

        <WorkspaceSettingsTabsClient
          workspaceId={workspaceId}
          workspace={{
            id: membership.workspace.id,
            name: membership.workspace.name,
            description: membership.workspace.description,
            baseCurrency: membership.workspace.baseCurrency,
            timeZone: membership.workspace.timeZone,
            status: membership.workspace.status as "active" | "deactive",
            inviteCode,
          }}
          isAdmin={isAdmin}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            code: category.code,
            color: category.color,
            type: category.type,
            icon: category.icon,
            parentId: category.parentId,
            jarCode: category.jarCode,
            status: category.status,
            transactionCount: category._count.transactions,
          }))}
          members={members.map((m) => ({
            id: m.id,
            username: m.user.username ?? "Người dùng",
            roleCode: m.role.code,
            isSelf: m.userId === session.user.id,
          }))}
          roles={roles.map((r) => ({ code: r.code, name: r.name }))}
          joinRequests={joinRequests.map((request) => ({
            id: request.id,
            username: request.requester.username ?? "Người dùng",
          }))}
          initialTab={
            params.tab === "members" || params.tab === "joinRequests"
              ? "members"
              : params.tab === "categories"
                ? "categories"
                : "general"
          }
        />
      </div>
    </PageContainer>
  );
}
