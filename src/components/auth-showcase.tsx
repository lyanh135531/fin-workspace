import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Landmark,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { FinLogo } from "@/components/fin-logo";

type AuthShowcaseMode = "sign-in" | "register";

type AuthShowcaseProps = {
  mode: AuthShowcaseMode;
};

const REGISTER_STEPS: ReadonlyArray<{
  title: string;
  desc: string;
}> = [
  {
    title: "Tạo tài khoản cá nhân",
    desc: "Đăng ký nhanh bằng Google hoặc tên đăng nhập và mật khẩu",
  },
  {
    title: "Tạo không gian tài chính",
    desc: "Dùng cho cá nhân, gia đình hoặc nhóm quản lý chung",
  },
  {
    title: "Ghi chép & theo dõi tài sản",
    desc: "Quản lý ví, thẻ tín dụng, sổ tiết kiệm và vàng tích sản",
  },
];

function SignInSnapshot() {
  return (
    <div className="auth-ledger" aria-label="Bản xem trước tổng quan tài chính">
      <div className="auth-ledger-header">
        <div>
          <span>Số dư khả dụng</span>
          <strong>128.460.000 ₫</strong>
        </div>
        <span className="auth-ledger-change">
          <ArrowUpRight size={13} aria-hidden />
          +8,4%
        </span>
      </div>

      <div className="auth-ledger-chart" aria-hidden>
        {[34, 47, 40, 62, 53, 78, 72, 91].map((height, index) => (
          <i
            key={`${height}-${index}`}
            style={{ "--bar-height": `${height}%` } as CSSProperties}
          />
        ))}
      </div>

      <div className="auth-ledger-list">
        <div>
          <span className="auth-ledger-icon auth-ledger-icon-income">
            <ArrowDownLeft size={15} aria-hidden />
          </span>
          <p>
            <strong>Thu nhập tháng này</strong>
            <small>Đã ghi nhận 12 khoản thu</small>
          </p>
          <b className="text-[var(--income)]">+42.850.000 ₫</b>
        </div>
        <div>
          <span className="auth-ledger-icon">
            <WalletCards size={15} aria-hidden />
          </span>
          <p>
            <strong>Ngân sách tháng còn lại</strong>
            <small>Chi tiêu trong hạn mức</small>
          </p>
          <b>18.270.000 ₫</b>
        </div>
      </div>
    </div>
  );
}

function RegisterSteps() {
  return (
    <div className="auth-ledger" aria-label="Các bước bắt đầu sử dụng">
      <div className="auth-ledger-header auth-ledger-header-compact">
        <div>
          <span>Các bước bắt đầu</span>
          <strong className="!text-sm !tracking-tight">
            Thiết lập nhanh trong 3 bước
          </strong>
        </div>
        <span className="auth-ledger-badge">Chỉ 1 phút</span>
      </div>
      <ol className="auth-register-steps">
        {REGISTER_STEPS.map((step, index) => (
          <li key={step.title} data-active={index === 0}>
            <span>{index + 1}</span>
            <p>
              <strong>{step.title}</strong>
              <small>{step.desc}</small>
            </p>
            {index === 0 ? (
              <em className="auth-step-pill">
                <Check size={12} aria-hidden />
                Bước 1
              </em>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AuthShowcase({ mode }: AuthShowcaseProps) {
  const isSignIn = mode === "sign-in";

  return (
    <aside className="auth-visual-panel">
      <div className="auth-grid-pattern" aria-hidden />

      <div className="auth-visual-top">
        <Link
          className="auth-visual-brand"
          href="/"
          aria-label="Felix — Trang chủ"
        >
          <span className="auth-brand-mark">
            <FinLogo size={28} />
          </span>
          <span>
            <strong>Felix</strong>
            <small>Tài chính cá nhân & gia đình</small>
          </span>
        </Link>
        <span className="auth-visual-badge">Tài chính thông minh</span>
      </div>

      <div className="auth-visual-body">
        <p className="auth-visual-tagline">
          <Sparkles size={13} aria-hidden />
          {isSignIn ? "Quản lý tài chính thông minh" : "Bắt đầu thật đơn giản"}
        </p>
        <h1 className="auth-visual-headline">
          {isSignIn ? (
            <>
              Rõ ràng thu chi,
              <br />
              minh bạch <em>ngân sách.</em>
            </>
          ) : (
            <>
              Quản lý dòng tiền,
              <br />
              an tâm <em>tích sản.</em>
            </>
          )}
        </h1>
        <p className="auth-visual-desc">
          {isSignIn
            ? "Ghi chép thu chi, theo dõi thẻ tín dụng, sổ tiết kiệm và vàng tích sản rõ ràng từng ngày tại một nơi duy nhất."
            : "Tạo không gian tài chính cho riêng bạn hoặc cùng gia đình, theo dõi thu chi và mục tiêu tiết kiệm mỗi ngày."}
        </p>

        {isSignIn ? <SignInSnapshot /> : <RegisterSteps />}
      </div>

      <div className="auth-visual-footer">
        <span>
          <ShieldCheck size={14} aria-hidden />
          Dữ liệu được bảo mật và tách biệt an toàn
        </span>
        <span>
          <Landmark size={14} aria-hidden />
          An toàn & Riêng tư
        </span>
      </div>
    </aside>
  );
}
