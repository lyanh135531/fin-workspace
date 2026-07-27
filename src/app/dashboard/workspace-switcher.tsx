"use client";

import { Check, ChevronsUpDown, Clock, KeyRound, Loader2, PlusCircle, Send } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useSyncExternalStore, useRef } from "react";
import { selectWorkspaceAction } from "@/app/dashboard/workspace-actions";
import { requestJoinAction } from "@/app/dashboard/join/actions";
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

/* ── Inline Join Mini‑Form ───────────────────────────────────────── */
function InlineJoinForm({ onSuccess }: { onSuccess?: () => void }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = value.trim();
    if (code.length < 6) {
      setFeedback({ ok: false, text: "Mã mời tối thiểu 6 ký tự." });
      return;
    }
    setFeedback(null);
    start(async () => {
      const r = await requestJoinAction({ inviteCode: code });
      if (r.ok) {
        setFeedback({ ok: true, text: "Đã gửi! Chờ Admin duyệt." });
        setValue("");
        onSuccess?.();
      } else {
        setFeedback({ ok: false, text: r.message ?? "Không thể gửi yêu cầu." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="ws-inline-join">
      <div className="ws-inline-join-row">
        <KeyRound size={14} className="ws-inline-join-icon" aria-hidden />
        <input
          ref={inputRef}
          className="ws-inline-join-input"
          placeholder="Dán mã mời workspace…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (feedback) setFeedback(null);
          }}
          disabled={pending}
          aria-label="Nhập mã mời workspace"
          minLength={6}
          maxLength={36}
        />
        <button
          type="submit"
          className="ws-inline-join-btn"
          disabled={pending || value.trim().length < 6}
          aria-label="Gửi yêu cầu tham gia"
        >
          {pending ? <Loader2 size={14} className="ws-join-spinner" /> : <Send size={13} />}
        </button>
      </div>
      {feedback && (
        <p className={`ws-inline-join-feedback ${feedback.ok ? "ws-join-ok" : "ws-join-err"}`} role="status">
          {feedback.text}
        </p>
      )}
    </form>
  );
}

export function WorkspaceSwitcher({
  workspaces,
  currentId,
  pendingJoinCount = 0,
  forceExpanded = false,
}: {
  workspaces: Workspace[];
  currentId: string;
  pendingJoinCount?: number;
  forceExpanded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed() && !forceExpanded;
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
          <div className="sidebar-ws-popover-footer">
            <InlineJoinForm onSuccess={() => router.refresh()} />
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
          <Link href="/workspaces/create" onClick={() => setOpen(false)} className="sidebar-ws-footer-link">
            <PlusCircle size={14} />
            <span>Tạo workspace mới</span>
          </Link>

          {/* Pending join requests indicator */}
          {pendingJoinCount > 0 && (
            <Link href="/settings/join" onClick={() => setOpen(false)} className="sidebar-ws-footer-link ws-pending-link">
              <Clock size={14} />
              <span>Đang chờ duyệt ({pendingJoinCount})</span>
            </Link>
          )}

          {/* Inline Join Form */}
          <InlineJoinForm onSuccess={() => router.refresh()} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
