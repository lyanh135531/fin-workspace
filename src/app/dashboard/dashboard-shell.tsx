import {
  BookOpen,
  CalendarRange,
  CreditCard,
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
import { getPendingJoinRequestCount } from "@/services/join-request-query";
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
            className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto px-4 pt-4 pb-24 md:px-6 md:py-5 lg:px-8 lg:py-6"
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

  if (activeWorkspaceId)
    await activateDueScheduledTransactionsForRequest(activeWorkspaceId);

  const [membership, workspaces] = await Promise.all([
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
      ]);

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
            wallet: {
              select: {
                id: true,
                name: true,
                kind: true,
                creditCardProfile: { select: { defaultFundingWalletId: true } },
              },
            },
          },
          orderBy: [
            { workspaceId: "asc" },
            { sortOrder: "asc" },
            { wallet: { name: "asc" } },
          ],
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

  const pendingJoinCount = await getPendingJoinRequestCount(userId);
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
    quickWalletLinks,
    quickCategories,
    pendingJoinCount,
    isAdmin,
    userRole,
    username: session.user.username ?? "User",
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
  const { membership, workspaces, quickWalletLinks, quickCategories } =
    await dataPromise;

  return (
    <QuickTransactionSheet
      initialWorkspaceId={
        membership?.workspaceId ?? workspaces[0]?.workspaceId ?? ""
      }
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
        <div className="h-12 shrink-0 px-2 pb-1" aria-hidden />
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
    { href: "/wallets", label: "Ví", icon: WalletCards },
    { href: "/credit-cards", label: "Thẻ tín dụng", icon: CreditCard },
    { href: "/financial-plans", label: "Kế hoạch", icon: CalendarRange },
  ];
  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Điều hướng chính">
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
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  render={<Link href={link.href} />}
                  aria-label={link.label}
                >
                  <Icon strokeWidth={1.8} />
                  <span>{link.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
