"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  User,
} from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useCallback, useId, useState } from "react";

import { registerAccountAction } from "@/app/setup/actions";
import { ThemeToggle } from "@/app/theme-toggle";
import { AuthShowcase } from "@/components/auth-showcase";
import { Button, Card, Input } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

type CompletionState = "idle" | "authenticating" | "manual-sign-in";

async function authenticateRegisteredAccount(
  username: string,
  password: string,
): Promise<boolean> {
  const result = await signIn("credentials", {
    username,
    password,
    redirect: false,
  });

  return result?.ok === true && !result.error;
}

function getStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "" };

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const capped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "",
    1: "Cơ bản",
    2: "Khá",
    3: "Tốt",
    4: "Rất mạnh",
  };

  return { score: capped, label: labels[capped] };
}

export default function SetupPage() {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [completionState, setCompletionState] =
    useState<CompletionState>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState(0);

  const strength = getStrength(password);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const username = String(formData.get("username"));
    const submittedPassword = String(formData.get("password"));

    try {
      const res = await registerAccountAction({
        username,
        password: submittedPassword,
      });

      if (res.ok) {
        setCompletionState("authenticating");

        try {
          const authenticated = await authenticateRegisteredAccount(
            username,
            submittedPassword,
          );

          if (authenticated) {
            window.location.replace("/onboarding");
            return;
          }
        } catch {
          setMessage(
            "Tài khoản đã tạo, nhưng Felix chưa đăng nhập được.",
          );
        }

        setCompletionState("manual-sign-in");
      } else {
        setErrorKey((k) => k + 1);
        setMessage(res.message || "Chưa tạo được tài khoản. Thử lại.");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      }
    } catch {
      setErrorKey((k) => k + 1);
      setMessage("Không kết nối được với máy chủ. Thử lại sau ít phút.");
    } finally {
      setLoading(false);
    }
  }

  const isMinLength = password.length >= 8;
  const hasLettersAndNumbers = /[A-Za-z]/.test(password) && /\d/.test(password);

  return (
    <main className="auth-split-shell auth-mobile-polished-shell">
      <AuthShowcase mode="register" />

      <section className="auth-form-panel" aria-labelledby="register-title">
        <div className="auth-form-toolbar">
          <Link href="/" className="auth-mobile-brand" aria-label="Felix — Trang chủ">
            <FinLogo size={28} />
            <span>Felix</span>
          </Link>
          <ThemeToggle />
        </div>

        <Card className="auth-form-card gap-0 py-0">
          <div className="auth-form-inner">
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">Đăng ký</span>
              <h2 id="register-title" className="auth-form-title">Tạo tài khoản Felix</h2>
              <p className="auth-form-subtitle">
                Chọn tên đăng nhập và mật khẩu để bắt đầu.
              </p>
            </div>

            {completionState !== "idle" && (
              <div
                className="auth-success-banner"
                role="status"
                aria-live="polite"
              >
                <span><CheckCircle2 size={18} aria-hidden /></span>
                <p>
                  <strong>Đã tạo tài khoản.</strong>
                  <small>
                    {completionState === "authenticating"
                      ? "Đang chuyển bạn đến bước tạo nhóm tài chính…"
                      : message ??
                        "Đăng nhập lại để tiếp tục thiết lập."}
                  </small>
                </p>
              </div>
            )}

            {completionState === "manual-sign-in" && (
              <div className="auth-form-actions">
                <Button
                  size="lg"
                  nativeButton={false}
                  render={<Link href="/sign-in" />}
                  className="auth-submit-btn"
                >
                  Đăng nhập
                  <span className="auth-submit-icon" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </Button>
              </div>
            )}

            {completionState === "idle" && (
              <form onSubmit={submit} aria-busy={loading}>
                <div className="auth-fields">
                  <div className="auth-floating-field">
                    <Input
                      label="Tên đăng nhập"
                      id={`${id}-username`}
                      name="username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={80}
                      autoComplete="username"
                      autoFocus
                      placeholder="Tên đăng nhập"
                      aria-invalid={fieldErrors.username ? true : undefined}
                      aria-describedby={fieldErrors.username ? `${id}-username-error` : undefined}
                      className="auth-field-input"
                      controlClassName="auth-field-wrap has-left-icon"
                      startAdornment={<span className="auth-field-left-icon" aria-hidden>
                        <User size={16} strokeWidth={2} />
                      </span>}
                    />
                    {fieldErrors.username && (
                      <p id={`${id}-username-error`} className="auth-field-error" role="alert">
                        {fieldErrors.username}
                      </p>
                    )}
                  </div>

                  <div className="auth-floating-field">
                    <Input
                      label="Mật khẩu"
                      id={`${id}-password`}
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự"
                      aria-invalid={fieldErrors.password ? true : undefined}
                      aria-describedby={fieldErrors.password ? `${id}-password-error` : undefined}
                      className="auth-field-input has-icon"
                      value={password}
                      onChange={handlePasswordChange}
                      controlClassName="auth-field-wrap has-left-icon"
                      startAdornment={<span className="auth-field-left-icon" aria-hidden>
                        <Lock size={16} strokeWidth={2} />
                      </span>}
                      endAdornment={<Button variant="unstyled" size="auto"
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
                    {fieldErrors.password && (
                      <p id={`${id}-password-error`} className="auth-field-error" role="alert">
                        {fieldErrors.password}
                      </p>
                    )}

                    {password.length > 0 && (
                      <div className="auth-minimal-strength">
                        <div className="auth-minimal-bars" role="progressbar" aria-valuenow={strength.score} aria-valuemax={4} aria-label={`Độ mạnh mật khẩu: ${strength.label}`}>
                          {[1, 2, 3, 4].map((barLevel) => (
                            <div
                              key={barLevel}
                              className="auth-minimal-bar"
                              data-active={barLevel <= strength.score}
                              data-score={strength.score}
                            />
                          ))}
                        </div>

                        <div className="auth-minimal-row">
                          <div className="auth-minimal-rules">
                            <span className={`auth-minimal-rule ${isMinLength ? "is-valid" : ""}`}>
                              {isMinLength ? <Check size={11} aria-hidden /> : <i aria-hidden />} 8+ ký tự
                            </span>
                            <span className={`auth-minimal-rule ${hasLettersAndNumbers ? "is-valid" : ""}`}>
                              {hasLettersAndNumbers ? <Check size={11} aria-hidden /> : <i aria-hidden />} Có chữ và số
                            </span>
                          </div>

                          {strength.label && (
                            <span className={`auth-minimal-label score-${strength.score}`}>
                              {strength.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {message && (
                  <div
                    key={errorKey}
                    className="auth-global-error"
                    role="alert"
                  >
                    <AlertCircle size={15} aria-hidden />
                    {message}
                  </div>
                )}

                <div className="auth-form-actions">
                  <Button
                    type="submit"
                    id="setup-submit"
                    size="lg"
                    className={`auth-submit-btn ${loading ? "is-loading" : ""}`}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="btn-spinner" aria-hidden />
                        Đang tạo tài khoản…
                      </>
                    ) : (
                      <>
                        Tạo tài khoản
                        <span className="auth-submit-icon" aria-hidden="true">
                          <ArrowRight size={16} />
                        </span>
                      </>
                    )}
                  </Button>

                  <p className="auth-form-link-row">
                    Đã có tài khoản?{" "}
                    <Link href="/sign-in" className="auth-form-link">
                      Đăng nhập
                    </Link>
                  </p>
                </div>
              </form>
            )}
          </div>
        </Card>
        <p className="auth-legal">
          Sau khi đăng ký, bạn sẽ tạo nhóm tài chính đầu tiên.
        </p>
      </section>
    </main>
  );
}
