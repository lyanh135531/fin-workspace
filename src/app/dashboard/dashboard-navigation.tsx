"use client";

import { BookOpen, CalendarRange, LayoutDashboard, Repeat2, Settings, WalletCards } from "lucide-react";
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
    overview: LayoutDashboard, ledger: BookOpen, recurring: Repeat2,
    plans: CalendarRange, wallets: WalletCards, settings: Settings,
  };
  const workspaceItems: NavigationItem[] = workspaceNavigationItems(currentId).map((item) => ({
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
      className="flex min-h-0 flex-1 flex-col min-[901px]:px-0.5"
      aria-label="Điều hướng chính"
    >
      {currentId && (
        <div className="mobile-workspace-block px-2 pb-1 min-[901px]:px-1 min-[901px]:pb-3 group-data-[collapsible=icon]:px-2 min-[901px]:group-data-[collapsible=icon]:px-0">
          <span className="dashboard-nav-section-label min-[901px]:mb-2 min-[901px]:block! min-[901px]:px-2 min-[901px]:text-[0.65rem] min-[901px]:font-semibold min-[901px]:tracking-[0.08em] min-[901px]:text-[var(--text-muted)] min-[901px]:group-data-[collapsible=icon]:hidden!">
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

      <SidebarGroup className="min-[901px]:pt-2">
        <span className="dashboard-nav-section-label min-[901px]:mb-2 min-[901px]:block! min-[901px]:px-2 min-[901px]:text-[0.65rem] min-[901px]:font-semibold min-[901px]:tracking-[0.08em] min-[901px]:text-[var(--text-muted)] min-[901px]:group-data-[collapsible=icon]:hidden!">
          Điều hướng
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
        const isPending = pendingHref === item.href;
        const isVisuallyActive = pendingHref
          ? isPending
          : item.active;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              className="dashboard-primary-nav-link group/nav min-[901px]:h-10! min-[901px]:rounded-xl! min-[901px]:px-2! min-[901px]:group-data-[collapsible=icon]:mx-auto! min-[901px]:group-data-[collapsible=icon]:size-10! min-[901px]:group-data-[collapsible=icon]:justify-center! min-[901px]:group-data-[collapsible=icon]:p-1!"
              render={
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  aria-busy={isPending || undefined}
                  aria-label={item.description}
                  title={item.description}
                  onNavigate={(event) => {
                    event.preventDefault();
                    onNavigate(item.href);
                  }}
                />
              }
              isActive={isVisuallyActive}
            >
              <Icon
                className="min-[901px]:hidden!"
                strokeWidth={1.8}
              />
              <span className="hidden! min-[901px]:flex! min-[901px]:shrink-0 min-[901px]:items-center min-[901px]:justify-center min-[901px]:text-[var(--text-muted)] min-[901px]:transition-colors min-[901px]:group-hover/nav:text-[var(--foreground)] min-[901px]:group-data-[active]/nav:text-[var(--primary)]">
                <Icon strokeWidth={1.8} />
              </span>
              <span className="min-[901px]:font-medium min-[901px]:group-data-[collapsible=icon]:hidden!">
                {item.label}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
