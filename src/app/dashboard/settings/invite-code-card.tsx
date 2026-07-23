"use client";

import { Check, Copy, KeyRound, Sparkles } from "lucide-react";
import { useState } from "react";
import { showToast } from "@/components/toast-container";

export function InviteCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      showToast("Đã sao chép mã mời vào bộ nhớ tạm!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Không thể sao chép tự động. Vui lòng sao chép thủ công.", "error");
    }
  }

  return (
    <section className="sunrise-card p-6 flex flex-col justify-between space-y-5 relative overflow-hidden">
      {/* Accent glow */}
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-15 bg-blue-500" />

      <div className="space-y-3 relative">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/15">
            <KeyRound size={18} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">
            <Sparkles size={11} />
            Mã chia sẻ
          </span>
        </div>

        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Mã mời Workspace</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Chia sẻ mã này với thành viên mới. Họ dùng mã này để gửi yêu cầu tham gia và bạn duyệt trong phần thông báo.
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <code className="font-mono text-lg font-bold tracking-[0.15em] text-[var(--foreground)] truncate select-all">
            {code}
          </code>
          <button
            type="button"
            onClick={copy}
            className={`button-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold shrink-0 transition-all ${
              copied ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : ""
            }`}
          >
            {copied ? (
              <>
                <Check size={14} />
                Đã chép
              </>
            ) : (
              <>
                <Copy size={14} />
                Sao chép
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400 text-center">
          Mã mời là cố định — không thể đổi sau khi tạo workspace
        </p>
      </div>
    </section>
  );
}
