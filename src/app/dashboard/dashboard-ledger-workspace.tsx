"use client";

import { Ledger } from "@/app/dashboard/dashboard-actions";
import {
  getCategoryFilterIds,
  getFilterPeriodLabel,
  getMonthDateRange,
  isDateInRange,
} from "@/app/dashboard/dashboard-ledger-filters";
import type { LedgerPeriodSummary } from "@/app/dashboard/dashboard-summary-data";
import {
  Card,
  type DateRangeValue,
} from "@/components/base";
import { formatAmount } from "@/lib/format";
import { usePrivacyMask } from "@/lib/privacy-mask";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps } from "react";

type LedgerProps = Omit<ComponentProps<typeof Ledger>, "isDesktop">;

export function DashboardLedgerWorkspace({
  ledgerProps,
}: {
  initialMonth: string;
  summaries: LedgerPeriodSummary[];
  ledgerProps: LedgerProps;
}) {
  usePrivacyMask();
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(() =>
    getMonthDateRange(ledgerProps.businessDate),
  );
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterWallet, setFilterWallet] = useState<string>("");
  const [filterReviewOnly, setFilterReviewOnly] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("status") === "pending",
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = (): void => setIsDesktop(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const categoryFilterIds = useMemo(
    () => getCategoryFilterIds(ledgerProps.categories, filterCategory),
    [ledgerProps.categories, filterCategory],
  );

  const filteredRows = useMemo(
    () =>
      ledgerProps.transactions.filter((item) => {
        const itemDate = item.date?.slice(0, 10) || "";
        const needsReview =
          item.status === "pending" || item.pendingChangeRequestId !== null;
        return (
          isDateInRange(itemDate, dateRange) &&
          (filterType === "" || item.type === filterType) &&
          (filterWallet === "" ||
            item.walletId === filterWallet ||
            item.toWalletId === filterWallet) &&
          (!filterReviewOnly || needsReview) &&
          (filterCategory === "" ||
            (item.categoryId !== null &&
              categoryFilterIds.has(item.categoryId))) &&
          `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
        );
      }),
    [
      ledgerProps.transactions,
      dateRange,
      filterType,
      filterWallet,
      filterReviewOnly,
      filterCategory,
      categoryFilterIds,
      query,
    ],
  );

  const summary = useMemo(() => {
    let income = new Decimal(0);
    let expense = new Decimal(0);
    let incomeCount = 0;
    let expenseCount = 0;
    let transferCount = 0;
    let pending = 0;

    for (const item of filteredRows) {
      if (item.status === "approved") {
        if (item.purpose === "credit_card_refund") {
          expense = expense.minus(item.amount);
          expenseCount += 1;
        } else if (item.type === "income") {
          income = income.plus(item.amount);
          incomeCount += 1;
        } else if (item.type === "expense") {
          expense = expense.plus(item.amount);
          expenseCount += 1;
        } else if (item.type === "transfer") {
          transferCount += 1;
        }
      }
      if (item.status === "pending" || item.pendingChangeRequestId !== null) {
        pending += 1;
      }
    }
    const netCashflow = income.minus(expense);
    expense = Decimal.max(new Decimal(0), expense);

    return {
      income: income.toString(),
      expense: expense.toString(),
      incomeDecimal: income,
      expenseDecimal: expense,
      incomeCount,
      expenseCount,
      transferCount,
      cashflow: netCashflow,
      pending,
    };
  }, [filteredRows]);

  const label = useMemo(() => getFilterPeriodLabel(dateRange), [dateRange]);
  const cashflow = summary.cashflow;

  return (
    <div className="flex w-full flex-col gap-3.5 md:gap-4">
      {/* Unified Hero Summary Card */}
      <Card
        as="section"
        className="shrink-0 p-4 md:p-5"
        aria-label="Tổng hợp giao dịch"
      >
        {/* Mobile Hero Section (<768px): Full-width amount so large figures never wrap */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.68rem] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Chênh lệch thu chi
            </span>

            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-[0.7rem] font-medium text-[var(--text-secondary)] transition-colors active:bg-[var(--surface-hover)] tabular-nums"
              title="Chạm để đổi kỳ lọc giao dịch"
            >
              <CalendarDays
                size={12}
                className="shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
              <span>{label}</span>
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <strong
              className={cn(
                "block text-2xl font-bold leading-none tracking-tight tabular-nums",
                cashflow.isNegative()
                  ? "text-[var(--expense)]"
                  : cashflow.gt(0)
                    ? "text-[var(--income)]"
                    : "text-[var(--foreground)]",
              )}
            >
              {cashflow.gt(0) ? "+" : cashflow.isNegative() ? "−" : ""}
              {formatAmount(cashflow.abs())}{" "}
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </strong>

            {summary.pending > 0 && (
              <button
                type="button"
                onClick={() => setFilterReviewOnly((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold transition-colors tabular-nums",
                  filterReviewOnly
                    ? "bg-[var(--warning)] text-[var(--surface)]"
                    : "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
                )}
              >
                <CircleAlert size={11} className="shrink-0" aria-hidden="true" />
                <span>{summary.pending} cần duyệt</span>
              </button>
            )}
          </div>

          {/* Mobile Secondary 2-Column Strip */}
          <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
            <div className="min-w-0">
              <span className="block text-[0.68rem] font-medium text-[var(--text-muted)]">
                Tổng thu
              </span>
              <strong className="mt-0.5 block break-words text-sm font-bold leading-snug text-[var(--income)] tabular-nums">
                {summary.incomeDecimal.gt(0) ? "+" : ""}
                {formatAmount(summary.income)}{" "}
                <span className="text-[0.68rem] font-medium opacity-80">
                  {ledgerProps.currency}
                </span>
              </strong>
            </div>

            <div className="min-w-0 border-l border-[var(--border)] pl-3">
              <span className="block text-[0.68rem] font-medium text-[var(--text-muted)]">
                Tổng chi
              </span>
              <strong className="mt-0.5 block break-words text-sm font-bold leading-snug text-[var(--expense)] tabular-nums">
                {summary.expenseDecimal.gt(0) ? "−" : ""}
                {formatAmount(summary.expense)}{" "}
                <span className="text-[0.68rem] font-medium opacity-80">
                  {ledgerProps.currency}
                </span>
              </strong>
            </div>
          </div>
        </div>

        {/* Tablet/Desktop Header & 3-Column Executive Strip (md:+) */}
        <div className="hidden border-b border-[var(--border)] pb-4 md:flex md:items-center md:justify-between md:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
              Sổ giao dịch
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Theo dõi, tìm kiếm và quản lý toàn bộ khoản thu, chi và chuyển khoản.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] lg:pointer-events-none tabular-nums"
              title="Đổi kỳ lọc giao dịch"
            >
              <CalendarDays
                size={13}
                className="shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
              <span className="break-words leading-snug">{label}</span>
            </button>
            <span className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 font-medium text-[var(--text-secondary)] tabular-nums">
              {filteredRows.length} giao dịch
            </span>
            {summary.pending > 0 && (
              <button
                type="button"
                onClick={() => setFilterReviewOnly((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-colors tabular-nums",
                  filterReviewOnly
                    ? "bg-[var(--warning)] text-[var(--surface)]"
                    : "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)] hover:bg-[color-mix(in_srgb,var(--warning)_18%,var(--surface))]",
                )}
              >
                <CircleAlert size={13} className="shrink-0" aria-hidden="true" />
                <span>{summary.pending} cần duyệt</span>
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:mt-4 md:grid md:grid-cols-3 md:gap-5 md:divide-x md:divide-[var(--border)]">
          {/* Metric 1: Tổng thu */}
          <div className="min-w-0 space-y-1 md:pr-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tổng thu
              </span>
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--income)_12%,var(--surface))] text-[var(--income)]"
                aria-hidden="true"
              >
                <ArrowDownLeft className="size-3.5" />
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <strong className="break-words text-2xl font-bold leading-snug tracking-tight text-[var(--income)] tabular-nums">
                {summary.incomeDecimal.gt(0) ? "+" : ""}
                {formatAmount(summary.income)}
              </strong>
              <span className="shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </div>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              {summary.incomeCount > 0
                ? `${summary.incomeCount} khoản thu đã ghi nhận trong kỳ`
                : "Chưa phát sinh khoản thu trong kỳ đang xem"}
            </p>
          </div>

          {/* Metric 2: Tổng chi */}
          <div className="min-w-0 space-y-1 md:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tổng chi
              </span>
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--expense)_12%,var(--surface))] text-[var(--expense)]"
                aria-hidden="true"
              >
                <ArrowUpRight className="size-3.5" />
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <strong className="break-words text-2xl font-bold leading-snug tracking-tight text-[var(--expense)] tabular-nums">
                {summary.expenseDecimal.gt(0) ? "−" : ""}
                {formatAmount(summary.expense)}
              </strong>
              <span className="shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </div>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              {summary.expenseCount > 0
                ? `${summary.expenseCount} khoản chi tiêu đã ghi nhận trong kỳ`
                : "Chưa phát sinh khoản chi trong kỳ đang xem"}
            </p>
          </div>

          {/* Metric 3: Chênh lệch thu chi */}
          <div className="min-w-0 space-y-1 md:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Chênh lệch thu chi
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  cashflow.isNegative()
                    ? "bg-[color-mix(in_srgb,var(--expense)_12%,var(--surface))] text-[var(--expense)]"
                    : cashflow.gt(0)
                      ? "bg-[color-mix(in_srgb,var(--income)_12%,var(--surface))] text-[var(--income)]"
                      : "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
                )}
              >
                {cashflow.isNegative() ? (
                  <TrendingDown className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingUp className="size-3" aria-hidden="true" />
                )}
                {cashflow.gt(0)
                  ? "Thặng dư"
                  : cashflow.isNegative()
                    ? "Chi vượt thu"
                    : "Cân bằng"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <strong
                className={cn(
                  "break-words text-2xl font-bold leading-snug tracking-tight tabular-nums",
                  cashflow.isNegative()
                    ? "text-[var(--expense)]"
                    : cashflow.gt(0)
                      ? "text-[var(--income)]"
                      : "text-[var(--foreground)]",
                )}
              >
                {cashflow.gt(0) ? "+" : cashflow.isNegative() ? "−" : ""}
                {formatAmount(cashflow.abs())}
              </strong>
              <span className="shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </div>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              {summary.transferCount > 0
                ? `Tổng ${filteredRows.length} giao dịch (gồm ${summary.transferCount} chuyển khoản nội bộ)`
                : `Tổng cộng ${filteredRows.length} giao dịch khớp điều kiện lọc`}
            </p>
          </div>
        </div>
      </Card>

      <Card
        as="section"
        className="flex flex-col gap-0 overflow-hidden p-0"
      >
        <Ledger
          {...ledgerProps}
          isDesktop={isDesktop}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          filterWallet={filterWallet}
          onFilterWalletChange={setFilterWallet}
          filterReviewOnly={filterReviewOnly}
          onFilterReviewOnlyChange={setFilterReviewOnly}
          query={query}
          onQueryChange={setQuery}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterOpenChange={setMobileFilterOpen}
        />
      </Card>
    </div>
  );
}
