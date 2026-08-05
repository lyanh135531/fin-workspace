"use client";

import { Check, Copy, KeyRound, RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { regenerateInviteCodeAction } from "@/app/dashboard/settings/actions";
import { Button, Card } from "@/components/base";
import { toast } from "sonner";

export function InviteCodeCard({ code: initialCode }: { code: string }) {
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

  return (
    <Card as="section">
      <div className="space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-900/10">
            <KeyRound size={18} strokeWidth={2} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
            <Sparkles size={11} />
            Mã chia sẻ 6 số
          </span>
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Mã mời Workspace
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Gửi mã này cho thành viên mới để họ có thể gửi yêu cầu tham gia vào
            workspace của bạn.
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-4 relative z-10">
        {/* Inner Code Well */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 pl-6">
          <code className="font-mono text-xl font-bold tracking-[0.25em] text-[var(--foreground)] truncate select-all">
            {formattedDisplay}
          </code>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="icon"
              size="auto"
              type="button"
              onClick={copy}
              title={copied ? "Đã sao chép" : "Sao chép mã mời"}
              aria-label={copied ? "Đã sao chép mã mời" : "Sao chép mã mời"}
              className={`transition-colors p-1 active:scale-[0.9] ${
                copied && "text-emerald-600"
              }`}
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
              size="auto"
              type="button"
              disabled={pending}
              onClick={handleRegenerate}
              title="Đổi mã mới"
              aria-label="Đổi mã mới"
            >
              <RefreshCw
                size={16}
                className={pending ? "animate-spin text-indigo-500" : ""}
              />
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-[var(--text-muted)] text-center font-medium">
          Mã mời gồm 6 chữ số.
        </p>
      </div>
    </Card>
  );
}
