"use client";

import { BookOpen, LayoutDashboard, Repeat2, Settings, SlidersHorizontal, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";

type Workspace = { id: string; name: string; role: string };

export function DashboardNavigation({
  currentId,
  workspaces,
  pendingJoinCount = 0,
  isAdmin = false,
  forceExpandedWorkspaceSwitcher = false,
  navigationBasePath = "",
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

  const overviewHref = navigationBasePath ? `${navigationBasePath}/overview` : "/overview";
  const ledgerHref = navigationBasePath ? `${navigationBasePath}/ledger` : "/dashboard";
  const recurringHref = navigationBasePath ? `${navigationBasePath}/recurring-transactions` : "/recurring-transactions";
  const walletsHref = navigationBasePath ? `${navigationBasePath}/wallets` : "/wallets";
  const workspaceSettingsHref = navigationBasePath ? `${navigationBasePath}/settings/workspace` : "/settings/workspace";

  const overviewActive = pathname === overviewHref;
  const ledgerActive =
    pathname === ledgerHref || (!navigationBasePath && pathname.startsWith("/workspace/"));
  const walletsActive = pathname === walletsHref;
  const recurringActive = pathname === recurringHref;
  const workspaceSettingsActive =
    pathname === workspaceSettingsHref ||
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

  return (
    <nav className="dashboard-nav" aria-label="Điều hướng chính">
      {/* ── Workspace Dropdown Switcher at top ── */}
      {currentId && (
        <div className="sidebar-ws-switcher-wrapper">
          <WorkspaceSwitcher
            currentId={currentId}
            workspaces={workspaces}
            pendingJoinCount={pendingJoinCount}
            forceExpanded={forceExpandedWorkspaceSwitcher}
            navigationBasePath={navigationBasePath}
          />
        </div>
      )}

      {/* ── Main Workspace Navigation ── */}
      <div className="nav-section-group">

        <Link
          className={`nav-item dashboard-nav-link ${overviewActive ? "nav-item-active" : ""}`}
          href={overviewHref}
          aria-current={overviewActive ? "page" : undefined}
          aria-label="Tổng quan tài chính"
        >
          <LayoutDashboard size={18} strokeWidth={1.8} />
          <span>Tổng quan</span>
        </Link>

        {currentId && (
          <>
            <Link
              className={`nav-item dashboard-nav-link ${ledgerActive ? "nav-item-active" : ""}`}
              href={ledgerHref}
              aria-current={ledgerActive ? "page" : undefined}
              aria-label="Sổ thu chi & lịch sử giao dịch"
            >
              <BookOpen size={18} strokeWidth={1.8} />
              <span>Sổ giao dịch</span>
            </Link>

            {isAdmin && (
              <Link
                className={`nav-item dashboard-nav-link ${recurringActive ? "nav-item-active" : ""}`}
                href={recurringHref}
                aria-current={recurringActive ? "page" : undefined}
                aria-label="Đăng ký giao dịch tự động hằng tháng"
              >
                <Repeat2 size={18} strokeWidth={1.8} />
                <span>Giao dịch định kỳ</span>
              </Link>
            )}

            <Link
              className={`nav-item dashboard-nav-link ${walletsActive ? "nav-item-active" : ""}`}
              href={walletsHref}
              aria-current={walletsActive ? "page" : undefined}
              aria-label="Quản lý các tài khoản ví"
            >
              <WalletCards size={18} strokeWidth={1.8} />
              <span>Quản lý ví</span>
            </Link>

            {isAdmin && (
              <Link
                className={`nav-item dashboard-nav-link ${workspaceSettingsActive ? "nav-item-active" : ""}`}
                href={workspaceSettingsHref}
                aria-current={workspaceSettingsActive ? "page" : undefined}
                aria-label="Cơ chế phê duyệt, mã mời và cấu hình"
              >
                <Settings size={18} strokeWidth={1.8} />
                <span>Cài đặt workspace</span>
              </Link>
            )}
          </>
        )}
      </div>

      <div className="sidebar-nav-divider" aria-hidden />

      {/* ── General Settings ── */}
      <div className="nav-section-group">
        <Link
          className={`nav-item dashboard-nav-link ${generalSettingsActive ? "nav-item-active" : ""}`}
          href="/setting"
          aria-current={generalSettingsActive ? "page" : undefined}
          aria-label="Giao diện hiển thị và danh mục mẫu cá nhân"
        >
          <SlidersHorizontal size={18} strokeWidth={1.8} />
          <span>Cài đặt chung</span>
        </Link>
      </div>
    </nav>
  );
}

