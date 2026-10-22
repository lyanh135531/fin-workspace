"use client";

import { AlertCircle, ArrowRight, User } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useId, useState } from "react";

import { completeGoogleProfileAction } from "@/app/setup/google/actions";
import { ThemeToggle } from "@/app/theme-toggle";
import { AuthShowcase } from "@/components/auth-showcase";
import { Button, Card, Input, Loading } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

export function GoogleSetupClient({ email }: { email: string }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const username = String(
      new FormData(event.currentTarget).get("username") ?? "",
    );
    const result = await completeGoogleProfileAction({ username });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    const authenticated = await signIn("google-profile-complete", {
      token: result.token,
      redirect: false,
    });
    if (!authenticated?.ok || authenticated.error) {
      setError(
        "Đã lưu tên đăng nhập. Vui lòng đăng nhập lại bằng Google để tiếp tục.",
      );
      setPending(false);
      return;
    }
    window.location.replace("/onboarding");
  }

  return (
    <main
      id="main-content"
      className="auth-split-shell auth-mobile-polished-shell"
    >
      <AuthShowcase mode="register" />

      <section
        className="auth-form-panel"
        aria-labelledby="google-setup-title"
      >
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
              <span className="auth-form-eyebrow">Hoàn tất đăng ký</span>
              <h1 id="google-setup-title" className="auth-form-title">
                Đặt tên đăng nhập của bạn
              </h1>
              <p className="auth-form-subtitle">
                Đã liên kết với tài khoản Google{" "}
                <strong className="break-words font-semibold text-[var(--foreground)]">
                  {email}
                </strong>
                . Hãy chọn tên đăng nhập để hiển thị trong các nhóm tài chính.
              </p>
            </div>

            <form onSubmit={submit} aria-busy={pending}>
              <div className="auth-fields">
                <div className="auth-floating-field">
                  <Input
                    id={`${id}-username`}
                    name="username"
                    label="Tên đăng nhập"
                    required
                    minLength={3}
                    maxLength={80}
                    autoComplete="username"
                    autoFocus
                    placeholder="Ví dụ: minhanh (tối thiểu 3 ký tự)"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="auth-field-input pl-10"
                    controlClassName="auth-field-wrap has-left-icon"
                    startAdornment={
                      <span className="auth-field-left-icon" aria-hidden="true">
                        <User size={16} strokeWidth={2} />
                      </span>
                    }
                  />
                </div>
              </div>

              {error && (
                <div
                  id={`${id}-error`}
                  role="alert"
                  className="auth-global-error"
                >
                  <AlertCircle size={15} strokeWidth={2} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="auth-form-actions">
                <Button
                  type="submit"
                  size="lg"
                  className={`auth-submit-btn ${pending ? "is-loading" : ""}`}
                  disabled={pending}
                >
                  {pending ? (
                    <Loading label="Đang hoàn tất..." />
                  ) : (
                    <>
                      <span>Hoàn tất đăng ký</span>
                      <span className="auth-submit-icon" aria-hidden="true">
                        <ArrowRight size={16} />
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>

        <p className="auth-legal">
          Chỉ còn một bước nữa để bắt đầu quản lý tài chính của bạn.
        </p>
      </section>
    </main>
  );
}
