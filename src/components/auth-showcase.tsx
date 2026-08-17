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

const REGISTER_STEPS: readonly string[] = [
  "Tạo tài khoản",
  "Tạo nhóm tài chính",
  "Thêm ví và giao dịch",
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
          8,4%
        </span>
      </div>

      <div className="auth-ledger-chart" aria-hidden>
        {[34, 47, 40, 62, 53, 78, 72, 91].map((height, index) => (
          <i key={`${height}-${index}`} style={{ "--bar-height": `${height}%` } as CSSProperties} />
        ))}
      </div>

      <div className="auth-ledger-list">
        <div>
          <span className="auth-ledger-icon auth-ledger-icon-income">
            <ArrowDownLeft size={15} aria-hidden />
          </span>
          <p>
            <strong>Thu nhập tháng này</strong>
            <small>12 giao dịch</small>
          </p>
          <b>+42.850.000 ₫</b>
        </div>
        <div>
          <span className="auth-ledger-icon">
            <WalletCards size={15} aria-hidden />
          </span>
          <p>
            <strong>Ngân sách còn lại</strong>
            <small>Cập nhật vài giây trước</small>
          </p>
          <b>18.270.000 ₫</b>
        </div>
      </div>
    </div>
  );
}

function RegisterSteps() {
  return (
    <ol className="auth-register-steps">
      {REGISTER_STEPS.map((step, index) => (
        <li key={step}>
          <span>{index + 1}</span>
          <p>
            <strong>{step}</strong>
            <small>{index === 0 ? "Bạn đang ở bước này" : "Thực hiện sau khi đăng ký"}</small>
          </p>
          {index === 0 && <Check size={16} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function AuthShowcase({ mode }: AuthShowcaseProps) {
  const isSignIn = mode === "sign-in";

  return (
    <aside className="auth-visual-panel">
      <div className="auth-grid-pattern" aria-hidden />

      <Link className="auth-visual-brand" href="/" aria-label="Felix — Trang chủ">
        <span className="auth-brand-mark">
          <FinLogo size={30} />
        </span>
        <span>
          <strong>Felix</strong>
          <small>Quản lý thu chi cùng nhau.</small>
        </span>
      </Link>

      <div className="auth-visual-body">
        <p className="auth-visual-tagline">
          <Sparkles size={14} aria-hidden />
          {isSignIn ? "Sổ thu chi của bạn" : "Bắt đầu với hai thông tin"}
        </p>
        <h1 className="auth-visual-headline">
          {isSignIn ? (
            <>
              Biết hôm nay
              <br />
              đã <em>chi những gì.</em>
            </>
          ) : (
            <>
              Đăng ký xong,
              <br />
              tạo nhóm <em>ngay.</em>
            </>
          )}
        </h1>
        <p className="auth-visual-desc">
          {isSignIn
            ? "Số dư, giao dịch và ngân sách của từng nhóm tài chính được cập nhật tại một chỗ."
            : "Sau khi đăng ký, bạn có thể tạo nhóm tài chính, thêm ví và ghi giao dịch đầu tiên."}
        </p>

        {isSignIn ? <SignInSnapshot /> : <RegisterSteps />}
      </div>

      <div className="auth-visual-footer">
        <span>
          <ShieldCheck size={14} aria-hidden />
          Mỗi nhóm có dữ liệu riêng
        </span>
        <span>
          <Landmark size={14} aria-hidden />
          Felix
        </span>
      </div>
    </aside>
  );
}
