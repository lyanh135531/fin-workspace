"use client";

import { BookOpen, CalendarRange, CreditCard, Landmark, LayoutDashboard, Repeat2, Settings, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";
import { useOptimisticNavigation } from "@/app/dashboard/use-optimistic-navigation";
import { isWorkspaceNavigationActive, workspaceNavigationItems, type WorkspaceNavigationKey } from "@/app/dashboard/workspace-navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type Workspace = { id: string; name: string; role: string };

type NavigationItem = {
  key: WorkspaceNavigationKey;
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  visible: boolean;
};

export function DashboardNavigation({
  currentId,
  workspaces,
  pendingJoinCount = 0,
  isAdmin = false,
  forceExpandedWorkspaceSwitcher = false,
  variant = "all",
}: {
  currentId?: string;
  workspaces: Workspace[];
  pendingJoinCount?: number;
  isAdmin?: boolean;
  username?: string;
  forceExpandedWorkspaceSwitcher?: boolean;
  variant?: "all" | "secondary";
}) {
  const pathname = usePathname();
  const { pendingHref, beginNavigation } = useOptimisticNavigation();
  const icons: Record<WorkspaceNavigationKey, typeof LayoutDashboard> = {
    overview: LayoutDashboard,
    ledger: BookOpen,
    recurring: Repeat2,
    plans: CalendarRange,
    wallets: WalletCards,
    investments: Landmark,
    creditCards: CreditCard,
    settings: Settings,
  };
  const workspaceItems: NavigationItem[] = workspaceNavigationItems(currentId).map((item) => ({
    key: item.key,
    href: item.href,
    label: item.label,
    description: item.description,
    icon: icons[item.key],
    active: isWorkspaceNavigationActive(item.key, pathname),
    visible: (!item.requiresWorkspace || Boolean(currentId))
      && (!item.adminOnly || isAdmin)
      && (variant === "all" || !item.mobilePrimary),
  }));

  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-2"
      aria-label="Điều hướng chính"
    >
      {currentId && (
        <div className="px-1 pb-2 group-data-[collapsible=icon]:px-0">
          <span className="mb-1.5 block px-2 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] group-data-[collapsible=icon]:hidden!">
            Nhóm tài chính
          </span>
          <WorkspaceSwitcher
            currentId={currentId}
            workspaces={workspaces}
            pendingJoinCount={pendingJoinCount}
            forceExpanded={forceExpandedWorkspaceSwitcher}
          />
        </div>
      )}

      <SidebarGroup className="pt-1">
        <span className="mb-1.5 block px-2 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] group-data-[collapsible=icon]:hidden!">
          Quản lý
        </span>
        <SidebarGroupContent>
          <NavigationMenu
            items={workspaceItems}
            pendingHref={pendingHref}
            onNavigate={beginNavigation}
          />
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}

function NavigationMenu({
  items,
  pendingHref,
  onNavigate,
}: {
  items: NavigationItem[];
  pendingHref: string | null;
  onNavigate: (href: string) => void;
}) {
  return (
    <SidebarMenu>
      {items.filter((item) => item.visible).map((item) => {
        const Icon = item.icon;
        const isPending = pendingHref
          ? item.href === pendingHref || isWorkspaceNavigationActive(item.key, pendingHref)
          : false;
        const isVisuallyActive = pendingHref
          ? isPending
          : item.active;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              className="group/nav h-10 rounded-lg px-2.5 group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!"
              render={
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  aria-busy={isPending || undefined}
                  aria-label={item.description}
                  title={item.label}
                  onNavigate={(event) => {
                    event.preventDefault();
                    onNavigate(item.href);
                  }}
                />
              }
              isActive={isVisuallyActive}
            >
              <span className="flex shrink-0 items-center justify-center text-[var(--text-secondary)] transition-colors group-hover/nav:text-[var(--foreground)] group-data-[active]/nav:text-[var(--primary)]">
                <Icon size={18} strokeWidth={1.85} />
              </span>
              <span className="min-w-0 break-words font-medium leading-snug group-data-[collapsible=icon]:hidden!">
                {item.label}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
