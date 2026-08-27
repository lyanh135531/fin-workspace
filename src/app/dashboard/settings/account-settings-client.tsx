"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { signIn } from "next-auth/react";

import {
  BadgeCheck,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  ShieldCheck,
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
  onOpenGoogleAction?: (mode: "link" | "replace" | "unlink") => void;
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
              } else {
                onOpenGoogleAction?.(security?.googleAccount ? "replace" : "link");
              }
            }}
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer outline-none disabled:pointer-events-none disabled:opacity-60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)]"
                aria-hidden="true"
              >
                <Link2 size={17} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                  Google Auth
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
              <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
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
  isMobile = false,
  onBack,
  onClose,
}: {
  open: boolean;
  mode: "link" | "replace" | "unlink";
  isMobile?: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [googlePassword, setGooglePassword] = useState("");

  function connectGoogle(connectMode: "link" | "replace") {
    start(async () => {
      const result = await startGoogleLinkAction({ password: googlePassword, mode: connectMode });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setGooglePassword("");
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
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)]"
              aria-hidden="true"
            >
              <Link2 size={18} />
            </span>
            <div className="min-w-0">
              <SheetTitle>
                {mode === "unlink"
                  ? "Gỡ liên kết Google"
                  : mode === "replace"
                  ? "Đổi tài khoản Google"
                  : "Liên kết tài khoản Google"}
              </SheetTitle>
              <SheetDescription className="text-xs text-[var(--text-muted)]">
                Nhập mật khẩu hiện tại để xác nhận thao tác
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="p-5 space-y-4">
          <Input
            name="googlePassword"
            type="password"
            label="Mật khẩu hiện tại *"
            autoComplete="current-password"
            value={googlePassword}
            onChange={(event) => setGooglePassword(event.target.value)}
            placeholder="Nhập mật khẩu hiện tại"
            autoFocus
          />

          <div className="pt-1">
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
              {pending ? "Đang xử lý…" : "Xác nhận"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
