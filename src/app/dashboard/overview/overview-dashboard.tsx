"use client";

import {
  Button,
  Card,
  Empty,
  Tabs,
  TabsList,
  TabsTrigger,
  buttonVariants,
  PageContainer,
  PageHeader,
} from "@/components/base";
import Decimal from "decimal.js";
import {
  CalendarClock,
  CircleAlert,
  Plus,
  Repeat2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
type UpcomingTransaction = {
  id: string;
  source: "scheduled" | "recurring";
  amount: string;
  type: "income" | "expense" | "transfer";
  description: string | null;
  date: string;
  walletId: string;
  wallet: string;
  categoryId: string | null;
  memberId: string;
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
  upcomingTransactions: UpcomingTransaction[];
};
const money = (value: Decimal.Value, currency: string) =>
  `${formatAmount(value)} ${currency}`;
const statusLabel = {
  approved: "Đã ghi nhận",
  pending: "Chờ duyệt",
  scheduled: "Đã lên lịch",
  rejected: "Đã từ chối",
};
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
const walletSeriesKey = (walletId: string) =>
  `wallet_${walletId.replaceAll("-", "_")}`;
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
  upcomingTransactions,
}: Props) {
  const defaultDateRange = getTrailingMonthDateRange(reportPeriod);
  const [walletId, setWalletId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [type, setType] = useState("all");
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
  const upcoming = upcomingTransactions.filter(
    (item) =>
      (walletId === "all" || item.walletId === walletId) &&
      (categoryId === "all" || item.categoryId === categoryId) &&
      (memberId === "all" || item.memberId === memberId) &&
      (type === "all" || item.type === type),
  );
  const reset = () => {
    setWalletId("all");
    setCategoryId("all");
    setMemberId("all");
    setType("all");
    setDateRange(defaultDateRange);
  };
  const chartEndPeriod = dateRange.to.slice(0, 7);

  return (
    <PageContainer className="overview-shell">
      <PageHeader
        eyebrow={`Workspace · ${workspace.name}`}
        title="Tổng quan tài chính"
        description="Theo dõi thu nhập, chi tiêu và số dư tài khoản của toàn bộ workspace."
      >
        <Link
          href={`/workspace/${workspace.id}?action=new-transaction`}
          className={buttonVariants({
            className: "overview-quick-entry-trigger",
          })}
        >
          <Plus size={17} />
          Nhập giao dịch
        </Link>
      </PageHeader>
      <div className="flex flex-col gap-6">
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
        />
        <MobileFinanceDonut
          balance={Object.entries(totalByCurrency)
            .map(([currency, total]) => money(total, currency))
            .join(" · ")}
          income={totals.income}
          expense={totals.expense}
          currency={workspace.currency}
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
          />
          <BalanceHistoryChart
            wallets={wallets}
            transactions={transactions}
            currency={workspace.currency}
            month={chartEndPeriod}
            range={range}
            walletId={walletId}
            dateRange={dateRange}
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
            <Card
              as="section"
              className="overview-card overview-recent gap-0 py-0"
            >
              <header>
                <div>
                  <h2>Giao dịch gần đây</h2>
                  <p>Được sắp xếp theo ngày mới nhất</p>
                </div>
                <Link href={`/workspace/${workspace.id}`}>Xem tất cả</Link>
              </header>
              <div className="recent-table">
                {filtered.slice(0, 6).map((item) => (
                  <article key={item.id}>
                    <div className="recent-copy">
                      <strong title={item.description ?? "Không có nội dung"}>
                        {item.description ?? "Không có nội dung"}
                      </strong>
                      <small>
                        {item.category?.name ?? "Chưa phân loại"} ·{" "}
                        {item.wallet} · {item.member}
                      </small>
                    </div>
                    <b className={`recent-amount ${item.type}`}>
                      {item.type === "income"
                        ? "+"
                        : item.type === "expense"
                          ? "−"
                          : "↔"}
                      {money(item.amount, workspace.currency)}
                    </b>
                    <div className="recent-meta">
                      <time>
                        {new Intl.DateTimeFormat("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                        }).format(new Date(item.date))}
                      </time>
                      <span className={`overview-status ${item.status}`}>
                        {statusLabel[item.status]}
                      </span>
                    </div>
                  </article>
                ))}
                {!filtered.length && (
                  <Empty
                    variant="compact"
                    title="Không có giao dịch phù hợp"
                    description="Thử thay đổi bộ lọc báo cáo."
                  />
                )}
              </div>
            </Card>
            <Card
              as="section"
              className="overview-card overview-operations gap-0 py-0"
            >
              <section className="overview-operation-section overview-upcoming">
                <header>
                  <div>
                    <h2>Giao dịch sắp tới</h2>
                    <p>{upcoming.length} giao dịch trong 30 ngày tới</p>
                  </div>
                  <span className="overview-card-count">{upcoming.length}</span>
                </header>
                <div className="upcoming-list">
                  {upcoming.length ? (
                    upcoming.map((item) => (
                      <UpcomingTransactionRow
                        key={`${item.source}-${item.id}`}
                        item={item}
                        currency={workspace.currency}
                      />
                    ))
                  ) : (
                    <Empty
                      variant="compact"
                      icon={CalendarClock}
                      title="Không có giao dịch sắp tới"
                      description="Các khoản đã lên lịch hoặc định kỳ trong 30 ngày tới sẽ xuất hiện tại đây."
                    />
                  )}
                </div>
              </section>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function UpcomingTransactionRow({
  item,
  currency,
}: {
  item: UpcomingTransaction;
  currency: string;
}) {
  const transactionDate = new Date(item.date);
  const sourceLabel = item.source === "recurring" ? "Định kỳ" : "Đã lên lịch";
  const fallbackDescription =
    item.source === "recurring" ? "Giao dịch định kỳ" : "Giao dịch đã lên lịch";
  const amountPrefix =
    item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔";

  return (
    <article className={item.type}>
      <time className="upcoming-date" dateTime={item.date.slice(0, 10)}>
        <strong>
          {new Intl.DateTimeFormat("vi-VN", { day: "2-digit" }).format(
            transactionDate,
          )}
        </strong>
        <span>
          thg{" "}
          {new Intl.DateTimeFormat("vi-VN", { month: "2-digit" }).format(
            transactionDate,
          )}
        </span>
      </time>
      <div className="upcoming-copy">
        <strong title={item.description ?? undefined}>
          {item.description ?? fallbackDescription}
        </strong>
        <small>
          <WalletCards size={12} aria-hidden="true" />
          <span>{item.wallet}</span>
          <i aria-hidden="true" />
          {item.source === "recurring" ? (
            <Repeat2 size={12} aria-hidden="true" />
          ) : (
            <CalendarClock size={12} aria-hidden="true" />
          )}
          <span>{sourceLabel}</span>
        </small>
      </div>
      <b className="upcoming-amount">
        {amountPrefix}
        {money(item.amount, currency)}
      </b>
    </article>
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
}) {
  return (
    <Card as="section" className="overview-card overview-flow gap-0 py-0">
      <header>
        <div>
          <h2>Thu nhập và chi tiêu theo tháng</h2>
          <p>Giao dịch đã ghi nhận · {formatDateRangeLabel(dateRange)}</p>
        </div>
      </header>
      <div className="overview-flow-layout">
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
        />
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
        />
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
}: {
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
  dateRange: DateRangeValue;
}) {
  const [mode, setMode] = useState<"total" | "wallets">("total");
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
  const walletSeries = visibleWallets.map((wallet, index) => ({
    ...wallet,
    key: walletSeriesKey(wallet.id),
    color: memberSeriesColor(index),
  }));
  const rows = balances.map((row) => {
    const [year, rowMonth] = row.period.split("-");
    return {
      period: row.period,
      label: `${rowMonth}/${year.slice(2)}`,
      fullLabel: `Tháng ${rowMonth}/${year}`,
      total: new Decimal(row.total).toNumber(),
      ...Object.fromEntries(
        walletSeries.map((wallet) => [
          wallet.key,
          new Decimal(row.wallets[wallet.id] ?? 0).toNumber(),
        ]),
      ),
    };
  });
  const negativeMonthCount = balances.filter(
    (row) => row.hasNegativeBalance,
  ).length;
  const walletChartConfig = Object.fromEntries(
    walletSeries.map((wallet) => [
      wallet.key,
      { label: wallet.name, color: wallet.color },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card as="section" className="overview-card overview-balance gap-0 py-0">
      <header>
        <div>
          <h2>Số dư cuối tháng</h2>
          <p>
            {balances.length} tháng trong khoảng đã chọn · chỉ giao dịch đã ghi
            nhận
          </p>
        </div>
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as "total" | "wallets")}
        >
          <TabsList aria-label="Cách hiển thị số dư">
            <TabsTrigger value="total">Tổng số dư</TabsTrigger>
            <TabsTrigger value="wallets">Theo ví</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      {negativeMonthCount > 0 && (
        <div className="overview-balance-alert">
          <span className="overview-chart-warning">
            <CircleAlert size={13} />
            {negativeMonthCount} tháng có số dư âm
          </span>
        </div>
      )}
      {visibleWallets.length ? (
        mode === "total" ? (
          <ChartContainer
            config={balanceChartConfig}
            className="overview-balance-chart"
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
          <ChartContainer
            config={walletChartConfig}
            className="overview-balance-chart"
            aria-label={`Biểu đồ số dư theo ví trong ${balances.length} tháng thuộc khoảng đã chọn`}
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
                    formatter={(value, name) => {
                      const series = walletSeries.find(
                        (wallet) => wallet.key === name,
                      );
                      return (
                        <div className="flex min-w-48 items-center justify-between gap-4">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <i
                              className="size-2 rounded-full"
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
              {walletSeries.map((wallet) => (
                <Line
                  key={wallet.id}
                  dataKey={wallet.key}
                  type="linear"
                  stroke={`var(--color-${wallet.key})`}
                  strokeWidth={2.1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )
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
      className="overview-flow-primary"
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
          className="overview-expense-chart"
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
    <section className="overview-flow-member">
      <header>
        <div>
          <h3>{metricLabel} theo thành viên</h3>
          <p>Theo filter Loại giao dịch · màu đại diện cho từng thành viên</p>
        </div>
      </header>
      {hasData ? (
        <div className="overview-member-chart-scroll">
          <ChartContainer
            config={chartConfig}
            className="overview-member-expense-chart"
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

function MobileFinanceDonut({
  balance,
  income,
  expense,
  currency,
}: {
  balance: string;
  income: Decimal;
  expense: Decimal;
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cashflow = income.minus(expense);
  const data = [
    {
      key: "income",
      name: "Thu nhập",
      amount: income.abs().toNumber(),
      display: money(income, currency),
      color: "var(--income)",
    },
    {
      key: "expense",
      name: "Chi phí",
      amount: expense.abs().toNumber(),
      display: money(expense, currency),
      color: "var(--expense)",
    },
    {
      key: "cashflow",
      name: "Dòng tiền",
      amount: cashflow.abs().toNumber(),
      display: money(cashflow, currency),
      color: "var(--primary)",
    },
  ];
  const active = data[Math.min(activeIndex, data.length - 1)];
  const hasData = data.some((item) => item.amount > 0);
  const config = Object.fromEntries(
    data.map((item) => [item.key, { label: item.name, color: item.color }]),
  ) satisfies ChartConfig;

  return (
    <section
      className="overview-mobile-finance"
      aria-label="Thu nhập, chi phí và dòng tiền trong kỳ"
    >
      <header>
        <div>
          <span>Số dư hiện tại</span>
          <strong>{balance}</strong>
        </div>
        <small>Theo khoảng ngày đã chọn</small>
      </header>
      <div className="overview-mobile-finance-body">
        <div className={`overview-mobile-donut-wrap ${hasData ? "" : "empty"}`}>
          {hasData && (
            <ChartContainer config={config} className="overview-mobile-donut">
              <PieChart accessibilityLayer>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  cornerRadius={5}
                  onClick={(_, index) => setActiveIndex(index)}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.key}
                      fill={item.color}
                      stroke="var(--surface)"
                      strokeWidth={3}
                      opacity={index === activeIndex ? 1 : 0.58}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
          <div className="overview-mobile-donut-center">
            <span>{active.name}</span>
            <strong>{active.display}</strong>
          </div>
        </div>
        <div
          className="overview-mobile-donut-list"
          role="list"
          aria-label="Chọn chỉ số hiển thị"
        >
          {data.map((item, index) => (
            <Button
              variant="unstyled"
              size="auto"
              type="button"
              role="listitem"
              className={index === activeIndex ? "active" : ""}
              key={item.key}
              onClick={() => setActiveIndex(index)}
            >
              <i style={{ background: item.color }} />
              <span>{item.name}</span>
              <strong>{item.display}</strong>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
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
