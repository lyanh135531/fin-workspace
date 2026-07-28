"use client";

import Decimal from "decimal.js";
import { useMemo, useState, type ComponentProps } from "react";
import { Ledger } from "@/app/dashboard/dashboard-actions";
import { DashboardSummaryPanel } from "@/app/dashboard/dashboard-summary-panel";
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

  return <div className="dashboard-workspace-view">
    <div className="dashboard-ledger-column">
      <Card as="section" className="sunrise-card dashboard-ledger-card gap-0 py-0 overflow-hidden">
        <Ledger
          {...ledgerProps}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      </Card>
    </div>
    <DashboardSummaryPanel
      periodLabel={label}
      metrics={[
        { label: "Dòng tiền ròng", value: `${formatAmount(cashflow)} ₫`, note: label, tone: "balance" },
        { label: "Thu nhập", value: `${formatAmount(summary.income)} ₫`, note: label, tone: "income" },
        { label: "Chi tiêu", value: `${formatAmount(summary.expense)} ₫`, note: label, tone: "expense" },
        { label: "Chờ xác nhận", value: `${summary.pending} giao dịch`, note: label, tone: "pending" },
      ]}
      wallets={wallets.map((wallet) => ({ ...wallet, balance: `${formatAmount(wallet.balance)} ₫` }))}
    />
  </div>;
}
