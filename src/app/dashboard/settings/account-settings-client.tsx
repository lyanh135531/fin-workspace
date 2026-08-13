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
    <div className="space-y-3 text-[var(--foreground)] min-[761px]:grid min-[761px]:gap-5 min-[761px]:space-y-0">
      <section
        className="hidden min-[761px]:grid min-[761px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[761px]:items-center min-[761px]:gap-4 min-[761px]:rounded-2xl min-[761px]:bg-[var(--surface-secondary)] min-[761px]:px-5 min-[761px]:py-[1.15rem]"
        aria-label="Tài khoản đang cập nhật"
      >
        <div
          className="grid size-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-[0.82rem] font-bold tracking-[-0.02em] text-[var(--primary)]"
          aria-hidden="true"
        >
          {initialsText}
        </div>
        <div className="min-w-0">
          <span className="mb-0.5 block text-[0.68rem] font-semibold tracking-[0.04em] text-[var(--text-muted)]">
            Tài khoản
          </span>
          <strong className="block truncate text-[0.93rem] font-semibold">
            {username}
          </strong>
          <p className="mt-0.5 text-[0.73rem] leading-[1.45] text-[var(--text-muted)]">
            Mật khẩu mới sẽ được áp dụng cho lần đăng nhập tiếp theo.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--surface)] px-2.5 py-2 text-[0.69rem] font-semibold text-[var(--text-secondary)] [&_svg]:text-[var(--primary)]">
          <BadgeCheck size={15} aria-hidden="true" />
          Đang hoạt động
        </span>
      </section>

      <section className="space-y-3 bg-transparent p-0 min-[761px]:space-y-0 min-[761px]:overflow-hidden min-[761px]:rounded-2xl min-[761px]:bg-[var(--surface-secondary)]">
        <header className="hidden min-[761px]:flex min-[761px]:items-start min-[761px]:gap-3 min-[761px]:px-6 min-[761px]:pt-6 min-[761px]:pb-1">
          <span
            className="grid size-[2.15rem] shrink-0 place-items-center rounded-[0.65rem] bg-[var(--primary-soft)] text-[var(--primary)]"
            aria-hidden="true"
          >
            <KeyRound size={18} />
          </span>
          <div>
            <h2 className="text-[0.94rem] font-semibold leading-[1.35] tracking-[-0.015em]">
              Thiết lập mật khẩu mới
            </h2>
            <p className="mt-0.5 max-w-[28rem] text-xs leading-6 text-[var(--text-muted)]">
              Xác nhận mật khẩu hiện tại trước khi lưu thay đổi bảo mật.
            </p>
          </div>
        </header>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-3 min-[761px]:grid min-[761px]:grid-cols-[minmax(0,1fr)_14rem] min-[761px]:gap-x-6 min-[761px]:gap-y-4 min-[761px]:space-y-0 min-[761px]:px-6 min-[761px]:pt-5 min-[761px]:pb-6"
          aria-busy={pending}
        >
          {/* Current Password */}
          <div className="space-y-1.5 px-4 pt-4 min-[761px]:col-start-1 min-[761px]:p-0">
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
          <div className="space-y-1.5 px-4 min-[761px]:col-start-1 min-[761px]:p-0">
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
          <div className="space-y-1.5 px-4 min-[761px]:col-start-1 min-[761px]:p-0">
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

          <aside className="hidden min-[761px]:col-start-2 min-[761px]:row-span-3 min-[761px]:row-start-1 min-[761px]:block min-[761px]:rounded-xl min-[761px]:bg-[var(--surface)] min-[761px]:p-5">
            <div className="flex items-center gap-2 text-[0.78rem] text-[var(--foreground)] [&_svg]:text-[var(--primary)]">
              <ShieldCheck size={17} aria-hidden="true" />
              <strong>Mật khẩu an toàn</strong>
            </div>
            <ul className="mt-4 grid list-none gap-3.5 p-0 text-[0.72rem] leading-[1.55] text-[var(--text-muted)]">
              <li className="relative pl-4 before:absolute before:top-[0.55em] before:left-0 before:size-1 before:rounded-full before:bg-[var(--primary)]">
                Dùng một cụm từ dài và dễ nhớ với riêng bạn.
              </li>
              <li className="relative pl-4 before:absolute before:top-[0.55em] before:left-0 before:size-1 before:rounded-full before:bg-[var(--primary)]">
                Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt.
              </li>
              <li className="relative pl-4 before:absolute before:top-[0.55em] before:left-0 before:size-1 before:rounded-full before:bg-[var(--primary)]">
                Không dùng lại mật khẩu của tài khoản khác.
              </li>
            </ul>
          </aside>

          <div className="mt-4 flex justify-end border-t border-[var(--border)] px-4 pt-[0.8rem] pb-3 min-[761px]:col-span-2 min-[761px]:mt-2 min-[761px]:px-0 min-[761px]:pt-5 min-[761px]:pb-0">
            <Button
              disabled={pending || !newPassword || !confirmPassword}
              type="submit"
              variant="default"
              size="default"
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
