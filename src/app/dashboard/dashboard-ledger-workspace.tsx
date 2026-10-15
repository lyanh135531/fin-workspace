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
  const [filterReviewOnly, setFilterReviewOnly] = useState<boolean>(false);
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
    let pending = 0;

    for (const item of filteredRows) {
      if (item.status === "approved") {
        if (item.type === "income") {
          income = income.plus(item.amount);
        } else if (item.type === "expense") {
          expense = expense.plus(item.amount);
        }
      }
      if (item.status === "pending" || item.pendingChangeRequestId !== null) {
        pending += 1;
      }
    }

    return {
      income: income.toString(),
      expense: expense.toString(),
      cashflow: income.minus(expense),
      pending,
    };
  }, [filteredRows]);

  const label = useMemo(() => getFilterPeriodLabel(dateRange), [dateRange]);
  const cashflow = summary.cashflow;

  return (
    <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-3 md:gap-4 lg:h-full lg:min-h-0">
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
                +{formatAmount(summary.income)}{" "}
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
                −{formatAmount(summary.expense)}{" "}
                <span className="text-[0.68rem] font-medium opacity-80">
                  {ledgerProps.currency}
                </span>
              </strong>
            </div>
          </div>
        </div>

        {/* Tablet/Desktop Header & 3-Column Strip (md:+) */}
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
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 font-medium tabular-nums">
              <CalendarDays
                size={13}
                className="shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
              <span className="break-words leading-snug">{label}</span>
            </span>
            {summary.pending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] px-2.5 py-1 font-medium text-[var(--warning)] tabular-nums">
                <CircleAlert size={13} className="shrink-0" aria-hidden="true" />
                <span>{summary.pending} cần duyệt</span>
              </span>
            )}
          </div>
        </div>

        <div className="hidden md:mt-4 md:grid md:grid-cols-3 md:divide-x md:divide-[var(--border)]">
          <div className="min-w-0 md:pr-5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span>Tổng thu</span>
              <ArrowDownLeft
                className="size-3.5 shrink-0 text-[var(--income)]"
                aria-hidden="true"
              />
            </div>
            <strong className="mt-1 block break-words text-xl font-bold leading-snug tracking-tight text-[var(--income)] tabular-nums">
              +{formatAmount(summary.income)}{" "}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </strong>
          </div>

          <div className="min-w-0 md:px-5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span>Tổng chi</span>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-[var(--expense)]"
                aria-hidden="true"
              />
            </div>
            <strong className="mt-1 block break-words text-xl font-bold leading-snug tracking-tight text-[var(--expense)] tabular-nums">
              −{formatAmount(summary.expense)}{" "}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </strong>
          </div>

          <div className="min-w-0 md:pl-5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span>Chênh lệch thu chi</span>
              {cashflow.isNegative() ? (
                <TrendingDown
                  className="size-3.5 shrink-0 text-[var(--expense)]"
                  aria-hidden="true"
                />
              ) : (
                <TrendingUp
                  className="size-3.5 shrink-0 text-[var(--income)]"
                  aria-hidden="true"
                />
              )}
            </div>
            <strong
              className={cn(
                "mt-1 block break-words text-xl font-bold leading-snug tracking-tight tabular-nums",
                cashflow.isNegative()
                  ? "text-[var(--expense)]"
                  : cashflow.gt(0)
                    ? "text-[var(--income)]"
                    : "text-[var(--foreground)]",
              )}
            >
              {cashflow.gt(0) ? "+" : cashflow.isNegative() ? "−" : ""}
              {formatAmount(cashflow.abs())}{" "}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {ledgerProps.currency}
              </span>
            </strong>
          </div>
        </div>
      </Card>

      <Card
        as="section"
        className="flex flex-col gap-0 p-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
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
