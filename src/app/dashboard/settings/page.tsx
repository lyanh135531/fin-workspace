import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { CategoryManagement } from "@/app/dashboard/settings/category-management";
import { ImportCategoryPanel } from "@/app/dashboard/settings/import-category-panel";
import { InviteCodeCard } from "@/app/dashboard/settings/invite-code-card";
import { WorkspaceSettings } from "@/app/dashboard/settings/workspace-settings";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { manageableCategoryWhere } from "@/services/category-visibility";
import { isOwnerRole } from "@/domain/role-policy";
import { getUserTemplatesForImport } from "@/services/import-category-service";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null }, include: { workspace: true, role: true } });
  if (!membership) redirect("/overview");

  const isOwner = isOwnerRole(membership.role.code);

  // Only workspace owner can access settings
  if (!isOwner) redirect("/dashboard");

  const [members, categories, templates] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true } }),
    prisma.category.findMany({ where: manageableCategoryWhere(workspaceId), include: { _count: { select: { transactions: { where: { deletedAt: null } } } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getUserTemplatesForImport(session.user.id),
  ]);

  const existingCodes = categories.map((c) => c.code);

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container">
        <header className="settings-hero">
          <div>
            <p className="settings-eyebrow">Không gian làm việc</p>
            <h1>{membership.workspace.name}</h1>
            <p className="settings-hero-copy">Thiết lập vận hành, danh mục và mã mời của workspace.</p>
          </div>
          <div className="settings-summary" aria-label="Tổng quan workspace">
            <span><strong>{members.length}</strong> thành viên</span>
            <span><strong>{categories.length}</strong> danh mục</span>
            <span className="settings-role settings-role-admin">Chủ sở hữu</span>
          </div>
        </header>

        <div className="settings-overview-grid">
          <WorkspaceSettings
            workspace={{
              name: membership.workspace.name,
              description: membership.workspace.description,
              baseCurrency: membership.workspace.baseCurrency,
              timeZone: membership.workspace.timeZone,
              approvalRequired: membership.workspace.approvalRequired,
              status: membership.workspace.status,
            }}
            isAdmin={isOwner}
          />
          <InviteCodeCard code={membership.workspace.inviteCode} />
        </div>

        <ImportCategoryPanel templates={templates} existingCodes={existingCodes} />

        <CategoryManagement
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
        />
      </div>
    </div>
  );
}
