"use client";

import { Ledger } from "@/app/dashboard/dashboard-actions";
import type { LedgerPeriodSummary } from "@/app/dashboard/dashboard-summary-data";
import { Card } from "@/components/base";
import { formatAmount } from "@/lib/format";
import Decimal from "decimal.js";
import { BookOpenText, CalendarDays } from "lucide-react";
import { useMemo, type ComponentProps } from "react";

type LedgerProps = ComponentProps<typeof Ledger>;

function periodLabel(period: string) {
  if (period === "all") return "Tất cả thời gian";
  const [year, month] = period.split("-");
  return `Tháng ${month}/${year}`;
}

export function DashboardLedgerWorkspace({
  initialMonth,
  summaries,
  ledgerProps,
}: {
  initialMonth: string;
  summaries: LedgerPeriodSummary[];
  ledgerProps: LedgerProps;
}) {
  const selectedMonth = initialMonth;
  const summary = useMemo(
    () =>
      summaries.find((item) => item.period === selectedMonth) ?? {
        period: selectedMonth,
        income: "0",
        expense: "0",
        pending: 0,
      },
    [selectedMonth, summaries],
  );
  const label = periodLabel(selectedMonth);
  const cashflow = new Decimal(summary.income).minus(summary.expense);
  const cashflowTone = cashflow.isNegative() ? "negative" : "positive";

  return (
    <div className="ledger-page-shell">
      <header className="ledger-page-hero rounded-xl">
        <div className="ledger-page-intro">
          <div className="ledger-page-kicker">
            <span>
              <BookOpenText size={15} aria-hidden="true" />
            </span>
            Nhật ký dòng tiền
          </div>
          <h1>Sổ giao dịch</h1>
          <p>
            Theo dõi mọi khoản thu, chi và chuyển khoản trong một dòng thời gian
            rõ ràng.
          </p>
        </div>
        <div
          className={`ledger-hero-balance ledger-hero-balance-${cashflowTone}`}
        >
          <div>
            <span>Dòng tiền ròng</span>
            <small>
              <CalendarDays size={13} aria-hidden="true" />
              {label}
            </small>
          </div>
          <strong>
            {cashflow.isPositive() ? "+" : ""}
            {formatAmount(cashflow)} {ledgerProps.currency}
          </strong>
        </div>
      </header>

      <div className="ledger-table-viewport">
        <Card
          as="section"
          className="dashboard-ledger-card ledger-book gap-0 p-0 overflow-hidden"
        >
          <Ledger {...ledgerProps} />
        </Card>
      </div>
    </div>
  );
}
