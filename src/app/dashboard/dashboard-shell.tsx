import { FinLogo } from "@/components/fin-logo";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { ThemeToggle } from "@/app/theme-toggle";
import { WorkspaceNotifications } from "@/app/dashboard/workspace-notifications";
import { DashboardNavigation } from "@/app/dashboard/dashboard-navigation";
import { DashboardHeaderSubtitle } from "@/app/dashboard/dashboard-header-subtitle";
import { SidebarToggle } from "@/app/dashboard/sidebar-toggle";
import { SidebarUserMenu } from "@/app/dashboard/sidebar-user-menu";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { activateDueScheduledTransactions } from "@/services/transaction-service";
import { isAdminRole, isOwnerRole } from "@/domain/role-policy";
import { getPendingJoinRequestCount } from "@/services/join-request-query";
import { MobileNavigation } from "@/app/dashboard/mobile-navigation";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const activeWorkspaceId = userId ? await resolveActiveWorkspaceId(userId) : null;

  if (activeWorkspaceId) await activateDueScheduledTransactions(activeWorkspaceId);

  const [membership, workspaces] = userId
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
    ])
    : [null, []];

  const pendingJoinCount = userId ? await getPendingJoinRequestCount(userId) : 0;

  const isOwner = membership ? isOwnerRole(membership.role.code) : false;
  const isAdmin = membership ? isAdminRole(membership.role.code) : false;
  const userRole: "admin" | "member" | "none" = membership
    ? isAdmin
      ? "admin"
      : "member"
    : "none";

  const username = session?.user?.username ?? "User";

  return (
    <div className="dashboard-app-shell">
      {/* ────────────────────────────── SIDEBAR ─────────────────────────────── */}
      <aside className="dashboard-sidebar" aria-label="Điều hướng">

        {/* Brand row */}
        <div className="dashboard-brand-row">
          <div className="dashboard-brand" style={{ display: "flex", alignItems: "center", gap: ".55rem", margin: "0 .35rem" }}>
            <FinLogo size={28} />
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
          pendingJoinCount={pendingJoinCount}
          isAdmin={isAdmin}
          username={username}
        />

        {/* User section with logout */}
        <SidebarUserMenu username={username} role={userRole} />
      </aside>

      {/* ────────────────────────── MAIN FRAME ──────────────────────────────── */}
      <div className="dashboard-frame">

        {/* ── HEADER ── */}
        <header className="dashboard-header">
          {/* Left: page subtitle (context) */}
          <div className="dashboard-header-leading">
            <MobileNavigation
              currentId={membership?.workspaceId}
              workspaces={workspaces.map((item) => ({
                id: item.workspace.id,
                name: item.workspace.name,
                role: item.role.code,
              }))}
              pendingJoinCount={pendingJoinCount}
              isAdmin={isAdmin}
              username={username}
              role={userRole}
            />
            <div className="dashboard-header-copy">
              <DashboardHeaderSubtitle
                fallback={
                  membership
                    ? membership.workspace.name
                    : "Fin Workspace"
                }
              />
            </div>
          </div>

          {/* Right: action group */}
          <div className="header-action-group">
            {membership && (
              <WorkspaceNotifications
                workspaceId={membership.workspaceId}
                currency={membership.workspace.baseCurrency}
                isAdmin={isAdmin}
                canAssignOwner={isOwner}
              />
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="dashboard-content">{children}</main>

      </div>
    </div>
  );
}

