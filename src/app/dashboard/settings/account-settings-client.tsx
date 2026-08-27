"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { signIn } from "next-auth/react";

import {
  BadgeCheck,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  RefreshCw,
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
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

export function AccountSettingsClient({ username }: { username: string }) {
  const [pending, start] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [googlePassword, setGooglePassword] = useState("");
  const [security, setSecurity] = useState<{
    hasPassword: boolean;
    googleAccount: { email: string; displayName: string | null; imageUrl: string | null } | null;
  } | null>(null);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const strength = getPasswordStrength(newPassword);

  async function refreshSecurity() {
    const result = await getAccountSecurityStateAction();
    if (result.ok) setSecurity(result.data);
    else toast.error(result.message);
  }

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

  function connectGoogle(mode: "link" | "replace") {
    start(async () => {
      const result = await startGoogleLinkAction({ password: googlePassword, mode });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
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
      await refreshSecurity();
    });
  }

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
      } else {
        toast.error(result.message ?? "Không thể đổi mật khẩu.");
      }
    });
  }

  const initialsText = getInitials(username);

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
    <div className="space-y-3 p-3 text-[var(--foreground)] min-[761px]:space-y-4 min-[761px]:p-0">
      <Card
        size="sm"
        tone="primarySoft"
        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 max-[760px]:p-4 min-[761px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[761px]:gap-4"
        aria-label="Tài khoản đang cập nhật"
      >
        <div
          className="grid size-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-sm font-bold tracking-[-0.02em] text-[var(--primary)]"
          aria-hidden="true"
        >
          {initialsText}
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-medium text-[var(--text-muted)]">
            Hồ sơ Felix
          </span>
          <strong className="mt-0.5 block truncate text-base font-semibold tracking-[-0.01em]">
            {username}
          </strong>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Quản lý danh tính và các phương thức đăng nhập.
          </p>
        </div>
        <span className="col-span-2 inline-flex items-center gap-1.5 justify-self-start whitespace-nowrap text-xs font-semibold text-[var(--success)] min-[761px]:col-span-1 min-[761px]:justify-self-end">
          <BadgeCheck size={16} aria-hidden="true" />
          Đang hoạt động
        </span>
      </Card>

      <Card
        size="sm"
        className="max-[760px]:p-4"
        aria-busy={pending || security === null}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Link2 size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle>Đăng nhập bằng Google</CardTitle>
              <CardDescription className="mt-1 leading-5">
                {security?.googleAccount
                  ? `Đang liên kết với ${security.googleAccount.email}`
                  : "Thêm Google làm phương thức đăng nhập dự phòng."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {security === null ? (
            <div className="grid gap-3" aria-label="Đang tải trạng thái bảo mật">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-8 w-36" />
            </div>
          ) : security.hasPassword ? (
            <div className="grid gap-4">
              {security.googleAccount && (
                <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-secondary)] p-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-base font-bold text-[var(--primary)]"
                    aria-hidden="true"
                  >
                    G
                  </span>
                  <div className="min-w-0 flex-1">
                    {security.googleAccount.displayName && (
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {security.googleAccount.displayName}
                      </p>
                    )}
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {security.googleAccount.email}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--success)]">
                    <Check size={15} aria-hidden="true" />
                    Đã liên kết
                  </span>
                </div>
              )}

              <div className="grid gap-3 min-[761px]:grid-cols-[minmax(0,1fr)_auto] min-[761px]:items-end">
                <Input
                  label="Mật khẩu Felix để xác nhận"
                  name="googlePassword"
                  type="password"
                  autoComplete="current-password"
                  value={googlePassword}
                  onChange={(event) => setGooglePassword(event.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || !googlePassword}
                    onClick={() =>
                      connectGoogle(security.googleAccount ? "replace" : "link")
                    }
                  >
                    {security.googleAccount ? (
                      <RefreshCw aria-hidden="true" />
                    ) : (
                      <Link2 aria-hidden="true" />
                    )}
                    {security.googleAccount ? "Đổi Google" : "Liên kết Google"}
                  </Button>
                  {security.googleAccount && (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pending || !googlePassword}
                      onClick={unlinkGoogle}
                    >
                      <Unlink aria-hidden="true" />
                      Gỡ liên kết
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Google đang là phương thức đăng nhập duy nhất. Hãy xác minh lại
                để tạo mật khẩu Felix.
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={createPasswordWithGoogle}
                className="justify-self-start"
              >
                <ShieldCheck aria-hidden="true" />
                Xác minh Google và tạo mật khẩu
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {security?.hasPassword !== false && (
        <form ref={formRef} onSubmit={handleSubmit} aria-busy={pending}>
          <Card size="sm" className="max-[760px]:p-4">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"
                  aria-hidden="true"
                >
                  <KeyRound size={17} />
                </span>
                <div className="min-w-0">
                  <CardTitle>Mật khẩu Felix</CardTitle>
                  <CardDescription className="mt-1 max-w-[32rem] leading-5">
                    Dùng mật khẩu riêng, dài và khó đoán để bảo vệ tài khoản.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 min-[761px]:grid-cols-2">
              <div className="min-[761px]:col-span-2">
                <Input
                  label="Mật khẩu hiện tại"
                  id="currentPassword"
                  required
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu hiện tại"
                  className="pr-10"
                  endAdornment={passwordToggle(
                    showCurrent,
                    () => setShowCurrent((value) => !value),
                    "mật khẩu hiện tại",
                  )}
                />
              </div>

              <div className="min-w-0">
                <Input
                  label="Mật khẩu mới"
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

                <div className="mt-2 space-y-1.5" aria-live="polite">
                  <div className="flex h-1 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                    <div
                      className={`h-full transition-[width] duration-200 motion-reduce:transition-none ${strength.color}`}
                      style={{ width: `${(strength.score / 3) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Ít nhất 8 ký tự</span>
                    {strength.label && (
                      <span className="font-medium text-[var(--text-secondary)]">
                        {strength.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <Input
                  label="Xác nhận mật khẩu mới"
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
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  Không dùng lại mật khẩu của tài khoản khác.
                </p>
              </div>
            </CardContent>

            <CardFooter className="justify-end">
              <Button
                disabled={pending || !newPassword || !confirmPassword}
                type="submit"
                variant="default"
                className="w-full min-[761px]:w-auto"
              >
                <ShieldCheck aria-hidden="true" />
                {pending ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
