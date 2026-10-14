"use client";

import { Check, Copy, KeyRound, RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { regenerateInviteCodeAction } from "@/app/dashboard/settings/actions";
import { Button, Card } from "@/components/base";
import { toast } from "sonner";

type InviteCodeCardProps = {
  code: string;
  compact?: boolean;
};

export function InviteCodeCard({
  code: initialCode,
  compact = false,
}: InviteCodeCardProps) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Đã sao chép mã mời vào bộ nhớ tạm.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không thể sao chép tự động. Vui lòng sao chép thủ công.");
    }
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateInviteCodeAction();
      if (result.ok && "inviteCode" in result && result.inviteCode) {
        setCode(result.inviteCode);
        toast.success("Đã tạo mã mời 6 chữ số mới.");
      } else {
        toast.error(result.message ?? "Không thể đổi mã mời.");
      }
    });
  }

  const formattedDisplay =
    code.length === 7 && code.includes("-") ? code.replace("-", " · ") : code;

  if (compact) {
    return (
      <div className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5">
        <Button
          variant="ghost"
          size="auto"
          type="button"
          className="group gap-2.5 px-2.5 py-1.5 text-left"
          onClick={copy}
          disabled={copied}
          title={copied ? "Đã sao chép mã mời" : `Sao chép mã mời ${code}`}
          aria-label={copied ? "Đã sao chép mã mời" : `Sao chép mã mời ${code}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            {copied ? <Check size={14} /> : <KeyRound size={14} />}
          </span>
          <span className="grid gap-0.5">
            <span className="text-[10px] font-medium leading-none text-[var(--text-muted)]">
              Mã mời nhóm
            </span>
            <code className="font-mono text-xs md:text-sm font-semibold leading-none tracking-[0.14em] text-[var(--foreground)] tabular-nums">
              {formattedDisplay}
            </code>
          </span>
        </Button>
      </div>
    );
  }

  return (
    <Card
      as="section"
      className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] md:items-center md:gap-5"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)]">
            <KeyRound size={17} strokeWidth={2} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
            <Sparkles size={11} />
            Mã chia sẻ
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
            Mã mời tham gia nhóm
          </h2>
          <p className="max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
            Gửi mã 6 chữ số này cho thành viên mới để họ gửi yêu cầu tham gia
            không gian tài chính của bạn.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
          <code className="select-all break-words font-mono text-lg md:text-xl font-semibold leading-snug tracking-[0.18em] text-[var(--foreground)] tabular-nums">
            {formattedDisplay}
          </code>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="icon"
              size="icon"
              type="button"
              onClick={copy}
              title={copied ? "Đã sao chép" : "Sao chép mã mời"}
              aria-label={copied ? "Đã sao chép mã mời" : "Sao chép mã mời"}
              className={copied ? "text-[var(--success)]" : undefined}
              disabled={copied}
            >
              {copied ? (
                <Check size={16} strokeWidth={2.5} />
              ) : (
                <Copy size={16} />
              )}
            </Button>

            <Button
              variant="icon"
              size="icon"
              type="button"
              disabled={pending}
              onClick={handleRegenerate}
              title="Đổi mã mới"
              aria-label="Đổi mã mới"
            >
              <RefreshCw
                size={16}
                className={pending ? "animate-spin text-[var(--primary)]" : ""}
              />
            </Button>
          </div>
        </div>

        <p className="text-right text-[11px] text-[var(--text-muted)]">
          Có thể tạo mã mới bất kỳ lúc nào để bảo mật quyền truy cập.
        </p>
      </div>
    </Card>
  );
}
