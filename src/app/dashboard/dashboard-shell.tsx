import { FinLogo } from "@/components/fin-logo";
import Link from "next/link";
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
import { isAdminRole } from "@/domain/role-policy";
import { getPendingJoinRequestCount } from "@/services/join-request-query";
import { MobileNavigation } from "@/app/dashboard/mobile-navigation";
import { QuickTransactionSheet } from "@/app/dashboard/overview/quick-transaction-sheet";
import { getBusinessDateInTimeZone } from "@/lib/date";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

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
          workspace: { select: { id: true, name: true, baseCurrency: true, timeZone: true } },
          role: { select: { code: true } },
        },
        orderBy: { workspace: { name: "asc" } },
      }),
    ])
    : [null, []];

  const quickWorkspaceIds = workspaces.map((item) => item.workspaceId);
  const [quickWalletLinks, quickCategories] = quickWorkspaceIds.length
    ? await Promise.all([
      prisma.workspaceWallet.findMany({
        where: {
          workspaceId: { in: quickWorkspaceIds },
          wallet: { status: "active", deletedAt: null },
        },
        select: {
          workspaceId: true,
          wallet: { select: { id: true, name: true } },
        },
        orderBy: { wallet: { name: "asc" } },
      }),
      prisma.category.findMany({
        where: {
          status: "active",
          deletedAt: null,
          workspaceId: { in: quickWorkspaceIds },
        },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          color: true,
          icon: true,
          parentId: true,
          type: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
    ])
    : [[], []];

  const pendingJoinCount = userId ? await getPendingJoinRequestCount(userId) : 0;

  const isAdmin = membership ? isAdminRole(membership.role.code) : false;
  const userRole: "admin" | "member" | "none" = membership
    ? isAdmin
      ? "admin"
      : "member"
    : "none";

  const username = session?.user?.username ?? "User";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            href="/overview"
            className="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md px-1 text-[var(--foreground)] outline-none transition-[width,height,padding,color,gap] duration-200 hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0!"
            aria-label="Felice — về trang tổng quan"
          >
            <FinLogo size={36} />
            <span className="max-w-24 truncate text-base font-semibold transition-[max-width,opacity] duration-200 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              Felice
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
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
        </SidebarContent>

        <SidebarFooter>
          <SidebarUserMenu username={username} role={userRole} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
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
            <div className="hidden min-[901px]:flex">
              <SidebarToggle />
            </div>
            <div className="dashboard-header-copy">
              <DashboardHeaderSubtitle
                fallback={
                  membership
                    ? membership.workspace.name
                    : "Felice"
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
                timeZone={membership.workspace.timeZone}
                isAdmin={isAdmin}
              />
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="dashboard-content px-10 py-5">{children}</main>
        <QuickTransactionSheet
          initialWorkspaceId={membership?.workspaceId ?? workspaces[0]?.workspaceId ?? ""}
          workspaces={workspaces.map((item) => ({
            id: item.workspaceId,
            name: item.workspace.name,
            currency: item.workspace.baseCurrency,
            businessDate: getBusinessDateInTimeZone(item.workspace.timeZone),
            role: item.role.code,
            wallets: quickWalletLinks
              .filter((link) => link.workspaceId === item.workspaceId)
              .map((link) => link.wallet),
            categories: quickCategories
              .filter((category) => category.workspaceId === item.workspaceId)
              .map((category) => ({
                id: category.id,
                name: category.name,
                color: category.color,
                icon: category.icon,
                parentId: category.parentId,
                type: category.type as "income" | "expense",
              })),
          }))}
        />

      </SidebarInset>
    </SidebarProvider>
  );
}
