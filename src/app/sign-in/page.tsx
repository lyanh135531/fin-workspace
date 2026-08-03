"use client";

import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useId, useState } from "react";

import { ThemeToggle } from "@/app/theme-toggle";
import { AuthShowcase } from "@/components/auth-showcase";
import { Button, Card, Input } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

export default function SignInPage() {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorKey, setErrorKey] = useState(0); // remount for re-animation

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await signIn("credentials", {
        username: String(formData.get("username")),
        password: String(formData.get("password")),
        redirect: false,
      });

      if (result?.error) {
        setErrorKey((key) => key + 1);
        setError("Tên đăng nhập hoặc mật khẩu không đúng.");
        return;
      }

      window.location.assign("/overview");
    } catch {
      setErrorKey((key) => key + 1);
      setError("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-split-shell">
      <AuthShowcase mode="sign-in" />

      <section className="auth-form-panel" aria-labelledby="sign-in-title">
        <div className="auth-form-toolbar">
          <Link href="/" className="auth-mobile-brand" aria-label="Felice — Trang chủ">
            <FinLogo size={28} />
            <span>Felice</span>
          </Link>
          <ThemeToggle />
        </div>

        <Card className="auth-form-card gap-0 py-0">
          <div className="auth-form-inner">
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">Đăng nhập</span>
              <h2 id="sign-in-title" className="auth-form-title">Chào mừng bạn trở lại.</h2>
              <p className="auth-form-subtitle">
                Tiếp tục đến không gian tài chính của bạn.
              </p>
            </div>

            <form onSubmit={submit}>
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
                    placeholder="Nhập tên đăng nhập"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-auth-error` : undefined}
                    className="auth-field-input"
                    controlClassName="auth-field-wrap has-left-icon"
                    startAdornment={<span className="auth-field-left-icon" aria-hidden>
                      <User size={16} strokeWidth={2} />
                    </span>}
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
                    placeholder="Nhập mật khẩu của bạn"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-auth-error` : undefined}
                    className="auth-field-input has-icon"
                    controlClassName="auth-field-wrap has-left-icon"
                    startAdornment={<span className="auth-field-left-icon" aria-hidden>
                      <Lock size={16} strokeWidth={2} />
                    </span>}
                    endAdornment={<Button
                      variant="unstyled"
                      size="auto"
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword
                        ? <EyeOff size={16} strokeWidth={2} />
                        : <Eye size={16} strokeWidth={2} />}
                    </Button>}
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

              <div className="auth-form-actions">
                <Button
                  type="submit"
                  id="sign-in-submit"
                  size="lg"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading && <span className="btn-spinner" aria-hidden />}
                  {loading ? "Đang xác thực..." : "Đăng nhập"}
                  {!loading && <ArrowRight size={17} aria-hidden />}
                </Button>

                <p className="auth-form-link-row">
                  Chưa có tài khoản?{" "}
                  <Link href="/setup" className="auth-form-link">Tạo tài khoản</Link>
                </p>
              </div>
            </form>
          </div>
        </Card>
        <p className="auth-legal">
          Khi tiếp tục, bạn đồng ý với các quy định bảo mật của Felice.
        </p>
      </section>
    </main>
  );
}
