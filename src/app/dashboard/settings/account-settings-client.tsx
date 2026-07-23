"use client";

import { useState, useTransition, useRef } from "react";
import { signOut } from "next-auth/react";
import {
  User,
  KeyRound,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Lock,
  BadgeCheck,
} from "lucide-react";
import { changePasswordAction } from "@/app/dashboard/settings/general-actions";

function getInitials(username: string): string {
  const parts = username.trim().split(/[\s_\-\.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function AccountSettingsClient({
  username,
}: {
  username: string;
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirmPassword, setConfirmPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");

    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: "Mật khẩu xác nhận không trùng khớp với mật khẩu mới." });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ ok: false, text: "Mật khẩu mới phải có tối thiểu 6 ký tự." });
      return;
    }

    start(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword });
      if (result.ok) {
        setMessage({ ok: true, text: "Đã đổi mật khẩu thành công!" });
        formRef.current?.reset();
        setConfirmPassword("");
      } else {
        setMessage({ ok: false, text: result.message ?? "Không thể đổi mật khẩu." });
      }
    });
  }

  const initialsText = getInitials(username);

  return (
    <div className="space-y-6 mt-6">
      {/* ── User Overview Card ── */}
      <section className="sunrise-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] text-xl font-bold border border-amber-500/20">
                {initialsText}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[var(--surface)] bg-emerald-500" title="Đang hoạt động" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">{username}</h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck size={13} /> Đang hoạt động
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Tài khoản cá nhân hệ thống Fin Workspace
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end text-xs text-[var(--text-muted)] border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--border)]">
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 font-medium">
              Tên đăng nhập: <strong className="text-[var(--foreground)]">@{username}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* ── Grid: Security & Password + Active Session ── */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Change Password Form (2 cols) */}
        <section className="sunrise-card p-6 lg:col-span-2">
          <div className="flex items-start gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-[var(--coral)]">
              <KeyRound size={20} strokeWidth={2} />
            </div>
            <div>
              <p className="settings-eyebrow">Bảo mật tài khoản</p>
              <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)] mt-0.5">
                Đổi mật khẩu
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Mật khẩu mới cần tối thiểu 6 ký tự để bảo vệ tài khoản cá nhân của bạn.
              </p>
            </div>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="currentPassword">
                Mật khẩu hiện tại <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  required
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu đang sử dụng"
                  className="field pr-10 text-sm"
                />
                <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="newPassword">
                  Mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    required
                    name="newPassword"
                    type="password"
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="field pr-10 text-sm"
                  />
                  <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="confirmPassword">
                  Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    required
                    name="confirmPassword"
                    type="password"
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="field pr-10 text-sm"
                  />
                  <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 text-xs font-semibold leading-relaxed ${
                  message.ok
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}
                role="status"
              >
                {message.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                disabled={pending}
                type="submit"
                className="button-primary inline-flex items-center gap-2 text-sm"
              >
                <ShieldCheck size={16} />
                {pending ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
              </button>
            </div>
          </form>
        </section>

        {/* Active Sessions & Logout (1 col) */}
        <section className="sunrise-card p-6 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Laptop size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="settings-eyebrow">Phiên làm việc</p>
                <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)] mt-0.5">
                  Đăng xuất
                </h3>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--foreground)]">Trình duyệt hiện tại</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    ● Active
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  Đăng xuất khỏi thiết bị này nếu bạn sử dụng máy tính công cộng hoặc kết thúc phiên làm việc.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              className="button-secondary w-full inline-flex items-center justify-center gap-2 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/10"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
            >
              <LogOut size={16} />
              <span>Đăng xuất khỏi tài khoản</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
