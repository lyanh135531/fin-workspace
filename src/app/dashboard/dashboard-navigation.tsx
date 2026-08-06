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
  navigationBasePath,
}: {
  currentId?: string;
  workspaces: Workspace[];
  pendingJoinCount?: number;
  isAdmin?: boolean;
  username?: string;
  forceExpandedWorkspaceSwitcher?: boolean;
  navigationBasePath?: string;
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
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Điều hướng chính">
      {currentId && (
        <div className="px-2 pb-1 group-data-[collapsible=icon]:px-2">
          <WorkspaceSwitcher
            currentId={currentId}
            workspaces={workspaces}
            pendingJoinCount={pendingJoinCount}
            forceExpanded={forceExpandedWorkspaceSwitcher}
            navigationBasePath={navigationBasePath}
          />
        </div>
      )}

      <SidebarGroup>
        <SidebarGroupContent>
          <NavigationMenu items={workspaceItems} />
        </SidebarGroupContent>
      </SidebarGroup>

      <div className="mx-4 my-1 h-px bg-[var(--border)] transition-[margin] duration-300 group-data-[collapsible=icon]:mx-3" aria-hidden />

      <SidebarGroup>
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
              <Icon strokeWidth={1.8} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
