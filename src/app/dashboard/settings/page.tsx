import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { CategoryManagement } from "@/app/dashboard/settings/category-management";
import { InviteCodeCard } from "@/app/dashboard/settings/invite-code-card";
import { SettingsClient } from "@/app/dashboard/settings/settings-client";
import { WorkspaceSettings } from "@/app/dashboard/settings/workspace-settings";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { manageableCategoryWhere } from "@/services/category-visibility";
import { isAdminRole } from "@/domain/role-policy";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null }, include: { workspace: { include: { monthlyRecord: true } }, role: true } });
  if (!membership) redirect("/overview");
  const isAdmin = isAdminRole(membership.role.code);
  const [roles, members, categories] = await Promise.all([
    prisma.role.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId, status: "active", deletedAt: null }, include: { user: { select: { username: true } }, role: { select: { code: true } } }, orderBy: { user: { username: "asc" } } }),
    prisma.category.findMany({ where: manageableCategoryWhere(workspaceId), include: { _count: { select: { transactions: { where: { deletedAt: null } } } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const privateCategoryCount = categories.filter((category) => category.workspaceId === workspaceId).length;
  return <div className="workspace-settings-page"><div className="workspace-settings-container">
    <a href={`/workspace/${workspaceId}`} className="settings-back">← Quay lại sổ thu chi</a>
    <header className="settings-hero"><div><p className="settings-eyebrow">Không gian làm việc</p><h1>{membership.workspace.name}</h1><p className="settings-hero-copy">Thiết lập vận hành, danh mục và quyền truy cập của workspace.</p></div><div className="settings-summary" aria-label="Tổng quan workspace"><span><strong>{members.length}</strong> thành viên</span><span><strong>{privateCategoryCount}</strong> danh mục riêng</span><span className={isAdmin ? "settings-role settings-role-admin" : "settings-role"}>{isAdmin ? "Quản trị viên" : "Thành viên"}</span></div></header>
    <div className="settings-overview-grid"><WorkspaceSettings workspace={{ name: membership.workspace.name, description: membership.workspace.description, baseCurrency: membership.workspace.baseCurrency, timeZone: membership.workspace.timeZone, approvalRequired: membership.workspace.approvalRequired, status: membership.workspace.status, isMonthly: Boolean(membership.workspace.monthlyRecord) }} isAdmin={isAdmin}/>{isAdmin && <InviteCodeCard code={membership.workspace.inviteCode}/>}</div>
    <CategoryManagement isAdmin={isAdmin} categories={categories.map((category) => ({ id: category.id, name: category.name, code: category.code, color: category.color, type: category.type, icon: category.icon, parentId: category.parentId, system: category.workspaceId === null, status: category.status, transactionCount: category._count.transactions }))}/>
    <SettingsClient roles={roles} isAdmin={isAdmin} members={members.map((member) => ({ id: member.id, username: member.user.username, roleCode: member.role.code, isSelf: member.userId === session.user.id }))}/>
  </div></div>;
}
