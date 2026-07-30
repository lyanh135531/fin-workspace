"use client";

import Decimal from "decimal.js";
import { ArrowDownLeft, ArrowUpRight, BookOpenText, CalendarDays, Clock3, WalletMinimal } from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";
import { Ledger } from "@/app/dashboard/dashboard-actions";
import type { LedgerPeriodSummary } from "@/app/dashboard/dashboard-summary-data";
import { Card } from "@/components/base";
import { formatAmount } from "@/lib/format";

type LedgerProps = Omit<ComponentProps<typeof Ledger>, "selectedMonth" | "onMonthChange">;

function periodLabel(period: string) {
  if (period === "all") return "Tất cả thời gian";
  const [year, month] = period.split("-");
  return `Tháng ${month}/${year}`;
}

export function DashboardLedgerWorkspace({
  initialMonth,
  summaries,
  wallets,
  ledgerProps,
}: {
  initialMonth: string;
  summaries: LedgerPeriodSummary[];
  wallets: Array<{ id: string; name: string; balance: string }>;
  ledgerProps: LedgerProps;
}) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const summary = useMemo(
    () => summaries.find((item) => item.period === selectedMonth)
      ?? { period: selectedMonth, income: "0", expense: "0", pending: 0 },
    [selectedMonth, summaries],
  );
  const label = periodLabel(selectedMonth);
  const cashflow = new Decimal(summary.income).minus(summary.expense);
  const cashflowTone = cashflow.isNegative() ? "negative" : "positive";

  return (
    <div className="ledger-page-shell">
      <header className="ledger-page-hero">
        <div className="ledger-page-intro">
          <div className="ledger-page-kicker">
            <span><BookOpenText size={15} aria-hidden="true" /></span>
            Nhật ký dòng tiền
          </div>
          <h1>Sổ giao dịch</h1>
          <p>Theo dõi mọi khoản thu, chi và chuyển khoản trong một dòng thời gian rõ ràng.</p>
        </div>
        <div className={`ledger-hero-balance ledger-hero-balance-${cashflowTone}`}>
          <div>
            <span>Dòng tiền ròng</span>
            <small><CalendarDays size={13} aria-hidden="true" />{label}</small>
          </div>
          <strong>{cashflow.isPositive() ? "+" : ""}{formatAmount(cashflow)} ₫</strong>
        </div>
      </header>

      <section className="ledger-kpi-strip" aria-label={`Tóm tắt tài chính ${label}`}>
        <article className="ledger-kpi ledger-kpi-income">
          <span className="ledger-kpi-icon"><ArrowDownLeft size={17} aria-hidden="true" /></span>
          <div><small>Thu nhập</small><strong>+{formatAmount(summary.income)} ₫</strong></div>
          <span className="ledger-kpi-period">{label}</span>
        </article>
        <article className="ledger-kpi ledger-kpi-expense">
          <span className="ledger-kpi-icon"><ArrowUpRight size={17} aria-hidden="true" /></span>
          <div><small>Chi tiêu</small><strong>−{formatAmount(summary.expense)} ₫</strong></div>
          <span className="ledger-kpi-period">{label}</span>
        </article>
        <article className="ledger-kpi ledger-kpi-pending">
          <span className="ledger-kpi-icon"><Clock3 size={17} aria-hidden="true" /></span>
          <div><small>Chờ xác nhận</small><strong>{summary.pending} giao dịch</strong></div>
          <span className="ledger-kpi-period">Cần xử lý</span>
        </article>
        <article className="ledger-kpi ledger-kpi-wallets">
          <span className="ledger-kpi-icon"><WalletMinimal size={17} aria-hidden="true" /></span>
          <div><small>Ví hoạt động</small><strong>{wallets.length} ví</strong></div>
          <span className="ledger-kpi-period">Đang kết nối</span>
        </article>
      </section>

      <div className="ledger-table-viewport">
        <Card as="section" className="dashboard-ledger-card ledger-book gap-0 py-0 overflow-hidden">
          <Ledger
            {...ledgerProps}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </Card>
      </div>
    </div>
  );
}
