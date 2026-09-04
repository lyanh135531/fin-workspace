"use client";

import {
  Button,
  buttonVariants,
  Card,
  CategoryIcon,
  DashboardPeriodFilter,
  Empty,
  PageContainer,
  PageHeader,
  Popover,
  PopoverTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  type DashboardPeriod,
} from "@/components/base";
import Decimal from "decimal.js";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DesktopTransactionCreatePopoverContent,
  createTransactionDraft,
  transactionDraftInput,
  type TransactionCategoryOption,
  type TransactionDraft,
  type TransactionWalletOption,
} from "@/app/dashboard/desktop-transaction-create-draft";
import { addTransactionAction } from "@/app/dashboard/actions";
import { useOptimisticNavigation } from "@/app/dashboard/use-optimistic-navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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
  getDashboardPeriodDateRange,
  getVisibleCashflowTypes,
  type CashflowRange,
  type CashflowType,
} from "@/app/dashboard/overview/overview-chart-data";
import type { DateRangeValue } from "@/components/base";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatAmount,
  formatScaledAmount,
  getAmountScale,
  type AmountScale,
} from "@/lib/format";
import { cn } from "@/lib/utils";

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
  category: { name: string; color: string; icon: string | null } | null;
  memberId: string;
  member: string;
};
type UpcomingRecurring = {
  id: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  description: string | null;
  nextExecutionDate: string;
  wallet: string;
  category: { name: string; color: string; icon: string | null } | null;
};

type Props = {
  workspace: { id: string; name: string; currency: string };
  reportPeriod: string;
  wallets: { id: string; name: string; balance: string; updatedAt: string }[];
  totalByCurrency: Record<string, string>;
  members: { id: string; name: string }[];
  transactions: Transaction[];
  userRole?: string;
  upcomingRecurring?: UpcomingRecurring[];
  categories?: TransactionCategoryOption[];
  businessDate?: string;
};
const money = (value: Decimal.Value, currency: string) =>
  `${formatAmount(value)} ${currency}`;
const axisUnitLabel = (scale: AmountScale, currency: string) =>
  scale.label ? `${scale.label} ${currency}` : currency;
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

function shiftReportPeriod(
  periodStr: string,
  step: number,
  period: DashboardPeriod,
): string {
  const [year, month] = periodStr.split("-").map(Number);
  if (period === "month") {
    const date = new Date(Date.UTC(year, month - 1 + step, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (period === "quarter") {
    const currentQuarter = Math.floor((month - 1) / 3) + 1;
    const targetQuarter = currentQuarter + step;
    const date = new Date(Date.UTC(year, targetQuarter * 3 - 1, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const nextYear = year + step;
  return `${nextYear}-${String(month).padStart(2, "0")}`;
}

function formatPeriodLabel(
  periodStr: string,
  period: DashboardPeriod,
): string {
  const [year, month] = periodStr.split("-").map(Number);
  if (period === "month") {
    return `Tháng ${String(month).padStart(2, "0")}/${year}`;
  }
  if (period === "quarter") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    return `Quý ${quarter}/${year}`;
  }
  return `Năm ${year}`;
}

function summarizeTransactions(
  transactions: Transaction[],
  dateRange: DateRangeValue,
): { income: Decimal; expense: Decimal } {
  return transactions.reduce(
    (result, item) => {
      if (item.status !== "approved" || !isInDateRange(item.date, dateRange)) {
        return result;
      }

      if (item.type === "income") result.income = result.income.plus(item.amount);
      if (item.type === "expense") result.expense = result.expense.plus(item.amount);
      return result;
    },
    { income: new Decimal(0), expense: new Decimal(0) },
  );
}

function calculatePeriodProgress(
  periodStr: string,
  period: DashboardPeriod,
): { elapsed: number; total: number } {
  const [year, month] = periodStr.split("-").map(Number);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  if (period === "month") {
    const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return { elapsed: totalDays, total: totalDays };
    }
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      return { elapsed: 1, total: totalDays };
    }
    return {
      elapsed: Math.max(1, Math.min(currentDay, totalDays)),
      total: totalDays,
    };
  }

  if (period === "quarter") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;
    const totalDays = 90;
    if (year < currentYear || (year === currentYear && quarter < currentQuarter)) {
      return { elapsed: totalDays, total: totalDays };
    }
    if (year > currentYear || (year === currentYear && quarter > currentQuarter)) {
      return { elapsed: 1, total: totalDays };
    }
    const quarterStartMonth = (quarter - 1) * 3 + 1;
    const monthsPassed = currentMonth - quarterStartMonth;
    const elapsed = Math.max(1, monthsPassed * 30 + currentDay);
    return { elapsed: Math.min(elapsed, totalDays), total: totalDays };
  }

  const totalDays = 365;
  if (year < currentYear) return { elapsed: 365, total: 365 };
  if (year > currentYear) return { elapsed: 1, total: 365 };
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const diffDays = Math.max(
    1,
    Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return { elapsed: Math.min(diffDays, 365), total: 365 };
}

export function OverviewDashboard({
  workspace,
  reportPeriod,
  wallets,
  totalByCurrency,
  members,
  transactions,
  userRole,
  upcomingRecurring,
  categories,
  businessDate,
}: Props) {
  const router = useRouter();
  const { beginNavigation } = useOptimisticNavigation();
  const ledgerHref = workspace.id ? `/workspace/${workspace.id}` : "/dashboard";
  const [isMobile, setIsMobile] = useState(false);
  const [createDraft, setCreateDraft] = useState<TransactionDraft | null>(null);
  const [transferDraft, setTransferDraft] = useState<TransactionDraft | null>(null);
  const [emptyCreateDraft, setEmptyCreateDraft] = useState<TransactionDraft | null>(null);
  const [busy, startTransition] = useTransition();

  const walletOptions = useMemo<TransactionWalletOption[]>(
    () => wallets.map((w) => ({ id: w.id, name: w.name })),
    [wallets],
  );

  const categoryOptions = useMemo<TransactionCategoryOption[]>(
    () => categories ?? [],
    [categories],
  );

  const defaultDate = businessDate ?? reportPeriod + "-01";

  function beginCreate() {
    setCreateDraft(createTransactionDraft(walletOptions, categoryOptions, defaultDate));
  }

  function saveCreate() {
    if (!createDraft) return;
    startTransition(async () => {
      const result = await addTransactionAction(
        workspace.id,
        transactionDraftInput(createDraft),
      );
      if (result.ok) {
        toast.success(
          result.status === "pending"
            ? "Đã gửi giao dịch quá khứ để Admin duyệt."
            : result.status === "scheduled"
              ? "Đã lên lịch giao dịch tương lai."
              : "Đã ghi nhận giao dịch và cập nhật số dư ví.",
        );
        setCreateDraft(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể lưu giao dịch.");
      }
    });
  }

  function beginTransfer() {
    const draft = createTransactionDraft(walletOptions, categoryOptions, defaultDate);
    draft.type = "transfer";
    setTransferDraft(draft);
  }

  function saveTransfer() {
    if (!transferDraft) return;
    startTransition(async () => {
      const result = await addTransactionAction(
        workspace.id,
        transactionDraftInput(transferDraft),
      );
      if (result.ok) {
        toast.success(
          result.status === "pending"
            ? "Đã gửi giao dịch quá khứ để Admin duyệt."
            : result.status === "scheduled"
              ? "Đã lên lịch giao dịch tương lai."
              : "Đã ghi nhận giao dịch chuyển tiền.",
        );
        setTransferDraft(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể chuyển tiền.");
      }
    });
  }

  function beginEmptyCreate() {
    setEmptyCreateDraft(createTransactionDraft(walletOptions, categoryOptions, defaultDate));
  }

  function saveEmptyCreate() {
    if (!emptyCreateDraft) return;
    startTransition(async () => {
      const result = await addTransactionAction(
        workspace.id,
        transactionDraftInput(emptyCreateDraft),
      );
      if (result.ok) {
        toast.success(
          result.status === "pending"
            ? "Đã gửi giao dịch quá khứ để Admin duyệt."
            : result.status === "scheduled"
              ? "Đã lên lịch giao dịch tương lai."
              : "Đã ghi nhận giao dịch và cập nhật số dư ví.",
        );
        setEmptyCreateDraft(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể lưu giao dịch.");
      }
    });
  }

  // Desktop global period states
  const [globalPeriod, setGlobalPeriod] = useState<DashboardPeriod>("month");
  const [activeReportPeriod, setActiveReportPeriod] = useState<string>(reportPeriod);
  const [chartTab, setChartTab] = useState<"cashflow" | "balance">("cashflow");
  const activeDateRange = getDashboardPeriodDateRange(
    activeReportPeriod,
    globalPeriod,
  );
  const activeTotals = summarizeTransactions(transactions, activeDateRange);
  const activeNetCashflow = activeTotals.income.minus(activeTotals.expense);
  const periodProgress = calculatePeriodProgress(activeReportPeriod, globalPeriod);
  const dailyBurnRate = activeTotals.expense.div(periodProgress.elapsed);
  const totalBalanceDecimal = wallets.reduce(
    (sum, w) => sum.plus(new Decimal(w.balance)),
    new Decimal(0),
  );
  const savingsRate = activeTotals.income.gt(0)
    ? activeNetCashflow.div(activeTotals.income).times(100).toNumber()
    : activeTotals.expense.gt(0)
      ? -100
      : 0;
  const pendingTransactions = transactions.filter((t) => t.status === "pending");
  const recentTransactions = transactions.slice(0, 5);
  const memberExpenses = members
    .map((m) => {
      const memberSpent = transactions
        .filter(
          (t) =>
            t.memberId === m.id &&
            t.type === "expense" &&
            t.status === "approved" &&
            isInDateRange(t.date, activeDateRange),
        )
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0));
      const percent = activeTotals.expense.isZero()
        ? 0
        : memberSpent.div(activeTotals.expense).times(100).toNumber();
      return {
        ...m,
        spent: memberSpent,
        percent,
      };
    })
    .sort((a, b) => b.spent.comparedTo(a.spent));
  const desktopExpenseByCategory = (() => {
    const rows = new Map<
      string,
      { name: string; color: string; icon: string | null; amount: Decimal }
    >();
    transactions
      .filter(
        (item) =>
          item.status === "approved" &&
          isInDateRange(item.date, activeDateRange),
      )
      .filter((item) => item.type === "expense")
      .forEach((item) => {
        const key = item.categoryId ?? "uncategorized";
        const prior = rows.get(key);
        rows.set(key, {
          name: item.category?.name ?? "Chưa phân loại",
          color: item.category?.color ?? "var(--chart-7)",
          icon: item.category?.icon ?? "tag",
          amount: (prior?.amount ?? new Decimal(0)).plus(item.amount),
        });
      });
    return [...rows.values()].sort((a, b) => b.amount.comparedTo(a.amount));
  })();

  // Mobile local period states (preserved for mobile-specific cards)
  const [balancePeriod, setBalancePeriod] = useState<DashboardPeriod>("month");
  const [summaryPeriod, setSummaryPeriod] = useState<DashboardPeriod>("month");
  const [categoryPeriod, setCategoryPeriod] = useState<DashboardPeriod>("month");
  const dateRange = getDashboardPeriodDateRange(reportPeriod, "month");
  const balanceDateRange = getDashboardPeriodDateRange(reportPeriod, balancePeriod);
  const summaryDateRange = getDashboardPeriodDateRange(reportPeriod, summaryPeriod);
  const categoryDateRange = getDashboardPeriodDateRange(reportPeriod, categoryPeriod);
  const filtered = transactions.filter(
    (item) => isInDateRange(item.date, dateRange),
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
  const balanceTotals = summarizeTransactions(transactions, balanceDateRange);
  const summaryTotals = summarizeTransactions(transactions, summaryDateRange);
  const categoryTotals = summarizeTransactions(transactions, categoryDateRange);
  const expenseByCategory = (() => {
    const rows = new Map<
      string,
      { name: string; color: string; icon: string | null; amount: Decimal }
    >();
    transactions
      .filter(
        (item) =>
          item.status === "approved" &&
          isInDateRange(item.date, categoryDateRange),
      )
      .filter((item) => item.type === "expense")
      .forEach((item) => {
        const key = item.categoryId ?? "uncategorized";
        const prior = rows.get(key);
        rows.set(key, {
          name: item.category?.name ?? "Chưa phân loại",
          color: item.category?.color ?? "var(--chart-7)",
          icon: item.category?.icon ?? "tag",
          amount: (prior?.amount ?? new Decimal(0)).plus(item.amount),
        });
      });
    return [...rows.values()].sort((a, b) => b.amount.comparedTo(a.amount));
  })();
  const balanceLabel =
    Object.entries(totalByCurrency)
      .map(([currency, total]) => money(total, currency))
      .join(" · ") || money(0, workspace.currency);
  const netCashflow = balanceTotals.income.minus(balanceTotals.expense);
  const summaryNetCashflow = summaryTotals.income.minus(summaryTotals.expense);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncViewport = (): void => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  if (!isMobile) {
    return (
      <PageContainer className="max-w-[76rem] space-y-6 pb-12 pt-2">
        <PageHeader
          title="Tổng quan tài chính"
          description={`${workspace.name} · Thu nhập, chi tiêu, dòng tiền và vận hành.`}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 select-none">
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0 rounded-md text-[var(--text-secondary)] hover:text-[var(--foreground)] touch-manipulation"
                onClick={() =>
                  setActiveReportPeriod((prev) =>
                    shiftReportPeriod(prev, -1, globalPeriod),
                  )
                }
                aria-label="Kỳ trước"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span
                onClick={() =>
                  activeReportPeriod !== reportPeriod &&
                  setActiveReportPeriod(reportPeriod)
                }
                title={
                  activeReportPeriod !== reportPeriod
                    ? "Bấm để về kỳ hiện tại"
                    : undefined
                }
                className={cn(
                  "min-w-[6.5rem] px-2 text-center text-xs font-medium tabular-nums select-none transition-colors",
                  activeReportPeriod !== reportPeriod
                    ? "cursor-pointer text-[var(--foreground)] hover:text-[var(--primary)]"
                    : "cursor-default text-[var(--foreground)]",
                )}
              >
                {formatPeriodLabel(activeReportPeriod, globalPeriod)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0 rounded-md text-[var(--text-secondary)] hover:text-[var(--foreground)] touch-manipulation"
                onClick={() =>
                  setActiveReportPeriod((prev) =>
                    shiftReportPeriod(prev, 1, globalPeriod),
                  )
                }
                aria-label="Kỳ sau"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <Tabs
              value={globalPeriod}
              onValueChange={(val) => setGlobalPeriod(val as DashboardPeriod)}
              className="gap-0"
            >
              <TabsList
                variant="navigation"
                className="inline-grid w-auto grid-cols-3 gap-0.5"
                aria-label="Chọn kỳ xem dữ liệu"
              >
                <TabsTrigger
                  value="month"
                  variant="navigation"
                  className="h-7 px-3 text-xs"
                >
                  Tháng
                </TabsTrigger>
                <TabsTrigger
                  value="quarter"
                  variant="navigation"
                  className="h-7 px-3 text-xs"
                >
                  Quý
                </TabsTrigger>
                <TabsTrigger
                  value="year"
                  variant="navigation"
                  className="h-7 px-3 text-xs"
                >
                  Năm
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Popover
              open={Boolean(createDraft)}
              onOpenChange={(open) => {
                if (open) beginCreate();
                else if (!busy) setCreateDraft(null);
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    size="sm"
                    disabled={busy || !wallets.length}
                    className="h-7 gap-1.5 px-3 text-xs font-medium cursor-pointer"
                    aria-label="Tạo giao dịch mới"
                  />
                }
              >
                <Plus className="size-3.5" />
                <span>Giao dịch</span>
              </PopoverTrigger>
              {createDraft && (
                <DesktopTransactionCreatePopoverContent
                  draft={createDraft}
                  wallets={walletOptions}
                  categories={categoryOptions}
                  busy={busy}
                  onChange={(patch) =>
                    setCreateDraft((current) =>
                      current ? { ...current, ...patch } : current,
                    )
                  }
                  onSave={saveCreate}
                  onCancel={() => setCreateDraft(null)}
                />
              )}
            </Popover>
          </div>
        </PageHeader>

        {/* TẦNG 1: 4 KPI CARDS */}
        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Chỉ số tài chính chính"
        >
          {/* Card 1: Tổng số dư khả dụng */}
          <Card as="article" className="gap-0 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span>Tổng số dư khả dụng</span>
              <WalletCards className="size-4 text-[var(--primary)]" aria-hidden="true" />
            </div>
            <strong className="mt-2.5 block text-2xl font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
              {balanceLabel}
            </strong>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs">
              <span className="text-[var(--text-muted)]">
                {wallets.length} ví hoạt động
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium tabular-nums",
                  activeNetCashflow.isNegative()
                    ? "text-[var(--expense)]"
                    : "text-[var(--income)]",
                )}
              >
                {activeNetCashflow.isNegative() ? (
                  <TrendingDown size={13} aria-hidden="true" />
                ) : (
                  <TrendingUp size={13} aria-hidden="true" />
                )}
                {activeNetCashflow.isNegative() ? "−" : "+"}
                {money(activeNetCashflow.abs(), workspace.currency)} trong kỳ
              </span>
            </div>
          </Card>

          {/* Card 2: Dòng tiền trong kỳ */}
          <Card as="article" className="gap-0 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span>Dòng tiền ròng trong kỳ</span>
              <TrendingUp className="size-4 text-[var(--income)]" aria-hidden="true" />
            </div>
            <strong
              className={cn(
                "mt-2.5 block text-2xl font-semibold tracking-tight tabular-nums",
                activeNetCashflow.isNegative()
                  ? "text-[var(--expense)]"
                  : "text-[var(--income)]",
              )}
            >
              {activeNetCashflow.isNegative() ? "−" : "+"}
              {money(activeNetCashflow.abs(), workspace.currency)}
            </strong>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
              <span>
                Thu:{" "}
                <span className="font-medium text-[var(--income)] tabular-nums">
                  +{money(activeTotals.income, workspace.currency)}
                </span>
              </span>
              <span>
                Chi:{" "}
                <span className="font-medium text-[var(--expense)] tabular-nums">
                  −{money(activeTotals.expense, workspace.currency)}
                </span>
              </span>
            </div>
          </Card>

          {/* Card 3: Nhịp chi tiêu / ngày */}
          <Card as="article" className="gap-0 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span>Tốc độ chi tiêu</span>
              <Clock className="size-4 text-[var(--text-secondary)]" aria-hidden="true" />
            </div>
            <strong className="mt-2.5 block text-2xl font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
              ~{money(dailyBurnRate.round(), workspace.currency)}
              <span className="text-xs font-normal text-[var(--text-muted)]"> / ngày</span>
            </strong>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
              <span>Tiến độ kỳ</span>
              <span className="font-medium text-[var(--foreground)] tabular-nums">
                {periodProgress.elapsed}/{periodProgress.total} ngày ({Math.round((periodProgress.elapsed / periodProgress.total) * 100)}%)
              </span>
            </div>
          </Card>

          {/* Card 4: Tỷ lệ tích lũy / Tiết kiệm */}
          <Card as="article" className="gap-0 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span>Tỷ lệ tích lũy</span>
              <PiggyBank className="size-4 text-[var(--primary)]" aria-hidden="true" />
            </div>
            <strong
              className={cn(
                "mt-2.5 block text-2xl font-semibold tracking-tight tabular-nums",
                savingsRate > 0 && "text-[var(--income)]",
                savingsRate < 0 && "text-[var(--expense)]",
                savingsRate === 0 && "text-[var(--foreground)]",
              )}
            >
              {savingsRate > 0 ? "+" : ""}
              {savingsRate.toFixed(1)}%
            </strong>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs">
              <span className="text-[var(--text-muted)]">
                {savingsRate >= 0 ? "Thặng dư" : "Bội chi"}:{" "}
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    savingsRate >= 0 ? "text-[var(--income)]" : "text-[var(--expense)]",
                  )}
                >
                  {savingsRate >= 0 ? "+" : "−"}
                  {money(activeNetCashflow.abs(), workspace.currency)}
                </span>
              </span>
              {pendingTransactions.length > 0 ? (
                <Link
                  href={`${ledgerHref}?status=pending`}
                  onClick={(event) => {
                    if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                      event.preventDefault();
                      beginNavigation(`${ledgerHref}?status=pending`);
                    }
                  }}
                  className="inline-flex items-center gap-1 font-medium text-[var(--warning)] hover:underline cursor-pointer"
                >
                  <CircleAlert className="size-3.5" aria-hidden="true" />
                  <span>{pendingTransactions.length} chờ duyệt</span>
                </Link>
              ) : (
                <span className="text-[var(--text-muted)]">
                  {savingsRate >= 20
                    ? "Tích lũy tốt"
                    : savingsRate > 0
                      ? "Cần tối ưu thêm"
                      : savingsRate < 0
                        ? "Vượt thu nhập"
                        : "Chưa phát sinh"}
                </span>
              )}
            </div>
          </Card>
        </section>

        {/* TẦNG 2: BIỂU ĐỒ DÒNG TIỀN (8 cols) & DANH SÁCH VÍ TÀI KHOẢN (4 cols) */}
        <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Card Biểu đồ Phân tích */}
          <Card as="section" className="gap-0 p-0 lg:col-span-8">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  {chartTab === "cashflow"
                    ? "Thu nhập và chi tiêu theo tháng"
                    : "Biến động tổng số dư"}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Giao dịch đã ghi nhận · {formatDateRangeLabel(activeDateRange)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tabs
                  value={chartTab}
                  onValueChange={(val) => setChartTab(val as "cashflow" | "balance")}
                  className="gap-0"
                >
                  <TabsList
                    variant="navigation"
                    className="inline-grid w-auto grid-cols-2 gap-0.5"
                    aria-label="Chọn chế độ biểu đồ"
                  >
                    <TabsTrigger
                      value="cashflow"
                      variant="navigation"
                      className="h-7 px-3 text-xs"
                    >
                      Thu & Chi
                    </TabsTrigger>
                    <TabsTrigger
                      value="balance"
                      variant="navigation"
                      className="h-7 px-3 text-xs"
                    >
                      Số dư lũy kế
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </header>
            <div className="p-5">
              {chartTab === "cashflow" ? (
                <MonthlyFinancialChart
                  transactions={transactions}
                  currency={workspace.currency}
                  month={activeReportPeriod}
                  range={12}
                  walletId="all"
                  categoryId="all"
                  memberId="all"
                  transactionType="all"
                  dateRange={activeDateRange}
                  axisScale={getAmountScale(
                    buildMonthlyCashflow(transactions, {
                      endPeriod: activeReportPeriod,
                      range: 12,
                      walletId: "all",
                      categoryId: "all",
                      memberId: "all",
                      transactionType: "all",
                      dateRange: activeDateRange,
                    }).flatMap((row) => [row.income, row.expense]),
                  )}
                  isMobile={false}
                />
              ) : (
                <BalanceHistoryChart
                  wallets={wallets}
                  transactions={transactions}
                  currency={workspace.currency}
                  reportPeriod={activeReportPeriod}
                  periodOverride={globalPeriod}
                  isMobile={false}
                  hideCard
                />
              )}
            </div>
          </Card>

          {/* Card Danh sách Ví */}
          <Card as="section" className="flex flex-col gap-0 p-0 lg:col-span-4">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Ví tài khoản
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {wallets.length} tài khoản đang hoạt động
                </p>
              </div>
              <Link
                href="/wallets"
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation("/wallets");
                  }
                }}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs text-[var(--primary)] hover:text-[var(--primary)] cursor-pointer")}
              >
                Xem ví →
              </Link>
            </header>
            <div className="space-y-3 p-5">
              {wallets.length ? (
                wallets.map((wallet) => {
                  const balanceDec = new Decimal(wallet.balance);
                  const percent = totalBalanceDecimal.isPositive() && !totalBalanceDecimal.isZero()
                    ? Math.max(0, balanceDec.div(totalBalanceDecimal).times(100).toNumber())
                    : 0;
                  return (
                    <div
                      key={wallet.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 font-medium text-[var(--foreground)] truncate">
                          <Wallet className="size-3.5 shrink-0 text-[var(--primary)]" />
                          <span className="truncate">{wallet.name}</span>
                        </span>
                        <strong className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
                          {money(wallet.balance, workspace.currency)}
                        </strong>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                          <span
                            className="block h-full rounded-full bg-[var(--primary)]"
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                          {percent.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty
                  variant="compact"
                  title="Chưa có ví"
                  description="Thêm ví để bắt đầu theo dõi."
                />
              )}
            </div>
            <div className="border-t border-[var(--border)] p-4">
              <Popover
                open={Boolean(transferDraft)}
                onOpenChange={(open) => {
                  if (open) beginTransfer();
                  else if (!busy) setTransferDraft(null);
                }}
              >
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || wallets.length < 2}
                      className="w-full text-xs cursor-pointer"
                      aria-label="Chuyển tiền giữa các ví"
                    />
                  }
                >
                  <ArrowLeftRight className="mr-1.5 size-3.5" />
                  Chuyển tiền giữa các ví
                </PopoverTrigger>
                {transferDraft && (
                  <DesktopTransactionCreatePopoverContent
                    draft={transferDraft}
                    wallets={walletOptions}
                    categories={categoryOptions}
                    busy={busy}
                    onChange={(patch) =>
                      setTransferDraft((current) =>
                        current ? { ...current, ...patch } : current,
                      )
                    }
                    onSave={saveTransfer}
                    onCancel={() => setTransferDraft(null)}
                  />
                )}
              </Popover>
            </div>
          </Card>
        </section>

        {/* TẦNG 3: CHI TIÊU THEO DANH MỤC (7 cols) & THÀNH VIÊN (5 cols) */}
        <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Card Danh mục */}
          <Card as="section" className="gap-0 p-0 lg:col-span-7">
            <header className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Chi tiêu theo danh mục
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Tỷ trọng trong kỳ · Tổng chi {money(activeTotals.expense, workspace.currency)}
                </p>
              </div>
            </header>
            <div className="p-5">
              {desktopExpenseByCategory.length ? (
                <div className="space-y-4">
                  {desktopExpenseByCategory.slice(0, 5).map((item) => {
                    const percentage = activeTotals.expense.isZero()
                      ? new Decimal(0)
                      : item.amount.div(activeTotals.expense).times(100);
                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <CategoryIcon category={item} size={14} />
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
                  description="Dữ liệu theo danh mục sẽ xuất hiện khi có giao dịch chi."
                />
              )}
            </div>
          </Card>

          {/* Card Thành viên */}
          <Card as="section" className="gap-0 p-0 lg:col-span-5">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Chi tiêu theo thành viên
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Mức chi tiêu của {members.length} thành viên trong kỳ
                </p>
              </div>
              <Link
                href="/settings/workspace?tab=members"
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation("/settings/workspace?tab=members");
                  }
                }}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs text-[var(--primary)] hover:text-[var(--primary)] cursor-pointer")}
              >
                Thành viên →
              </Link>
            </header>
            <div className="space-y-4 p-5">
              {memberExpenses.length ? (
                memberExpenses.map((m, idx) => (
                  <div key={m.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-secondary)] text-[0.65rem] font-semibold text-[var(--foreground)] uppercase">
                          {m.name.slice(0, 2)}
                        </span>
                        <strong className="truncate font-medium text-[var(--foreground)]">
                          {m.name}
                        </strong>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
                        {money(m.spent, workspace.currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(100, m.percent)}%`,
                            backgroundColor: memberSeriesColor(idx),
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                        {m.percent.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  variant="compact"
                  title="Chưa có dữ liệu"
                  description="Chưa có chi tiêu nào từ các thành viên."
                />
              )}
            </div>
          </Card>
        </section>

        {/* TẦNG 4: GIAO DỊCH GẦN NHẤT (7 cols) & ĐỊNH KỲ SẮP TỚI (5 cols) */}
        <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Card Giao dịch gần đây */}
          <Card as="section" className="gap-0 p-0 lg:col-span-7">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Giao dịch gần đây
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  5 biến động gần nhất trong workspace
                </p>
              </div>
              <Link
                href={ledgerHref}
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation(ledgerHref);
                  }
                }}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs text-[var(--primary)] hover:text-[var(--primary)] cursor-pointer")}
              >
                Xem tất cả sổ cái →
              </Link>
            </header>
            <div className="divide-y divide-[var(--border)]">
              {recentTransactions.length ? (
                recentTransactions.map((tx) => {
                  const isIncome = tx.type === "income";
                  const isExpense = tx.type === "expense";
                  const dateStr = tx.date.slice(0, 10);
                  const [y, m, d] = dateStr.split("-");
                  const formattedDate = `${d}/${m}`;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-4 px-6 py-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            isIncome && "bg-[var(--income)]/10 text-[var(--income)]",
                            isExpense && "bg-[var(--expense)]/10 text-[var(--expense)]",
                            !isIncome && !isExpense && "bg-[var(--primary)]/10 text-[var(--primary)]",
                          )}
                        >
                          {isIncome && <ArrowDownLeft className="size-4" />}
                          {isExpense && <ArrowUpRight className="size-4" />}
                          {!isIncome && !isExpense && <ArrowLeftRight className="size-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--foreground)]">
                            {tx.description || tx.category?.name || (isIncome ? "Khoản thu" : "Khoản chi")}
                          </p>
                          <p className="mt-0.5 truncate text-[0.68rem] text-[var(--text-muted)]">
                            {tx.member} · {tx.wallet} · {formattedDate}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            isIncome && "text-[var(--income)]",
                            isExpense && "text-[var(--expense)]",
                            !isIncome && !isExpense && "text-[var(--foreground)]",
                          )}
                        >
                          {isIncome ? "+" : isExpense ? "−" : ""}
                          {money(tx.amount, workspace.currency)}
                        </span>
                        <p className="text-[0.68rem] text-[var(--text-muted)] capitalize">
                          {tx.status === "approved"
                            ? "Đã ghi nhận"
                            : tx.status === "pending"
                              ? "Chờ duyệt"
                              : tx.status}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center p-5">
                  <Empty
                    variant="compact"
                    title="Chưa có giao dịch"
                    description="Các giao dịch mới phát sinh sẽ hiển thị tại đây."
                  />
                  <Popover
                    open={Boolean(emptyCreateDraft)}
                    onOpenChange={(open) => {
                      if (open) beginEmptyCreate();
                      else if (!busy) setEmptyCreateDraft(null);
                    }}
                  >
                    <PopoverTrigger
                      render={
                        <Button
                          size="sm"
                          disabled={busy || !wallets.length}
                          className="mt-3 h-7 gap-1.5 px-3 text-xs cursor-pointer"
                          aria-label="Tạo giao dịch đầu tiên"
                        />
                      }
                    >
                      <Plus className="size-3.5" />
                      <span>Tạo giao dịch</span>
                    </PopoverTrigger>
                    {emptyCreateDraft && (
                      <DesktopTransactionCreatePopoverContent
                        draft={emptyCreateDraft}
                        wallets={walletOptions}
                        categories={categoryOptions}
                        busy={busy}
                        onChange={(patch) =>
                          setEmptyCreateDraft((current) =>
                            current ? { ...current, ...patch } : current,
                          )
                        }
                        onSave={saveEmptyCreate}
                        onCancel={() => setEmptyCreateDraft(null)}
                      />
                    )}
                  </Popover>
                </div>
              )}
            </div>
          </Card>

          {/* Card Định kỳ sắp tới */}
          <Card as="section" className="gap-0 p-0 lg:col-span-5">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Định kỳ sắp đến hạn
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Dự báo hóa đơn & dòng tiền định kỳ
                </p>
              </div>
              <Link
                href="/recurring-transactions"
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation("/recurring-transactions");
                  }
                }}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs text-[var(--primary)] hover:text-[var(--primary)] cursor-pointer")}
              >
                Quản lý →
              </Link>
            </header>
            <div className="divide-y divide-[var(--border)]">
              {upcomingRecurring && upcomingRecurring.length ? (
                upcomingRecurring.slice(0, 4).map((rec) => {
                  const dateStr = rec.nextExecutionDate.slice(0, 10);
                  const [y, m, d] = dateStr.split("-");
                  const formattedDate = `${d}/${m}`;
                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-4 px-6 py-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-8 shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[0.65rem] font-medium leading-none text-[var(--foreground)] tabular-nums">
                          <span>{d}</span>
                          <span className="text-[0.6rem] text-[var(--text-muted)]">Th{m}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--foreground)]">
                            {rec.description || rec.category?.name || "Giao dịch định kỳ"}
                          </p>
                          <p className="mt-0.5 truncate text-[0.68rem] text-[var(--text-muted)]">
                            Ví nguồn: {rec.wallet}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            rec.type === "income" && "text-[var(--income)]",
                            rec.type === "expense" && "text-[var(--expense)]",
                          )}
                        >
                          {rec.type === "income" ? "+" : rec.type === "expense" ? "−" : ""}
                          {money(rec.amount, workspace.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-5">
                  <Empty
                    variant="compact"
                    title="Chưa có khoản định kỳ"
                    description="Thiết lập giao dịch định kỳ để tự động dự báo dòng tiền."
                  />
                  <div className="mt-4 flex justify-center">
                    <Link
                      href="/recurring-transactions"
                      onClick={(event) => {
                        if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                          event.preventDefault();
                          beginNavigation("/recurring-transactions");
                        }
                      }}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs cursor-pointer")}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Tạo khoản định kỳ
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
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
        <header className="overview-mobile-dashboard-heading">
          <div>
            <span>Phân tích linh hoạt</span>
            <h2>Mỗi thẻ có kỳ xem riêng</h2>
          </div>
          <small>Tháng · Quý · Năm</small>
        </header>
        <MobileOverviewHome
          balance={Object.entries(totalByCurrency)
            .map(([currency, total]) => money(total, currency))
            .join(" · ")}
          transactions={transactions}
          reportPeriod={reportPeriod}
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
            periodData={{
              metric: "income",
              transactions,
              reportPeriod,
              currency: workspace.currency,
            }}
          />
          <Metric
            title="Chi phí trong kỳ"
            value={money(totals.expense, workspace.currency)}
            note="Chỉ giao dịch đã ghi nhận"
            icon={<TrendingDown size={18} />}
            tone="expense"
            periodData={{
              metric: "expense",
              transactions,
              reportPeriod,
              currency: workspace.currency,
            }}
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
            periodData={{
              metric: "net",
              transactions,
              reportPeriod,
              currency: workspace.currency,
            }}
          />
        </div>
        <div className="overview-grid">
          <CashflowOverviewCharts
            members={members}
            transactions={transactions}
            currency={workspace.currency}
            reportPeriod={reportPeriod}
            isMobile
          />
          <BalanceHistoryChart
            wallets={wallets}
            transactions={transactions}
            currency={workspace.currency}
            reportPeriod={reportPeriod}
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
                <DashboardPeriodFilter
                  value={categoryPeriod}
                  onValueChange={setCategoryPeriod}
                  ariaLabel="Chọn kỳ chi phí theo hạng mục"
                />
              </header>
              <MobileCategoryPie
                items={expenseByCategory}
                total={categoryTotals.expense}
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
          reportPeriod={reportPeriod}
        />
      </div>
    </PageContainer>
  );
}

function CashflowOverviewCharts({
  members,
  transactions,
  currency,
  reportPeriod,
  isMobile,
  periodOverride,
}: {
  members: { id: string; name: string }[];
  transactions: Transaction[];
  currency: string;
  reportPeriod: string;
  isMobile: boolean;
  periodOverride?: DashboardPeriod;
}) {
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>("month");
  const period = periodOverride ?? internalPeriod;
  const dateRange = getDashboardPeriodDateRange(reportPeriod, period);
  const range: CashflowRange = 12;
  const showMemberExpenseChart = members.length > 1;
  const visibleTypes = getVisibleCashflowTypes("all");
  const cashflow = buildMonthlyCashflow(transactions, {
    endPeriod: reportPeriod,
    range,
    walletId: "all",
    categoryId: "all",
    memberId: "all",
    transactionType: "all",
    dateRange,
  });
  const warningCount =
    visibleTypes.length === 2
      ? cashflow.filter((row) => row.hasWarning).length
      : 0;
  const axisScale = getAmountScale(
    cashflow.flatMap((row) =>
      visibleTypes.map((visibleType) => row[visibleType]),
    ),
  );

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
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {(!periodOverride || isMobile) && (
            <DashboardPeriodFilter
              value={period}
              onValueChange={setInternalPeriod}
              ariaLabel="Chọn kỳ biểu đồ thu nhập và chi tiêu"
            />
          )}
          <span
            className={`text-xs text-[var(--text-muted)] tabular-nums ${isMobile ? "hidden" : ""}`}
          >
            Đơn vị: {axisUnitLabel(axisScale, currency)}
          </span>
          {warningCount > 0 && (
            <span
              className={`overview-chart-warning ${isMobile ? "hidden" : ""}`}
              role="status"
            >
              <CircleAlert size={13} aria-hidden="true" />
              {warningCount} tháng chi vượt thu
            </span>
          )}
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
          month={reportPeriod}
          range={range}
          walletId="all"
          categoryId="all"
          memberId="all"
          transactionType="all"
          dateRange={dateRange}
          axisScale={axisScale}
          isMobile={isMobile}
        />
        {showMemberExpenseChart && (
          <MemberExpenseChart
            members={members}
            transactions={transactions}
            currency={currency}
            period={reportPeriod}
            range={range}
            walletId="all"
            categoryId="all"
            transactionType="all"
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
  reportPeriod,
  isMobile,
  periodOverride,
  hideCard,
}: {
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  reportPeriod: string;
  isMobile: boolean;
  periodOverride?: DashboardPeriod;
  hideCard?: boolean;
}) {
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>("month");
  const period = periodOverride ?? internalPeriod;
  const dateRange = getDashboardPeriodDateRange(reportPeriod, period);
  const visibleWallets = wallets;
  const balances = buildMonthlyBalances(wallets, transactions, {
    endPeriod: reportPeriod,
    range: 12,
    walletId: "all",
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
  const axisScale = getAmountScale(balances.map((row) => row.total));

  if (hideCard) {
    if (!visibleWallets.length) {
      return (
        <Empty
          variant="compact"
          icon={WalletCards}
          title="Chưa có ví đang hoạt động"
          description="Tạo hoặc kích hoạt ví để theo dõi lịch sử số dư."
        />
      );
    }
    return (
      <ChartContainer
        config={balanceChartConfig}
        className="h-[19rem] w-full px-2 pb-2 pt-2"
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
            width={56}
            tickLine={false}
            tickMargin={6}
            axisLine={false}
            tickCount={5}
            tickFormatter={(value) => formatScaledAmount(value, axisScale)}
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
            type="monotone"
            fill="var(--color-total)"
            fillOpacity={0.14}
            stroke="var(--color-total)"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
    );
  }

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
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {(!periodOverride || isMobile) && (
            <DashboardPeriodFilter
              value={period}
              onValueChange={setInternalPeriod}
              ariaLabel="Chọn kỳ lịch sử số dư"
            />
          )}
          <span
            className={`text-xs text-[var(--text-muted)] tabular-nums ${isMobile ? "hidden" : ""}`}
          >
            Đơn vị: {axisUnitLabel(axisScale, currency)}
          </span>
          {negativeMonthCount > 0 && (
            <span
              className={`overview-chart-warning ${isMobile ? "hidden" : ""}`}
              role="status"
            >
              <CircleAlert size={13} aria-hidden="true" />
              {negativeMonthCount} tháng có số dư âm
            </span>
          )}
        </div>
      </header>
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
              width={56}
              tickLine={false}
              tickMargin={6}
              axisLine={false}
              tickCount={5}
              tickFormatter={(value) => formatScaledAmount(value, axisScale)}
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
              type="monotone"
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
  axisScale,
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
  axisScale: AmountScale;
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
      {hasData ? (
        <ChartContainer
          config={monthlyChartConfig}
          className={isMobile ? "overview-expense-chart" : "h-[20rem] w-full"}
          aria-label={`Biểu đồ thu nhập và chi tiêu trong ${cashflow.length} tháng thuộc khoảng đã chọn`}
        >
          <ComposedChart
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
              width={56}
              tickLine={false}
              tickMargin={6}
              axisLine={false}
              tickCount={5}
              tickFormatter={(value) => formatScaledAmount(value, axisScale)}
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
                type="monotone"
                stroke="var(--color-income)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {visibleTypes.includes("expense") && (
              <Bar
                dataKey="expense"
                fill="var(--color-expense)"
                radius={[5, 5, 1, 1]}
                maxBarSize={28}
              />
            )}
          </ComposedChart>
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
  transactions,
  reportPeriod,
  currency,
  walletCount,
}: {
  balance: string;
  transactions: Transaction[];
  reportPeriod: string;
  currency: string;
  walletCount: number;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const totals = summarizeTransactions(
    transactions,
    getDashboardPeriodDateRange(reportPeriod, period),
  );
  const { income, expense } = totals;
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
          <DashboardPeriodFilter
            value={period}
            onValueChange={setPeriod}
            ariaLabel="Chọn kỳ tổng quan tài chính"
          />
        </header>
        <strong className="overview-mobile-balance-value">{balance}</strong>
        <small className="inline-flex items-center gap-1 text-[var(--text-muted)]">
          <WalletCards size={13} aria-hidden="true" /> {walletCount} ví
        </small>
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
  reportPeriod,
}: {
  members: { id: string; name: string }[];
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  reportPeriod: string;
}) {
  const [memberPeriod, setMemberPeriod] = useState<DashboardPeriod>("month");
  const [balancePeriod, setBalancePeriod] = useState<DashboardPeriod>("month");
  const [cashflowPeriod, setCashflowPeriod] = useState<DashboardPeriod>("month");
  const showMemberComparison = members.length >= 2;
  const visibleMembers = showMemberComparison ? members : [];
  const memberMetricType: CashflowType = "expense";
  const memberTotals = showMemberComparison
    ? buildMemberMonthlyTotals(visibleMembers, transactions, {
        endPeriod: reportPeriod,
        range: 12,
        walletId: "all",
        categoryId: "all",
        type: memberMetricType,
        dateRange: getDashboardPeriodDateRange(reportPeriod, memberPeriod),
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
    endPeriod: reportPeriod,
    range: 12,
    walletId: "all",
    dateRange: getDashboardPeriodDateRange(reportPeriod, balancePeriod),
  });
  const balanceRows = balances.map((row) => ({
    label: mobileMonthLabel(row.period),
    fullLabel: fullMonthLabel(row.period),
    total: new Decimal(row.total).toNumber(),
  }));
  const balanceHasData = wallets.length > 0;

  const monthlyCashflow = buildMonthlyCashflow(transactions, {
    endPeriod: reportPeriod,
    range: 12,
    walletId: "all",
    categoryId: "all",
    memberId: "all",
    transactionType: "all",
    dateRange: getDashboardPeriodDateRange(reportPeriod, cashflowPeriod),
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
                Chi tiêu theo từng tháng
              </p>
            </div>
            <DashboardPeriodFilter
              value={memberPeriod}
              onValueChange={setMemberPeriod}
              ariaLabel="Chọn kỳ so sánh thành viên"
            />
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
                "Chưa có dữ liệu thành viên"
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
          <DashboardPeriodFilter
            value={balancePeriod}
            onValueChange={setBalancePeriod}
            ariaLabel="Chọn kỳ tổng số dư theo tháng"
          />
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
          <DashboardPeriodFilter
            value={cashflowPeriod}
            onValueChange={setCashflowPeriod}
            ariaLabel="Chọn kỳ thu nhập và chi tiêu"
          />
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
  periodData,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
  periodData?: {
    metric: "income" | "expense" | "net";
    transactions: Transaction[];
    reportPeriod: string;
    currency: string;
  };
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const totals = periodData
    ? summarizeTransactions(
        periodData.transactions,
        getDashboardPeriodDateRange(periodData.reportPeriod, period),
      )
    : null;
  const resolvedValue =
    !periodData || !totals
      ? value
      : money(
          periodData.metric === "income"
            ? totals.income
            : periodData.metric === "expense"
              ? totals.expense
              : totals.income.minus(totals.expense),
          periodData.currency,
        );

  return (
    <Card
      as="section"
      className={`overview-metric ${tone} relative gap-0 py-0`}
    >
      <span>{icon}</span>
      {periodData && (
        <div className="absolute right-4 top-4">
          <DashboardPeriodFilter
            value={period}
            onValueChange={setPeriod}
            ariaLabel={`Chọn kỳ ${title.toLocaleLowerCase("vi")}`}
          />
        </div>
      )}
      <p>{title}</p>
      <strong>{resolvedValue}</strong>
      <small>{note}</small>
    </Card>
  );
}
