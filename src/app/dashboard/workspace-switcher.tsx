"use client";

import { Button, Input } from "@/components/base";
import {
  Check,
  ChevronsUpDown,
  Clock,
  KeyRound,
  Loader2,
  PlusCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import { selectWorkspaceAction } from "@/app/dashboard/workspace-actions";
import { requestJoinAction } from "@/app/dashboard/join/actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";

type Workspace = { id: string; name: string; role: string };

/* ── Inline Join Mini‑Form ───────────────────────────────────────── */
function InlineJoinForm({ onSuccess }: { onSuccess?: () => void }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
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

  /* ── Expanded: High-end card dropdown ── */
  return (
    <form onSubmit={submit} className="ws-inline-join">
      <div className="ws-inline-join-row rounded-xl">
        <KeyRound size={14} className="ws-inline-join-icon" aria-hidden />
        <Input
          ref={inputRef}
          className="ws-inline-join-input focus-visible:none"
          placeholder="Dán mã mời của nhóm…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (feedback) setFeedback(null);
          }}
          disabled={pending}
          aria-label="Nhập mã mời của nhóm tài chính"
          minLength={6}
          maxLength={36}
        />
        <Button
          variant="unstyled"
          size="auto"
          type="submit"
          className="ws-inline-join-btn rounded-lg"
          disabled={pending || value.trim().length < 6}
          aria-label="Gửi yêu cầu tham gia"
        >
          {pending ? (
            <Loader2 size={14} className="ws-join-spinner" />
          ) : (
            <Send size={13} />
          )}
        </Button>
      </div>
      {feedback && (
        <p
          className={`ws-inline-join-feedback ${feedback.ok ? "ws-join-ok" : "ws-join-err"}`}
          role="status"
        >
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
}: {
  workspaces: Workspace[];
  currentId: string;
  pendingJoinCount?: number;
  forceExpanded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentWorkspace =
    workspaces.find((ws) => ws.id === currentId) ?? workspaces[0];

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
        setError("Không thể chuyển nhóm tài chính.");
      }
    });
  }

  const activeInitial = currentWorkspace?.name.charAt(0).toUpperCase() ?? "W";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SpotlightTrigger
        open={open}
        onOpenChange={setOpen}
        mobileOnly
        render={
          <Button
            variant="unstyled"
            size="auto"
            type="button"
            className="sidebar-workspace-selector-card flex h-12 w-full min-w-0 items-center gap-2 rounded-2xl px-2.5 py-2 text-left outline-none transition-[width,height,padding,gap,background-color,transform] duration-300 ease-in-out hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] min-[901px]:h-[3.25rem]! min-[901px]:gap-3! min-[901px]:rounded-xl! min-[901px]:border-0! min-[901px]:bg-[var(--surface)]! min-[901px]:px-2.5! min-[901px]:shadow-none! min-[901px]:hover:bg-[var(--surface-hover)]! min-[901px]:hover:shadow-none! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-h-8! group-data-[collapsible=icon]:translate-x-2 group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center min-[901px]:group-data-[collapsible=icon]:mx-auto! min-[901px]:group-data-[collapsible=icon]:size-10! min-[901px]:group-data-[collapsible=icon]:min-h-10! min-[901px]:group-data-[collapsible=icon]:translate-x-0 min-[901px]:group-data-[collapsible=icon]:bg-transparent!"
            aria-expanded={open}
            aria-label={`Nhóm tài chính: ${currentWorkspace?.name}. Nhấn để chuyển nhóm.`}
          />
        }
        dismissLabel="Đóng menu chọn nhóm tài chính"
      >
        {(spotlightTrigger) => (
          <PopoverTrigger render={spotlightTrigger}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              <span>{activeInitial}</span>
            </div>
            <div className="min-w-0 flex-1 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 min-[901px]:group-data-[collapsible=icon]:hidden!">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="sidebar-ws-title truncate">
                  {currentWorkspace?.name}
                </span>
              </div>
              <span className="sidebar-ws-sub">
                <span className="sidebar-ws-dot" aria-hidden />
                {currentWorkspace?.role === "ADMIN"
                  ? "Quản trị viên"
                  : "Thành viên"}
              </span>
            </div>
            <ChevronsUpDown
              size={15}
              className="shrink-0 text-[var(--text-muted)] opacity-100 transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0 min-[901px]:group-data-[collapsible=icon]:hidden!"
            />
          </PopoverTrigger>
        )}
      </SpotlightTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="sidebar-ws-popover w-[var(--anchor-width)]! min-w-[var(--anchor-width)]! max-w-[var(--anchor-width)]! min-[901px]:w-72! min-[901px]:min-w-72! min-[901px]:max-w-72!"
      >
        <div className="sidebar-ws-popover-list">
          {workspaces.map((ws) => {
            const isSelected = ws.id === currentId;
            return (
              <Button
                variant="unstyled"
                size="auto"
                type="button"
                key={ws.id}
                disabled={pending}
                onClick={() => choose(ws.id)}
                className={`sidebar-ws-item rounded-xl ${isSelected ? "sidebar-ws-item-active" : ""}`}
              >
                <div className="sidebar-ws-avatar">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-ws-info">
                  <span className="sidebar-ws-name">{ws.name}</span>
                  <span className="sidebar-ws-role">
                    {ws.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}
                  </span>
                </div>
                {isSelected && (
                  <Check size={14} className="text-[var(--primary)]" />
                )}
              </Button>
            );
          })}
        </div>
        {error && <p className="sidebar-ws-error">{error}</p>}
        <div className="sidebar-ws-popover-footer">
          <Link
            href="/workspaces/create"
            onClick={() => setOpen(false)}
            className="sidebar-ws-footer-link rounded-md"
          >
            <PlusCircle size={14} />
            <span>Tạo nhóm mới</span>
          </Link>

          {/* Pending join requests indicator */}
          {pendingJoinCount > 0 && (
            <Link
              href="/settings/join"
              onClick={() => setOpen(false)}
              className="sidebar-ws-footer-link ws-pending-link"
            >
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
