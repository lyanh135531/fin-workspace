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
  "Tạo thông tin đăng nhập",
  "Thiết lập không gian tài chính",
  "Theo dõi dòng tiền đầu tiên",
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
            <small>12 giao dịch đã ghi nhận</small>
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
            <small>{index === 0 ? "Bạn đang ở đây" : "Chỉ mất khoảng một phút"}</small>
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

      <Link className="auth-visual-brand" href="/" aria-label="Felice — Trang chủ">
        <span className="auth-brand-mark">
          <FinLogo size={30} />
        </span>
        <span>
          <strong>Felice</strong>
          <small>Tài chính, cùng một nhịp.</small>
        </span>
      </Link>

      <div className="auth-visual-body">
        <p className="auth-visual-tagline">
          <Sparkles size={14} aria-hidden />
          {isSignIn ? "Một góc nhìn rõ ràng" : "Khởi đầu gọn gàng"}
        </p>
        <h1 className="auth-visual-headline">
          {isSignIn ? (
            <>
              Biết tiền của bạn
              <br />
              đang <em>đi về đâu.</em>
            </>
          ) : (
            <>
              Tài chính sáng rõ,
              <br />
              ngay từ <em>ngày đầu.</em>
            </>
          )}
        </h1>
        <p className="auth-visual-desc">
          {isSignIn
            ? "Theo dõi ví, giao dịch và ngân sách trong một không gian được thiết kế để cả nhóm cùng hiểu."
            : "Tạo tài khoản để gom ví, dòng tiền và cộng tác tài chính về một nơi dễ quản lý."}
        </p>

        {isSignIn ? <SignInSnapshot /> : <RegisterSteps />}
      </div>

      <div className="auth-visual-footer">
        <span>
          <ShieldCheck size={14} aria-hidden />
          Dữ liệu được bảo vệ theo từng không gian
        </span>
        <span>
          <Landmark size={14} aria-hidden />
          Felice
        </span>
      </div>
    </aside>
  );
}
