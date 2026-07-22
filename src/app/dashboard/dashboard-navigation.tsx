"use client";

import { BookOpen, LayoutDashboard, Settings, SlidersHorizontal, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonthlyArchiveTree } from "@/app/dashboard/monthly-archive-tree";
import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";

type Workspace = { id: string; name: string; role: string };

export function DashboardNavigation({
  currentId,
  workspaces,
  archivedWorkspaces,
  pendingJoinCount = 0,
}: {
  currentId?: string;
  workspaces: Workspace[];
  archivedWorkspaces: Workspace[];
  pendingJoinCount?: number;
}) {
  const pathname = usePathname();

  const overviewActive = pathname === "/overview";
  const ledgerActive =
    pathname === "/dashboard" || pathname.startsWith("/workspace/");
  const walletsActive = pathname === "/wallets";
  const workspaceSettingsActive =
    pathname === "/settings/workspace" ||
    pathname === "/dashboard/settings" ||
    pathname === "/dashboard/join-requests";
  const generalSettingsActive =
    pathname === "/setting" ||
    (pathname.startsWith("/settings/") && !workspaceSettingsActive);

  return (
    <nav className="dashboard-nav" aria-label="Điều hướng chính">
      {/* ── Workspace Dropdown Switcher at top ── */}
      {currentId && (
        <div className="sidebar-ws-switcher-wrapper">
          <WorkspaceSwitcher currentId={currentId} workspaces={workspaces} pendingJoinCount={pendingJoinCount} />
        </div>
      )}

      {/* ── Main Workspace Navigation ── */}
      <div className="nav-section-group">
        <p className="sidebar-nav-section">WORKSPACE</p>

        <Link
          className={`nav-item dashboard-nav-link ${overviewActive ? "nav-item-active" : ""}`}
          href="/overview"
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
              href="/dashboard"
              aria-current={ledgerActive ? "page" : undefined}
              aria-label="Sổ thu chi & lịch sử giao dịch"
            >
              <BookOpen size={18} strokeWidth={1.8} />
              <span>Sổ giao dịch</span>
            </Link>

            <Link
              className={`nav-item dashboard-nav-link ${walletsActive ? "nav-item-active" : ""}`}
              href="/wallets"
              aria-current={walletsActive ? "page" : undefined}
              aria-label="Quản lý các tài khoản ví"
            >
              <WalletCards size={18} strokeWidth={1.8} />
              <span>Quản lý ví</span>
            </Link>

            <Link
              className={`nav-item dashboard-nav-link ${workspaceSettingsActive ? "nav-item-active" : ""}`}
              href="/settings/workspace"
              aria-current={workspaceSettingsActive ? "page" : undefined}
              aria-label="Cơ chế phê duyệt, mã mời và thành viên"
            >
              <Settings size={18} strokeWidth={1.8} />
              <span>Cài đặt workspace</span>
            </Link>
          </>
        )}
      </div>

      <div className="sidebar-collapsed-divider" aria-hidden />

      {/* ── Monthly Archive Section ── */}
      {archivedWorkspaces.length > 0 && (
        <div className="nav-section-group">
          <MonthlyArchiveTree workspaces={archivedWorkspaces} />
        </div>
      )}

      {/* ── Account & General Settings ── */}
      <div className="nav-section-group">
        <p className="sidebar-nav-section">TÀI KHOẢN CÁ NHÂN</p>
        <Link
          className={`nav-item dashboard-nav-link ${generalSettingsActive ? "nav-item-active" : ""}`}
          href="/setting"
          aria-current={generalSettingsActive ? "page" : undefined}
          aria-label="Giao diện, đổi mật khẩu và danh mục hệ thống"
        >
          <SlidersHorizontal size={18} strokeWidth={1.8} />
          <span>Cài đặt chung</span>
        </Link>
      </div>
    </nav>
  );
}
