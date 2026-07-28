"use client";

import { Button } from "@/components/base";
import Decimal from "decimal.js";
import { CircleAlert, Funnel, RefreshCw, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  buildMonthlyBalances,
  buildMemberMonthlyTotals,
  buildMonthlyCashflow,
  getVisibleCashflowTypes,
  type CashflowRange,
  type CashflowType,
} from "@/app/dashboard/overview/overview-chart-data";
import { FinanceSelect } from "@/components/finance/finance-select";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAmount, formatCompactAmount } from "@/lib/format";
import { QuickTransactionSheet } from "@/app/dashboard/overview/quick-transaction-sheet";

type Transaction = { id: string; amount: string; type: "income" | "expense" | "transfer"; status: "pending" | "scheduled" | "approved" | "rejected"; description: string | null; date: string; walletId: string; toWalletId: string | null; wallet: string; categoryId: string | null; category: { name: string; color: string } | null; memberId: string; member: string };
type QuickWorkspace = {
  id: string;
  name: string;
  currency: string;
  businessDate: string;
  role: string;
  wallets: { id: string; name: string }[];
  categories: { id: string; name: string; type: "income" | "expense" }[];
};
type Props = { workspace: { id: string; name: string; currency: string }; reportPeriod: string; wallets: { id: string; name: string; balance: string; updatedAt: string }[]; totalByCurrency: Record<string, string>; categories: { id: string; name: string; color: string; type: "income" | "expense" }[]; members: { id: string; name: string }[]; transactions: Transaction[]; quickWorkspaces: QuickWorkspace[] };
const money = (value: Decimal.Value, currency: string) => `${formatAmount(value)} ${currency}`;
const statusLabel = { approved: "Đã ghi nhận", pending: "Chờ duyệt", scheduled: "Đã lên lịch", rejected: "Đã từ chối" };
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
const memberSeriesKey = (memberId: string) => `member_${memberId.replaceAll("-", "_")}`;
const walletSeriesKey = (walletId: string) => `wallet_${walletId.replaceAll("-", "_")}`;
const memberSeriesColor = (index: number) => memberChartColors[index] ?? `hsl(${Math.round((index * 137.508) % 360)} 58% 52%)`;
const balanceChartConfig = {
  total: { label: "Tổng số dư", color: "var(--primary)" },
} satisfies ChartConfig;

export function OverviewDashboard({ workspace, reportPeriod, wallets, totalByCurrency, categories, members, transactions, quickWorkspaces }: Props) {
  const [walletId, setWalletId] = useState("all"); const [categoryId, setCategoryId] = useState("all"); const [memberId, setMemberId] = useState("all"); const [type, setType] = useState("all"); const [range, setRange] = useState<CashflowRange>(6);
  const filtered = transactions.filter((item) => item.date.slice(0, 7) === reportPeriod && (walletId === "all" || item.walletId === walletId || item.toWalletId === walletId) && (categoryId === "all" || item.categoryId === categoryId) && (memberId === "all" || item.memberId === memberId) && (type === "all" || item.type === type));
  const posted = filtered.filter((item) => item.status === "approved");
  const totals = posted.reduce((result, item) => ({ income: item.type === "income" ? result.income.plus(item.amount) : result.income, expense: item.type === "expense" ? result.expense.plus(item.amount) : result.expense }), { income: new Decimal(0), expense: new Decimal(0) });
  const expenseByCategory = (() => {
    const rows = new Map<string, { name: string; color: string; amount: Decimal }>();
    posted.filter((item) => item.type === "expense").forEach((item) => { const key = item.categoryId ?? "uncategorized"; const prior = rows.get(key); rows.set(key, { name: item.category?.name ?? "Chưa phân loại", color: item.category?.color ?? "var(--chart-7)", amount: (prior?.amount ?? new Decimal(0)).plus(item.amount) }); });
    return [...rows.values()].sort((a, b) => b.amount.comparedTo(a.amount));
  })();
  const pending = filtered.filter((item) => item.status === "pending");
  const activeFilterCount = [walletId, categoryId, memberId, type].filter((value) => value !== "all").length;
  const reset = () => { setWalletId("all"); setCategoryId("all"); setMemberId("all"); setType("all"); };

  return <div className="overview-shell">
    <div className="overview-title"><div><p>Workspace · {workspace.name}</p><h1>Tổng quan tài chính</h1></div><QuickTransactionSheet initialWorkspaceId={workspace.id} workspaces={quickWorkspaces} triggerMode="overview" /></div>
    <section className="overview-filter-panel" aria-label="Bộ lọc báo cáo">
      <div className="overview-filter-heading"><div className="overview-filter-title"><span><Funnel size={16}/></span><div><strong>Bộ lọc báo cáo</strong><small>{activeFilterCount ? `${activeFilterCount} điều kiện đang áp dụng` : "Đang hiển thị toàn bộ dữ liệu trong tháng"}</small></div></div><Button variant="unstyled" size="auto" type="button" onClick={reset} className="overview-reset" disabled={!activeFilterCount}><RefreshCw size={15}/>Đặt lại</Button></div>
      <div className="overview-mobile-filter-meta"><span>{activeFilterCount ? `${activeFilterCount} bộ lọc` : "Bộ lọc"}</span><Button variant="unstyled" size="auto" type="button" onClick={reset} disabled={!activeFilterCount}>Đặt lại</Button></div>
      <div className="overview-filter-grid">
        <FilterField label="Ví"><FinanceSelect value={walletId} onValueChange={setWalletId} label="Lọc theo ví" contentClassName="overview-minimal-select-content" options={[{ value: "all", label: "Tất cả ví" }, ...wallets.map((item) => ({ value: item.id, label: item.name }))]} /></FilterField>
        <FilterField label="Hạng mục"><FinanceSelect value={categoryId} onValueChange={setCategoryId} label="Lọc theo hạng mục" contentClassName="overview-minimal-select-content" options={[{ value: "all", label: "Tất cả hạng mục" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} /></FilterField>
        <FilterField label="Loại giao dịch"><FinanceSelect value={type} onValueChange={setType} label="Lọc theo loại giao dịch" contentClassName="overview-minimal-select-content" options={[{ value: "all", label: "Tất cả loại" }, { value: "income", label: "Thu nhập" }, { value: "expense", label: "Chi phí" }, { value: "transfer", label: "Chuyển khoản" }]} /></FilterField>
        <FilterField label="Thành viên"><FinanceSelect value={memberId} onValueChange={setMemberId} label="Lọc theo thành viên" contentClassName="overview-minimal-select-content" options={[{ value: "all", label: "Tất cả thành viên" }, ...members.map((item) => ({ value: item.id, label: item.name }))]} /></FilterField>
      </div>
    </section>
    <MobileFinanceDonut
      balance={Object.entries(totalByCurrency).map(([currency, total]) => money(total, currency)).join(" · ")}
      income={totals.income}
      expense={totals.expense}
      currency={workspace.currency}
    />
    <div className="overview-kpis"><Metric title="Tổng số dư ví" value={Object.entries(totalByCurrency).map(([currency, total]) => money(total, currency)).join(" · ")} note={`${wallets.length} ví đang hoạt động`} icon={<WalletCards size={18}/>} tone="primary"/><Metric title="Thu nhập trong kỳ" value={money(totals.income, workspace.currency)} note="Chỉ giao dịch đã ghi nhận" icon={<TrendingUp size={18}/>} tone="income"/><Metric title="Chi phí trong kỳ" value={money(totals.expense, workspace.currency)} note="Chỉ giao dịch đã ghi nhận" icon={<TrendingDown size={18}/>} tone="expense"/><Metric title="Dòng tiền ròng" value={money(totals.income.minus(totals.expense), workspace.currency)} note="Thu nhập trừ chi phí" icon={<TrendingUp size={18}/>} tone="primary"/></div>
    <div className="overview-grid"><CashflowOverviewCharts members={members} transactions={transactions} currency={workspace.currency} month={reportPeriod} range={range} onRangeChange={setRange} walletId={walletId} categoryId={categoryId} memberId={memberId} transactionType={type} categoryType={categories.find((category) => category.id === categoryId)?.type}/>
      <BalanceHistoryChart wallets={wallets} transactions={transactions} currency={workspace.currency} month={reportPeriod} range={range} walletId={walletId}/>
      <div className="overview-detail-grid">
        <section className="overview-card overview-category">
          <header><div><h2>Chi phí theo hạng mục</h2><p>Phân bổ chi phí đã ghi nhận</p></div><span className="overview-card-count">{expenseByCategory.length}</span></header>
          <MobileCategoryPie items={expenseByCategory} total={totals.expense} currency={workspace.currency}/>
          {expenseByCategory.length ? <div className="category-list">{expenseByCategory.map((item) => {
            const percentage = item.amount.div(totals.expense).times(100);
            return <div className="category-row" key={item.name}><span className="category-dot" style={{ background: item.color }}/><div><span className="category-row-heading"><strong>{item.name}</strong><b>{percentage.toFixed(0)}%</b></span><div className="category-track"><span style={{ width: `${percentage}%`, background: item.color }}/></div><small>{formatCompactAmount(item.amount)} {workspace.currency}</small></div></div>;
          })}</div> : <Empty text="Chưa có chi phí đã ghi nhận để phân bổ." />}
        </section>
        <section className="overview-card overview-recent">
          <header><div><h2>Giao dịch gần đây</h2><p>Được sắp xếp theo ngày mới nhất</p></div><a href={`/workspace/${workspace.id}`}>Xem tất cả</a></header>
          <div className="recent-table">{filtered.slice(0, 6).map((item) => <article key={item.id}><div><strong title={item.description ?? "Không có nội dung"}>{item.description ?? "Không có nội dung"}</strong><small>{item.category?.name ?? "Chưa phân loại"} · {item.wallet} · {item.member}</small></div><time>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(item.date))}</time><b className={item.type}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{money(item.amount, workspace.currency)}</b><span className={`overview-status ${item.status}`}>{statusLabel[item.status]}</span></article>)}{!filtered.length && <Empty text="Không có giao dịch phù hợp với bộ lọc." />}</div>
        </section>
        <section className="overview-card overview-operations">
          <section className="overview-operation-section overview-wallets">
            <header><div><h2>Ví trong workspace</h2><p>Số dư hiện tại</p></div><span className="overview-card-count">{wallets.length}</span></header>
            {wallets.length ? <div className="wallet-list">{wallets.map((wallet) => <article key={wallet.id}><span><WalletCards size={16}/></span><div><strong>{wallet.name}</strong><small>Cập nhật {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(wallet.updatedAt))}</small></div><b>{formatCompactAmount(wallet.balance)} {workspace.currency}</b></article>)}</div> : <Empty text="Workspace này chưa có ví đang hoạt động." />}
          </section>
          <section className="overview-operation-section overview-pending">
            <header><div><h2>Giao dịch cần phê duyệt</h2><p>{pending.length} giao dịch đang chờ</p></div><span className="overview-card-count warning">{pending.length}</span></header>
            <div className="pending-list open">{pending.length ? pending.map((item) => <article key={item.id}><CircleAlert size={16}/><div><strong>{item.description ?? "Không có nội dung"}</strong><small>{item.member} · {formatCompactAmount(item.amount)} {workspace.currency}</small></div></article>) : <Empty text="Không có giao dịch nào cần phê duyệt." />}</div>
          </section>
        </section>
      </div>
    </div>
  </div>;
}
function CashflowOverviewCharts({ members, transactions, currency, month, range, onRangeChange, walletId, categoryId, memberId, transactionType, categoryType }: {
  members: { id: string; name: string }[];
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  onRangeChange: (range: CashflowRange) => void;
  walletId: string;
  categoryId: string;
  memberId: string;
  transactionType: string;
  categoryType?: "income" | "expense";
}) {
  return <section className="overview-card overview-flow">
    <header>
      <div><h2>Thu nhập và chi tiêu theo tháng</h2><p>Giao dịch đã ghi nhận · kỳ kết thúc tháng {month.slice(5, 7)}/{month.slice(0, 4)}</p></div>
      <Tabs value={String(range)} onValueChange={(value) => onRangeChange(Number(value) as CashflowRange)}><TabsList aria-label="Khoảng thời gian phân tích">{([3, 6, 12] as const).map((value) => <TabsTrigger key={value} value={String(value)}>{value} tháng</TabsTrigger>)}</TabsList></Tabs>
    </header>
    <div className="overview-flow-layout">
      <MonthlyFinancialChart transactions={transactions} currency={currency} month={month} range={range} walletId={walletId} categoryId={categoryId} memberId={memberId} transactionType={transactionType} categoryType={categoryType}/>
      <MemberExpenseChart members={members} transactions={transactions} currency={currency} period={month} range={range} walletId={walletId} categoryId={categoryId} transactionType={transactionType} categoryType={categoryType}/>
    </div>
  </section>;
}
function BalanceHistoryChart({ wallets, transactions, currency, month, range, walletId }: {
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
}) {
  const [mode, setMode] = useState<"total" | "wallets">("total");
  const visibleWallets = walletId === "all"
    ? wallets
    : wallets.filter((wallet) => wallet.id === walletId);
  const balances = buildMonthlyBalances(wallets, transactions, {
    endPeriod: month,
    range,
    walletId,
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
      ...Object.fromEntries(walletSeries.map((wallet) => [
        wallet.key,
        new Decimal(row.wallets[wallet.id] ?? 0).toNumber(),
      ])),
    };
  });
  const negativeMonthCount = balances.filter((row) => row.hasNegativeBalance).length;
  const walletChartConfig = Object.fromEntries(walletSeries.map((wallet) => [
    wallet.key,
    { label: wallet.name, color: wallet.color },
  ])) satisfies ChartConfig;

  return <section className="overview-card overview-balance">
    <header>
      <div><h2>Số dư cuối tháng</h2><p>{range} tháng gần nhất · tháng hiện tại tính đến hôm nay · chỉ giao dịch đã ghi nhận</p></div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as "total" | "wallets")}><TabsList aria-label="Cách hiển thị số dư"><TabsTrigger value="total">Tổng số dư</TabsTrigger><TabsTrigger value="wallets">Theo ví</TabsTrigger></TabsList></Tabs>
    </header>
    {negativeMonthCount > 0 && <div className="overview-balance-alert"><span className="overview-chart-warning"><CircleAlert size={13}/>{negativeMonthCount} tháng có số dư âm</span></div>}
    {visibleWallets.length ? mode === "total"
      ? <ChartContainer config={balanceChartConfig} className="overview-balance-chart" aria-label={`Biểu đồ tổng số dư ${range} tháng, kết thúc tháng ${month}`}>
          <AreaChart data={rows} accessibilityLayer margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false}/>
            <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false}/>
            <YAxis width={76} tickLine={false} tickMargin={6} axisLine={false} tickFormatter={formatCompactAmount}/>
            {negativeMonthCount > 0 && <ReferenceLine y={0} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity={0.7}/>}
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" indicator="line" labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} formatter={(value) => <div className="flex min-w-48 items-center justify-between gap-4"><span className="text-muted-foreground">Tổng số dư</span><strong className="tabular-nums text-foreground">{money(String(value), currency)}</strong></div>}/>} />
            <Area dataKey="total" type="linear" fill="var(--color-total)" fillOpacity={0.14} stroke="var(--color-total)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
          </AreaChart>
        </ChartContainer>
      : <ChartContainer config={walletChartConfig} className="overview-balance-chart" aria-label={`Biểu đồ số dư theo ví trong ${range} tháng, kết thúc tháng ${month}`}>
          <LineChart data={rows} accessibilityLayer margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false}/>
            <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false}/>
            <YAxis width={76} tickLine={false} tickMargin={6} axisLine={false} tickFormatter={formatCompactAmount}/>
            {negativeMonthCount > 0 && <ReferenceLine y={0} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity={0.7}/>}
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" indicator="line" labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} formatter={(value, name) => { const series = walletSeries.find((wallet) => wallet.key === name); return <div className="flex min-w-48 items-center justify-between gap-4"><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2 rounded-full" style={{ background: series?.color }}/>{series?.name ?? String(name)}</span><strong className="tabular-nums text-foreground">{money(String(value), currency)}</strong></div>; }}/>} />
            <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4 gap-y-2 pt-3"/>}/>
            {walletSeries.map((wallet) => <Line key={wallet.id} dataKey={wallet.key} type="linear" stroke={`var(--color-${wallet.key})`} strokeWidth={2.1} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>)}
          </LineChart>
        </ChartContainer>
      : <Empty text="Workspace này chưa có ví đang hoạt động để theo dõi số dư." />}
  </section>;
}
function MonthlyFinancialChart({ transactions, currency, month, range, walletId, categoryId, memberId, transactionType, categoryType }: {
  transactions: Transaction[];
  currency: string;
  month: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  memberId: string;
  transactionType: string;
  categoryType?: "income" | "expense";
}) {
  const visibleTypes = getVisibleCashflowTypes(transactionType, categoryType);
  const cashflow = buildMonthlyCashflow(transactions, { endPeriod: month, range, walletId, categoryId, memberId, transactionType, categoryType });
  const showComparison = visibleTypes.length === 2;
  const warningCount = showComparison ? cashflow.filter((row) => row.hasWarning).length : 0;
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
  const emptyText = transactionType === "transfer"
    ? "Biểu đồ thu và chi không áp dụng cho giao dịch chuyển khoản."
    : visibleTypes.length === 0
      ? "Loại giao dịch không thuộc hạng mục đang chọn."
      : "Chưa có giao dịch đã ghi nhận phù hợp với bộ lọc.";

  return <section className="overview-flow-primary" aria-label="Biểu đồ thu nhập và chi tiêu">
    {warningCount > 0 && <div className="overview-flow-alert"><span className="overview-chart-warning"><CircleAlert size={13}/>{warningCount} tháng chi vượt thu</span></div>}
    {hasData ? <ChartContainer config={monthlyChartConfig} className="overview-expense-chart" aria-label={`Biểu đồ thu nhập và chi tiêu ${range} tháng, kết thúc tháng ${month}`}>
      <LineChart data={rows} accessibilityLayer margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false}/>
        <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false}/>
        <YAxis width={76} tickLine={false} tickMargin={6} axisLine={false} tickFormatter={formatCompactAmount}/>
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" indicator="line" labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} formatter={(value, name) => <div className="flex min-w-48 items-center justify-between gap-4"><span className="text-muted-foreground">{name === "income" ? "Thu nhập" : "Chi tiêu"}</span><strong className="tabular-nums text-foreground">{money(String(value), currency)}</strong></div>}/>} />
        <ChartLegend content={<ChartLegendContent className="justify-start pt-3"/>}/>
        {visibleTypes.includes("income") && <Line dataKey="income" type="linear" stroke="var(--color-income)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>}
        {visibleTypes.includes("expense") && <Line dataKey="expense" type="linear" stroke="var(--color-expense)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>}
      </LineChart>
    </ChartContainer> : <Empty text={emptyText} />}
  </section>;
}
function MemberExpenseChart({ members, transactions, currency, period, range, walletId, categoryId, transactionType, categoryType }: {
  members: { id: string; name: string }[];
  transactions: Transaction[];
  currency: string;
  period: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  transactionType: string;
  categoryType?: CashflowType;
}) {
  const isTransfer = transactionType === "transfer";
  const metricType: CashflowType = transactionType === "income"
    ? "income"
    : transactionType === "expense"
      ? "expense"
      : categoryType ?? "expense";
  const totals = buildMemberMonthlyTotals(members, transactions, { endPeriod: period, range, walletId, categoryId, type: metricType });
  const hasData = !isTransfer && totals.some((row) => Object.values(row.totals).some((value) => !new Decimal(value).isZero()));
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
      ...Object.fromEntries(memberSeries.map((member) => [
        member.key,
        new Decimal(row.totals[member.id] ?? 0).toNumber(),
      ])),
    };
  });
  const chartHeight = Math.max(260, rows.length * Math.max(48, members.length * 20));
  const metricLabel = metricType === "income" ? "Thu nhập" : "Chi tiêu";
  const chartConfig = Object.fromEntries(memberSeries.map((member) => [
    member.key,
    { label: member.name, color: member.color },
  ])) satisfies ChartConfig;

  return <section className="overview-flow-member">
    <header>
      <div><h3>{metricLabel} theo thành viên</h3><p>Theo filter Loại giao dịch · màu đại diện cho từng thành viên</p></div>
    </header>
    {hasData ? <div className="overview-member-chart-scroll">
      <ChartContainer config={chartConfig} className="overview-member-expense-chart" style={{ height: chartHeight }} aria-label={`Biểu đồ ${metricLabel.toLocaleLowerCase("vi")} theo tháng của ${members.length} thành viên trong ${range} tháng`}>
        <BarChart data={rows} layout="vertical" accessibilityLayer barGap={3} barCategoryGap="20%" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false}/>
          <XAxis type="number" hide/>
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} tickMargin={8} width={52}/>
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" hideIndicator labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} formatter={(value, name) => { const series = memberSeries.find((member) => member.key === name); return <div className="flex min-w-48 items-center justify-between gap-4"><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2 rounded-[2px]" style={{ background: series?.color }}/>{series?.name ?? String(name)}</span><strong className="tabular-nums text-foreground">{money(String(value), currency)}</strong></div>; }}/>} />
          <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4 gap-y-2 pt-3"/>}/>
          {memberSeries.map((member) => <Bar key={member.id} dataKey={member.key} fill={`var(--color-${member.key})`} radius={[0, 5, 5, 0]} maxBarSize={14}/>)}
        </BarChart>
      </ChartContainer>
    </div> : <Empty text={isTransfer ? "Biểu đồ theo thành viên không áp dụng cho giao dịch chuyển khoản." : `Chưa có ${metricLabel.toLocaleLowerCase("vi")} đã ghi nhận phù hợp trong ${range} tháng này.`} />}
  </section>;
}

function MobileFinanceDonut({ balance, income, expense, currency }: {
  balance: string;
  income: Decimal;
  expense: Decimal;
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cashflow = income.minus(expense);
  const data = [
    { key: "income", name: "Thu nhập", amount: income.abs().toNumber(), display: money(income, currency), color: "var(--income)" },
    { key: "expense", name: "Chi phí", amount: expense.abs().toNumber(), display: money(expense, currency), color: "var(--expense)" },
    { key: "cashflow", name: "Dòng tiền", amount: cashflow.abs().toNumber(), display: money(cashflow, currency), color: "var(--primary)" },
  ];
  const active = data[Math.min(activeIndex, data.length - 1)];
  const hasData = data.some((item) => item.amount > 0);
  const config = Object.fromEntries(data.map((item) => [item.key, { label: item.name, color: item.color }])) satisfies ChartConfig;

  return <section className="overview-mobile-finance" aria-label="Thu nhập, chi phí và dòng tiền trong kỳ">
    <header><div><span>Số dư hiện tại</span><strong>{balance}</strong></div><small>Kỳ báo cáo hiện tại</small></header>
    <div className="overview-mobile-finance-body">
      <div className={`overview-mobile-donut-wrap ${hasData ? "" : "empty"}`}>
        {hasData && <ChartContainer config={config} className="overview-mobile-donut">
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
              {data.map((item, index) => <Cell key={item.key} fill={item.color} stroke="var(--surface)" strokeWidth={3} opacity={index === activeIndex ? 1 : .58}/>)}
            </Pie>
          </PieChart>
        </ChartContainer>}
        <div className="overview-mobile-donut-center"><span>{active.name}</span><strong>{active.display}</strong></div>
      </div>
      <div className="overview-mobile-donut-list" role="list" aria-label="Chọn chỉ số hiển thị">
        {data.map((item, index) => <Button variant="unstyled" size="auto" type="button" role="listitem" className={index === activeIndex ? "active" : ""} key={item.key} onClick={() => setActiveIndex(index)}>
          <i style={{ background: item.color }}/>
          <span>{item.name}</span>
          <strong>{item.display}</strong>
        </Button>)}
      </div>
    </div>
  </section>;
}

function MobileCategoryPie({ items, total, currency }: {
  items: { name: string; color: string; amount: Decimal }[];
  total: Decimal;
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleItems = items.length > 6
    ? [
      ...items.slice(0, 5),
      {
        name: "Khác",
        color: "var(--chart-7)",
        amount: items.slice(5).reduce((sum, item) => sum.plus(item.amount), new Decimal(0)),
      },
    ]
    : items;
  const data = visibleItems.map((item) => ({
    name: item.name,
    color: item.color,
    amount: item.amount.toNumber(),
    display: `${formatCompactAmount(item.amount)} ${currency}`,
    percentage: total.isZero() ? "0" : item.amount.div(total).times(100).toFixed(0),
  }));
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, data.length - 1));
  const active = data[safeActiveIndex];
  const config = Object.fromEntries(data.map((item, index) => [`category_${index}`, { label: item.name, color: item.color }])) satisfies ChartConfig;

  if (!data.length) return null;

  return <div className="overview-mobile-category-pie">
    <div className="overview-mobile-category-chart">
      <ChartContainer config={config} className="overview-mobile-category-donut">
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
            {data.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} stroke="var(--surface)" strokeWidth={2.5} opacity={index === safeActiveIndex ? 1 : .62}/>)}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="overview-mobile-category-center"><strong>{active.percentage}%</strong><span>{active.name}</span></div>
    </div>
    <div className="overview-mobile-category-labels" role="list" aria-label="Chi phí theo hạng mục">
      {data.map((item, index) => <Button variant="unstyled" size="auto" type="button" role="listitem" className={index === safeActiveIndex ? "active" : ""} key={`${item.name}-label-${index}`} onClick={() => setActiveIndex(index)}>
        <i style={{ background: item.color }}/>
        <span><strong>{item.name}</strong><small>{item.display}</small></span>
        <b>{item.percentage}%</b>
      </Button>)}
    </div>
  </div>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="overview-filter-field" role="group" aria-label={label}><span>{label}</span>{children}</div>; }
function Metric({ title, value, note, icon, tone }: { title: string; value: string; note: string; icon: React.ReactNode; tone: string }) { return <section className={`overview-metric ${tone}`}><span>{icon}</span><p>{title}</p><strong>{value}</strong><small>{note}</small></section>; }
function Empty({ text }: { text: string }) { return <div className="overview-empty">{text}</div>; }
