import { getServerSession } from "next-auth";
import { Settings } from "lucide-react";
import Link from "next/link";
import { authOptions } from "@/auth";
import { ThemeToggle } from "@/app/theme-toggle";
import { WorkspaceNotifications } from "@/app/dashboard/workspace-notifications";
import { DashboardNavigation } from "@/app/dashboard/dashboard-navigation";
import { DashboardBreadcrumb } from "@/app/dashboard/dashboard-breadcrumb";
import { DashboardHeaderSubtitle } from "@/app/dashboard/dashboard-header-subtitle";
import { SidebarToggle } from "@/app/dashboard/sidebar-toggle";
import { SidebarUserMenu } from "@/app/dashboard/sidebar-user-menu";
import { FooterClock } from "@/app/dashboard/footer-clock";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { activateDueScheduledTransactions } from "@/services/transaction-service";
import { isAdminRole } from "@/domain/role-policy";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const activeWorkspaceId = userId ? await resolveActiveWorkspaceId(userId) : null;

  if (activeWorkspaceId) await activateDueScheduledTransactions(activeWorkspaceId);

  const [membership, workspaces, archivedWorkspaces] = userId
    ? await Promise.all([
      activeWorkspaceId
        ? prisma.workspaceMember.findFirst({
          where: {
            userId,
            workspaceId: activeWorkspaceId,
            status: "active",
            deletedAt: null,
            workspace: { status: "active", deletedAt: null },
          },
          include: { workspace: true, role: true },
        })
        : null,
      prisma.workspaceMember.findMany({
        where: {
          userId,
          status: "active",
          deletedAt: null,
          workspace: { status: "active", deletedAt: null },
        },
        include: {
          workspace: { select: { id: true, name: true } },
          role: { select: { code: true } },
        },
        orderBy: { workspace: { name: "asc" } },
      }),
      prisma.workspaceMember.findMany({
        where: {
          userId,
          status: "active",
          deletedAt: null,
          workspace: { status: "deactive", deletedAt: null, monthlyRecord: { isNot: null } },
        },
        include: {
          workspace: { select: { id: true, name: true } },
          role: { select: { code: true } },
        },
        orderBy: { workspace: { name: "asc" } },
      }),
    ])
    : [null, [], []];

  const isAdmin = membership?.role.code === "ADMIN";
  const userRole: "admin" | "member" | "none" = membership
    ? isAdmin
      ? "admin"
      : "member"
    : "none";

  const breadcrumbWorkspaces = [...workspaces, ...archivedWorkspaces].map((item) => ({
    id: item.workspace.id,
    name: item.workspace.name,
  }));

  const username = session?.user?.username ?? "User";

  return (
    <div className="dashboard-app-shell">
      {/* ────────────────────────────── SIDEBAR ─────────────────────────────── */}
      <aside className="dashboard-sidebar" aria-label="Điều hướng">

        {/* Brand row */}
        <div className="dashboard-brand-row">
          <div className="dashboard-brand" style={{ display: "flex", alignItems: "center", gap: ".55rem", margin: "0 .35rem" }}>
            <div className="sidebar-brand-logo" aria-hidden>F</div>
            <span className="sidebar-brand-text">Fin Workspace</span>
          </div>
          <SidebarToggle />
        </div>


        {/* Navigation */}
        <DashboardNavigation
          currentId={membership?.workspaceId}
          workspaces={workspaces.map((item) => ({
            id: item.workspace.id,
            name: item.workspace.name,
            role: item.role.code,
          }))}
          archivedWorkspaces={archivedWorkspaces.map((item) => ({
            id: item.workspace.id,
            name: item.workspace.name,
            role: item.role.code,
          }))}
        />

        {/* User section with logout */}
        <SidebarUserMenu username={username} role={userRole} />
      </aside>

      {/* ────────────────────────── MAIN FRAME ──────────────────────────────── */}
      <div className="dashboard-frame">

        {/* ── HEADER ── */}
        <header className="dashboard-header">
          {/* Left: breadcrumb + subtitle */}
          <div className="dashboard-header-copy">
            <DashboardBreadcrumb
              workspaces={breadcrumbWorkspaces}
              currentWorkspace={
                membership
                  ? { id: membership.workspaceId, name: membership.workspace.name }
                  : undefined
              }
            />
            <DashboardHeaderSubtitle
              fallback={
                membership
                  ? `${membership.workspace.name} · ${new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}`
                  : "Quản lý tài chính theo workspace"
              }
            />
          </div>

          {/* Center: active workspace pill */}
          {membership && (
            <div className="header-workspace-center">
              <span className="header-workspace-pill" title={membership.workspace.name}>
                <span className="header-workspace-pill-dot" aria-hidden />
                <span className="header-workspace-pill-name">{membership.workspace.name}</span>
              </span>
            </div>
          )}

          {/* Right: action group */}
          <div className="header-action-group">
            {membership && (
              <WorkspaceNotifications
                workspaceId={membership.workspaceId}
                isAdmin={isAdmin}
              />
            )}
            {membership && (
              <Link
                className="icon-button header-action-btn"
                href="/settings/workspace"
                aria-label="Cài đặt workspace"
              >
                <Settings size={17} strokeWidth={2} />
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="dashboard-content">{children}</main>

        {/* ── FOOTER ── */}
        <footer className="dashboard-footer">
          {/* Left: brand */}
          <div className="footer-brand">
            <div className="footer-brand-logo" aria-hidden>F</div>
            <span>Fin Workspace</span>
            <span className="footer-version">v1</span>
          </div>

          {/* Center: connection status */}
          <div className="footer-status" aria-label="Trạng thái kết nối: Đang hoạt động">
            <span className="footer-status-dot" aria-hidden />
            <span className="footer-status-label">Đang hoạt động</span>
          </div>

          {/* Right: live clock + timezone */}
          <div className="footer-right">
            <span
              id="dashboard-footer-notice"
              className="dashboard-footer-notice"
              role="status"
              aria-live="polite"
              hidden
            />
            <FooterClock />
            <span className="footer-tz">ICT · VND</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
