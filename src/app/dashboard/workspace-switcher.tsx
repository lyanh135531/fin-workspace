"use client";

import { Check, ChevronsUpDown, PlusCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useSyncExternalStore } from "react";
import { selectWorkspaceAction } from "@/app/dashboard/workspace-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Workspace = { id: string; name: string; role: string };

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
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentWorkspace = workspaces.find((ws) => ws.id === currentId) ?? workspaces[0];

  function choose(id: string) {
    if (id === currentId && pathname === `/workspace/${id}`) {
      setOpen(false);
      return;
    }
    setError(null);
    start(async () => {
      try {
        await selectWorkspaceAction(id);
        setOpen(false);
        if (pathname === "/wallets") router.refresh();
        else router.push(`/workspace/${id}`);
      } catch {
        setError("Không thể chuyển workspace.");
      }
    });
  }

  const activeInitial = currentWorkspace?.name.charAt(0).toUpperCase() ?? "W";

  if (collapsed) {
    const wsName = currentWorkspace?.name || "Workspace";
    const initialLetter = wsName.charAt(0).toUpperCase();

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="sidebar-workspace-collapsed-btn"
              aria-label={`Workspace hiện tại: ${wsName}. Click để đổi.`}
            />
          }
        >
          <div className="sidebar-ws-avatar">
            <span className="sidebar-ws-initial-letter">{initialLetter}</span>
            <span className="sidebar-ws-collapsed-dot" />
          </div>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={10} className="sidebar-ws-popover">
          <div className="sidebar-ws-popover-header">
            <span>CHỌN WORKSPACE</span>
            <small>{workspaces.length}</small>
          </div>
          <div className="sidebar-ws-popover-list">
            {workspaces.map((ws) => {
              const isSelected = ws.id === currentId;
              return (
                <button
                  type="button"
                  key={ws.id}
                  disabled={pending}
                  onClick={() => choose(ws.id)}
                  className={`sidebar-ws-item ${isSelected ? "sidebar-ws-item-active" : ""}`}
                >
                  <div className="sidebar-ws-avatar">{ws.name.charAt(0).toUpperCase()}</div>
                  <div className="sidebar-ws-info">
                    <span className="sidebar-ws-name">{ws.name}</span>
                    <span className="sidebar-ws-role">{ws.role === "ADMIN" || ws.role === "OWNER" ? "Admin" : "Thành viên"}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-[var(--primary)]" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  /* ── Expanded: High-end card dropdown ── */
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="sidebar-workspace-selector-card"
            aria-expanded={open}
            aria-label={`Workspace: ${currentWorkspace?.name}. Click để chuyển đổi.`}
          />
        }
      >
        <div className="sidebar-ws-avatar">
          <span className="sidebar-ws-initial">{activeInitial}</span>
        </div>
        <div className="sidebar-ws-meta">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="sidebar-ws-title truncate">{currentWorkspace?.name}</span>
          </div>
          <span className="sidebar-ws-sub">
            <span className="sidebar-ws-dot" aria-hidden />
            {currentWorkspace?.role === "ADMIN" || currentWorkspace?.role === "OWNER" ? "Quản trị viên" : "Thành viên"}
          </span>
        </div>
        <ChevronsUpDown size={15} className="sidebar-ws-chevron" />
      </PopoverTrigger>

      <PopoverContent side="bottom" align="start" sideOffset={6} className="sidebar-ws-popover">
        <div className="sidebar-ws-popover-header">
          <span>DANH SÁCH WORKSPACE ({workspaces.length})</span>
        </div>
        <div className="sidebar-ws-popover-list">
          {workspaces.map((ws) => {
            const isSelected = ws.id === currentId;
            return (
              <button
                type="button"
                key={ws.id}
                disabled={pending}
                onClick={() => choose(ws.id)}
                className={`sidebar-ws-item ${isSelected ? "sidebar-ws-item-active" : ""}`}
              >
                <div className="sidebar-ws-avatar">{ws.name.charAt(0).toUpperCase()}</div>
                <div className="sidebar-ws-info">
                  <span className="sidebar-ws-name">{ws.name}</span>
                  <span className="sidebar-ws-role">{ws.role === "ADMIN" || ws.role === "OWNER" ? "Quản trị viên" : "Thành viên"}</span>
                </div>
                {isSelected && <Check size={14} className="text-[var(--primary)]" />}
              </button>
            );
          })}
        </div>
        {error && <p className="sidebar-ws-error">{error}</p>}
        <div className="sidebar-ws-popover-footer">
          <Link href="/settings/workspaces/create" onClick={() => setOpen(false)} className="sidebar-ws-footer-link">
            <PlusCircle size={14} />
            <span>Tạo workspace mới</span>
          </Link>
          <Link href="/settings/join" onClick={() => setOpen(false)} className="sidebar-ws-footer-link">
            <UserPlus size={14} />
            <span>Tham gia workspace</span>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
