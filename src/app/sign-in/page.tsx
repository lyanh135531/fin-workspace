"use client";

import { signIn } from "next-auth/react";
import { useState, useId } from "react";
import {
  Eye, EyeOff, ShieldCheck, TrendingUp, Wallet, BarChart3, AlertCircle, User, Lock,
} from "lucide-react";
import { FinLogo } from "@/components/fin-logo";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorKey, setErrorKey] = useState(0); // remount for re-animation

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: String(formData.get("username")),
      password: String(formData.get("password")),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setErrorKey((k) => k + 1);
      setError("Tên đăng nhập hoặc mật khẩu không đúng.");
      return;
    }

    window.location.assign("/overview");
  }

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
          <p className="auth-visual-tagline">Quản lý tài chính thông minh</p>
          <h1 className="auth-visual-headline">
            Kiểm soát<br />
            <em className="auth-headline-accent">mọi dòng tiền</em><br />
            của bạn.
          </h1>
          <p className="auth-visual-desc">
            Nền tảng tập trung cho sổ kế toán, ngân sách, và báo cáo tài chính—
            đủ mạnh cho đội nhóm, đủ đơn giản cho cá nhân.
          </p>

          <div className="auth-visual-features">
            <span className="auth-visual-pill">
              <ShieldCheck size={14} strokeWidth={2} />
              Bảo mật cao cấp
            </span>
            <span className="auth-visual-pill">
              <TrendingUp size={14} strokeWidth={2} />
              Báo cáo thời gian thực
            </span>
            <span className="auth-visual-pill">
              <Wallet size={14} strokeWidth={2} />
              Đa ví, đa tài khoản
            </span>
            <span className="auth-visual-pill">
              <BarChart3 size={14} strokeWidth={2} />
              Phân tích chi tiêu
            </span>
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
              <h2 className="auth-form-title">Chào mừng trở lại</h2>
              <p className="auth-form-subtitle">
                Nhập thông tin tài khoản để tiếp tục vào không gian tài chính của bạn.
              </p>
            </div>

            {/* Form */}
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
                    <input
                      id={`${id}-username`}
                      name="username"
                      type="text"
                      required
                      autoComplete="username"
                      autoFocus
                      placeholder="Nhập tên đăng nhập"
                      className={`auth-field-input${error ? " field-error" : ""}`}
                    />
                  </div>
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
                    <input
                      id={`${id}-password`}
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      className={`auth-field-input has-icon${error ? " field-error" : ""}`}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={0}
                    >
                      {showPassword
                        ? <EyeOff size={16} strokeWidth={2} />
                        : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Global error */}
              {error && (
                <div
                  key={errorKey}
                  className="auth-global-error"
                  role="alert"
                >
                  <AlertCircle size={15} strokeWidth={2} />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="auth-form-actions">
                <button
                  type="submit"
                  id="sign-in-submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading && <span className="btn-spinner" aria-hidden />}
                  {loading ? "Đang xác thực..." : "Đăng nhập"}
                </button>

                <p className="auth-form-link-row">
                  <a href="/setup" className="auth-form-link">
                    Chưa có tài khoản? Đăng ký ngay
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
