"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { signIn } from "next-auth/react";

import {
  BadgeCheck,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Unlink,
} from "lucide-react";

import {
  changePasswordAction,
  getAccountSecurityStateAction,
  startGoogleLinkAction,
  startGooglePasswordSetupAction,
  unlinkGoogleAction,
} from "@/app/dashboard/settings/account-actions";
import {
  Button,
  Input,
  Sheet,
  SheetBackButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@/components/base";
import { toast } from "sonner";

function GoogleMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.77-5.62-4.14H3.03v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.38 13.92A6.02 6.02 0 0 1 6.06 12c0-.67.12-1.32.32-1.92V7.46H3.03A10 10 0 0 0 2 12c0 1.62.39 3.15 1.03 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.97 5.46l3.35 2.62C7.17 7.71 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

function getInitials(username: string): string {
  const parts = username.trim().split(/[\s_\-\.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function getPasswordStrength(pw: string) {
  if (!pw)
    return { score: 0, label: "", color: "bg-[var(--border)]" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1)
    return { score: 1, label: "Yếu", color: "bg-[var(--destructive)]" };
  if (score === 2)
    return { score: 2, label: "Trung bình", color: "bg-[var(--warning)]" };
  return { score: 3, label: "Mạnh", color: "bg-[var(--success)]" };
}

export function AccountSettingsClient({
  username,
  onOpenPasswordChange,
  onOpenGoogleAction,
}: {
  username: string;
  onOpenPasswordChange?: () => void;
  onOpenGoogleAction?: (
    mode: "link" | "replace" | "unlink",
    email?: string,
  ) => void;
}) {
  const [pending, start] = useTransition();
  const [security, setSecurity] = useState<{
    hasPassword: boolean;
    googleAccount: { email: string; displayName: string | null; imageUrl: string | null } | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void getAccountSecurityStateAction().then((result) => {
      if (!active) return;
      if (result.ok) setSecurity(result.data);
      else toast.error(result.message);
    });
    return () => {
      active = false;
    };
  }, []);

  function createPasswordWithGoogle() {
    start(async () => {
      const result = await startGooglePasswordSetupAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await signIn("google", {
        callbackUrl: "/auth/google/complete?returnTo=password",
      });
    });
  }

  const initialsText = getInitials(username);

  return (
    <div className="space-y-5 text-[var(--foreground)]">
      {/* ── Profile Hero ────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 pb-1 pt-1">
        {/* Avatar with status indicator */}
        <div className="relative">
          <div
            className="grid size-[4.5rem] place-items-center rounded-full bg-[var(--primary-soft)] text-lg font-bold tracking-wide text-[var(--primary)]"
            aria-hidden="true"
          >
            {initialsText}
          </div>
          <span
            className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-[var(--surface)] bg-[var(--success)]"
            aria-label="Đang hoạt động"
          />
        </div>

        {/* Name + badge */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
              {username}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--success)]">
              <BadgeCheck size={11} />
              Active
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Tài khoản hệ thống Felix
          </p>
        </div>
      </div>

      {/* ── Security Settings Section ───────────────── */}
      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Bảo mật
        </p>

        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl ring-1 ring-[var(--border)] bg-[var(--surface)]">
          {/* ── Google Auth Row ────────────────────── */}
          <button
            type="button"
            disabled={pending || security === null}
            onClick={() => {
              if (!security?.hasPassword) {
                createPasswordWithGoogle();
              } else if (security.googleAccount) {
                onOpenGoogleAction?.("unlink", security.googleAccount.email);
              } else {
                onOpenGoogleAction?.("link");
              }
            }}
            aria-label={
              security?.googleAccount
                ? `Quản lý tài khoản Google ${security.googleAccount.email}`
                : "Liên kết tài khoản Google"
            }
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] ring-1 ring-[var(--border)]"
                aria-hidden="true"
              >
                <GoogleMark className="size-4.5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                  Google
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] truncate leading-relaxed">
                  {security === null ? (
                    "Đang tải…"
                  ) : security.googleAccount ? (
                    security.googleAccount.email
                  ) : (
                    "Chưa liên kết tài khoản"
                  )}
                </p>
              </div>
            </div>

            {security === null ? (
              <Skeleton className="h-5 w-5 rounded-full" />
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                {security.googleAccount && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                    <BadgeCheck size={11} aria-hidden="true" />
                    Đã liên kết
                  </span>
                )}
                <ChevronRight
                  size={16}
                  className="text-[var(--text-muted)]"
                  aria-hidden="true"
                />
              </div>
            )}
          </button>

          {/* ── Password Row ──────────────────────── */}
          {security?.hasPassword !== false && (
            <button
              type="button"
              disabled={pending || security === null}
              onClick={() => onOpenPasswordChange?.()}
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer outline-none disabled:pointer-events-none disabled:opacity-60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)]"
                  aria-hidden="true"
                >
                  <KeyRound size={17} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                    Mật khẩu
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] truncate leading-relaxed">
                    Đã thiết lập
                  </p>
                </div>
              </div>

              <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Standalone Action Sheet 1: Change Password ─────────────── */
export function ChangePasswordSheet({
  open,
  isMobile = false,
  onBack,
  onClose,
}: {
  open: boolean;
  isMobile?: boolean;
  onBack?: () => void;
  onClose: () => void;
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

    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có tối thiểu 8 ký tự.");
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
        onClose();
      } else {
        toast.error(result.message ?? "Không thể đổi mật khẩu.");
      }
    });
  }

  const passwordToggle = (
    visible: boolean,
    toggle: () => void,
    label: string,
  ) => (
    <Button
      variant="icon"
      size="icon"
      type="button"
      className="absolute inset-y-0 right-0"
      onClick={toggle}
      aria-label={visible ? `Ẩn ${label}` : `Hiện ${label}`}
      aria-pressed={visible}
    >
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          formRef.current?.reset();
          setNewPassword("");
          setConfirmPassword("");
          onClose();
        }
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement="inset"
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation={isMobile ? "raised" : "flat"}
      >
        <SheetHeader className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            {onBack && <SheetBackButton onBack={onBack} />}
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)]"
              aria-hidden="true"
            >
              <KeyRound size={18} />
            </span>
            <div className="min-w-0">
              <SheetTitle>Đổi mật khẩu</SheetTitle>
              <SheetDescription className="text-xs text-[var(--text-muted)]">
                Nhập mật khẩu hiện tại và mật khẩu mới của bạn
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          aria-busy={pending}
          className="p-5 space-y-3.5"
        >
          <Input
            label="Mật khẩu hiện tại *"
            id="currentPassword"
            required
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu hiện tại"
            className="pr-10"
            autoFocus
          />

          <div className="space-y-1.5">
            <Input
              label="Mật khẩu mới *"
              id="newPassword"
              required
              name="newPassword"
              type={showNew ? "text" : "password"}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
              endAdornment={passwordToggle(
                showNew,
                () => setShowNew((value) => !value),
                "mật khẩu mới",
              )}
            />

            {newPassword && (
              <div
                className="flex items-center justify-between gap-2 pt-0.5 text-[11px]"
                aria-live="polite"
              >
                <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                  <div
                    className={`h-full transition-all duration-300 ease-out rounded-full ${strength.color}`}
                    style={{ width: `${(strength.score / 3) * 100}%` }}
                  />
                </div>
                {strength.label && (
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {strength.label}
                  </span>
                )}
              </div>
            )}
          </div>

          <Input
            label="Xác nhận mật khẩu mới *"
            id="confirmPassword"
            required
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pr-10"
            endAdornment={passwordToggle(
              showConfirm,
              () => setShowConfirm((value) => !value),
              "mật khẩu xác nhận",
            )}
          />

          <div className="pt-2">
            <Button
              disabled={pending || !newPassword || !confirmPassword}
              type="submit"
              variant="default"
              className="w-full text-xs"
            >
              <ShieldCheck aria-hidden="true" size={15} />
              {pending ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ── Standalone Action Sheet 2: Google Action Confirm ────────── */
export function GoogleConfirmSheet({
  open,
  mode,
  googleEmail,
  isMobile = false,
  onBack,
  onClose,
}: {
  open: boolean;
  mode: "link" | "replace" | "unlink";
  googleEmail?: string | null;
  isMobile?: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [googlePassword, setGooglePassword] = useState("");
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function connectGoogle(connectMode: "link" | "replace") {
    start(async () => {
      const result = await startGoogleLinkAction({ password: googlePassword, mode: connectMode });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setGooglePassword("");
      setShowPassword(false);
      onClose();
      await signIn("google", {
        callbackUrl: "/auth/google/complete?returnTo=account",
      });
    });
  }

  function unlinkGoogle() {
    start(async () => {
      const result = await unlinkGoogleAction({ password: googlePassword });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setGooglePassword("");
      setShowPassword(false);
      toast.success("Đã gỡ liên kết Google.");
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setGooglePassword("");
          setConfirmingUnlink(false);
          setShowPassword(false);
          onClose();
        }
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement="inset"
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation={isMobile ? "raised" : "flat"}
      >
        <SheetHeader className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <SheetBackButton
                onBack={
                  mode === "unlink" && confirmingUnlink
                    ? () => {
                        setConfirmingUnlink(false);
                        setGooglePassword("");
                        setShowPassword(false);
                      }
                    : onBack
                }
              />
            )}
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] ring-1 ring-[var(--border)]"
              aria-hidden="true"
            >
              <GoogleMark className="size-4.5" />
            </span>
            <div className="min-w-0">
              <SheetTitle>
                {mode === "unlink" && !confirmingUnlink
                  ? "Tài khoản Google"
                  : mode === "unlink"
                  ? "Xác nhận ngắt liên kết"
                  : mode === "replace"
                  ? "Đổi tài khoản Google"
                  : "Liên kết tài khoản Google"}
              </SheetTitle>
              <SheetDescription className="text-xs text-[var(--text-muted)]">
                {mode === "unlink" && !confirmingUnlink
                  ? "Quản lý phương thức đăng nhập đã liên kết"
                  : "Nhập mật khẩu hiện tại để xác nhận thao tác"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {mode === "unlink" && !confirmingUnlink ? (
          <div className="space-y-4 p-5">
            {/* Account Card */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] ring-1 ring-[var(--border)]"
                    aria-hidden="true"
                  >
                    <GoogleMark className="size-5.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      Google
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Phương thức đăng nhập
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2.5 py-1 text-[10px] font-semibold text-[var(--success)] shrink-0">
                  <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
                  Đã liên kết
                </span>
              </div>

              {/* Email Pill */}
              <div className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--foreground)]">
                <Mail size={14} className="text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                <span className="font-medium truncate select-all">{googleEmail ?? "Tài khoản Google"}</span>
              </div>
            </div>

            {/* Information Card */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start gap-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]"
                  aria-hidden="true"
                >
                  <ShieldCheck size={16} />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-[var(--foreground)]">
                    Đăng nhập một chạm
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                    Tài khoản Google này đang được dùng để đăng nhập nhanh chóng và bảo mật vào Felix.
                  </p>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-2">
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => setConfirmingUnlink(true)}
                className="w-full text-xs"
              >
                <Unlink size={14} aria-hidden="true" />
                Ngắt liên kết
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {mode === "unlink" && (
              <div className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--destructive)_25%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] p-4">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--destructive)_15%,var(--surface))] text-[var(--destructive)]"
                  aria-hidden="true"
                >
                  <ShieldAlert size={16} />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-[var(--destructive)]">
                    Lưu ý khi ngắt liên kết
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    Bạn sẽ không thể đăng nhập bằng Google nữa. Sau khi ngắt, bạn sẽ sử dụng mật khẩu tài khoản Felix để đăng nhập.
                  </p>
                </div>
              </div>
            )}

            <Input
              name="googlePassword"
              type={showPassword ? "text" : "password"}
              label="Mật khẩu hiện tại *"
              autoComplete="current-password"
              value={googlePassword}
              onChange={(event) => setGooglePassword(event.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              autoFocus
              className="pr-10"
              endAdornment={
                <Button
                  variant="icon"
                  size="icon"
                  type="button"
                  className="absolute inset-y-0 right-0"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              }
            />

            <div
              className={
                mode === "unlink"
                  ? "grid grid-cols-2 gap-2 pt-1"
                  : "pt-1"
              }
            >
              {mode === "unlink" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setGooglePassword("");
                    setShowPassword(false);
                    setConfirmingUnlink(false);
                  }}
                  className="w-full text-xs"
                >
                  Hủy
                </Button>
              )}
              <Button
                type="button"
                variant={mode === "unlink" ? "destructive" : "default"}
                disabled={pending || !googlePassword}
                onClick={() => {
                  if (mode === "unlink") {
                    unlinkGoogle();
                  } else {
                    connectGoogle(mode);
                  }
                }}
                className="w-full text-xs"
              >
                {pending
                  ? "Đang xử lý…"
                  : mode === "unlink"
                  ? "Xác nhận ngắt liên kết"
                  : "Xác nhận"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
