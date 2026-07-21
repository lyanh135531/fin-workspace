"use client";

import { Archive, ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { usePathname } from "next/navigation";

type ArchivedWorkspace = { id: string; name: string };

export function MonthlyArchiveTree({ workspaces }: { workspaces: ArchivedWorkspace[] }) {
  const pathname = usePathname();
  const treeId = useId();
  const active = workspaces.some((workspace) => pathname === `/workspace/${workspace.id}`);
  const [open, setOpen] = useState(true);

  return <div className="workspace-tree monthly-archive-tree">
    <button type="button" className={`nav-item workspace-tree-trigger ${active ? "nav-item-active" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={treeId}>
      <span className="flex items-center gap-2"><Archive size={17}/><span className="workspace-tree-title">Lưu trữ theo tháng</span></span>
      <span className="workspace-tree-meta flex items-center gap-2"><small>{workspaces.length}</small>{open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</span>
    </button>
    {open && <div id={treeId} className="workspace-tree-list" aria-label="Workspace theo tháng đã lưu trữ">
      {workspaces.map((workspace) => <a key={workspace.id} href={`/workspace/${workspace.id}`} className={`workspace-tree-item ${pathname === `/workspace/${workspace.id}` ? "workspace-tree-current" : ""}`} aria-current={pathname === `/workspace/${workspace.id}` ? "page" : undefined}>
        <span className="workspace-tree-branch" aria-hidden="true"/>
        <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
        <small>Chỉ xem</small>
      </a>)}
    </div>}
  </div>;
}
