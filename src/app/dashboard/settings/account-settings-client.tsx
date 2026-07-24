"use client";

import { useState, useTransition, useRef } from "react";

import {
  User,
  KeyRound,
  ShieldCheck,
  Lock,
  BadgeCheck,
  Eye,
  EyeOff,
} from "lucide-react";

import { changePasswordAction } from "@/app/dashboard/settings/general-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function getInitials(username: string): string {
  const parts = username.trim().split(/[\s_\-\.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function getPasswordStrength(pw: string) {
  if (!pw) return { score: 0, label: "", color: "bg-slate-200 dark:bg-slate-700" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Yếu", color: "bg-rose-500" };
  if (score === 2) return { score: 2, label: "Trung bình", color: "bg-amber-500" };
  return { score: 3, label: "Mạnh", color: "bg-emerald-500" };
}

export function AccountSettingsClient({
  username,
}: {
  username: string;
}) {
  const [pending, start] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const strength = getPasswordStrength(newPassword);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không trùng khớp với mật khẩu mới.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }

    start(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword });
      if (result.ok) {
        toast.success("Đã đổi mật khẩu thành công!");
        formRef.current?.reset();
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.message ?? "Không thể đổi mật khẩu.");
      }
    });
  }

  const initialsText = getInitials(username);

  return (
    <div className="space-y-4 text-[var(--foreground)]">
      {/* ── Profile Header Card ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] text-base font-extrabold border border-orange-500/20 shadow-xs">
              {initialsText}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)] bg-emerald-500" title="Đang hoạt động" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-[var(--foreground)] truncate">{username}</h2>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <BadgeCheck size={12} /> Live
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">
              @{username} · Fin Workspace Account
            </p>
          </div>
        </div>
      </section>

      {/* ── Change Password Card ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-[var(--coral)]">
            <KeyRound size={18} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--foreground)]">
              Bảo mật & Đổi mật khẩu
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Cập nhật mật khẩu mới tối thiểu 6 ký tự
            </p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3.5">
          {/* Current Password */}
          <div className="space-y-1.5">
            <Label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="currentPassword">
              Mật khẩu hiện tại <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                required
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu hiện tại"
                className="pr-10 text-sm"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
                aria-label={showCurrent ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="newPassword">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                required
                name="newPassword"
                type={showNew ? "text" : "password"}
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Tối thiểu 6 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10 text-sm"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
                aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Password strength meter */}
            {newPassword && (
              <div className="mt-1.5 space-y-1">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(strength.score / 3) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)]">
                  <span>Độ mạnh mật khẩu</span>
                  <span className="font-semibold text-[var(--foreground)]">{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <Label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="confirmPassword">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                required
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10 text-sm"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              disabled={pending || !newPassword || !confirmPassword}
              type="submit"
              variant="default"
              size="sm"
              className="w-full sm:w-auto"
            >
              <ShieldCheck size={16} />
              {pending ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
