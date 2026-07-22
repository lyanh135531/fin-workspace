"use client";

import { Archive, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ArchivedWorkspace = { id: string; name: string; role: string };

function useSidebarCollapsed() {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.dataset.sidebarCollapsed === "true",
    () => false,
  );
}

export function MonthlyArchiveTree({ workspaces }: { workspaces: ArchivedWorkspace[] }) {
  const pathname = usePathname();
  const treeId = useId();
  const collapsed = useSidebarCollapsed();
  const [open, setOpen] = useState(true);

  const isAnyArchiveActive = workspaces.some(
    (ws) => pathname === `/workspace/${ws.id}`,
  );

  const archiveList = (
    <div
      id={treeId}
      className="workspace-tree-list"
      aria-label="Workspace theo tháng đã lưu trữ"
    >
      {workspaces.map((ws) => (
        <Link
          key={ws.id}
          href={`/workspace/${ws.id}`}
          className={`workspace-tree-item ${pathname === `/workspace/${ws.id}` ? "workspace-tree-current" : ""}`}
          aria-current={pathname === `/workspace/${ws.id}` ? "page" : undefined}
        >
          <span className="workspace-tree-branch" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{ws.name}</span>
          <small>Xem</small>
        </Link>
      ))}
    </div>
  );

  /* ── Collapsed: icon trigger → right flyout ── */
  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={`nav-item dashboard-nav-link ${isAnyArchiveActive ? "nav-item-active" : ""}`}
              aria-label="Lưu trữ theo tháng"
            />
          }
        >
          <Archive size={18} strokeWidth={1.8} />
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="sidebar-flyout-popover"
        >
          <header className="sidebar-flyout-header">
            <Archive size={14} strokeWidth={2} />
            <strong>Lưu trữ theo tháng</strong>
            <small>{workspaces.length}</small>
          </header>
          {archiveList}
        </PopoverContent>
      </Popover>
    );
  }

  /* ── Expanded: inline accordion ── */
  return (
    <div className="workspace-tree monthly-archive-tree">
      <button
        type="button"
        className={`nav-item workspace-tree-trigger ${isAnyArchiveActive ? "nav-item-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={treeId}
      >
        <span className="flex items-center gap-2">
          <Archive size={18} strokeWidth={1.8} />
          <span className="workspace-tree-title">Lưu trữ theo tháng</span>
        </span>
        <span className="workspace-tree-meta flex items-center gap-2">
          <small>{workspaces.length}</small>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
      </button>
      {open && archiveList}
    </div>
  );
}
