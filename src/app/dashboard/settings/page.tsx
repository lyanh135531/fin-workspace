import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
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
  if (!isAdmin) redirect("/dashboard");
  const inviteCode = /^\d{3}-\d{3}$/.test(membership.workspace.inviteCode)
    ? membership.workspace.inviteCode
    : await regenerateWorkspaceInviteCode(session.user.id, workspaceId);

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
        where: { workspaceId, status: "pending" },
        select: {
          id: true,
          requester: { select: { username: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return (
    <PageContainer className="workspace-settings-page">
      <div className="workspace-settings-container workspace-admin-settings-container space-y-6 min-[901px]:mx-auto min-[901px]:max-w-[76rem] min-[901px]:space-y-0">
        <section className="workspace-mobile-overview md:hidden rounded-2xl">
          <div className="workspace-mobile-overview-head">
            <div className="workspace-mobile-overview-copy">
              <p>Quản trị nhóm</p>
              <h1>{membership.workspace.name}</h1>
              <span>
                <i data-active={membership.workspace.status === "active"} />
                {membership.workspace.status === "active"
                  ? "Đang hoạt động"
                  : "Tạm ngưng"}
              </span>
            </div>
            <InviteCodeCard code={inviteCode} />
          </div>
          <dl>
            <div>
              <dt>Thành viên</dt>
              <dd>{members.length}</dd>
            </div>
            <div>
              <dt>Danh mục</dt>
              <dd>{categories.length}</dd>
            </div>
            <div>
              <dt>Chờ duyệt</dt>
              <dd>{joinRequests.length}</dd>
            </div>
          </dl>
        </section>

        <PageHeader
          title="Cài đặt nhóm tài chính"
          description="Cấu hình thông tin chung, quản lý danh mục thu chi và thành viên trong nhóm của bạn."
          eyebrow="Quản trị nhóm"
          className="max-md:hidden min-[901px]:mb-6 min-[901px]:pb-0"
          border={false}
        >
          <InviteCodeCard code={inviteCode} compact />
        </PageHeader>

        <WorkspaceSettingsTabsClient
          workspace={{
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
