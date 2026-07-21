"use client";

import { LayoutDashboard, SlidersHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { MonthlyArchiveTree } from "@/app/dashboard/monthly-archive-tree";
import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";

type Workspace = { id: string; name: string; role: string };

export function DashboardNavigation({ currentId, workspaces, archivedWorkspaces }: { currentId?: string; workspaces: Workspace[]; archivedWorkspaces: Workspace[] }) {
  const pathname = usePathname();
  const overviewActive = pathname === "/overview";
  const settingsActive = pathname === "/setting" || pathname.startsWith("/settings/");

  return <nav className="dashboard-nav" aria-label="Điều hướng chính">
    <a className={`nav-item dashboard-nav-link ${overviewActive ? "nav-item-active" : ""}`} href="/overview"><LayoutDashboard size={17}/><span>Tổng quan</span></a>
    {currentId && <WorkspaceSwitcher currentId={currentId} workspaces={workspaces} />}
    {archivedWorkspaces.length > 0 && <MonthlyArchiveTree workspaces={archivedWorkspaces} />}
    <a className={`nav-item dashboard-nav-link ${settingsActive ? "nav-item-active" : ""}`} href="/setting"><SlidersHorizontal size={17}/><span>Cài đặt chung</span></a>
  </nav>;
}
