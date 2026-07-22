"use client";

import { useState, useId, useCallback } from "react";
import { setupInitialAdmin } from "@/app/setup/actions";
import {
  Eye, EyeOff, ShieldCheck, ShieldAlert, Building2, AlertCircle, CheckCircle2, Lock, User, Briefcase, Check,
} from "lucide-react";
import { FinLogo } from "@/components/fin-logo";

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
  "Tạo tài khoản quản trị viên đầu tiên",
  "Đặt tên cho không gian làm việc",
  "Thiết lập mật khẩu bảo mật (≥ 6 ký tự)",
  "Đăng nhập và bắt đầu sử dụng",
];

export default function SetupPage() {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
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

    const formData = new FormData(e.currentTarget);
    try {
      await setupInitialAdmin({
        username: String(formData.get("username")),
        password: String(formData.get("password")),
        workspaceName: String(formData.get("workspaceName")),
      });
      setDone(true);
      setTimeout(() => window.location.assign("/sign-in"), 1800);
    } catch {
      setErrorKey((k) => k + 1);
      setMessage("Không thể khởi tạo hệ thống — thông tin chưa hợp lệ hoặc hệ thống đã được thiết lập.");
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
          <p className="auth-visual-tagline">Thiết lập hệ thống</p>
          <h1 className="auth-visual-headline">
            Chỉ mất<br />
            <em className="auth-headline-accent">vài bước</em><br />
            để bắt đầu.
          </h1>
          <p className="auth-visual-desc">
            Biểu mẫu này chỉ hoạt động một lần duy nhất—khi hệ thống chưa có tài khoản nào.
            Sau khi hoàn tất, bạn sẽ là quản trị viên đầu tiên.
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
          Biểu mẫu này bị vô hiệu hóa sau khi tài khoản đầu tiên được tạo.
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-inner">
            {/* Header */}
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">KHỞI TẠO HỆ THỐNG</span>
              <h2 className="auth-form-title">Tạo quản trị viên</h2>
              <p className="auth-form-subtitle">
                Thiết lập tài khoản quản trị viên đầu tiên và đặt tên cho không gian làm việc của bạn.
              </p>
            </div>

            {/* Success */}
            {done && (
              <div className="auth-success-banner" role="status">
                <CheckCircle2 size={16} strokeWidth={2} />
                Khởi tạo thành công! Đang chuyển hướng đến trang đăng nhập…
              </div>
            )}

            {/* Form */}
            {!done && (
              <form onSubmit={submit}>
                <div className="auth-fields">
                  {/* Username */}
                  <div className="auth-floating-field">
                    <label htmlFor={`${id}-username`}>
                      Tên đăng nhập <span aria-hidden>*</span>
                    </label>
                    <div className="auth-field-wrap has-left-icon">
                      <span className="auth-field-left-icon" aria-hidden>
                        <User size={16} strokeWidth={2} />
                      </span>
                      <input
                        id={`${id}-username`}
                        name="username"
                        type="text"
                        required
                        minLength={3}
                        maxLength={80}
                        autoComplete="username"
                        autoFocus
                        placeholder="Tối thiểu 3 ký tự"
                        className="auth-field-input"
                      />
                    </div>
                  </div>

                  {/* Workspace name */}
                  <div className="auth-floating-field">
                    <label htmlFor={`${id}-workspace`}>
                      Tên workspace <span aria-hidden>*</span>
                    </label>
                    <div className="auth-field-wrap has-left-icon">
                      <span className="auth-field-left-icon" aria-hidden>
                        <Briefcase size={16} strokeWidth={2} />
                      </span>
                      <input
                        id={`${id}-workspace`}
                        name="workspaceName"
                        type="text"
                        required
                        minLength={3}
                        maxLength={120}
                        autoComplete="organization"
                        placeholder="Tên tổ chức hoặc nhóm của bạn"
                        className="auth-field-input"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="auth-floating-field">
                    <label htmlFor={`${id}-password`}>
                      Mật khẩu <span aria-hidden>*</span>
                    </label>
                    <div className="auth-field-wrap has-left-icon">
                      <span className="auth-field-left-icon" aria-hidden>
                        <Lock size={16} strokeWidth={2} />
                      </span>
                      <input
                        id={`${id}-password`}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        maxLength={128}
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        className="auth-field-input has-icon"
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
                        Đang khởi tạo…
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} strokeWidth={2} />
                        Khởi tạo hệ thống
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
