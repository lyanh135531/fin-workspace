"use client";

import { Building2, Plus, Sparkles, Wallet, ShieldCheck, KeyRound, ArrowRight } from "lucide-react";
import { useState, useTransition } from "react";
import { createWorkspaceAction } from "@/app/dashboard/settings/actions";
import { Button, Card } from "@/components/base";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const NAME_SUGGESTIONS = [
  "Chi tiêu gia đình",
  "Tài chính cá nhân",
  "Quản lý dự án",
];

export function CreateWorkspaceForm() {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const result = await createWorkspaceAction({
        name: form.get("name"),
        description: form.get("description") || undefined,
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
        approvalRequired: form.get("approvalRequired") === "on",
      });
      if (result.ok) {
        toast.success("Tạo workspace thành công! Đang chuyển hướng...");
        setTimeout(() => {
          window.location.assign("/overview");
        }, 800);
      } else {
        toast.error(result.message ?? "Không thể tạo workspace.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* ── Left Column: Creation Form (7 cols) ── */}
        <Card as="section" className="sunrise-card gap-0 p-6 sm:p-8 lg:col-span-7 space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--coral)]/10 text-[var(--coral)]">
                <Building2 size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                Tạo không gian làm việc
              </h1>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pl-11">
              Khởi tạo không gian dữ liệu độc lập cho thành viên, ví tiền và giao dịch. Bạn sẽ có quyền <strong>Admin (Owner)</strong> quản trị tối cao.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5 pt-2">
            {/* Workspace Name & Suggestions */}
            <div className="space-y-2">
              <Label htmlFor="workspace-name-input" className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                Tên workspace <span className="text-rose-500">*</span>
              </Label>
              <input
                id="workspace-name-input"
                required
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={3}
                maxLength={120}
                placeholder="Ví dụ: Chi tiêu gia đình..."
                className="field w-full text-sm font-medium"
                autoFocus
              />

              {/* Minimalist Name Suggestions */}
              <div className="flex flex-nowrap items-center gap-1.5 pt-1 text-xs whitespace-nowrap overflow-x-auto">
                <span className="text-slate-400 font-medium mr-1">Gợi ý:</span>
                {NAME_SUGGESTIONS.map((sug) => (
                  <Button variant="unstyled" size="auto"
                    key={sug}
                    type="button"
                    onClick={() => setName(sug)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      name === sug
                        ? "bg-[var(--coral)] text-white font-semibold shadow-sm"
                        : "border border-[var(--border)] bg-transparent text-slate-600 hover:border-[var(--coral)]/40 hover:text-[var(--coral)] hover:bg-[var(--coral)]/5"
                    }`}
                  >
                    + {sug}
                  </Button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="workspace-desc-input" className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                Mô tả ngắn <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
              </Label>
              <Textarea
                id="workspace-desc-input"
                name="description"
                maxLength={500}
                rows={3}
                placeholder="Mục đích hoặc phạm vi sử dụng của workspace..."
                className="settings-textarea w-full text-sm resize-none"
              />
            </div>

            {/* Clean Approval Toggle */}
            <div className="rounded-xl border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface-muted)]/50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  name="approvalRequired"
                  type="checkbox"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--coral)] focus:ring-[var(--coral)]"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-[var(--foreground)] block text-sm">
                    Yêu cầu duyệt giao dịch (Approval Workflow)
                  </span>
                  <p className="text-slate-500 leading-normal">
                    Giao dịch mới tạo bởi Member sẽ ở trạng thái Chờ duyệt (Pending) cho đến khi Admin kiểm tra và phê duyệt.
                  </p>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                disabled={pending || !name.trim()}
                variant="default"
              >
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang khởi tạo...
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    Khởi tạo Workspace ngay
                    <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* ── Right Column: Ecosystem Preview (5 cols) ── */}
        <Card as="section" className="sunrise-card gap-0 p-6 sm:p-8 lg:col-span-5 space-y-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-0.5 text-[11px] font-semibold text-blue-600">
              <Sparkles size={12} />
              <span>Hệ sinh thái tự động</span>
            </div>
            <h2 className="text-base font-bold text-[var(--foreground)] pt-1">
              Thiết lập có sẵn khi tạo
            </h2>
            <p className="text-xs text-slate-500">
              Hệ thống tự động chuẩn bị sẵn môi trường làm việc tài chính cho bạn:
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-[var(--surface-muted)]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Wallet size={16} />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-[var(--foreground)]">Ví chính mặc định</p>
                <p className="text-slate-500">Tạo sẵn Ví chính với số dư ban đầu 0 VND.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-[var(--surface-muted)]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--coral)]/10 text-[var(--coral)]">
                <ShieldCheck size={16} />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-[var(--foreground)]">Quyền Admin (Owner)</p>
                <p className="text-slate-500">Toàn quyền quản lý ví, phân quyền và phê duyệt.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-[var(--surface-muted)]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <KeyRound size={16} />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-[var(--foreground)]">Mã mời gia nhập</p>
                <p className="text-slate-500">Tạo sẵn mã mời để bạn gửi cho thành viên khác.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
