"use client";

import {
  Button,
  Card,
  Empty,
  PageContainer,
  PageHeader,
} from "@/components/base";
import Decimal from "decimal.js";
import {
  CircleAlert,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildMonthlyBalances,
  buildMemberMonthlyTotals,
  buildMonthlyCashflow,
  getVisibleCashflowTypes,
  type CashflowRange,
  type CashflowType,
} from "@/app/dashboard/overview/overview-chart-data";
import { OverviewFilters } from "@/app/dashboard/overview/overview-filters";
import type { DateRangeValue } from "@/components/base";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAmount, formatCompactAmount } from "@/lib/format";

type Transaction = {
  id: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  status: "pending" | "scheduled" | "approved" | "rejected";
  description: string | null;
  date: string;
  walletId: string;
  toWalletId: string | null;
  wallet: string;
  categoryId: string | null;
  category: { name: string; color: string } | null;
  memberId: string;
  member: string;
};
type Props = {
  workspace: { id: string; name: string; currency: string };
  reportPeriod: string;
  wallets: { id: string; name: string; balance: string; updatedAt: string }[];
  totalByCurrency: Record<string, string>;
  categories: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    parentId: string | null;
    type: "income" | "expense";
  }[];
  members: { id: string; name: string }[];
  transactions: Transaction[];
};
const money = (value: Decimal.Value, currency: string) =>
  `${formatAmount(value)} ${currency}`;
const monthlyChartConfig = {
  income: { label: "Thu nhập", color: "var(--income)" },
  expense: { label: "Chi tiêu", color: "var(--expense)" },
} satisfies ChartConfig;
const memberChartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];
const memberSeriesKey = (memberId: string) =>
  `member_${memberId.replaceAll("-", "_")}`;
const memberSeriesColor = (index: number) =>
  memberChartColors[index] ??
  `hsl(${Math.round((index * 137.508) % 360)} 58% 52%)`;
const balanceChartConfig = {
  total: { label: "Tổng số dư", color: "var(--primary)" },
} satisfies ChartConfig;

function getTrailingMonthDateRange(
  reportPeriod: string,
  monthCount: CashflowRange = 6,
): DateRangeValue {
  const match = /^(\d{4})-(\d{2})$/.exec(reportPeriod);
  if (!match)
    throw new RangeError(
      `Invalid report period "${reportPeriod}". Expected yyyy-MM.`,
    );

  const year = Number(match[1]);
  const month = Number(match[2]);
  const firstMonth = new Date(Date.UTC(year, month - monthCount, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, "0");
  return {
    from: `${firstMonth.getUTCFullYear()}-${String(firstMonth.getUTCMonth() + 1).padStart(2, "0")}-01`,
    to: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

function isInDateRange(date: string, range: DateRangeValue): boolean {
  const transactionDate = date.slice(0, 10);
  return transactionDate >= range.from && transactionDate <= range.to;
}

function formatDateRangeLabel(dateRange: DateRangeValue): string {
  const formatDate = (value: string): string => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };
  return `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`;
}

export function OverviewDashboard({
  workspace,
  reportPeriod,
  wallets,
  totalByCurrency,
  categories,
  members,
  transactions,
}: Props) {
  const defaultDateRange = getTrailingMonthDateRange(reportPeriod);
  const [walletId, setWalletId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [type, setType] = useState("all");
  const [isMobile, setIsMobile] = useState(false);
  const range: CashflowRange = 6;
  const [dateRange, setDateRange] = useState<DateRangeValue>(defaultDateRange);
  const filtered = transactions.filter(
    (item) =>
      isInDateRange(item.date, dateRange) &&
      (walletId === "all" ||
        item.walletId === walletId ||
        item.toWalletId === walletId) &&
      (categoryId === "all" || item.categoryId === categoryId) &&
      (memberId === "all" || item.memberId === memberId) &&
      (type === "all" || item.type === type),
  );
  const posted = filtered.filter((item) => item.status === "approved");
  const totals = posted.reduce(
    (result, item) => ({
      income:
        item.type === "income"
          ? result.income.plus(item.amount)
          : result.income,
      expense:
        item.type === "expense"
          ? result.expense.plus(item.amount)
          : result.expense,
    }),
    { income: new Decimal(0), expense: new Decimal(0) },
  );
  const expenseByCategory = (() => {
    const rows = new Map<
      string,
      { name: string; color: string; amount: Decimal }
    >();
    posted
      .filter((item) => item.type === "expense")
      .forEach((item) => {
        const key = item.categoryId ?? "uncategorized";
        const prior = rows.get(key);
        rows.set(key, {
          name: item.category?.name ?? "Chưa phân loại",
          color: item.category?.color ?? "var(--chart-7)",
          amount: (prior?.amount ?? new Decimal(0)).plus(item.amount),
        });
      });
    return [...rows.values()].sort((a, b) => b.amount.comparedTo(a.amount));
  })();
  const reset = () => {
    setWalletId("all");
    setCategoryId("all");
    setMemberId("all");
    setType("all");
    setDateRange(defaultDateRange);
  };
  const chartEndPeriod = dateRange.to.slice(0, 7);
  const mobilePeriodLabel = `${mobileMonthLabel(dateRange.from.slice(0, 7))} – ${mobileMonthLabel(dateRange.to.slice(0, 7))}`;
  const balanceLabel =
    Object.entries(totalByCurrency)
      .map(([currency, total]) => money(total, currency))
      .join(" · ") || money(0, workspace.currency);
  const netCashflow = totals.income.minus(totals.expense);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncViewport = (): void => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  if (!isMobile) {
    return (
      <PageContainer size="standard" className="space-y-5 pb-10 pt-2">
        <PageHeader
          title="Tổng quan tài chính"
          description={`${workspace.name} · Thu nhập, chi tiêu và số dư hiện tại.`}
        >
          <OverviewFilters
            wallets={wallets.map(({ id, name }) => ({ id, name }))}
            categories={categories}
            members={members}
            values={{ walletId, categoryId, memberId, type }}
            dateRange={dateRange}
            defaultDateRange={defaultDateRange}
            onWalletChange={setWalletId}
            onCategoryChange={setCategoryId}
            onMemberChange={setMemberId}
            onTypeChange={setType}
            onDateRangeChange={setDateRange}
            onReset={reset}
            isMobile={false}
          />
        </PageHeader>

        <section
          className="grid grid-cols-1 gap-5 lg:grid-cols-12"
          aria-label="Tóm tắt tài chính"
        >
          <Card
            as="article"
            tone="primarySoft"
            className="relative isolate gap-0 lg:col-span-5"
          >
            <span
              className="pointer-events-none absolute -right-8 -top-24 size-44 rounded-full border border-[color-mix(in_srgb,var(--primary)_17%,transparent)]"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute right-3 top-[-3.3rem] size-24 rounded-full border border-[color-mix(in_srgb,var(--primary)_17%,transparent)]"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  Tổng số dư khả dụng
                </p>
                <strong className="mt-3 block text-[clamp(1.7rem,3vw,2.45rem)] font-semibold leading-none tracking-[-0.055em] text-[var(--foreground)] tabular-nums">
                  {balanceLabel}
                </strong>
              </div>
            </div>
            <div className="mt-7 flex items-center justify-between gap-4 border-t border-[color-mix(in_srgb,var(--primary)_15%,var(--border))] pt-4 text-xs">
              <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
                <WalletCards
                  className="size-3.5 text-[var(--info)]"
                  aria-hidden="true"
                />
                {wallets.length} ví đang hoạt động
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${netCashflow.isNegative() ? "text-[var(--expense)]" : "text-[var(--income)]"}`}
              >
                {netCashflow.isNegative() ? (
                  <TrendingDown size={14} aria-hidden="true" />
                ) : (
                  <TrendingUp size={14} aria-hidden="true" />
                )}
                {netCashflow.isNegative() ? "−" : "+"}
                {money(netCashflow.abs(), workspace.currency)} trong kỳ
              </span>
            </div>
          </Card>

          <Card as="article" className="gap-0 lg:col-span-7">
            <header className="flex items-center justify-between gap-4 pb-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Dòng tiền trong kỳ
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Chỉ tính các giao dịch đã ghi nhận
                </p>
              </div>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {formatDateRangeLabel(dateRange)}
              </span>
            </header>
            <dl className="grid grid-cols-3 border-t border-[var(--border)] pt-5 [&>div+div]:border-l [&>div+div]:border-[var(--border)] [&>div+div]:pl-5">
              <SummaryStat
                label="Thu nhập"
                value={money(totals.income, workspace.currency)}
                tone="income"
              />
              <SummaryStat
                label="Chi tiêu"
                value={money(totals.expense, workspace.currency)}
                tone="expense"
              />
              <SummaryStat
                label="Dòng tiền ròng"
                value={money(netCashflow, workspace.currency)}
                tone="primary"
              />
            </dl>
          </Card>
        </section>

        <CashflowOverviewCharts
          members={members}
          transactions={transactions}
          currency={workspace.currency}
          month={chartEndPeriod}
          range={range}
          walletId={walletId}
          categoryId={categoryId}
          memberId={memberId}
          transactionType={type}
          categoryType={
            categories.find((category) => category.id === categoryId)?.type
          }
          dateRange={dateRange}
          isMobile={false}
        />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <BalanceHistoryChart
              wallets={wallets}
              transactions={transactions}
              currency={workspace.currency}
              month={chartEndPeriod}
              range={range}
              walletId={walletId}
              dateRange={dateRange}
              isMobile={false}
            />
          </div>
          <Card as="section" className="gap-0 lg:col-span-4">
            <header className="flex items-start justify-between gap-4 pb-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Chi tiêu theo danh mục
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Tỷ trọng trong kỳ đã chọn
                </p>
              </div>
              <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                {expenseByCategory.length} mục
              </span>
            </header>
            {expenseByCategory.length ? (
              <div className="space-y-4 border-t border-[var(--border)] pt-5">
                {expenseByCategory.slice(0, 6).map((item) => {
                  const percentage = item.amount.div(totals.expense).times(100);
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <i
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: item.color }}
                          />
                          <strong className="truncate font-medium text-[var(--foreground)]">
                            {item.name}
                          </strong>
                        </span>
                        <span className="shrink-0 text-[var(--text-muted)] tabular-nums">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-right text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                        {money(item.amount, workspace.currency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                variant="compact"
                title="Chưa có chi tiêu"
                description="Dữ liệu theo danh mục sẽ xuất hiện tại đây."
              />
            )}
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="overview-shell">
      <PageHeader
        eyebrow={`Nhóm tài chính · ${workspace.name}`}
        title="Tổng quan tài chính"
        description="Theo dõi thu nhập, chi tiêu và số dư tài khoản của cả nhóm."
      />
      <div className="overview-dashboard-stack flex flex-col gap-6">
        <OverviewFilters
          wallets={wallets.map(({ id, name }) => ({ id, name }))}
          categories={categories}
          members={members}
          values={{ walletId, categoryId, memberId, type }}
          dateRange={dateRange}
          defaultDateRange={defaultDateRange}
          onWalletChange={setWalletId}
          onCategoryChange={setCategoryId}
          onMemberChange={setMemberId}
          onTypeChange={setType}
          onDateRangeChange={setDateRange}
          onReset={reset}
          isMobile
        />
        <header className="overview-mobile-dashboard-heading">
          <div>
            <span>Phân tích theo tháng</span>
            <h2>Biến động trong khoảng đã chọn</h2>
          </div>
          <small>{mobilePeriodLabel}</small>
        </header>
        <MobileOverviewHome
          balance={Object.entries(totalByCurrency)
            .map(([currency, total]) => money(total, currency))
            .join(" · ")}
          income={totals.income}
          expense={totals.expense}
          currency={workspace.currency}
          walletCount={wallets.length}
        />
        <div className="overview-kpis gap-6">
          <Metric
            title="Tổng số dư ví"
            value={Object.entries(totalByCurrency)
              .map(([currency, total]) => money(total, currency))
              .join(" · ")}
            note={`${wallets.length} ví đang hoạt động`}
            icon={<WalletCards size={18} />}
            tone="primary"
          />
          <Metric
            title="Thu nhập trong kỳ"
            value={money(totals.income, workspace.currency)}
            note="Chỉ giao dịch đã ghi nhận"
            icon={<TrendingUp size={18} />}
            tone="income"
          />
          <Metric
            title="Chi phí trong kỳ"
            value={money(totals.expense, workspace.currency)}
            note="Chỉ giao dịch đã ghi nhận"
            icon={<TrendingDown size={18} />}
            tone="expense"
          />
          <Metric
            title="Dòng tiền ròng"
            value={money(
              totals.income.minus(totals.expense),
              workspace.currency,
            )}
            note="Thu nhập trừ chi phí"
            icon={<TrendingUp size={18} />}
            tone="primary"
          />
        </div>
        <div className="overview-grid">
          <CashflowOverviewCharts
            members={members}
            transactions={transactions}
            currency={workspace.currency}
            month={chartEndPeriod}
            range={range}
            walletId={walletId}
            categoryId={categoryId}
            memberId={memberId}
            transactionType={type}
            categoryType={
              categories.find((category) => category.id === categoryId)?.type
            }
            dateRange={dateRange}
            isMobile
          />
          <BalanceHistoryChart
            wallets={wallets}
            transactions={transactions}
            currency={workspace.currency}
            month={chartEndPeriod}
            range={range}
            walletId={walletId}
            dateRange={dateRange}
            isMobile
          />
          <div className="overview-detail-grid">
            <Card
              as="section"
              className="overview-card overview-category gap-0 py-0"
            >
              <header>
                <div>
                  <h2>Chi phí theo hạng mục</h2>
                  <p>Phân bổ chi phí đã ghi nhận</p>
                </div>
                <span className="overview-card-count">
                  {expenseByCategory.length}
                </span>
              </header>
              <MobileCategoryPie
                items={expenseByCategory}
                total={totals.expense}
                currency={workspace.currency}
              />
              {expenseByCategory.length ? (
                <div className="category-list">
                  {expenseByCategory.map((item) => {
                    const percentage = item.amount
                      .div(totals.expense)
                      .times(100);
                    return (
                      <div className="category-row" key={item.name}>
                        <span
                          className="category-dot"
                          style={{ background: item.color }}
                        />
                        <div>
                          <span className="category-row-heading">
                            <strong>{item.name}</strong>
                            <b>{percentage.toFixed(0)}%</b>
                          </span>
                          <div className="category-track">
                            <span
                              style={{
                                width: `${percentage}%`,
                                background: item.color,
                              }}
                            />
                          </div>
                          <small>
                            {money(item.amount, workspace.currency)}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  variant="compact"
                  title="Chưa có chi phí đã ghi nhận"
                  description="Dữ liệu phân bổ theo hạng mục sẽ xuất hiện tại đây."
                />
              )}
            </Card>
          </div>
        </div>
        <MobileMonthlyDashboards
          members={members}
          wallets={wallets}
          transactions={transactions}
          currency={workspace.currency}
          month={chartEndPeriod}
          range={range}
          walletId={walletId}
          categoryId={categoryId}
          memberId={memberId}
          transactionType={type}
          dateRange={dateRange}
        />
      </div>
    </PageContainer>
  );
}

function CashflowOverviewCharts({
  members,
  transactions,
  currency,
  month,
  range,
  walletId,
  categoryId,
  memberId,
  transactionType,
  categoryType,
  dateRange,
  isMobile,
}: {
  members: { id: string; name: string }[];
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  memberId: string;
  transactionType: string;
  categoryType?: "income" | "expense";
  dateRange: DateRangeValue;
  isMobile: boolean;
}) {
  const showMemberExpenseChart = members.length > 1;

  return (
    <Card
      as="section"
      className={
        isMobile ? "overview-card overview-flow gap-0 py-0" : "gap-0 p-0"
      }
    >
      <header
        className={
          isMobile
            ? undefined
            : "flex items-start justify-between gap-5 px-6 pb-4 pt-6"
        }
      >
        <div>
          <h2
            className={
              isMobile
                ? undefined
                : "text-base font-semibold text-[var(--foreground)]"
            }
          >
            Thu nhập và chi tiêu theo tháng
          </h2>
          <p
            className={
              isMobile ? undefined : "mt-1 text-xs text-[var(--text-muted)]"
            }
          >
            Giao dịch đã ghi nhận · {formatDateRangeLabel(dateRange)}
          </p>
        </div>
      </header>
      <div
        className={
          isMobile
            ? "overview-flow-layout"
            : showMemberExpenseChart
              ? "grid grid-cols-1 gap-6 border-t border-[var(--border)] px-6 pb-6 pt-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]"
              : "grid grid-cols-1 border-t border-[var(--border)] px-6 pb-6 pt-5"
        }
      >
        <MonthlyFinancialChart
          transactions={transactions}
          currency={currency}
          month={month}
          range={range}
          walletId={walletId}
          categoryId={categoryId}
          memberId={memberId}
          transactionType={transactionType}
          categoryType={categoryType}
          dateRange={dateRange}
          isMobile={isMobile}
        />
        {showMemberExpenseChart && (
          <MemberExpenseChart
            members={members}
            transactions={transactions}
            currency={currency}
            period={month}
            range={range}
            walletId={walletId}
            categoryId={categoryId}
            transactionType={transactionType}
            categoryType={categoryType}
            dateRange={dateRange}
            isMobile={isMobile}
          />
        )}
      </div>
    </Card>
  );
}
function BalanceHistoryChart({
  wallets,
  transactions,
  currency,
  month,
  range,
  walletId,
  dateRange,
  isMobile,
}: {
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
  dateRange: DateRangeValue;
  isMobile: boolean;
}) {
  const visibleWallets =
    walletId === "all"
      ? wallets
      : wallets.filter((wallet) => wallet.id === walletId);
  const balances = buildMonthlyBalances(wallets, transactions, {
    endPeriod: month,
    range,
    walletId,
    dateRange,
  });
  const rows = balances.map((row) => {
    const [year, rowMonth] = row.period.split("-");
    return {
      period: row.period,
      label: `${rowMonth}/${year.slice(2)}`,
      fullLabel: `Tháng ${rowMonth}/${year}`,
      total: new Decimal(row.total).toNumber(),
    };
  });
  const negativeMonthCount = balances.filter(
    (row) => row.hasNegativeBalance,
  ).length;
  return (
    <Card
      as="section"
      className={
        isMobile ? "overview-card overview-balance gap-0 py-0" : "gap-0 p-0"
      }
    >
      <header
        className={
          isMobile
            ? undefined
            : "flex items-start justify-between gap-5 px-6 pb-4 pt-6"
        }
      >
        <div>
          <h2
            className={
              isMobile
                ? undefined
                : "text-sm font-semibold text-[var(--foreground)]"
            }
          >
            Số dư cuối tháng
          </h2>
          <p
            className={
              isMobile
                ? undefined
                : "mt-1 text-xs leading-5 text-[var(--text-muted)]"
            }
          >
            {balances.length} tháng trong khoảng đã chọn · chỉ giao dịch đã ghi
            nhận
          </p>
        </div>
      </header>
      {negativeMonthCount > 0 && (
        <div
          className={
            isMobile
              ? "overview-balance-alert"
              : "px-6 pb-2 text-xs text-[var(--danger)]"
          }
        >
          <span className="overview-chart-warning">
            <CircleAlert size={13} />
            {negativeMonthCount} tháng có số dư âm
          </span>
        </div>
      )}
      {visibleWallets.length ? (
        <ChartContainer
          config={balanceChartConfig}
          className={
            isMobile
              ? "overview-balance-chart"
              : "h-[19rem] w-full border-t border-[var(--border)] px-4 pb-4 pt-5"
          }
          aria-label={`Biểu đồ tổng số dư trong ${balances.length} tháng thuộc khoảng đã chọn`}
        >
          <AreaChart
            data={rows}
            accessibilityLayer
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              width={76}
              tickLine={false}
              tickMargin={6}
              axisLine={false}
              tickFormatter={formatCompactAmount}
            />
            {negativeMonthCount > 0 && (
              <ReferenceLine
                y={0}
                stroke="var(--danger)"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
            )}
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelKey="label"
                  indicator="line"
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? ""
                  }
                  formatter={(value) => (
                    <div className="flex min-w-48 items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Tổng số dư
                      </span>
                      <strong className="tabular-nums text-foreground">
                        {money(String(value), currency)}
                      </strong>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="total"
              type="linear"
              fill="var(--color-total)"
              fillOpacity={0.14}
              stroke="var(--color-total)"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <Empty
          variant="compact"
          icon={WalletCards}
          title="Chưa có ví đang hoạt động"
          description="Tạo hoặc kích hoạt ví để theo dõi lịch sử số dư."
        />
      )}
    </Card>
  );
}
function MonthlyFinancialChart({
  transactions,
  currency,
  month,
  range,
  walletId,
  categoryId,
  memberId,
  transactionType,
  categoryType,
  dateRange,
  isMobile,
}: {
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  memberId: string;
  transactionType: string;
  categoryType?: "income" | "expense";
  dateRange: DateRangeValue;
  isMobile: boolean;
}) {
  const visibleTypes = getVisibleCashflowTypes(transactionType, categoryType);
  const cashflow = buildMonthlyCashflow(transactions, {
    endPeriod: month,
    range,
    walletId,
    categoryId,
    memberId,
    transactionType,
    categoryType,
    dateRange,
  });
  const showComparison = visibleTypes.length === 2;
  const warningCount = showComparison
    ? cashflow.filter((row) => row.hasWarning).length
    : 0;
  const hasData = cashflow.some((row) =>
    visibleTypes.some((visibleType) => !new Decimal(row[visibleType]).isZero()),
  );
  const rows = cashflow.map((item) => {
    const [year, rowMonth] = item.period.split("-");
    return {
      ...item,
      label: `${rowMonth}/${year.slice(2)}`,
      fullLabel: `Tháng ${rowMonth}/${year}`,
      income: new Decimal(item.income).toNumber(),
      expense: new Decimal(item.expense).toNumber(),
    };
  });
  const emptyText =
    transactionType === "transfer"
      ? "Biểu đồ thu và chi không áp dụng cho giao dịch chuyển khoản."
      : visibleTypes.length === 0
        ? "Loại giao dịch không thuộc hạng mục đang chọn."
        : "Chưa có giao dịch đã ghi nhận phù hợp với bộ lọc.";

  return (
    <section
      className={
        isMobile
          ? "overview-flow-primary"
          : "min-w-0 border-b border-[var(--border)] pb-6 xl:border-b-0 xl:pb-0"
      }
      aria-label="Biểu đồ thu nhập và chi tiêu"
    >
      {warningCount > 0 && (
        <div className="overview-flow-alert">
          <span className="overview-chart-warning">
            <CircleAlert size={13} />
            {warningCount} tháng chi vượt thu
          </span>
        </div>
      )}
      {hasData ? (
        <ChartContainer
          config={monthlyChartConfig}
          className={isMobile ? "overview-expense-chart" : "h-[20rem] w-full"}
          aria-label={`Biểu đồ thu nhập và chi tiêu trong ${cashflow.length} tháng thuộc khoảng đã chọn`}
        >
          <LineChart
            data={rows}
            accessibilityLayer
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              width={76}
              tickLine={false}
              tickMargin={6}
              axisLine={false}
              tickFormatter={formatCompactAmount}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelKey="label"
                  indicator="line"
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? ""
                  }
                  formatter={(value, name) => (
                    <div className="flex min-w-48 items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {name === "income" ? "Thu nhập" : "Chi tiêu"}
                      </span>
                      <strong className="tabular-nums text-foreground">
                        {money(String(value), currency)}
                      </strong>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend
              content={<ChartLegendContent className="justify-start pt-3" />}
            />
            {visibleTypes.includes("income") && (
              <Line
                dataKey="income"
                type="linear"
                stroke="var(--color-income)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {visibleTypes.includes("expense") && (
              <Line
                dataKey="expense"
                type="linear"
                stroke="var(--color-expense)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
          </LineChart>
        </ChartContainer>
      ) : (
        <Empty variant="compact" title={emptyText} />
      )}
    </section>
  );
}
function MemberExpenseChart({
  members,
  transactions,
  currency,
  period,
  range,
  walletId,
  categoryId,
  transactionType,
  categoryType,
  dateRange,
  isMobile,
}: {
  members: { id: string; name: string }[];
  transactions: Transaction[];
  currency: string;
  period: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  transactionType: string;
  categoryType?: CashflowType;
  dateRange: DateRangeValue;
  isMobile: boolean;
}) {
  const isTransfer = transactionType === "transfer";
  const metricType: CashflowType =
    transactionType === "income"
      ? "income"
      : transactionType === "expense"
        ? "expense"
        : (categoryType ?? "expense");
  const totals = buildMemberMonthlyTotals(members, transactions, {
    endPeriod: period,
    range,
    walletId,
    categoryId,
    type: metricType,
    dateRange,
  });
  const hasData =
    !isTransfer &&
    totals.some((row) =>
      Object.values(row.totals).some((value) => !new Decimal(value).isZero()),
    );
  const memberSeries = members.map((member, index) => ({
    ...member,
    key: memberSeriesKey(member.id),
    color: memberSeriesColor(index),
  }));
  const rows = totals.map((row) => {
    const [year, rowMonth] = row.period.split("-");
    return {
      period: row.period,
      label: `${rowMonth}/${year.slice(2)}`,
      fullLabel: `Tháng ${rowMonth}/${year}`,
      ...Object.fromEntries(
        memberSeries.map((member) => [
          member.key,
          new Decimal(row.totals[member.id] ?? 0).toNumber(),
        ]),
      ),
    };
  });
  const chartHeight = Math.max(
    260,
    rows.length * Math.max(48, members.length * 20),
  );
  const metricLabel = metricType === "income" ? "Thu nhập" : "Chi tiêu";
  const chartConfig = Object.fromEntries(
    memberSeries.map((member) => [
      member.key,
      { label: member.name, color: member.color },
    ]),
  ) satisfies ChartConfig;

  return (
    <section className={isMobile ? "overview-flow-member" : "min-w-0 pt-0.5"}>
      <header className={isMobile ? undefined : "pb-3"}>
        <div>
          <h3
            className={
              isMobile
                ? undefined
                : "text-sm font-semibold text-[var(--foreground)]"
            }
          >
            {metricLabel} theo thành viên
          </h3>
          <p
            className={
              isMobile
                ? undefined
                : "mt-1 text-[0.68rem] leading-4 text-[var(--text-muted)]"
            }
          >
            {isMobile
              ? "Theo filter Loại giao dịch · màu đại diện cho từng thành viên"
              : "So sánh theo từng thành viên"}
          </p>
        </div>
      </header>
      {hasData ? (
        <div
          className={
            isMobile
              ? "overview-member-chart-scroll"
              : "max-h-[20rem] overflow-y-auto"
          }
        >
          <ChartContainer
            config={chartConfig}
            className={isMobile ? "overview-member-expense-chart" : "w-full"}
            style={{ height: chartHeight }}
            aria-label={`Biểu đồ ${metricLabel.toLocaleLowerCase("vi")} theo tháng của ${members.length} thành viên trong ${totals.length} tháng`}
          >
            <BarChart
              data={rows}
              layout="vertical"
              accessibilityLayer
              barGap={3}
              barCategoryGap="20%"
              margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={52}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelKey="label"
                    hideIndicator
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullLabel ?? ""
                    }
                    formatter={(value, name) => {
                      const series = memberSeries.find(
                        (member) => member.key === name,
                      );
                      return (
                        <div className="flex min-w-48 items-center justify-between gap-4">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <i
                              className="size-2 rounded-[2px]"
                              style={{ background: series?.color }}
                            />
                            {series?.name ?? String(name)}
                          </span>
                          <strong className="tabular-nums text-foreground">
                            {money(String(value), currency)}
                          </strong>
                        </div>
                      );
                    }}
                  />
                }
              />
              <ChartLegend
                content={
                  <ChartLegendContent className="flex-wrap justify-start gap-x-4 gap-y-2 pt-3" />
                }
              />
              {memberSeries.map((member) => (
                <Bar
                  key={member.id}
                  dataKey={member.key}
                  fill={`var(--color-${member.key})`}
                  radius={[0, 5, 5, 0]}
                  maxBarSize={14}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <Empty
          variant="compact"
          title={
            isTransfer
              ? "Không áp dụng cho giao dịch chuyển khoản"
              : `Chưa có ${metricLabel.toLocaleLowerCase("vi")} phù hợp`
          }
          description={
            isTransfer
              ? "Biểu đồ theo thành viên chỉ hiển thị giao dịch thu và chi."
              : "Chưa có dữ liệu đã ghi nhận trong khoảng ngày đã chọn."
          }
        />
      )}
    </section>
  );
}

function MobileOverviewHome({
  balance,
  income,
  expense,
  currency,
  walletCount,
}: {
  balance: string;
  income: Decimal;
  expense: Decimal;
  currency: string;
  walletCount: number;
}) {
  const cashflow = income.minus(expense);
  const positiveCashflow = cashflow.greaterThanOrEqualTo(0);

  return (
    <section
      className="overview-mobile-home"
      aria-label="Tổng quan tài chính trên di động"
    >
      <article className="overview-mobile-balance-hero">
        <header>
          <span>Tổng tài sản</span>
          <small>
            <WalletCards size={13} /> {walletCount} ví
          </small>
        </header>
        <strong className="overview-mobile-balance-value">{balance}</strong>
        <div
          className={`overview-mobile-net ${positiveCashflow ? "positive" : "negative"}`}
        >
          {positiveCashflow ? (
            <TrendingUp size={15} />
          ) : (
            <TrendingDown size={15} />
          )}
          <span>
            {positiveCashflow ? "+" : "−"}
            {money(cashflow.abs(), currency)}
          </span>
          <small>dòng tiền trong kỳ</small>
        </div>
        <dl className="overview-mobile-cashflow-pair">
          <div>
            <dt>
              <i className="income" /> Thu vào
            </dt>
            <dd>{money(income, currency)}</dd>
          </div>
          <div>
            <dt>
              <i className="expense" /> Chi ra
            </dt>
            <dd>{money(expense, currency)}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

function MobileMonthlyDashboards({
  members,
  wallets,
  transactions,
  currency,
  month,
  range,
  walletId,
  categoryId,
  memberId,
  transactionType,
  dateRange,
}: {
  members: { id: string; name: string }[];
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  memberId: string;
  transactionType: string;
  dateRange: DateRangeValue;
}) {
  const showMemberComparison = members.length >= 2;
  const visibleMembers = showMemberComparison
    ? memberId === "all"
      ? members
      : members.filter((member) => member.id === memberId)
    : [];
  const memberMetricType: CashflowType =
    transactionType === "income" ? "income" : "expense";
  const memberTotals = showMemberComparison
    ? buildMemberMonthlyTotals(visibleMembers, transactions, {
        endPeriod: month,
        range,
        walletId,
        categoryId,
        type: memberMetricType,
        dateRange,
      })
    : [];
  const memberSeries = visibleMembers.map((member, index) => ({
    ...member,
    key: memberSeriesKey(member.id),
    color: memberSeriesColor(index),
  }));
  const memberRows = memberTotals.map((row) => ({
    label: mobileMonthLabel(row.period),
    fullLabel: fullMonthLabel(row.period),
    ...Object.fromEntries(
      memberSeries.map((member) => [
        member.key,
        new Decimal(row.totals[member.id] ?? 0).toNumber(),
      ]),
    ),
  }));
  const memberHasData =
    transactionType !== "transfer" &&
    memberTotals.some((row) =>
      Object.values(row.totals).some((value) => !new Decimal(value).isZero()),
    );
  const memberConfig = Object.fromEntries(
    memberSeries.map((member) => [
      member.key,
      { label: member.name, color: member.color },
    ]),
  ) satisfies ChartConfig;

  const balances = buildMonthlyBalances(wallets, transactions, {
    endPeriod: month,
    range,
    walletId,
    dateRange,
  });
  const balanceRows = balances.map((row) => ({
    label: mobileMonthLabel(row.period),
    fullLabel: fullMonthLabel(row.period),
    total: new Decimal(row.total).toNumber(),
  }));
  const balanceHasData =
    (walletId === "all"
      ? wallets
      : wallets.filter((wallet) => wallet.id === walletId)
    ).length > 0;

  const monthlyCashflow = buildMonthlyCashflow(transactions, {
    endPeriod: month,
    range,
    walletId,
    categoryId,
    memberId,
    transactionType,
    dateRange,
  });
  const expenseRows = monthlyCashflow.map((row) => ({
    label: mobileMonthLabel(row.period),
    fullLabel: fullMonthLabel(row.period),
    income: new Decimal(row.income).toNumber(),
    expense: new Decimal(row.expense).toNumber(),
  }));
  const cashflowHasData = monthlyCashflow.some(
    (row) =>
      !new Decimal(row.income).isZero() || !new Decimal(row.expense).isZero(),
  );
  const chartWidth = Math.max(
    320,
    memberRows.length * Math.max(54, memberSeries.length * 24),
  );
  const balanceChartWidth = Math.max(320, balanceRows.length * 54);
  const expenseChartWidth = Math.max(320, expenseRows.length * 54);

  return (
    <section
      className="overview-mobile-monthly-dashboards"
      aria-label="Dashboard theo tháng"
    >
      {showMemberComparison && (
        <article className="overview-mobile-chart-card overview-mobile-member-chart-card">
          <header>
            <div>
              <h3>So sánh thành viên</h3>
              <p>
                {memberMetricType === "income" ? "Thu nhập" : "Chi tiêu"} theo
                từng tháng
              </p>
            </div>
            <span>{visibleMembers.length} người</span>
          </header>
          {memberHasData ? (
            <div className="overview-mobile-chart-scroll">
              <ChartContainer
                config={memberConfig}
                className="overview-mobile-monthly-chart"
                style={{ width: chartWidth, minWidth: "100%" }}
              >
                <BarChart
                  data={memberRows}
                  accessibilityLayer
                  barGap={2}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    minTickGap={0}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelKey="label"
                        hideIndicator
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullLabel ?? ""
                        }
                        formatter={(value, name) => {
                          const series = memberSeries.find(
                            (member) => member.key === name,
                          );
                          return (
                            <div className="flex min-w-44 items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {series?.name ?? String(name)}
                              </span>
                              <strong className="tabular-nums">
                                {money(String(value), currency)}
                              </strong>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  {memberSeries.map((member) => (
                    <Bar
                      key={member.id}
                      dataKey={member.key}
                      fill={`var(--color-${member.key})`}
                      radius={[4, 4, 1, 1]}
                      maxBarSize={15}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          ) : (
            <Empty
              variant="compact"
              title={
                transactionType === "transfer"
                  ? "Không áp dụng cho chuyển khoản"
                  : "Chưa có dữ liệu thành viên"
              }
            />
          )}
          <div className="overview-mobile-member-legend">
            {memberSeries.map((member) => (
              <span key={member.id}>
                <i style={{ background: member.color }} />
                {member.name}
              </span>
            ))}
          </div>
        </article>
      )}

      <article className="overview-mobile-chart-card">
        <header>
          <div>
            <h3>Tổng số dư theo tháng</h3>
            <p>Số dư cuối mỗi tháng trong khoảng lọc</p>
          </div>
          <span>{balances.length} tháng</span>
        </header>
        {balanceHasData ? (
          <div className="overview-mobile-chart-scroll">
            <ChartContainer
              config={balanceChartConfig}
              className="overview-mobile-monthly-chart"
              style={{ width: balanceChartWidth, minWidth: "100%" }}
            >
              <AreaChart
                data={balanceRows}
                accessibilityLayer
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  minTickGap={0}
                  padding={{ left: 18, right: 18 }}
                />
                <YAxis hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelKey="label"
                      indicator="line"
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.fullLabel ?? ""
                      }
                      formatter={(value) => (
                        <div className="flex min-w-44 items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            Tổng số dư
                          </span>
                          <strong className="tabular-nums">
                            {money(String(value), currency)}
                          </strong>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="total"
                  type="monotone"
                  fill="var(--color-total)"
                  fillOpacity={0.12}
                  stroke="var(--color-total)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : (
          <Empty
            variant="compact"
            icon={WalletCards}
            title="Chưa có ví phù hợp"
          />
        )}
      </article>

      <article className="overview-mobile-chart-card">
        <header>
          <div>
            <h3>Thu nhập &amp; chi tiêu theo tháng</h3>
            <p>Thu nhập dạng đường, chi tiêu dạng cột</p>
          </div>
          <span>{monthlyCashflow.length} tháng</span>
        </header>
        {cashflowHasData ? (
          <div className="overview-mobile-chart-scroll">
            <ChartContainer
              config={monthlyChartConfig}
              className="overview-mobile-monthly-chart"
              style={{ width: expenseChartWidth, minWidth: "100%" }}
            >
              <ComposedChart
                data={expenseRows}
                accessibilityLayer
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  minTickGap={0}
                />
                <YAxis hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelKey="label"
                      hideIndicator
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.fullLabel ?? ""
                      }
                      formatter={(value, name) => (
                        <div className="flex min-w-44 items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {name === "income" ? "Thu nhập" : "Chi tiêu"}
                          </span>
                          <strong className="tabular-nums">
                            {money(String(value), currency)}
                          </strong>
                        </div>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={[5, 5, 1, 1]}
                  maxBarSize={28}
                />
                <Line
                  dataKey="income"
                  type="monotone"
                  stroke="var(--color-income)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        ) : (
          <Empty
            variant="compact"
            title="Chưa có thu chi phù hợp"
            description="Thử đổi loại giao dịch hoặc khoảng tháng."
          />
        )}
      </article>
    </section>
  );
}

function mobileMonthLabel(period: string): string {
  const [year, month] = period.split("-");
  return `T${Number(month)}/${year.slice(2)}`;
}

function fullMonthLabel(period: string): string {
  const [year, month] = period.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

function MobileCategoryPie({
  items,
  total,
  currency,
}: {
  items: { name: string; color: string; amount: Decimal }[];
  total: Decimal;
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleItems =
    items.length > 6
      ? [
          ...items.slice(0, 5),
          {
            name: "Khác",
            color: "var(--chart-7)",
            amount: items
              .slice(5)
              .reduce((sum, item) => sum.plus(item.amount), new Decimal(0)),
          },
        ]
      : items;
  const data = visibleItems.map((item) => ({
    name: item.name,
    color: item.color,
    amount: item.amount.toNumber(),
    display: money(item.amount, currency),
    percentage: total.isZero()
      ? "0"
      : item.amount.div(total).times(100).toFixed(0),
  }));
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, data.length - 1));
  const active = data[safeActiveIndex];
  const config = Object.fromEntries(
    data.map((item, index) => [
      `category_${index}`,
      { label: item.name, color: item.color },
    ]),
  ) satisfies ChartConfig;

  if (!data.length) return null;

  return (
    <div className="overview-mobile-category-pie">
      <div className="overview-mobile-category-chart">
        <ChartContainer
          config={config}
          className="overview-mobile-category-donut"
        >
          <PieChart accessibilityLayer>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius={38}
              outerRadius={62}
              paddingAngle={2}
              cornerRadius={4}
              onClick={(_, index) => setActiveIndex(index)}
            >
              {data.map((item, index) => (
                <Cell
                  key={`${item.name}-${index}`}
                  fill={item.color}
                  stroke="var(--surface)"
                  strokeWidth={2.5}
                  opacity={index === safeActiveIndex ? 1 : 0.62}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="overview-mobile-category-center">
          <strong>{active.percentage}%</strong>
          <span>{active.name}</span>
        </div>
      </div>
      <div
        className="overview-mobile-category-labels"
        role="list"
        aria-label="Chi phí theo hạng mục"
      >
        {data.map((item, index) => (
          <Button
            variant="unstyled"
            size="auto"
            type="button"
            role="listitem"
            className={index === safeActiveIndex ? "active" : ""}
            key={`${item.name}-label-${index}`}
            onClick={() => setActiveIndex(index)}
          >
            <i style={{ background: item.color }} />
            <span>
              <strong>{item.name}</strong>
              <small>{item.display}</small>
            </span>
            <b>{item.percentage}%</b>
          </Button>
        ))}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "primary";
}) {
  const toneClasses = {
    income: "text-[var(--income)]",
    expense: "text-[var(--expense)]",
    primary: "text-[var(--foreground)]",
  } satisfies Record<typeof tone, string>;

  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-medium text-[var(--text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-2 truncate text-base font-semibold tracking-[-0.025em] tabular-nums ${toneClasses[tone]}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function Metric({
  title,
  value,
  note,
  icon,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card as="section" className={`overview-metric ${tone} gap-0 py-0`}>
      <span>{icon}</span>
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </Card>
  );
}
