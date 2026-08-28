"use client";

import { BookOpen, CalendarRange, LayoutDashboard, Repeat2, Settings, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";
import { useOptimisticNavigation } from "@/app/dashboard/use-optimistic-navigation";
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
}: {
  currentId?: string;
  workspaces: Workspace[];
  pendingJoinCount?: number;
  isAdmin?: boolean;
  username?: string;
  forceExpandedWorkspaceSwitcher?: boolean;
}) {
  const pathname = usePathname();
  const { pendingHref, beginNavigation } = useOptimisticNavigation();
  const workspaceSettingsActive =
    pathname === "/settings/workspace" ||
    pathname === "/dashboard/settings" ||
    pathname === "/dashboard/join-requests";
  const workspaceItems: NavigationItem[] = [
    {
      href: "/overview",
      label: "Tổng quan",
      description: "Tổng quan tài chính",
      icon: LayoutDashboard,
      active: pathname === "/overview",
      visible: true,
    },
    {
      href: currentId ? `/workspace/${currentId}` : "/dashboard",
      label: "Sổ giao dịch",
      description: "Sổ thu chi và lịch sử giao dịch",
      icon: BookOpen,
      active: pathname === "/dashboard" || pathname.startsWith("/workspace/"),
      visible: Boolean(currentId),
    },
    {
      href: "/recurring-transactions",
      label: "Giao dịch định kỳ",
      description: "Đăng ký giao dịch tự động hằng tháng",
      icon: Repeat2,
      active: pathname === "/recurring-transactions",
      visible: Boolean(currentId) && isAdmin,
    },
    {
      href: "/financial-plans",
      label: "Kế hoạch",
      description: "Mục tiêu tương lai và hạn mức sáu hũ",
      icon: CalendarRange,
      active: pathname === "/financial-plans",
      visible: Boolean(currentId),
    },
    {
      href: "/wallets",
      label: "Quản lý ví",
      description: "Quản lý các tài khoản ví",
      icon: WalletCards,
      active: pathname === "/wallets",
      visible: Boolean(currentId),
    },
    {
      href: "/settings/workspace",
      label: "Cài đặt nhóm",
      description: "Cơ chế phê duyệt, mã mời và cấu hình",
      icon: Settings,
      active: workspaceSettingsActive,
      visible: Boolean(currentId) && isAdmin,
    },
  ];

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
