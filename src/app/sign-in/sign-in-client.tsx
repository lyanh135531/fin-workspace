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
    googleError ? "Không thể đăng nhập bằng Google. Vui lòng thử lại." : null,
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
          "Tên đăng nhập hoặc mật khẩu chưa chính xác.",
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
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau ít phút.");
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
            <FinLogo size={26} />
            <span>Felix</span>
          </Link>
          <ThemeToggle />
        </div>

        <Card className="auth-form-card gap-0 py-0">
          <div className="auth-form-inner">
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">
                {portalMode ? "Quản trị hệ thống" : "Chào mừng bạn quay lại"}
              </span>
              <h2 id="sign-in-title" className="auth-form-title">
                {portalMode ? "Đăng nhập Quản trị" : "Đăng nhập vào Felix"}
              </h2>
              <p className="auth-form-subtitle">
                {portalMode
                  ? "Khu vực dành riêng cho quản trị viên hệ thống."
                  : "Đăng nhập để tiếp tục theo dõi thu chi và tài sản của bạn."}
              </p>
            </div>

            {googleEnabled && (
              <div className="mb-4">
                <GoogleAuthButton
                  enabled
                  label={
                    portalMode
                      ? "Đăng nhập Quản trị bằng Google"
                      : "Tiếp tục với Google"
                  }
                  dividerLabel="hoặc đăng nhập bằng mật khẩu"
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
                    placeholder="Nhập tên đăng nhập của bạn"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-auth-error` : undefined}
                    className="auth-field-input pl-10"
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
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-auth-error` : undefined}
                    className="auth-field-input has-icon pl-10 pr-10"
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
                  <span>{error}</span>
                </div>
              )}

              <Label className="mt-3.5 flex min-h-8 cursor-pointer items-center gap-2.5 text-[13px] font-medium text-[var(--text-secondary)]">
                <Checkbox
                  checked={rememberMe}
                  disabled={loading}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  aria-label="Duy trì đăng nhập trên thiết bị này"
                />
                <span>Duy trì đăng nhập trên thiết bị này</span>
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
                      <span>Đăng nhập</span>
                      <span className="auth-submit-icon" aria-hidden="true">
                        <ArrowRight size={16} />
                      </span>
                    </>
                  )}
                </Button>

                {!portalMode && (
                  <p className="auth-form-link-row">
                    Chưa có tài khoản Felix?{" "}
                    <Link href="/setup" className="auth-form-link">
                      Đăng ký ngay
                    </Link>
                  </p>
                )}
              </div>
            </form>
          </div>
        </Card>
        <p className="auth-legal">
          {portalMode
            ? "Phiên quản trị được bảo mật và tách biệt với ứng dụng."
            : "Dữ liệu tài chính của bạn luôn được bảo mật riêng tư."}{" "}
          <Link href="/privacy">Chính sách bảo mật</Link>{" · "}
          <Link href="/terms">Điều khoản sử dụng</Link>
        </p>
      </section>
    </main>
  );
}
