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
    <form onSubmit={submit} className="mt-1 pt-1">
      <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1">
        <KeyRound size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
        <Input
          ref={inputRef}
          className="h-7 min-h-0 flex-1 border-0 bg-transparent px-1 py-0 text-xs focus-visible:ring-0 md:h-7 md:min-h-0 md:py-0 md:text-xs"
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
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--text-on-primary)] transition-opacity disabled:opacity-40"
          disabled={pending || value.trim().length < 6}
          aria-label="Gửi yêu cầu tham gia"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={13} />
          )}
        </Button>
      </div>
      {feedback && (
        <p
          className={`mt-1.5 px-1 text-xs font-medium ${feedback.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
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
    if (id === currentId) {
      setOpen(false);
      return;
    }
    setError(null);
    start(async () => {
      try {
        const result = await selectWorkspaceAction(id);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setOpen(false);
        if (pathname.startsWith("/workspace/") || pathname === "/dashboard") {
          router.push(`/workspace/${id}`);
        } else if (pathname.startsWith("/credit-cards/")) {
          router.push("/credit-cards");
        } else {
          router.refresh();
        }
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
            className="flex h-12 w-full min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:min-h-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0!"
            aria-expanded={open}
            aria-label={`Nhóm tài chính: ${currentWorkspace?.name}. Nhấn để chuyển nhóm.`}
          />
        }
        dismissLabel="Đóng menu chọn nhóm tài chính"
      >
        {(spotlightTrigger) => (
          <PopoverTrigger render={spotlightTrigger}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-[var(--text-on-primary)]">
              <span>{activeInitial}</span>
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden!">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {currentWorkspace?.name}
                </span>
              </div>
              <span className="flex items-center gap-1.5 text-xs leading-snug text-[var(--text-muted)]">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--success)]" aria-hidden />
                {currentWorkspace?.role === "ADMIN"
                  ? "Quản trị viên"
                  : "Thành viên"}
              </span>
            </div>
            <ChevronsUpDown
              size={15}
              className="shrink-0 text-[var(--text-muted)] group-data-[collapsible=icon]:hidden!"
            />
          </PopoverTrigger>
        )}
      </SpotlightTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-80 min-w-64 max-w-[calc(100vw-2rem)] p-2"
      >
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
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
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-hover)] ${isSelected ? "bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]" : ""}`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-xs font-bold text-[var(--foreground)]">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-sm font-medium leading-snug text-[var(--foreground)]">
                    {ws.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {ws.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}
                  </span>
                </div>
                {isSelected && (
                  <Check size={15} className="shrink-0 text-[var(--primary)]" />
                )}
              </Button>
            );
          })}
        </div>
        {error && <p className="mt-2 px-2 text-xs text-[var(--danger)]">{error}</p>}
        <div className="mt-2 flex flex-col gap-1 border-t border-[var(--border)] pt-2">
          <Link
            href="/workspaces/create"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <PlusCircle size={14} />
            <span>Tạo nhóm mới</span>
          </Link>

          {pendingJoinCount > 0 && (
            <Link
              href="/settings/join"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--warning)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <Clock size={14} />
              <span>Đang chờ duyệt ({pendingJoinCount})</span>
            </Link>
          )}

          <InlineJoinForm onSuccess={() => router.refresh()} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
