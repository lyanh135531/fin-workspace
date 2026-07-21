import { getServerSession } from "next-auth";
import { Settings } from "lucide-react";
import { authOptions } from "@/auth";
import { ThemeToggle } from "@/app/theme-toggle";
import { WorkspaceNotifications } from "@/app/dashboard/workspace-notifications";
import { DashboardNavigation } from "@/app/dashboard/dashboard-navigation";
import { SidebarToggle } from "@/app/dashboard/sidebar-toggle";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const activeWorkspaceId = userId ? await resolveActiveWorkspaceId(userId) : null;
  const [membership, workspaces, archivedWorkspaces] = userId ? await Promise.all([
    activeWorkspaceId ? prisma.workspaceMember.findFirst({ where: { userId, workspaceId: activeWorkspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } }, include: { workspace: true, role: true } }) : null,
    prisma.workspaceMember.findMany({ where: { userId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } }, include: { workspace: { select: { id: true, name: true } }, role: { select: { code: true } } }, orderBy: { workspace: { name: "asc" } } }),
    prisma.workspaceMember.findMany({ where: { userId, status: "active", deletedAt: null, workspace: { status: "deactive", deletedAt: null, monthlyRecord: { isNot: null } } }, include: { workspace: { select: { id: true, name: true } }, role: { select: { code: true } } }, orderBy: { workspace: { name: "asc" } } }),
  ]) : [null, [], []];
  const isAdmin = membership?.role.code === "ADMIN";
  const monthLabel = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  return <div className="dashboard-app-shell"><aside className="dashboard-sidebar"><div className="dashboard-brand-row"><div className="dashboard-brand">Sunrise Finance</div><SidebarToggle/></div>{membership && <div className="dashboard-workspace-card"><p>Workspace đang mở</p><strong>{membership.workspace.name}</strong></div>}<DashboardNavigation currentId={membership?.workspaceId} workspaces={workspaces.map((item) => ({ id: item.workspace.id, name: item.workspace.name, role: item.role.code }))} archivedWorkspaces={archivedWorkspaces.map((item) => ({ id: item.workspace.id, name: item.workspace.name, role: item.role.code }))}/><div className="dashboard-user"><strong>{session?.user?.username}</strong><span>{membership ? (isAdmin ? "Quản trị viên" : "Thành viên") : "Chưa có workspace"}</span></div></aside><div className="dashboard-frame"><header className="dashboard-header"><div><p>{membership?.workspace.name ?? "Fin Workspace"}</p><span>{membership ? `Tổng quan · ${monthLabel}` : "Quản lý tài chính theo workspace"}</span></div><div className="flex items-center gap-2">{membership && <WorkspaceNotifications workspaceId={membership.workspaceId} isAdmin={isAdmin} />}{membership && <a className="button-secondary icon-button" href="/settings/workspace" title="Cài đặt workspace" aria-label="Cài đặt workspace"><Settings size={18} /></a>}<ThemeToggle /></div></header><main className="dashboard-content">{children}</main><footer className="dashboard-footer"><span className="dashboard-footer-brand">Fin Workspace</span><span id="dashboard-footer-notice" className="dashboard-footer-notice" role="status" aria-live="polite" hidden/><span className="dashboard-footer-meta">VND · Asia/Ho_Chi_Minh</span></footer></div></div>;
}
