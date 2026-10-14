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
  PageHeader,
  type DateRangeValue,
} from "@/components/base";
import { formatAmount } from "@/lib/format";
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
      <PageHeader
        className="mb-0 shrink-0 pb-3 md:pb-4"
        title="Sổ giao dịch"
        description="Theo dõi, tìm kiếm và quản lý toàn bộ khoản thu, chi và chuyển khoản."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-medium tabular-nums">
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
      </PageHeader>

      {/* Compact 3-Metric Summary Strip */}
      <section
        className="grid shrink-0 grid-cols-1 gap-2.5 sm:grid-cols-3 md:gap-4"
        aria-label="Tổng hợp giao dịch"
      >
        <Card as="article" size="sm" className="min-w-0 gap-1">
          <div className="flex min-w-0 items-center justify-between gap-1 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Tổng thu</span>
            <ArrowDownLeft
              className="size-3.5 shrink-0 text-[var(--income)]"
              aria-hidden="true"
            />
          </div>
          <strong
            className="block break-words text-base font-bold leading-snug tracking-tight text-[var(--income)] tabular-nums md:text-lg"
            title={`+${formatAmount(summary.income)} ${ledgerProps.currency}`}
          >
            +{formatAmount(summary.income)}{" "}
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {ledgerProps.currency}
            </span>
          </strong>
        </Card>

        <Card as="article" size="sm" className="min-w-0 gap-1">
          <div className="flex min-w-0 items-center justify-between gap-1 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Tổng chi</span>
            <ArrowUpRight
              className="size-3.5 shrink-0 text-[var(--expense)]"
              aria-hidden="true"
            />
          </div>
          <strong
            className="block break-words text-base font-bold leading-snug tracking-tight text-[var(--expense)] tabular-nums md:text-lg"
            title={`−${formatAmount(summary.expense)} ${ledgerProps.currency}`}
          >
            −{formatAmount(summary.expense)}{" "}
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {ledgerProps.currency}
            </span>
          </strong>
        </Card>

        <Card as="article" size="sm" className="min-w-0 gap-1">
          <div className="flex min-w-0 items-center justify-between gap-1 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Chênh lệch thu chi</span>
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
              "block break-words text-base font-bold leading-snug tracking-tight tabular-nums md:text-lg",
              cashflow.isNegative()
                ? "text-[var(--expense)]"
                : cashflow.gt(0)
                  ? "text-[var(--income)]"
                  : "text-[var(--foreground)]",
            )}
            title={`${cashflow.gt(0) ? "+" : cashflow.isNegative() ? "−" : ""}${formatAmount(cashflow.abs())} ${ledgerProps.currency}`}
          >
            {cashflow.gt(0) ? "+" : cashflow.isNegative() ? "−" : ""}
            {formatAmount(cashflow.abs())}{" "}
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {ledgerProps.currency}
            </span>
          </strong>
        </Card>
      </section>

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
