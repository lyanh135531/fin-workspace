"use client";

import { Ledger } from "@/app/dashboard/dashboard-actions";
import type { LedgerPeriodSummary } from "@/app/dashboard/dashboard-summary-data";
import { Card, DashboardPageSkeleton, PageHeader } from "@/components/base";
import { formatAmount } from "@/lib/format";
import Decimal from "decimal.js";
import { BookOpenText, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps } from "react";

type LedgerProps = Omit<ComponentProps<typeof Ledger>, "isDesktop">;

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
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = (): void => setIsDesktop(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  if (isDesktop) {
    return (
      <div className="mx-auto grid h-full min-h-0 w-full max-w-7xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden px-px py-2">
        <PageHeader
          className="mb-0"
          title="Sổ giao dịch"
          description="Theo dõi, tìm kiếm và quản lý toàn bộ khoản thu, chi và chuyển khoản."
        />

        <Card
          as="section"
          className="gap-0 mb-5"
          aria-label="Tổng hợp giao dịch"
        >
          <dl className="grid grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] items-stretch">
            <div className="pr-6">
              <dt className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <BookOpenText
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Dòng tiền ròng
              </dt>
              <dd
                className={`mt-3 text-2xl font-semibold tracking-[-0.045em] tabular-nums ${cashflow.isNegative() ? "text-[var(--expense)]" : "text-[var(--foreground)]"}`}
              >
                {cashflow.isPositive() ? "+" : ""}
                {formatAmount(cashflow)} {ledgerProps.currency}
              </dd>
              <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-[var(--text-muted)]">
                <CalendarDays size={13} aria-hidden="true" />
                {label}
              </p>
            </div>
            <LedgerSummaryMetric
              label="Thu nhập"
              value={summary.income}
              currency={ledgerProps.currency}
              tone="income"
            />
            <LedgerSummaryMetric
              label="Chi tiêu"
              value={summary.expense}
              currency={ledgerProps.currency}
              tone="expense"
            />
            <div className="border-l border-[var(--border)] pl-6">
              <dt className="text-xs font-medium text-[var(--text-muted)]">
                Chờ duyệt
              </dt>
              <dd className="mt-3 text-xl font-semibold text-[var(--foreground)] tabular-nums">
                {summary.pending}
              </dd>
              <p className="mt-2 text-[0.68rem] text-[var(--text-muted)]">
                giao dịch cần xử lý
              </p>
            </div>
          </dl>
        </Card>

        <Card as="section" className="min-h-0 gap-0 overflow-hidden p-0">
          <Ledger {...ledgerProps} isDesktop />
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="hidden h-full lg:block">
        <DashboardPageSkeleton />
      </div>
      <div className="h-full min-h-0 lg:hidden">
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
              <p>Theo dõi toàn bộ khoản thu, chi và chuyển khoản.</p>
            </div>
            <div
              className={`ledger-hero-balance ledger-hero-balance-${cashflowTone}`}
            >
              <div>
                <span>Dòng tiền ròng</span>
                <small>
                  <CalendarDays size={14} aria-hidden="true" />
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
              <Ledger {...ledgerProps} isDesktop={false} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function LedgerSummaryMetric({
  label,
  value,
  currency,
  tone,
}: {
  label: string;
  value: string;
  currency: string;
  tone: "income" | "expense";
}) {
  return (
    <div className="border-l border-[var(--border)] px-6">
      <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
      <dd
        className={`mt-3 truncate text-xl font-semibold tracking-[-0.025em] tabular-nums ${tone === "income" ? "text-[var(--income)]" : "text-[var(--expense)]"}`}
        title={`${formatAmount(value)} ${currency}`}
      >
        {formatAmount(value)} {currency}
      </dd>
      <p className="mt-2 text-[0.68rem] text-[var(--text-muted)]">
        giao dịch đã ghi nhận
      </p>
    </div>
  );
}
