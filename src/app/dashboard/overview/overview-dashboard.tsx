"use client";

import Decimal from "decimal.js";
import { ChevronDown, CircleAlert, Funnel, RefreshCw, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { FinanceSelect } from "@/components/finance/finance-select";
import { MonthPicker } from "@/components/finance/date-picker-field";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAmount } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Transaction = { id: string; amount: string; type: "income" | "expense" | "transfer"; status: "pending" | "scheduled" | "approved" | "rejected"; description: string | null; date: string; walletId: string; toWalletId: string | null; wallet: string; categoryId: string | null; category: { name: string; color: string } | null; memberId: string; member: string };
type MonthlyFinancial = { period: string; balance: string; expense: string };
type Props = { workspace: { id: string; name: string; currency: string }; wallets: { id: string; name: string; balance: string; updatedAt: string }[]; totalByCurrency: Record<string, string>; categories: { id: string; name: string; color: string }[]; members: { id: string; name: string }[]; transactions: Transaction[]; monthlyFinancials: MonthlyFinancial[] };
const money = (value: Decimal.Value, currency: string) => `${formatAmount(value)} ${currency}`;
const statusLabel = { approved: "Đã ghi nhận", pending: "Chờ duyệt", scheduled: "Đã lên lịch", rejected: "Đã từ chối" };
const monthlyChartConfig = {
  balance: { label: "Tổng số dư cuối tháng", color: "var(--primary)" },
  expense: { label: "Tổng chi tiêu", color: "var(--expense)" },
} satisfies ChartConfig;

export function OverviewDashboard({ workspace, wallets, totalByCurrency, categories, members, transactions, monthlyFinancials }: Props) {
  const now = new Date(); const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initialMonth); const [walletId, setWalletId] = useState("all"); const [categoryId, setCategoryId] = useState("all"); const [memberId, setMemberId] = useState("all"); const [type, setType] = useState("all"); const [showPending, setShowPending] = useState(false);
  const filtered = transactions.filter((item) => item.date.slice(0, 7) === month && (walletId === "all" || item.walletId === walletId || item.toWalletId === walletId) && (categoryId === "all" || item.categoryId === categoryId) && (memberId === "all" || item.memberId === memberId) && (type === "all" || item.type === type));
  const posted = filtered.filter((item) => item.status === "approved");
  const totals = posted.reduce((result, item) => ({ income: item.type === "income" ? result.income.plus(item.amount) : result.income, expense: item.type === "expense" ? result.expense.plus(item.amount) : result.expense }), { income: new Decimal(0), expense: new Decimal(0) });
  const expenseByCategory = (() => {
    const rows = new Map<string, { name: string; color: string; amount: Decimal }>();
    posted.filter((item) => item.type === "expense").forEach((item) => { const key = item.categoryId ?? "uncategorized"; const prior = rows.get(key); rows.set(key, { name: item.category?.name ?? "Chưa phân loại", color: item.category?.color ?? "var(--chart-7)", amount: (prior?.amount ?? new Decimal(0)).plus(item.amount) }); });
    return [...rows.values()].sort((a, b) => b.amount.comparedTo(a.amount));
  })();
  const pending = filtered.filter((item) => item.status === "pending");
  const activeFilterCount = [walletId, categoryId, memberId, type].filter((value) => value !== "all").length + (month !== initialMonth ? 1 : 0);
  const reset = () => { setMonth(initialMonth); setWalletId("all"); setCategoryId("all"); setMemberId("all"); setType("all"); setShowPending(false); };

  return <div className="overview-shell">
    <div className="overview-title"><div><p>Workspace · {workspace.name}</p><h1>Tổng quan tài chính</h1></div><Button render={<a href={`/workspace/${workspace.id}`} aria-label="Thêm giao dịch" />} className="overview-add">Thêm giao dịch</Button></div>
    <section className="overview-filter-panel" aria-label="Bộ lọc báo cáo">
      <div className="overview-filter-heading"><div className="overview-filter-title"><span><Funnel size={16}/></span><div><strong>Bộ lọc báo cáo</strong><small>{activeFilterCount ? `${activeFilterCount} điều kiện đang áp dụng` : "Đang hiển thị toàn bộ dữ liệu trong tháng"}</small></div></div><button type="button" onClick={reset} className="overview-reset" disabled={!activeFilterCount}><RefreshCw size={15}/>Đặt lại</button></div>
      <div className="overview-filter-grid">
        <FilterField label="Tháng báo cáo"><MonthPicker value={month} onValueChange={setMonth}/></FilterField>
        <FilterField label="Ví"><FinanceSelect value={walletId} onValueChange={setWalletId} label="Lọc theo ví" options={[{ value: "all", label: "Tất cả ví" }, ...wallets.map((item) => ({ value: item.id, label: item.name }))]} /></FilterField>
        <FilterField label="Hạng mục"><FinanceSelect value={categoryId} onValueChange={setCategoryId} label="Lọc theo hạng mục" options={[{ value: "all", label: "Tất cả hạng mục" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} /></FilterField>
        <FilterField label="Loại giao dịch"><FinanceSelect value={type} onValueChange={setType} label="Lọc theo loại giao dịch" options={[{ value: "all", label: "Tất cả loại" }, { value: "income", label: "Thu nhập" }, { value: "expense", label: "Chi phí" }, { value: "transfer", label: "Chuyển khoản" }]} /></FilterField>
        <FilterField label="Thành viên"><FinanceSelect value={memberId} onValueChange={setMemberId} label="Lọc theo thành viên" options={[{ value: "all", label: "Tất cả thành viên" }, ...members.map((item) => ({ value: item.id, label: item.name }))]} /></FilterField>
      </div>
    </section>
    <div className="overview-kpis"><Metric title="Tổng số dư ví" value={Object.entries(totalByCurrency).map(([currency, total]) => money(total, currency)).join(" · ")} note={`${wallets.length} ví đang hoạt động`} icon={<WalletCards size={18}/>} tone="primary"/><Metric title="Thu nhập trong kỳ" value={money(totals.income, workspace.currency)} note="Chỉ giao dịch đã ghi nhận" icon={<TrendingUp size={18}/>} tone="income"/><Metric title="Chi phí trong kỳ" value={money(totals.expense, workspace.currency)} note="Chỉ giao dịch đã ghi nhận" icon={<TrendingDown size={18}/>} tone="expense"/><Metric title="Dòng tiền ròng" value={money(totals.income.minus(totals.expense), workspace.currency)} note="Thu nhập trừ chi phí" icon={<TrendingUp size={18}/>} tone="primary"/></div>
    <div className="overview-grid"><MonthlyFinancialChart financials={monthlyFinancials} currency={workspace.currency}/>
      <section className="overview-card overview-category"><header><div><h2>Chi phí theo hạng mục</h2><p>Chỉ tính giao dịch đã ghi nhận</p></div></header>{expenseByCategory.length ? <div className="category-list">{expenseByCategory.map((item) => <div className="category-row" key={item.name}><span className="category-dot" style={{ background: item.color }}/><div><strong>{item.name}</strong><div className="category-track"><span style={{ width: `${item.amount.div(totals.expense).times(100)}%`, background: item.color }}/></div></div><b>{item.amount.div(totals.expense).times(100).toFixed(0)}%</b><small>{money(item.amount, workspace.currency)}</small></div>)}</div> : <Empty text="Chưa có chi phí đã ghi nhận để phân bổ." />}</section>
      <section className="overview-card overview-wallets"><header><div><h2>Ví trong workspace</h2><p>Số dư hiện tại theo dữ liệu ví</p></div></header>{wallets.length ? <div className="wallet-list">{wallets.map((wallet) => <article key={wallet.id}><span><WalletCards size={17}/></span><div><strong>{wallet.name}</strong><small>Cập nhật {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(wallet.updatedAt))}</small></div><b>{money(wallet.balance, workspace.currency)}</b></article>)}</div> : <Empty text="Workspace này chưa có ví đang hoạt động." />}</section>
      <section className="overview-card overview-recent"><header><div><h2>Giao dịch gần đây</h2><p>Được sắp xếp theo ngày mới nhất</p></div><a href={`/workspace/${workspace.id}`}>Xem tất cả</a></header><div className="recent-table">{filtered.slice(0, 6).map((item) => <article key={item.id}><div><strong title={item.description ?? "Không có nội dung"}>{item.description ?? "Không có nội dung"}</strong><small>{item.category?.name ?? "Chưa phân loại"} · {item.wallet} · {item.member}</small></div><time>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(item.date))}</time><b className={item.type}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{money(item.amount, workspace.currency)}</b><span className={`overview-status ${item.status}`}>{statusLabel[item.status]}</span></article>)}{!filtered.length && <Empty text="Không có giao dịch phù hợp với bộ lọc." />}</div></section>
      <section className="overview-card overview-pending"><header><div><h2>Cần xử lý</h2><p>Giao dịch đang chờ duyệt</p></div><button onClick={() => setShowPending(!showPending)} aria-expanded={showPending}><ChevronDown size={17}/></button></header><div className={showPending ? "pending-list open" : "pending-list"}>{pending.length ? pending.map((item) => <article key={item.id}><CircleAlert size={17}/><div><strong>{item.description ?? "Không có nội dung"}</strong><small>{item.member} · {money(item.amount, workspace.currency)}</small></div></article>) : <Empty text="Không có giao dịch nào cần xử lý." />}</div><p className="pending-summary">{pending.length} giao dịch đang chờ duyệt</p></section>
    </div>
  </div>;
}
function MonthlyFinancialChart({ financials, currency }: { financials: MonthlyFinancial[]; currency: string }) {
  const [range, setRange] = useState<3 | 6 | 12>(3);
  const rows = financials.slice(-range).map((item) => { const [year, month] = item.period.split("-"); return { period: item.period, label: `${month}/${year.slice(2)}`, balance: new Decimal(item.balance).toNumber(), expense: new Decimal(item.expense).toNumber() }; });
  return <section className="overview-card overview-flow"><header><div><h2>Số dư và chi tiêu theo tháng</h2><p>Cột biểu diễn số dư cuối tháng, đường biểu diễn chi tiêu đã ghi nhận. Tháng hiện tại tính đến hôm nay.</p></div><Tabs value={String(range)} onValueChange={(value) => setRange(Number(value) as 3 | 6 | 12)}><TabsList aria-label="Khoảng thời gian biểu đồ">{([3, 6, 12] as const).map((value) => <TabsTrigger key={value} value={String(value)}>{value} tháng</TabsTrigger>)}</TabsList></Tabs></header>{rows.length ? <ChartContainer config={monthlyChartConfig} className="overview-expense-chart" aria-label={`Biểu đồ số dư và chi tiêu ${range} tháng gần nhất`}><ComposedChart data={rows} accessibilityLayer margin={{ top: 4, right: 4, left: 4, bottom: 0 }}><CartesianGrid vertical={false}/><XAxis dataKey="label" tickLine={false} tickMargin={8} axisLine={false}/><YAxis yAxisId="balance" width={62} tickLine={false} axisLine={false} tickFormatter={(value) => formatAmount(value)}/><YAxis yAxisId="expense" orientation="right" width={62} tickLine={false} axisLine={false} tickFormatter={(value) => formatAmount(value)}/><ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" hideIndicator formatter={(value, name) => { const isBalance = name === "balance"; return <div className="flex min-w-48 items-center justify-between gap-4"><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2 rounded-[2px]" style={{ background: isBalance ? "var(--color-balance)" : "var(--color-expense)" }}/>{isBalance ? "Tổng số dư cuối tháng" : "Tổng chi tiêu"}</span><strong className="tabular-nums text-foreground">{money(String(value), currency)}</strong></div>; }}/>} /><ChartLegend verticalAlign="top" content={<ChartLegendContent className="justify-start pb-2 pt-0"/>}/><Bar yAxisId="balance" dataKey="balance" fill="var(--color-balance)" radius={[7, 7, 2, 2]} maxBarSize={34}/><Line yAxisId="expense" dataKey="expense" type="monotone" stroke="var(--color-expense)" strokeWidth={2.25} dot={{ r: 3, fill: "var(--color-expense)", strokeWidth: 0 }} activeDot={{ r: 5 }}/></ComposedChart></ChartContainer> : <Empty text="Chưa có dữ liệu số dư và chi tiêu theo tháng." />}</section>;
}
function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="overview-filter-field" role="group" aria-label={label}><span>{label}</span>{children}</div>; }
function Metric({ title, value, note, icon, tone }: { title: string; value: string; note: string; icon: React.ReactNode; tone: string }) { return <section className={`overview-metric ${tone}`}><span>{icon}</span><p>{title}</p><strong>{value}</strong><small>{note}</small></section>; }
function Empty({ text }: { text: string }) { return <div className="overview-empty">{text}</div>; }
