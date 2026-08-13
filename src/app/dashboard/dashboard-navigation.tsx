"use client";

import { BookOpen, LayoutDashboard, Repeat2, Settings, SlidersHorizontal, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";
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
  const workspaceSettingsActive =
    pathname === "/settings/workspace" ||
    pathname === "/dashboard/settings" ||
    pathname === "/dashboard/join-requests";
  const accountSettingsActive =
    pathname === "/settings/account" ||
    pathname === "/account" ||
    pathname === "/dashboard/settings/account";
  const isCreateWorkspace =
    pathname === "/workspaces/create" ||
    pathname === "/dashboard/workspaces/create" ||
    pathname === "/settings/workspaces/create";
  const generalSettingsActive =
    (pathname === "/setting" ||
      (pathname.startsWith("/settings/") && !workspaceSettingsActive && !accountSettingsActive)) &&
    !isCreateWorkspace;

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
      href: "/wallets",
      label: "Quản lý ví",
      description: "Quản lý các tài khoản ví",
      icon: WalletCards,
      active: pathname === "/wallets",
      visible: Boolean(currentId),
    },
    {
      href: "/settings/workspace",
      label: "Cài đặt workspace",
      description: "Cơ chế phê duyệt, mã mời và cấu hình",
      icon: Settings,
      active: workspaceSettingsActive,
      visible: Boolean(currentId) && isAdmin,
    },
  ];

  const generalItems: NavigationItem[] = [
    {
      href: "/setting",
      label: "Cài đặt chung",
      description: "Giao diện hiển thị và danh mục mẫu cá nhân",
      icon: SlidersHorizontal,
      active: generalSettingsActive,
      visible: true,
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
            Workspace
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
          <NavigationMenu items={workspaceItems} />
        </SidebarGroupContent>
      </SidebarGroup>

      <div
        className="dashboard-navigation-divider mx-4 my-1 h-px bg-[var(--border)] transition-[margin] duration-300 min-[901px]:mx-0 min-[901px]:my-0 min-[901px]:h-2 min-[901px]:bg-transparent! group-data-[collapsible=icon]:mx-3"
        aria-hidden
      />

      <SidebarGroup className="min-[901px]:pt-1">
        <span className="dashboard-nav-section-label min-[901px]:mb-2 min-[901px]:block! min-[901px]:px-2 min-[901px]:text-[0.65rem] min-[901px]:font-semibold min-[901px]:tracking-[0.08em] min-[901px]:text-[var(--text-muted)] min-[901px]:group-data-[collapsible=icon]:hidden!">
          Cá nhân
        </span>
        <SidebarGroupContent>
          <NavigationMenu items={generalItems} />
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}

function NavigationMenu({ items }: { items: NavigationItem[] }) {
  return (
    <SidebarMenu>
      {items.filter((item) => item.visible).map((item) => {
        const Icon = item.icon;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              className="dashboard-primary-nav-link group/nav min-[901px]:h-10! min-[901px]:rounded-xl! min-[901px]:px-2! min-[901px]:group-data-[collapsible=icon]:mx-auto! min-[901px]:group-data-[collapsible=icon]:size-10! min-[901px]:group-data-[collapsible=icon]:justify-center! min-[901px]:group-data-[collapsible=icon]:p-1!"
              render={
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  aria-label={item.description}
                  title={item.description}
                />
              }
              isActive={item.active}
            >
              <Icon
                className="min-[901px]:hidden!"
                strokeWidth={1.8}
              />
              <span className="hidden! min-[901px]:grid! min-[901px]:size-7 min-[901px]:shrink-0 min-[901px]:place-items-center min-[901px]:rounded-lg min-[901px]:text-[var(--text-muted)] min-[901px]:transition-colors min-[901px]:group-hover/nav:text-[var(--foreground)] min-[901px]:group-data-[active]/nav:bg-[var(--primary-soft)] min-[901px]:group-data-[active]/nav:text-[var(--primary)]">
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
