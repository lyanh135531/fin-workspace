"use client";

import { useState, useTransition, useRef } from "react";

import { KeyRound, ShieldCheck, BadgeCheck, Eye, EyeOff } from "lucide-react";

import { changePasswordAction } from "@/app/dashboard/settings/general-actions";
import { Button, Input } from "@/components/base";
import { toast } from "sonner";

function getInitials(username: string): string {
  const parts = username.trim().split(/[\s_\-\.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function getPasswordStrength(pw: string) {
  if (!pw)
    return { score: 0, label: "", color: "bg-slate-200 dark:bg-slate-700" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Yếu", color: "bg-rose-500" };
  if (score === 2)
    return { score: 2, label: "Trung bình", color: "bg-amber-500" };
  return { score: 3, label: "Mạnh", color: "bg-emerald-500" };
}

export function AccountSettingsClient({ username }: { username: string }) {
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
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
      });
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
    <div className="account-settings-content space-y-4 text-[var(--foreground)]">
      {/* ── Change Password Card ── */}
      <section className="account-settings-password border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4 rounded-xl">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="account-settings-password-form space-y-3.5"
          aria-busy={pending}
        >
          {/* Current Password */}
          <div className="space-y-1.5 px-4 pt-4">
            <Input
              label="Mật khẩu hiện tại"
              id="currentPassword"
              required
              name="currentPassword"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu hiện tại"
              className="pr-10 text-sm"
              controlClassName="relative"
              endAdornment={
                <Button
                  variant="unstyled"
                  size="auto"
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  onClick={() => setShowCurrent(!showCurrent)}
                  tabIndex={-1}
                  aria-label={showCurrent ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              }
            />
          </div>

          {/* New Password */}
          <div className="space-y-1.5 px-4">
            <Input
              label="Mật khẩu mới"
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
              controlClassName="relative"
              endAdornment={
                <Button
                  variant="unstyled"
                  size="auto"
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                  aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              }
            />

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
                  <span className="font-semibold text-[var(--foreground)]">
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5 px-4">
            <Input
              label="Xác nhận mật khẩu mới"
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
              controlClassName="relative"
              endAdornment={
                <Button
                  variant="unstyled"
                  size="auto"
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                  aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              }
            />
          </div>

          <div className="account-settings-password-submit py-3 px-4 flex justify-end">
            <Button
              disabled={pending || !newPassword || !confirmPassword}
              type="submit"
              variant="default"
              size="default"
              className="w-full sm:w-auto ro"
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
