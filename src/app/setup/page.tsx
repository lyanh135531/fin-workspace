"use client";

import { useState, useId, useCallback } from "react";
import { registerAccountAction } from "@/app/setup/actions";
import {
  Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, Lock, User, Check,
} from "lucide-react";
import { FinLogo } from "@/components/fin-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ── Password strength ─────────────────────────────────────────── */
type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; cls: string };

function getStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", cls: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const capped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const map: Record<0 | 1 | 2 | 3 | 4, { label: string; cls: string }> = {
    0: { label: "", cls: "" },
    1: { label: "Cơ bản", cls: "strength-weak" },
    2: { label: "Khá", cls: "strength-fair" },
    3: { label: "Tốt", cls: "strength-good" },
    4: { label: "Rất mạnh", cls: "strength-strong" },
  };
  return { score: capped, ...map[capped] };
}

function barClass(barIndex: number, score: number): string {
  if (barIndex >= score) return "";
  if (score <= 1) return "filled";
  if (score === 2) return "filled filled-warn";
  return "filled filled-ok";
}

/* ── Checklist shown on visual panel ──────────────────────────── */
const CHECKLIST = [
  "Tạo tài khoản cá nhân",
  "Thiết lập mật khẩu bảo mật (≥ 6 ký tự)",
  "Đăng nhập và bắt đầu sử dụng",
];

export default function SetupPage() {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
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
    try {
      const res = await registerAccountAction({
        username: String(formData.get("username")),
        password: String(formData.get("password")),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => window.location.assign("/sign-in"), 1800);
      } else {
        setErrorKey((k) => k + 1);
        setMessage(res.message || "Không thể tạo tài khoản.");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      }
    } catch {
      setErrorKey((k) => k + 1);
      setMessage("Không thể kết nối tới máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  const isMinLength = password.length >= 6;
  const hasLettersAndNumbers = /[A-Za-z]/.test(password) && /\d/.test(password);

  return (
    <main className="auth-split-shell">
      {/* ── Left visual panel ── */}
      <div className="auth-visual-panel">
        <div className="auth-visual-orb auth-visual-orb-1" aria-hidden />
        <div className="auth-visual-orb auth-visual-orb-2" aria-hidden />
        <div className="auth-visual-orb auth-visual-orb-3" aria-hidden />

        {/* Brand */}
        <div className="auth-visual-brand">
          <FinLogo size={34} />
          <span className="auth-visual-brand-name">Fin Workspace</span>
        </div>

        {/* Main copy */}
        <div className="auth-visual-body">
          <p className="auth-visual-tagline">Đăng ký tài khoản</p>
          <h1 className="auth-visual-headline">
            Chỉ mất<br />
            <em className="auth-headline-accent">vài bước</em><br />
            để bắt đầu.
          </h1>
          <p className="auth-visual-desc">
            Tạo tài khoản cá nhân của bạn để bắt đầu sử dụng hệ thống.
          </p>

          {/* Checklist */}
          <div className="auth-visual-features" style={{ flexDirection: "column", gap: ".65rem", marginTop: "2rem" }}>
            {CHECKLIST.map((item, i) => (
              <span key={i} className="auth-visual-pill" style={{ borderRadius: ".6rem", backdropFilter: "blur(8px)" }}>
                <CheckCircle2 size={14} strokeWidth={2} />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="auth-visual-footer">
          © {new Date().getFullYear()} Fin Workspace · Mọi quyền được bảo lưu
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-inner">
            {/* Header */}
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">ĐĂNG KÝ TÀI KHOẢN</span>
              <h2 className="auth-form-title">Tạo tài khoản mới</h2>
              <p className="auth-form-subtitle">
                Đăng ký tài khoản cá nhân của bạn.
              </p>
            </div>

            {/* Success */}
            {done && (
              <div className="auth-success-banner" role="status">
                <CheckCircle2 size={16} strokeWidth={2} />
                Đăng ký thành công! Đang chuyển hướng đến trang đăng nhập…
              </div>
            )}

            {/* Form */}
            {!done && (
              <form onSubmit={submit}>
                <div className="auth-fields">
                  {/* Username */}
                  <div className="auth-floating-field">
                    <Label htmlFor={`${id}-username`}>
                      Tên đăng nhập <span aria-hidden>*</span>
                    </Label>
                    <div className="auth-field-wrap has-left-icon">
                      <span className="auth-field-left-icon" aria-hidden>
                        <User size={16} strokeWidth={2} />
                      </span>
                      <Input
                        id={`${id}-username`}
                        name="username"
                        type="text"
                        required
                        minLength={3}
                        maxLength={80}
                        autoComplete="username"
                        autoFocus
                        placeholder="Tối thiểu 3 ký tự"
                        className="auth--input"
                      />
                    </div>
                    {fieldErrors.username && (
                      <p className="text-xs text-rose-500 mt-1" role="alert">{fieldErrors.username}</p>
                    )}
                  </div>


                  {/* Password */}
                  <div className="auth-floating-field">
                    <Label htmlFor={`${id}-password`}>
                      Mật khẩu <span aria-hidden>*</span>
                    </Label>
                    <div className="auth-field-wrap has-left-icon">
                      <span className="auth-field-left-icon" aria-hidden>
                        <Lock size={16} strokeWidth={2} />
                      </span>
                      <Input
                        id={`${id}-password`}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        maxLength={128}
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        className="auth--input has-icon"
                        value={password}
                        onChange={handlePasswordChange}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword
                          ? <EyeOff size={16} strokeWidth={2} />
                          : <Eye size={16} strokeWidth={2} />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-xs text-rose-500 mt-1" role="alert">{fieldErrors.password}</p>
                    )}

                    {/* Ultra-Minimalist Password Strength Indicator */}
                    {password.length > 0 && (
                      <div className="auth-minimal-strength">
                        <div className="auth-minimal-bars" role="progressbar" aria-valuenow={strength.score} aria-valuemax={4} aria-label={`Độ mạnh mật khẩu: ${strength.label}`}>
                          {[1, 2, 3, 4].map((barLevel) => (
                            <div
                              key={barLevel}
                              className={`auth-minimal-bar ${barLevel <= strength.score ? `active-${strength.score}` : ""}`}
                            />
                          ))}
                        </div>

                        <div className="auth-minimal-row">
                          <div className="auth-minimal-rules">
                            <span className={`auth-minimal-rule ${isMinLength ? "is-valid" : ""}`}>
                              {isMinLength ? <Check size={11} strokeWidth={2.5} /> : "•"} 6+ ký tự
                            </span>
                            <span className={`auth-minimal-rule ${hasLettersAndNumbers ? "is-valid" : ""}`}>
                              {hasLettersAndNumbers ? <Check size={11} strokeWidth={2.5} /> : "•"} Chữ & Số
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

                {/* Global error */}
                {message && (
                  <div
                    key={errorKey}
                    className="auth-global-error"
                    role="alert"
                    style={{ marginTop: "1rem" }}
                  >
                    <AlertCircle size={15} strokeWidth={2} />
                    {message}
                  </div>
                )}

                {/* Actions */}
                <div className="auth-form-actions">
                  <button
                    type="submit"
                    id="setup-submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="btn-spinner" aria-hidden />
                        Đang đăng ký…
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} strokeWidth={2} />
                        Đăng ký
                      </>
                    )}
                  </button>

                  <p className="auth-form-link-row">
                    Đã có tài khoản?{" "}
                    <a href="/sign-in" className="auth-form-link">
                      Đăng nhập
                    </a>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
