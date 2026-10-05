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
  DashboardPageSkeleton,
  PageHeader,
  type DateRangeValue,
} from "@/components/base";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";
import { BookOpenText, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps } from "react";

type LedgerProps = Omit<ComponentProps<typeof Ledger>, "isDesktop">;

export function DashboardLedgerWorkspace({
  initialMonth: _initialMonth,
  summaries: _summaries,
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
        return (
          isDateInRange(itemDate, dateRange) &&
          (filterCategory === "" ||
            (item.categoryId !== null &&
              categoryFilterIds.has(item.categoryId))) &&
          `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
        );
      }),
    [ledgerProps.transactions, dateRange, filterCategory, categoryFilterIds, query],
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
      if (item.status === "pending") {
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
  const filterCategoryName = useMemo(() => {
    if (!filterCategory) return "";
    const cat = ledgerProps.categories.find((c) => c.id === filterCategory);
    return cat?.name || "";
  }, [ledgerProps.categories, filterCategory]);

  if (isDesktop) {
    return (
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[76rem] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden px-px py-2">
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
                {cashflow.gt(0) ? "+" : ""}
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
          <Ledger
            {...ledgerProps}
            isDesktop
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            filterCategory={filterCategory}
            onFilterCategoryChange={setFilterCategory}
            query={query}
            onQueryChange={setQuery}
            mobileFilterOpen={mobileFilterOpen}
            onMobileFilterOpenChange={setMobileFilterOpen}
          />
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
          <Card
            as="section"
            size="sm"
            className="gap-0 p-3 shrink-0"
            aria-label="Tổng hợp dòng tiền"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <BookOpenText
                    className="size-3.5 text-[var(--primary)] shrink-0"
                    aria-hidden="true"
                  />
                  <span>Dòng tiền ròng</span>
                </div>
                <p className="mt-0.5 text-[0.72rem] text-[var(--text-muted)] truncate">
                  {label}
                  {filterCategoryName ? ` · ${filterCategoryName}` : ""}
                  {query.trim() ? ` · "${query.trim()}"` : ""}
                </p>
              </div>

              <div className="text-right shrink-0">
                <strong
                  className={cn(
                    "block text-lg font-bold tracking-tight tabular-nums",
                    cashflow.isNegative()
                      ? "text-[var(--expense)]"
                      : cashflow.gt(0)
                        ? "text-[var(--income)]"
                        : "text-[var(--foreground)]",
                  )}
                >
                  {cashflow.gt(0) ? "+" : ""}
                  {formatAmount(cashflow)}{" "}
                  <span className="text-xs font-semibold text-[var(--text-muted)] tracking-normal">
                    {ledgerProps.currency}
                  </span>
                </strong>
                <span className="text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                  {filteredRows.length} giao dịch
                  {summary.pending > 0 && (
                    <span className="ml-1 text-[var(--warning)] font-medium">
                      ({summary.pending} chờ duyệt)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </Card>

          <div className="ledger-table-viewport px-px">
            <Card
              as="section"
              className="dashboard-ledger-card ledger-book gap-0 p-0 overflow-hidden"
            >
              <Ledger
                {...ledgerProps}
                isDesktop={false}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                filterCategory={filterCategory}
                onFilterCategoryChange={setFilterCategory}
                query={query}
                onQueryChange={setQuery}
                mobileFilterOpen={mobileFilterOpen}
                onMobileFilterOpenChange={setMobileFilterOpen}
              />
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
