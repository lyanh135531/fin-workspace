"use client";

import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useId, useState } from "react";

import { ThemeToggle } from "@/app/theme-toggle";
import { AuthShowcase } from "@/components/auth-showcase";
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Loading,
} from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { getPostSignInPath } from "@/lib/host-routing";

const rememberedUsernameKey = "felix.remembered-username";

type BrowserPasswordCredential = Credential & {
  id: string;
  password: string;
};

type PasswordCredentialConstructor = new (data: {
  id: string;
  name: string;
  password: string;
}) => BrowserPasswordCredential;

type PasswordCredentialWindow = Window & {
  PasswordCredential?: PasswordCredentialConstructor;
};

function isBrowserPasswordCredential(
  credential: Credential | null,
): credential is BrowserPasswordCredential {
  return Boolean(
    credential &&
    "password" in credential &&
    typeof credential.password === "string",
  );
}

async function loadBrowserCredential() {
  const PasswordCredential = (window as PasswordCredentialWindow)
    .PasswordCredential;
  if (!PasswordCredential) return null;

  const credential = await navigator.credentials.get({
    mediation: "optional",
    password: true,
  } as CredentialRequestOptions & { password: true });
  return isBrowserPasswordCredential(credential) ? credential : null;
}

async function storeBrowserCredential(username: string, password: string) {
  const PasswordCredential = (window as PasswordCredentialWindow)
    .PasswordCredential;
  if (!PasswordCredential) return;

  await navigator.credentials.store(
    new PasswordCredential({ id: username, name: username, password }),
  );
}

async function loadRememberedSignIn() {
  const rememberedUsername = window.localStorage.getItem(rememberedUsernameKey);
  const credential = await loadBrowserCredential().catch(() => null);

  return {
    username: credential?.id ?? rememberedUsername ?? "",
    password: credential?.password ?? "",
    rememberMe: Boolean(credential || rememberedUsername),
  };
}

type SignInClientProps = {
  callbackUrl?: string;
  portalMode: boolean;
  googleEnabled: boolean;
  googleError: boolean;
};

export function SignInClient({ callbackUrl, portalMode, googleEnabled, googleError }: SignInClientProps) {
  const id = useId();
  const [error, setError] = useState<string | null>(
    googleError ? "Không đăng nhập được bằng Google. Kiểm tra tài khoản và thử lại." : null,
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState(0); // remount for re-animation

  useEffect(() => {
    let active = true;
    void loadRememberedSignIn()
      .then((remembered) => {
        if (!active || !remembered.rememberMe) return;
        setUsername(remembered.username);
        setPassword(remembered.password);
        setRememberMe(remembered.rememberMe);
      })
      .catch(() => {
        // Browser password managers remain available through autocomplete.
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const submittedUsername = String(formData.get("username"));
    const submittedPassword = String(formData.get("password"));

    try {
      const result = await signIn("credentials", {
        username: submittedUsername,
        password: submittedPassword,
        rememberMe: rememberMe ? "true" : "false",
        redirect: false,
      });

      if (result?.error) {
        setErrorKey((key) => key + 1);
        setError(
          "Không đăng nhập được. Kiểm tra lại tên đăng nhập và mật khẩu.",
        );
        setLoading(false);
        return;
      }

      if (rememberMe) {
        window.localStorage.setItem(rememberedUsernameKey, submittedUsername);
        await storeBrowserCredential(
          submittedUsername,
          submittedPassword,
        ).catch(() => {
          // Login still succeeds when the browser declines credential storage.
        });
      } else {
        window.localStorage.removeItem(rememberedUsernameKey);
      }

      window.location.replace(
        getPostSignInPath(
          window.location.hostname,
          callbackUrl,
          window.location.origin,
        ),
      );
    } catch {
      setErrorKey((key) => key + 1);
      setError("Không kết nối được với máy chủ. Thử lại sau ít phút.");
      setLoading(false);
    }
  }

  return (
    <main className="auth-split-shell auth-mobile-polished-shell">
      <AuthShowcase mode="sign-in" />

      <section className="auth-form-panel" aria-labelledby="sign-in-title">
        <div className="auth-form-toolbar">
          <Link
            href="/"
            className="auth-mobile-brand"
            aria-label="Felix — Trang chủ"
          >
            <FinLogo size={28} />
            <span>Felix</span>
          </Link>
          <ThemeToggle />
        </div>

        <Card className="auth-form-card gap-0 py-0">
          <div className="auth-form-inner">
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">Chào mừng quay lại</span>
              <h2 id="sign-in-title" className="auth-form-title">
                {portalMode ? "Đăng nhập Portal" : "Đăng nhập để tiếp tục"}
              </h2>
              <p className="auth-form-subtitle">
                {portalMode
                  ? "Chỉ tài khoản quản trị hệ thống được phép truy cập"
                  : "Tiếp tục quản lý thu chi và cập nhật biến động"}
              </p>
            </div>

            {googleEnabled && (
              <div className="mb-5">
                <GoogleAuthButton
                  enabled
                  label={portalMode ? "Đăng nhập Portal bằng Google" : "Tiếp tục với Google"}
                  dividerLabel="hoặc dùng mật khẩu"
                />
              </div>
            )}

            <form onSubmit={submit} aria-busy={loading}>
              <div className="auth-fields">
                <div className="auth-floating-field">
                  <Input
                    label="Tên đăng nhập"
                    id={`${id}-username`}
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    autoFocus
                    placeholder="Tên đăng nhập"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-auth-error` : undefined}
                    className="auth-field-input"
                    controlClassName="auth-field-wrap has-left-icon"
                    startAdornment={
                      <span className="auth-field-left-icon" aria-hidden>
                        <User size={16} strokeWidth={2} />
                      </span>
                    }
                  />
                </div>

                <div className="auth-floating-field">
                  <Input
                    label="Mật khẩu"
                    id={`${id}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-auth-error` : undefined}
                    className="auth-field-input has-icon"
                    controlClassName="auth-field-wrap has-left-icon"
                    startAdornment={
                      <span className="auth-field-left-icon" aria-hidden>
                        <Lock size={16} strokeWidth={2} />
                      </span>
                    }
                    endAdornment={
                      <Button
                        variant="unstyled"
                        size="auto"
                        type="button"
                        className="auth-password-toggle"
                        aria-label={
                          showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff size={16} strokeWidth={2} />
                        ) : (
                          <Eye size={16} strokeWidth={2} />
                        )}
                      </Button>
                    }
                  />
                </div>
              </div>

              {error && (
                <div
                  key={errorKey}
                  id={`${id}-auth-error`}
                  className="auth-global-error"
                  role="alert"
                >
                  <AlertCircle size={15} strokeWidth={2} />
                  {error}
                </div>
              )}

              <Label className="mt-4 min-h-11 cursor-pointer gap-2.5 text-sm">
                <Checkbox
                  checked={rememberMe}
                  disabled={loading}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  aria-label="Ghi nhớ tôi trên thiết bị này"
                />
                <span>Ghi nhớ tôi trên thiết bị này</span>
              </Label>

              <div className="auth-form-actions">
                <Button
                  type="submit"
                  id="sign-in-submit"
                  size="lg"
                  className={`auth-submit-btn ${loading ? "is-loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? (
                    <Loading label="Đang đăng nhập..." />
                  ) : (
                    <>
                      Đăng nhập
                      <span className="auth-submit-icon" aria-hidden="true">
                        <ArrowRight size={16} />
                      </span>
                    </>
                  )}
                </Button>

                {!portalMode && (
                  <p className="auth-form-link-row">
                    Chưa dùng Felix?{" "}
                    <Link href="/setup" className="auth-form-link">
                      Đăng ký
                    </Link>
                  </p>
                )}
              </div>
            </form>
          </div>
        </Card>
        <p className="auth-legal">
          {portalMode
            ? "Phiên Portal được tách biệt với phiên đăng nhập ứng dụng."
            : "Dữ liệu của mỗi nhóm tài chính được lưu tách biệt."}{" "}
          <Link href="/privacy">Chính sách bảo mật</Link>{" · "}
          <Link href="/terms">Điều khoản sử dụng</Link>
        </p>
      </section>
    </main>
  );
}
