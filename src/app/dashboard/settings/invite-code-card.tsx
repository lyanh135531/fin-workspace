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
    code.length === 7 && code.includes("-")
      ? code.replace("-", " · ")
      : code;

  return (
    <Card as="section" className="sunrise-card gap-0 p-6 flex flex-col justify-between space-y-5 relative overflow-hidden">
      {/* Accent glow */}
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-15 bg-blue-500" />

      <div className="space-y-3 relative">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/15">
            <KeyRound size={18} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">
            <Sparkles size={11} />
            Mã chia sẻ 6 số
          </span>
        </div>

        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Mã mời Workspace</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Chia sẻ mã 6 chữ số này với thành viên mới. Họ dùng mã này để gửi yêu cầu tham gia và bạn duyệt trong phần thông báo.
          </p>
        </div>
      </div>

      <div className="space-y-3 relative">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <code className="font-mono text-2xl font-bold tracking-[0.2em] text-[var(--foreground)] truncate select-all text-center sm:text-left">
            {formattedDisplay}
          </code>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={copy}
              variant="outline"
              size="icon"
              title={copied ? "Đã sao chép" : "Sao chép mã mời"}
              aria-label={copied ? "Đã sao chép mã mời" : "Sao chép mã mời"}
              className={`${
                copied ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : ""
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>

            <Button
              type="button"
              disabled={pending}
              onClick={handleRegenerate}
              variant="outline"
              size="icon"
              className="hover:text-[var(--primary)]"
              title="Đổi mã mời 6 số mới"
              aria-label="Đổi mã mời 6 số mới"
            >
              <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          Mã 6 chữ số ngắn gọn, dễ gõ và dễ truyền đạt cho thành viên mới
        </p>
      </div>
    </Card>
  );
}
