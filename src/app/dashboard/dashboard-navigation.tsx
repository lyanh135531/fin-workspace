"use client";

import { LayoutDashboard, SlidersHorizontal, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonthlyArchiveTree } from "@/app/dashboard/monthly-archive-tree";
import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";

type Workspace = { id: string; name: string; role: string };

export function DashboardNavigation({
  currentId,
  workspaces,
  archivedWorkspaces,
}: {
  currentId?: string;
  workspaces: Workspace[];
  archivedWorkspaces: Workspace[];
}) {
  const pathname = usePathname();
  const overviewActive = pathname === "/overview";
  const walletsActive = pathname === "/wallets";
  const settingsActive =
    pathname === "/setting" || pathname.startsWith("/settings/");

  return (
    <nav className="dashboard-nav" aria-label="Điều hướng chính">
      {/* ── Tổng quan section ── */}
      <p className="sidebar-nav-section">Tổng quan</p>

      <Link
        className={`nav-item dashboard-nav-link ${overviewActive ? "nav-item-active" : ""}`}
        href="/overview"
        aria-current={overviewActive ? "page" : undefined}
        title="Tổng quan"
      >
        <LayoutDashboard size={18} strokeWidth={1.8} />
        <span>Tổng quan</span>
      </Link>

      {/* ── Workspace section ── */}
      {currentId && (
        <>
          <p className="sidebar-nav-section">Workspace</p>
          <WorkspaceSwitcher currentId={currentId} workspaces={workspaces} />

          <Link
            className={`nav-item dashboard-nav-link ${walletsActive ? "nav-item-active" : ""}`}
            href="/wallets"
            aria-current={walletsActive ? "page" : undefined}
            title="Quản lý ví"
          >
            <WalletCards size={18} strokeWidth={1.8} />
            <span>Quản lý ví</span>
          </Link>
        </>
      )}

      {/* ── Archive section ── */}
      {archivedWorkspaces.length > 0 && (
        <MonthlyArchiveTree workspaces={archivedWorkspaces} />
      )}

      {/* ── Hệ thống section ── */}
      <p className="sidebar-nav-section">Hệ thống</p>
      <Link
        className={`nav-item dashboard-nav-link ${settingsActive ? "nav-item-active" : ""}`}
        href="/setting"
        aria-current={settingsActive ? "page" : undefined}
        title="Cài đặt chung"
      >
        <SlidersHorizontal size={18} strokeWidth={1.8} />
        <span>Cài đặt chung</span>
      </Link>
    </nav>
  );
}
