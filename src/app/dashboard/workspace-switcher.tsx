"use client";

import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useSyncExternalStore } from "react";
import { selectWorkspaceAction } from "@/app/dashboard/workspace-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Workspace = { id: string; name: string; role: string };

/* Reads sidebar collapsed state from the root data attribute */
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

export function WorkspaceSwitcher({
  workspaces,
  currentId,
}: {
  workspaces: Workspace[];
  currentId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAnyWorkspaceActive = workspaces.some(
    (ws) => pathname === `/workspace/${ws.id}`,
  );

  function choose(id: string) {
    if (id === currentId && pathname === `/workspace/${id}`) return;
    setError(null);
    start(async () => {
      try {
        await selectWorkspaceAction(id);
        if (pathname === "/wallets") router.refresh();
        else router.push(`/workspace/${id}`);
      } catch {
        setError("Không thể chuyển workspace.");
      }
    });
  }

  const workspaceList = (
    <div className="workspace-tree-list" aria-label="Workspace bạn được phép hoạt động">
      {workspaces.map((ws) => (
        <button
          type="button"
          key={ws.id}
          disabled={pending}
          onClick={() => choose(ws.id)}
          className={`workspace-tree-item ${pathname === `/workspace/${ws.id}` ? "workspace-tree-current" : ""}`}
        >
          <span className="workspace-tree-branch" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{ws.name}</span>
          <small>{ws.role === "ADMIN" ? "Admin" : "Member"}</small>
        </button>
      ))}
      {error && <p className="workspace-tree-error">{error}</p>}
    </div>
  );

  /* ── Collapsed: icon trigger → right flyout popover ── */
  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={`nav-item dashboard-nav-link ${isAnyWorkspaceActive ? "nav-item-active" : ""}`}
              title="Workspace"
              aria-label="Chọn workspace"
            />
          }
        >
          <FolderTree size={18} strokeWidth={1.8} />
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="sidebar-flyout-popover"
        >
          <header className="sidebar-flyout-header">
            <FolderTree size={14} strokeWidth={2} />
            <strong>Workspace</strong>
            <small>{workspaces.length}</small>
          </header>
          {workspaceList}
        </PopoverContent>
      </Popover>
    );
  }

  /* ── Expanded: inline accordion ── */
  return (
    <div className="workspace-tree">
      <button
        type="button"
        className={`nav-item workspace-tree-trigger ${isAnyWorkspaceActive ? "nav-item-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="workspace-tree-list"
      >
        <span className="flex items-center gap-2">
          <FolderTree size={18} strokeWidth={1.8} />
          <span className="workspace-tree-title">Workspace</span>
        </span>
        <span className="workspace-tree-meta flex items-center gap-2">
          <small>{workspaces.length}</small>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
      </button>
      {open && (
        <div id="workspace-tree-list">
          {workspaceList}
        </div>
      )}
    </div>
  );
}
