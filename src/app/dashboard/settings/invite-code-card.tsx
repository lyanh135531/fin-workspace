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

  // Format code for display if it's 6 digits e.g. "892-415" -> "892 - 415"
  const formattedDisplay =
    code.length === 7 && code.includes("-") ? code.replace("-", " · ") : code;

  if (compact) {
    return (
      <div className="hidden min-[901px]:flex">
        <Button
          variant="ghost"
          size="auto"
          type="button"
          className="group gap-2.5 px-2 py-1.5 text-left"
          onClick={copy}
          disabled={copied}
          aria-label={copied ? "Đã sao chép mã mời" : "Sao chép mã mời"}
        >
          <KeyRound
            className="text-[var(--primary)]"
            aria-hidden="true"
          />
          <span className="grid gap-0.5">
            <span className="text-[10px] font-medium leading-none text-[var(--text-muted)]">
              Mã mời workspace
            </span>
            <code className="font-mono text-sm font-semibold leading-none tracking-[0.14em] text-[var(--foreground)]">
              {formattedDisplay}
            </code>
          </span>
          {copied ? (
            <Check className="text-[var(--success)]" aria-hidden="true" />
          ) : (
            <Copy
              className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--primary)]"
              aria-hidden="true"
            />
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="unstyled"
        size="auto"
        type="button"
        className="workspace-mobile-invite-code md:hidden"
        onClick={copy}
        disabled={copied}
        aria-label={copied ? `Đã sao chép mã mời ${code}` : `Sao chép mã mời ${code}`}
      >
        <span className="workspace-mobile-invite-icon" aria-hidden="true">
          <KeyRound size={16} />
        </span>
        <span className="workspace-mobile-invite-label">Mã mời</span>
        <code>{code}</code>
      </Button>

      <Card
        as="section"
        className="workspace-invite-card max-md:hidden min-[901px]:grid min-[901px]:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] min-[901px]:items-center min-[901px]:gap-6"
      >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound size={18} strokeWidth={2} />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles size={11} />
            Mã chia sẻ
          </span>
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Mã mời Workspace
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--text-muted)]">
            Gửi mã này cho thành viên mới để họ có thể gửi yêu cầu tham gia vào
            workspace của bạn.
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-3 min-[901px]:mt-0">
        {/* Inner Code Well */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-[var(--surface-secondary)] p-4 sm:flex-row sm:pl-5">
          <code className="select-all truncate font-mono text-xl font-semibold tracking-[0.22em] text-[var(--foreground)]">
            {formattedDisplay}
          </code>

          <div className="flex items-center gap-2 shrink-0">
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
                className={pending ? "animate-spin text-primary" : ""}
              />
            </Button>
          </div>
        </div>

        <p className="text-center text-[10px] font-medium text-[var(--text-muted)]">
          Có thể tạo mã mới bất kỳ lúc nào.
        </p>
      </div>
      </Card>
    </>
  );
}
