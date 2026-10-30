import {
  BookOpen,
  CalendarRange,
  CreditCard,
  Landmark,
  LayoutDashboard,
  Repeat2,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { DashboardHeaderSubtitle } from "@/app/dashboard/dashboard-header-subtitle";
import {
  AppearanceMenu,
  MobileAppearanceSheet,
} from "@/app/dashboard/appearance-controls";
import { MobileBottomNavigation } from "@/app/dashboard/mobile-bottom-navigation";
import { DashboardNavigation } from "@/app/dashboard/dashboard-navigation";
import { MobileNavigation } from "@/app/dashboard/mobile-navigation";
import {
  QuickTransactionHeaderButton,
  QuickTransactionSheet,
} from "@/app/dashboard/overview/quick-transaction-sheet";
import {
  PwaInstallBanner,
  PwaInstallProvider,
} from "@/app/pwa-install";
import { PrivacyMaskHeaderButton } from "@/app/dashboard/privacy-mask-button";
import { SidebarToggle } from "@/app/dashboard/sidebar-toggle";
import { SidebarUserMenu } from "@/app/dashboard/sidebar-user-menu";
import { WorkspaceNotifications } from "@/app/dashboard/workspace-notifications";
import { FinLogo } from "@/components/fin-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { workspaceCapabilities } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { getPendingJoinRequestCount } from "@/services/join-request-query";
import { processDueRecurringTransactions } from "@/services/recurring-transaction-service";
import { activateDueScheduledTransactionsForRequest } from "@/services/transaction-service";

type DashboardShellProps = {
  children: React.ReactNode;
};

type DashboardShellData = Awaited<ReturnType<typeof loadDashboardShellData>>;

type DashboardShellDataProps = {
  dataPromise: Promise<DashboardShellData>;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const dataPromise = loadDashboardShellData();

  return (
    <PwaInstallProvider>
      <SidebarProvider>
        <Suspense fallback={<DashboardSidebarFallback />}>
          <DashboardSidebar dataPromise={dataPromise} />
        </Suspense>

        <SidebarInset>
          <Suspense fallback={<DashboardHeaderFallback />}>
            <DashboardHeader dataPromise={dataPromise} />
          </Suspense>

          <PwaInstallBanner />

          <main
            id="main-content"
            className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto [scrollbar-gutter:stable] px-4 pt-4 pb-24 md:px-6 md:py-5 lg:px-8 lg:py-6"
            tabIndex={-1}
          >
            {children}
          </main>

          <Suspense fallback={null}>
            <DashboardQuickTransaction dataPromise={dataPromise} />
          </Suspense>

          <Suspense fallback={null}>
            <DashboardMobileBottomNavigation dataPromise={dataPromise} />
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </PwaInstallProvider>
  );
}

async function loadDashboardShellData() {
  const session = await requireAcceptedLegalPageSession();
  const userId = session.user.id;
  const activeWorkspaceId = await resolveActiveWorkspaceId(userId);

  if (activeWorkspaceId) {
    await Promise.all([
      activateDueScheduledTransactionsForRequest(activeWorkspaceId),
      processDueRecurringTransactions({ workspaceId: activeWorkspaceId }).catch(() => null),
    ]);
  }

  const [membership, workspaces, currentUser] = await Promise.all([
        activeWorkspaceId
          ? prisma.workspaceMember.findFirst({
              where: {
                userId,
                workspaceId: activeWorkspaceId,
                status: "active",
                deletedAt: null,
                OR: [
                  { workspace: { status: "active", deletedAt: null } },
                  { workspace: { deletedAt: null }, role: { code: "ADMIN" } },
                ],
              },
              include: { workspace: true, role: true },
            })
          : null,
        prisma.workspaceMember.findMany({
          where: {
            userId,
            status: "active",
            deletedAt: null,
            OR: [
              { workspace: { status: "active", deletedAt: null } },
              { workspace: { deletedAt: null }, role: { code: "ADMIN" } },
            ],
          },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                baseCurrency: true,
                timeZone: true,
              },
            },
            role: { select: { code: true } },
          },
          orderBy: { workspace: { name: "asc" } },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        }),
      ]);

  const targetQuickWorkspaceId =
    membership?.workspaceId ?? workspaces[0]?.workspaceId ?? null;
  const [quickWalletLinks, quickCategories, pendingJoinCount] =
    await Promise.all([
      targetQuickWorkspaceId
        ? prisma.workspaceWallet.findMany({
            where: {
              workspaceId: targetQuickWorkspaceId,
              wallet: { status: "active", deletedAt: null },
            },
            select: {
              workspaceId: true,
              wallet: {
                select: {
                  id: true,
                  name: true,
                  kind: true,
                  creditCardProfile: {
                    select: { defaultFundingWalletId: true },
                  },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
          })
        : Promise.resolve([]),
      targetQuickWorkspaceId
        ? prisma.category.findMany({
            where: availableCategoryWhere(targetQuickWorkspaceId),
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
          })
        : Promise.resolve([]),
      getPendingJoinRequestCount(userId),
    ]);

  const capabilities = workspaceCapabilities(membership?.role.code ?? "");
  const isAdmin = capabilities.canManageWorkspace;
  const userRole: "admin" | "member" | "none" = membership
    ? isAdmin
      ? "admin"
      : "member"
    : "none";

  return {
    membership,
    workspaces,
    targetQuickWorkspaceId,
    quickWalletLinks,
    quickCategories,
    pendingJoinCount,
    isAdmin,
    userRole,
    username: currentUser?.username ?? session.user.username ?? "User",
  };
}

async function DashboardSidebar({ dataPromise }: DashboardShellDataProps) {
  const {
    membership,
    workspaces,
    pendingJoinCount,
    isAdmin,
    userRole,
    username,
  } = await dataPromise;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-2">
        <BrandLink />
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

      <SidebarFooter className="pt-2">
        <SidebarUserMenu username={username} role={userRole} />
      </SidebarFooter>
    </Sidebar>
  );
}

async function DashboardHeader({ dataPromise }: DashboardShellDataProps) {
  const {
    membership,
    workspaces,
    pendingJoinCount,
    isAdmin,
    userRole,
    username,
  } = await dataPromise;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex shrink-0 md:hidden">
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
        </div>
        <div className="hidden shrink-0 lg:flex">
          <SidebarToggle />
        </div>
        <div className="min-w-0 flex-1">
          <DashboardHeaderSubtitle
            fallback={membership?.workspace.name ?? "Felix"}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {membership && <QuickTransactionHeaderButton />}
        <PrivacyMaskHeaderButton />
        <div className="md:hidden">
          <MobileAppearanceSheet />
        </div>
        <div className="hidden md:block">
          <AppearanceMenu />
        </div>
        {membership && (
          <WorkspaceNotifications
            workspaceId={membership.workspaceId}
            memberId={membership.id}
            userId={membership.userId}
            currency={membership.workspace.baseCurrency}
            timeZone={membership.workspace.timeZone}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </header>
  );
}

async function DashboardQuickTransaction({
  dataPromise,
}: DashboardShellDataProps) {
  const {
    membership,
    workspaces,
    targetQuickWorkspaceId,
    quickWalletLinks,
    quickCategories,
  } = await dataPromise;

  const targetWorkspace = targetQuickWorkspaceId
    ? workspaces.find((item) => item.workspaceId === targetQuickWorkspaceId)
    : undefined;

  return (
    <QuickTransactionSheet
      key={membership?.workspaceId ?? "none"}
      initialWorkspaceId={targetQuickWorkspaceId ?? ""}
      workspaces={
        targetWorkspace
          ? [
              {
                id: targetWorkspace.workspaceId,
                name: targetWorkspace.workspace.name,
                currency: targetWorkspace.workspace.baseCurrency,
                businessDate: getBusinessDateInTimeZone(
                  targetWorkspace.workspace.timeZone,
                ),
                role: targetWorkspace.role.code,
                wallets: quickWalletLinks.map((link) => link.wallet),
                categories: quickCategories.map((category) => ({
                  id: category.id,
                  name: category.name,
                  color: category.color,
                  icon: category.icon,
                  parentId: category.parentId,
                  type: category.type as "income" | "expense",
                })),
              },
            ]
          : []
      }
    />
  );
}

async function DashboardMobileBottomNavigation({
  dataPromise,
}: DashboardShellDataProps) {
  const { membership } = await dataPromise;

  return (
    <MobileBottomNavigation currentWorkspaceId={membership?.workspaceId} />
  );
}

function DashboardSidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-2">
        <BrandLink />
      </SidebarHeader>

      <SidebarContent>
        <FallbackNavigation />
      </SidebarContent>

      <SidebarFooter className="pt-2">
        <SidebarUserMenu username="User" role="none" />
      </SidebarFooter>
    </Sidebar>
  );
}

function DashboardHeaderFallback() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex shrink-0 md:hidden">
          <MobileNavigation
            workspaces={[]}
            pendingJoinCount={0}
            isAdmin={false}
            username="User"
            role="none"
          />
        </div>
        <div className="hidden shrink-0 lg:flex">
          <SidebarToggle />
        </div>
        <div className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">
          Felix
        </div>
      </div>
    </header>
  );
}

function BrandLink() {
  return (
    <Link
      href="/overview"
      prefetch={false}
      className="flex h-10 w-full min-w-0 items-center justify-start gap-2.5 rounded-lg px-2 text-[var(--foreground)] outline-none transition-colors duration-150 hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0!"
      aria-label="Felix - về trang tổng quan"
    >
      <FinLogo size={32} />
      <span className="text-base font-bold tracking-[-0.02em] transition-opacity duration-150 group-data-[collapsible=icon]:hidden!">
        Felix
      </span>
    </Link>
  );
}

function FallbackNavigation() {
  const workspaceLinks = [
    { href: "/overview", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/dashboard", label: "Sổ giao dịch", icon: BookOpen },
    {
      href: "/recurring-transactions",
      label: "Giao dịch định kỳ",
      icon: Repeat2,
    },
    { href: "/financial-plans", label: "Kế hoạch", icon: CalendarRange },
    { href: "/wallets", label: "Ví", icon: WalletCards },
    { href: "/investments", label: "Đầu tư", icon: Landmark },
    { href: "/credit-cards", label: "Thẻ tín dụng", icon: CreditCard },
  ];
  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-2"
      aria-label="Điều hướng chính"
    >
      <div className="px-1 pb-2 group-data-[collapsible=icon]:px-0" aria-hidden>
        <span className="mb-1.5 block px-2 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] group-data-[collapsible=icon]:hidden!">
          Nhóm tài chính
        </span>
        <div className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10" />
      </div>
      <FallbackNavigationGroup links={workspaceLinks} />
    </nav>
  );
}

function FallbackNavigationGroup({
  links,
}: {
  links: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>;
}) {
  return (
    <SidebarGroup className="pt-1">
      <span className="mb-1.5 block px-2 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] group-data-[collapsible=icon]:hidden!">
        Quản lý
      </span>
      <SidebarGroupContent>
        <SidebarMenu>
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  className="h-10 rounded-lg px-2.5 group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!"
                  render={<Link href={link.href} prefetch={false} />}
                  aria-label={link.label}
                >
                  <span className="flex shrink-0 items-center justify-center text-[var(--text-secondary)]">
                    <Icon size={18} strokeWidth={1.85} />
                  </span>
                  <span className="min-w-0 break-words font-medium leading-snug group-data-[collapsible=icon]:hidden!">
                    {link.label}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
