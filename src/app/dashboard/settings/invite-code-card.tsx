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
  const [regenerated, setRegenerated] = useState<{
    baseCode: string;
    code: string;
  } | null>(null);
  const code =
    regenerated?.baseCode === initialCode ? regenerated.code : initialCode;
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Đã sao chép mã mời.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không thể sao chép mã mời.");
    }
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateInviteCodeAction();
      if (result.ok && "inviteCode" in result && result.inviteCode) {
        setRegenerated({ baseCode: initialCode, code: result.inviteCode });
        toast.success("Đã tạo mã mời mới.");
      } else {
        toast.error(result.message ?? "Không thể đổi mã mời.");
      }
    });
  }

  const formattedDisplay =
    code.length === 7 && code.includes("-") ? code.replace("-", " · ") : code;

  if (compact) {
    return (
      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 md:w-auto md:px-3 md:py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"
            aria-hidden="true"
          >
            <KeyRound size={15} />
          </span>
          <div className="min-w-0">
            <span className="block text-[10px] font-medium leading-none text-[var(--text-muted)]">
              Mã mời tham gia nhóm
            </span>
            <code className="mt-1 block whitespace-nowrap font-mono text-sm font-bold leading-none tracking-[0.14em] text-[var(--foreground)] tabular-nums">
              {formattedDisplay}
            </code>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="icon"
            size="icon"
            type="button"
            className={copied ? "text-[var(--success)]" : undefined}
            onClick={copy}
            disabled={copied}
            title={copied ? "Đã sao chép mã mời" : `Sao chép mã mời ${code}`}
            aria-label={copied ? "Đã sao chép mã mời" : `Sao chép mã mời ${code}`}
          >
            {copied ? (
              <Check size={15} strokeWidth={2.5} />
            ) : (
              <Copy size={15} />
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
              size={15}
              className={pending ? "animate-spin text-[var(--primary)]" : ""}
            />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card
      as="section"
      className="grid gap-3.5 p-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] md:items-center md:gap-5 md:p-5"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)] md:size-9">
            <KeyRound size={16} strokeWidth={2} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
            <Sparkles size={11} />
            Mã chia sẻ
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)] md:text-base">
            Mã mời tham gia nhóm
          </h2>
          <p className="max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
            Gửi mã 6 chữ số này cho thành viên mới để họ gửi yêu cầu tham gia
            nhóm tài chính của bạn.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5 md:px-4 md:py-3">
          <code className="select-all whitespace-nowrap font-mono text-base font-bold leading-snug tracking-[0.16em] text-[var(--foreground)] tabular-nums md:text-xl">
            {formattedDisplay}
          </code>

          <div className="flex shrink-0 items-center gap-1.5">
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

        <p className="hidden text-right text-[11px] text-[var(--text-muted)] md:block">
          Có thể tạo mã mới bất kỳ lúc nào để bảo mật quyền truy cập.
        </p>
      </div>
    </Card>
  );
}
