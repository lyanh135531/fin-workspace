import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { authOptions } from "@/auth";
import { WorkspaceSettingsTabsClient } from "@/app/dashboard/settings/workspace-settings-tabs-client";
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

  const [members, categories, templates, roles] = await Promise.all([
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
    prisma.role.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const existingCodes = categories.map((c) => c.code);
  const activeCategories = categories.filter((c) => c.status === "active");

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container space-y-6">
        {/* ── Hero Section (đồng nhất General Settings) ── */}
        <header className="settings-hero">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="settings-badge">
                <Settings2 size={13} className="text-[var(--primary)]" />
                Cài đặt workspace
              </span>
            </div>
            <h1>{membership.workspace.name}</h1>
            <p className="settings-hero-copy">Thiết lập vận hành, danh mục thu/chi, mã mời và quản lý thành viên của workspace.</p>
          </div>
          <div className="settings-summary" aria-label="Tổng quan workspace">
            <span><strong>{members.length}</strong> thành viên</span>
            <span><strong>{activeCategories.length}</strong> / {categories.length} danh mục</span>
            <span className="settings-role settings-role-admin">Chủ sở hữu</span>
          </div>
        </header>

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
          isAdmin={isOwner}
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
        />
      </div>
    </div>
  );
}
