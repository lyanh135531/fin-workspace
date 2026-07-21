"use client";

import { LayoutDashboard, SlidersHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";

type Workspace = { id: string; name: string; role: string };

export function DashboardNavigation({ currentId, workspaces, archivedWorkspaces }: { currentId?: string; workspaces: Workspace[]; archivedWorkspaces: Workspace[] }) {
  const pathname = usePathname();
  const overviewActive = pathname === "/overview" || pathname.startsWith("/workspace/");
  const settingsActive = pathname === "/setting" || pathname.startsWith("/settings/");

  return <nav className="dashboard-nav" aria-label="Điều hướng chính">
    <a className={`nav-item dashboard-nav-link ${overviewActive ? "nav-item-active" : ""}`} href="/overview"><LayoutDashboard size={17}/><span>Tổng quan</span></a>
    {currentId && <WorkspaceSwitcher currentId={currentId} workspaces={workspaces} />}
    {archivedWorkspaces.length > 0 && <div className="workspace-tree"><p className="px-3 pt-3 text-xs font-semibold text-slate-500">Lưu trữ theo tháng</p><div className="workspace-tree-list">{archivedWorkspaces.map((workspace) => <a key={workspace.id} href={`/workspace/${workspace.id}`} className={`workspace-tree-item ${pathname === `/workspace/${workspace.id}` ? "workspace-tree-current" : ""}`}><span className="workspace-tree-branch" aria-hidden="true"/><span className="min-w-0 flex-1 truncate">{workspace.name}</span><small>Chỉ xem</small></a>)}</div></div>}
    <a className={`nav-item dashboard-nav-link ${settingsActive ? "nav-item-active" : ""}`} href="/setting"><SlidersHorizontal size={17}/><span>Cài đặt chung</span></a>
  </nav>;
}
