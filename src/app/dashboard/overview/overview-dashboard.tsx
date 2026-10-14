"use client";

import {
  Button,
  buttonVariants,
  Card,
  CategoryIcon,
  Empty,
  PageHeader,
  Popover,
  PopoverTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  type DashboardPeriod,
  type DateRangeValue,
} from "@/components/base";
import Decimal from "decimal.js";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  PiggyBank,
  Plus,
  RotateCcw,
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
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildDailyBalances,
  buildDailyCashflow,
  buildMonthlyBalances,
  buildMonthlyCashflow,
  getDashboardPeriodDateRange,
  getVisibleCashflowTypes,
  type CashflowRange,
} from "@/app/dashboard/overview/overview-chart-data";
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
  purpose?:
    | "standard"
    | "credit_card_payment"
    | "credit_card_refund"
    | "credit_card_installment_fee";
  paymentSources?: { walletId: string; amount: string }[];
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
  wallets: {
    id: string;
    name: string;
    kind: "asset" | "credit_card";
    balance: string;
    committed: string;
    available: string;
    defaultFundingWalletId?: string | null;
    updatedAt: string;
  }[];
  totalByCurrency: Record<string, string>;
  members: { id: string; name: string }[];
  transactions: Transaction[];
  userRole?: string;
  upcomingRecurring?: UpcomingRecurring[];
  categories?: TransactionCategoryOption[];
  businessDate?: string;
};

type MainChartTab = "cashflow" | "balance" | "category" | "member";

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
  if (year < currentYear) return { elapsed: totalDays, total: totalDays };
  if (year > currentYear) return { elapsed: 1, total: totalDays };
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const diffDays = Math.max(
    1,
    Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return { elapsed: Math.min(diffDays, totalDays), total: totalDays };
}

export function OverviewDashboard({
  workspace,
  reportPeriod,
  wallets,
  totalByCurrency,
  members,
  transactions,
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
    () =>
      wallets.map((w) => ({
        id: w.id,
        name: w.name,
        kind: w.kind,
        defaultFundingWalletId: w.defaultFundingWalletId,
      })),
    [wallets],
  );

  const categoryOptions = useMemo<TransactionCategoryOption[]>(
    () => categories ?? [],
    [categories],
  );

  const defaultDate = businessDate ?? `${reportPeriod}-01`;

  function beginCreate() {
    setCreateDraft(
      createTransactionDraft(walletOptions, categoryOptions, defaultDate),
    );
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
    const draft = createTransactionDraft(
      walletOptions,
      categoryOptions,
      defaultDate,
    );
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
              : "Đã ghi nhận giao dịch chuyển khoản.",
        );
        setTransferDraft(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể chuyển khoản.");
      }
    });
  }

  function beginEmptyCreate() {
    setEmptyCreateDraft(
      createTransactionDraft(walletOptions, categoryOptions, defaultDate),
    );
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

  const [globalPeriod, setGlobalPeriod] = useState<DashboardPeriod>("quarter");
  const [activeReportPeriod, setActiveReportPeriod] =
    useState<string>(reportPeriod);
  const [chartTab, setChartTab] = useState<MainChartTab>("cashflow");

  const activeDateRange = getDashboardPeriodDateRange(
    activeReportPeriod,
    globalPeriod,
  );
  const activeTotals = summarizeTransactions(transactions, activeDateRange);
  const activeNetCashflow = activeTotals.income.minus(activeTotals.expense);
  const periodProgress = calculatePeriodProgress(
    activeReportPeriod,
    globalPeriod,
  );
  const dailyBurnRate = activeTotals.expense.div(periodProgress.elapsed);

  const totalBalanceDecimal = wallets.reduce(
    (sum, w) =>
      w.kind === "credit_card" ? sum : sum.plus(new Decimal(w.balance)),
    new Decimal(0),
  );
  const totalAvailableDecimal = wallets.reduce(
    (sum, w) =>
      w.kind === "credit_card" ? sum : sum.plus(new Decimal(w.available)),
    new Decimal(0),
  );
  const totalCommittedDecimal = wallets.reduce(
    (sum, w) =>
      w.kind === "credit_card" ? sum : sum.plus(new Decimal(w.committed)),
    new Decimal(0),
  );

  const savingsRate = activeTotals.income.gt(0)
    ? activeNetCashflow.div(activeTotals.income).times(100).toNumber()
    : activeTotals.expense.gt(0)
      ? -100
      : 0;

  const pendingTransactions = transactions.filter(
    (t) => t.status === "pending",
  );
  const recentTransactions = transactions.slice(0, 6);

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

  const expenseByCategory = (() => {
    const rows = new Map<
      string,
      { name: string; color: string; icon: string | null; amount: Decimal }
    >();
    transactions
      .filter(
        (item) =>
          item.status === "approved" &&
          isInDateRange(item.date, activeDateRange) &&
          item.type === "expense",
      )
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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (): void => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const chartTitle =
    chartTab === "cashflow"
      ? globalPeriod === "month"
        ? "Biến động thu chi theo ngày"
        : "Biến động thu chi theo tháng"
      : chartTab === "balance"
        ? globalPeriod === "month"
          ? "Số dư lũy kế theo ngày"
          : "Số dư lũy kế theo tháng"
        : chartTab === "category"
          ? "Cơ cấu chi tiêu theo danh mục"
          : "Chi tiêu theo thành viên";

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 1. Header & Period Controls */}
      <PageHeader
        eyebrow={workspace.name}
        title="Tổng quan tài chính"
        description="Theo dõi tài sản, thu chi và lịch thanh toán định kỳ."
      >
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
          <div className="flex items-center justify-between gap-2 md:justify-start">
            <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
              <Button
                variant="icon"
                size="icon"
                onClick={() =>
                  setActiveReportPeriod((prev) =>
                    shiftReportPeriod(prev, -1, globalPeriod),
                  )
                }
                aria-label="Kỳ trước"
                title="Kỳ trước"
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
                  "min-w-[6.25rem] px-2 text-center text-xs font-semibold tabular-nums select-none",
                  activeReportPeriod !== reportPeriod
                    ? "cursor-pointer text-[var(--primary)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {formatPeriodLabel(activeReportPeriod, globalPeriod)}
              </span>
              <Button
                variant="icon"
                size="icon"
                onClick={() =>
                  setActiveReportPeriod((prev) =>
                    shiftReportPeriod(prev, 1, globalPeriod),
                  )
                }
                aria-label="Kỳ sau"
                title="Kỳ sau"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {activeReportPeriod !== reportPeriod && (
              <Button
                type="button"
                variant="selected"
                size="icon"
                onClick={() => setActiveReportPeriod(reportPeriod)}
                aria-label="Về kỳ hiện tại"
                title="Về kỳ hiện tại"
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tabs
              value={globalPeriod}
              onValueChange={(val) => setGlobalPeriod(val as DashboardPeriod)}
              className="min-w-0 flex-1 gap-0 md:flex-initial"
            >
              <TabsList
                variant="navigation"
                className="grid w-full grid-cols-3 md:inline-grid md:w-auto"
                aria-label="Chọn kỳ xem dữ liệu"
              >
                <TabsTrigger value="month">Tháng</TabsTrigger>
                <TabsTrigger value="quarter">Quý</TabsTrigger>
                <TabsTrigger value="year">Năm</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="hidden md:block">
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
                      size="icon"
                      disabled={busy || !wallets.length}
                      aria-label="Tạo giao dịch mới"
                      title="Tạo giao dịch mới"
                    />
                  }
                >
                  <Plus className="size-4" />
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
          </div>
        </div>
      </PageHeader>

      {/* 2. Unified 4-Metric Summary Strip */}
      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Chỉ số tài chính chính"
      >
        {/* Card 1: Tổng tài sản */}
        <Card as="article" size="sm" className="min-w-0 gap-1.5">
          <div className="flex min-w-0 items-start justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Tổng tài sản</span>
            <WalletCards
              className="size-4 shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
          </div>
          <strong className="block break-words text-base font-bold leading-snug tracking-tight text-[var(--foreground)] tabular-nums md:text-xl">
            {balanceLabel}
          </strong>
          <p className="break-words border-t border-[var(--border)] pt-2 text-[0.7rem] leading-snug text-[var(--text-muted)] tabular-nums">
            Số dư có thể dùng: {money(totalAvailableDecimal, workspace.currency)}
          </p>
        </Card>

        {/* Card 2: Thu nhập kỳ này */}
        <Card as="article" size="sm" className="min-w-0 gap-1.5">
          <div className="flex min-w-0 items-start justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Thu nhập kỳ này</span>
            <ArrowDownLeft
              className="size-4 shrink-0 text-[var(--income)]"
              aria-hidden="true"
            />
          </div>
          <strong className="block break-words text-base font-bold leading-snug tracking-tight text-[var(--income)] tabular-nums md:text-xl">
            +{money(activeTotals.income, workspace.currency)}
          </strong>
          <p className="break-words border-t border-[var(--border)] pt-2 text-[0.7rem] leading-snug text-[var(--text-muted)] tabular-nums">
            {formatPeriodLabel(activeReportPeriod, globalPeriod)}
          </p>
        </Card>

        {/* Card 3: Chi tiêu kỳ này */}
        <Card as="article" size="sm" className="min-w-0 gap-1.5">
          <div className="flex min-w-0 items-start justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Chi tiêu kỳ này</span>
            <ArrowUpRight
              className="size-4 shrink-0 text-[var(--expense)]"
              aria-hidden="true"
            />
          </div>
          <strong className="block break-words text-base font-bold leading-snug tracking-tight text-[var(--expense)] tabular-nums md:text-xl">
            −{money(activeTotals.expense, workspace.currency)}
          </strong>
          <p className="break-words border-t border-[var(--border)] pt-2 text-[0.7rem] leading-snug text-[var(--text-muted)] tabular-nums">
            Trung bình ~{money(dailyBurnRate.round(), workspace.currency)}/ngày
          </p>
        </Card>

        {/* Card 4: Chênh lệch thu chi */}
        <Card as="article" size="sm" className="min-w-0 gap-1.5">
          <div className="flex min-w-0 items-start justify-between gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="break-words leading-snug">Chênh lệch thu chi</span>
            {activeNetCashflow.isNegative() ? (
              <TrendingDown
                className="size-4 shrink-0 text-[var(--expense)]"
                aria-hidden="true"
              />
            ) : (
              <TrendingUp
                className="size-4 shrink-0 text-[var(--income)]"
                aria-hidden="true"
              />
            )}
          </div>
          <strong
            className={cn(
              "block break-words text-base font-bold leading-snug tracking-tight tabular-nums md:text-xl",
              activeNetCashflow.isNegative()
                ? "text-[var(--expense)]"
                : "text-[var(--income)]",
            )}
          >
            {activeNetCashflow.isNegative() ? "−" : "+"}
            {money(activeNetCashflow.abs(), workspace.currency)}
          </strong>
          <p className="break-words border-t border-[var(--border)] pt-2 text-[0.7rem] leading-snug text-[var(--text-muted)] tabular-nums">
            <PiggyBank className="mr-1 inline size-3 text-[var(--primary)]" />
            Tích lũy {savingsRate > 0 ? "+" : ""}
            {savingsRate.toFixed(1)}% ({periodProgress.elapsed}/{periodProgress.total} ngày)
          </p>
        </Card>
      </section>

      {/* 3. Main Tabbed Chart Card & Wallets */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Main Chart Card (Thu chi / Số dư / Danh mục / Thành viên) */}
        <Card
          as="section"
          className="flex min-w-0 flex-col gap-0 p-0 lg:col-span-8"
        >
          <header className="flex flex-col gap-3 border-b border-[var(--border)] p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                {chartTitle}
              </h2>
              <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                Đã ghi nhận · {formatDateRangeLabel(activeDateRange)}
              </p>
            </div>
            <Tabs
              value={chartTab}
              onValueChange={(val) => setChartTab(val as MainChartTab)}
              className="w-full gap-0 md:w-auto"
            >
              <TabsList
                variant="navigation"
                className="grid w-full grid-cols-4 md:inline-grid md:w-auto"
                aria-label="Chọn biểu đồ phân tích"
              >
                <TabsTrigger value="cashflow">Thu chi</TabsTrigger>
                <TabsTrigger value="balance">Số dư</TabsTrigger>
                <TabsTrigger value="category">Danh mục</TabsTrigger>
                <TabsTrigger value="member">Thành viên</TabsTrigger>
              </TabsList>
            </Tabs>
          </header>

          <div className="flex-1 p-4 md:p-5">
            {chartTab === "cashflow" && (
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
                  (globalPeriod === "month"
                    ? buildDailyCashflow(transactions, {
                        endPeriod: activeReportPeriod,
                        walletId: "all",
                        categoryId: "all",
                        memberId: "all",
                        transactionType: "all",
                        dateRange: activeDateRange,
                      })
                    : buildMonthlyCashflow(transactions, {
                        endPeriod: activeReportPeriod,
                        range: 12,
                        walletId: "all",
                        categoryId: "all",
                        memberId: "all",
                        transactionType: "all",
                        dateRange: activeDateRange,
                      })
                  ).flatMap((row) => [row.income, row.expense]),
                )}
                isMobile={isMobile}
                period={globalPeriod}
              />
            )}

            {chartTab === "balance" && (
              <BalanceHistoryChart
                wallets={wallets}
                transactions={transactions}
                currency={workspace.currency}
                reportPeriod={activeReportPeriod}
                periodOverride={globalPeriod}
                isMobile={isMobile}
              />
            )}

            {chartTab === "category" && (
              <div className="space-y-3.5">
                {expenseByCategory.length ? (
                  expenseByCategory.slice(0, 6).map((item) => {
                    const percentage = activeTotals.expense.isZero()
                      ? new Decimal(0)
                      : item.amount.div(activeTotals.expense).times(100);
                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <CategoryIcon category={item} size={14} />
                            <strong className="break-words font-medium leading-snug text-[var(--foreground)]">
                              {item.name}
                            </strong>
                          </span>
                          <div className="shrink-0 text-right tabular-nums">
                            <span className="font-semibold text-[var(--foreground)]">
                              {money(item.amount, workspace.currency)}
                            </span>
                            <span className="ml-1.5 text-[0.7rem] text-[var(--text-muted)]">
                              ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.min(100, percentage.toNumber())}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Empty
                    variant="compact"
                    title="Chưa có chi tiêu"
                    description="Dữ liệu danh mục sẽ hiển thị khi có giao dịch chi tiêu đã ghi nhận."
                  />
                )}
              </div>
            )}

            {chartTab === "member" && (
              <div className="space-y-3.5">
                {memberExpenses.length ? (
                  <>
                    {memberExpenses.map((m, idx) => (
                      <div key={m.id} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-secondary)] text-[0.68rem] font-semibold uppercase text-[var(--foreground)]">
                              {m.name.slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <strong className="block break-words font-medium leading-snug text-[var(--foreground)]">
                                {m.name}
                              </strong>
                              <span className="text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                                {m.percent.toFixed(0)}% tổng chi tiêu
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 font-semibold text-[var(--foreground)] tabular-nums">
                            {money(m.spent, workspace.currency)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.min(100, m.percent)}%`,
                              backgroundColor: memberSeriesColor(idx),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-right">
                      <Link
                        href="/settings/workspace?tab=members"
                        onClick={(event) => {
                          if (
                            !event.ctrlKey &&
                            !event.metaKey &&
                            event.button === 0
                          ) {
                            event.preventDefault();
                            beginNavigation("/settings/workspace?tab=members");
                          }
                        }}
                        aria-label="Quản lý thành viên"
                        title="Quản lý thành viên"
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon",
                        })}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <Empty
                    variant="compact"
                    title="Chưa có dữ liệu thành viên"
                    description="Chưa có chi tiêu nào từ các thành viên trong kỳ."
                  />
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Wallets Summary Card */}
        <Card
          as="section"
          className="flex min-w-0 flex-col gap-0 p-0 lg:col-span-4"
        >
          <header className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-4 md:p-5">
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                Ví & Thẻ ({wallets.length})
              </h2>
              <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                {totalCommittedDecimal.gt(0)
                  ? `Tiền chờ thanh toán thẻ: ${money(totalCommittedDecimal, workspace.currency)}`
                  : "Số dư thực tế và số dư có thể dùng"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
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
                      size="icon"
                      disabled={busy || wallets.length < 2}
                      aria-label="Chuyển tiền giữa các ví"
                      title="Chuyển tiền giữa các ví"
                    />
                  }
                >
                  <ArrowLeftRight className="size-4" />
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
              <Link
                href="/wallets"
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation("/wallets");
                  }
                }}
                aria-label="Xem danh sách ví"
                title="Xem danh sách ví"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "shrink-0",
                )}
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </header>

          <div className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {wallets.length ? (
              wallets.map((wallet) => {
                const balanceDec = new Decimal(wallet.balance);
                const committedDec = new Decimal(wallet.committed);
                const percent =
                  wallet.kind === "asset" &&
                  totalBalanceDecimal.isPositive() &&
                  !totalBalanceDecimal.isZero()
                    ? Math.max(
                        0,
                        balanceDec
                          .div(totalBalanceDecimal)
                          .times(100)
                          .toNumber(),
                      )
                    : 0;
                return (
                  <div
                    key={wallet.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 text-xs md:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]">
                        {wallet.kind === "credit_card" ? (
                          <CreditCard className="size-4" />
                        ) : (
                          <Wallet className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block break-words font-semibold leading-snug text-[var(--foreground)]">
                          {wallet.name}
                        </span>
                        {wallet.kind === "credit_card" ? (
                          <p className="mt-0.5 break-words text-[0.68rem] leading-snug text-[var(--text-muted)]">
                            Dư nợ thẻ tín dụng
                          </p>
                        ) : committedDec.gt(0) ? (
                          <p className="mt-0.5 break-words text-[0.68rem] leading-snug text-[var(--text-muted)] tabular-nums">
                            Số dư có thể dùng:{" "}
                            {money(wallet.available, workspace.currency)} · Tiền
                            chờ thanh toán thẻ:{" "}
                            {money(wallet.committed, workspace.currency)}
                          </p>
                        ) : (
                          <p className="mt-0.5 break-words text-[0.68rem] leading-snug text-[var(--text-muted)] tabular-nums">
                            Số dư có thể dùng:{" "}
                            {money(wallet.available, workspace.currency)}
                            {wallets.length > 1
                              ? ` (${percent.toFixed(0)}%)`
                              : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <strong className="shrink-0 text-right font-semibold text-[var(--foreground)] tabular-nums">
                      {money(wallet.balance, workspace.currency)}
                    </strong>
                  </div>
                );
              })
            ) : (
              <div className="p-4">
                <Empty
                  variant="compact"
                  title="Chưa có ví"
                  description="Thêm ví để bắt đầu theo dõi tài sản."
                />
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 4. Bottom 2-Column Grid: Giao dịch gần đây & Lịch thu chi sắp tới / Cần xử lý */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Column 1: Giao dịch gần đây */}
        <Card as="section" className="flex min-w-0 flex-col gap-0 p-0">
          <header className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-4 md:p-5">
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                Giao dịch gần đây
              </h2>
              <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                Biến động thu chi mới nhất trong nhóm
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
              aria-label="Mở sổ giao dịch"
              title="Mở sổ giao dịch"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "shrink-0",
              )}
            >
              <ChevronRight className="size-4" />
            </Link>
          </header>

          <div className="flex-1 divide-y divide-[var(--border)]">
            {recentTransactions.length ? (
              recentTransactions.map((tx) => {
                const isIncome = tx.type === "income";
                const isExpense = tx.type === "expense";
                const dateStr = tx.date.slice(0, 10);
                const [, m, d] = dateStr.split("-");
                const formattedDate = `${d}/${m}`;
                return (
                  <div
                    key={tx.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 text-xs md:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          isIncome &&
                            "bg-[var(--income)]/10 text-[var(--income)]",
                          isExpense &&
                            "bg-[var(--expense)]/10 text-[var(--expense)]",
                          !isIncome &&
                            !isExpense &&
                            "bg-[var(--primary)]/10 text-[var(--primary)]",
                        )}
                      >
                        {tx.category ? (
                          <CategoryIcon category={tx.category} size={15} />
                        ) : isIncome ? (
                          <ArrowDownLeft className="size-4" />
                        ) : isExpense ? (
                          <ArrowUpRight className="size-4" />
                        ) : (
                          <ArrowLeftRight className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium leading-snug text-[var(--foreground)]">
                          {tx.description ||
                            tx.category?.name ||
                            (isIncome
                              ? "Khoản thu"
                              : isExpense
                                ? "Khoản chi"
                                : "Chuyển khoản")}
                        </p>
                        <p className="mt-0.5 break-words text-[0.68rem] leading-snug text-[var(--text-muted)]">
                          {tx.wallet} · {tx.member} · {formattedDate}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block font-semibold tabular-nums",
                          isIncome && "text-[var(--income)]",
                          isExpense && "text-[var(--expense)]",
                          !isIncome && !isExpense && "text-[var(--foreground)]",
                        )}
                      >
                        {isIncome ? "+" : isExpense ? "−" : "↔"}
                        {money(tx.amount, workspace.currency)}
                      </span>
                      <span
                        className={cn(
                          "text-[0.65rem]",
                          tx.status === "pending"
                            ? "font-medium text-[var(--warning)]"
                            : "text-[var(--text-muted)]",
                        )}
                      >
                        {tx.status === "approved"
                          ? "Đã ghi nhận"
                          : tx.status === "pending"
                            ? "Chờ duyệt"
                            : tx.status === "scheduled"
                              ? "Đã lên lịch"
                              : "Từ chối"}
                      </span>
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
                        size="icon"
                        disabled={busy || !wallets.length}
                        className="mt-3"
                        aria-label="Tạo giao dịch đầu tiên"
                        title="Tạo giao dịch đầu tiên"
                      />
                    }
                  >
                    <Plus className="size-4" />
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

        {/* Column 2: Lịch thu chi sắp tới & Cần xử lý */}
        <Card as="section" className="flex min-w-0 flex-col gap-0 p-0">
          <header className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-4 md:p-5">
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                Lịch thu chi sắp tới
              </h2>
              <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                Khoản thu chi định kỳ và giao dịch cần duyệt
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
              aria-label="Xem giao dịch định kỳ"
              title="Xem giao dịch định kỳ"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "shrink-0",
              )}
            >
              <ChevronRight className="size-4" />
            </Link>
          </header>

          {pendingTransactions.length > 0 && (
            <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] px-4 py-2.5 md:px-5">
              <Link
                href={`${ledgerHref}?status=pending`}
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation(`${ledgerHref}?status=pending`);
                  }
                }}
                aria-label={`Xử lý ${pendingTransactions.length} giao dịch đang chờ duyệt`}
                title={`Xử lý ${pendingTransactions.length} giao dịch đang chờ duyệt`}
                className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--warning)]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CircleAlert className="size-4 shrink-0" />
                  <span className="break-words leading-snug">
                    Có {pendingTransactions.length} giao dịch đang chờ duyệt
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0" />
              </Link>
            </div>
          )}

          <div className="flex-1 divide-y divide-[var(--border)]">
            {upcomingRecurring && upcomingRecurring.length ? (
              upcomingRecurring.slice(0, 5).map((rec) => {
                const dateStr = rec.nextExecutionDate.slice(0, 10);
                const [, m, d] = dateStr.split("-");
                return (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 text-xs md:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-8 shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[0.65rem] font-semibold leading-none text-[var(--foreground)] tabular-nums">
                        <span>{d}</span>
                        <span className="text-[0.58rem] text-[var(--text-muted)]">
                          T{m}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium leading-snug text-[var(--foreground)]">
                          {rec.description ||
                            rec.category?.name ||
                            "Giao dịch định kỳ"}
                        </p>
                        <p className="mt-0.5 break-words text-[0.68rem] leading-snug text-[var(--text-muted)]">
                          Ví: {rec.wallet}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          rec.type === "income" && "text-[var(--income)]",
                          rec.type === "expense" && "text-[var(--expense)]",
                        )}
                      >
                        {rec.type === "income"
                          ? "+"
                          : rec.type === "expense"
                            ? "−"
                            : "↔"}
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
                  icon={CalendarClock}
                  title="Chưa có lịch định kỳ sắp tới"
                  description="Thiết lập khoản thu chi định kỳ để chủ động theo dõi hóa đơn."
                />
                <div className="mt-3 flex justify-center">
                  <Link
                    href="/recurring-transactions"
                    onClick={(event) => {
                      if (
                        !event.ctrlKey &&
                        !event.metaKey &&
                        event.button === 0
                      ) {
                        event.preventDefault();
                        beginNavigation("/recurring-transactions");
                      }
                    }}
                    aria-label="Tạo lịch định kỳ"
                    title="Tạo lịch định kỳ"
                    className={buttonVariants({
                      variant: "outline",
                      size: "icon",
                    })}
                  >
                    <Plus className="size-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function BalanceHistoryChart({
  wallets,
  transactions,
  currency,
  reportPeriod,
  isMobile,
  periodOverride,
}: {
  wallets: { id: string; name: string; balance: string }[];
  transactions: Transaction[];
  currency: string;
  reportPeriod: string;
  isMobile: boolean;
  periodOverride?: DashboardPeriod;
}) {
  const period = periodOverride ?? "month";
  const dateRange = getDashboardPeriodDateRange(reportPeriod, period);
  const isDaily = period === "month";
  const balances = isDaily
    ? buildDailyBalances(wallets, transactions, {
        walletId: "all",
        dateRange,
      })
    : buildMonthlyBalances(wallets, transactions, {
        endPeriod: reportPeriod,
        range: 12,
        walletId: "all",
        dateRange,
      });

  const rows = balances.map((row) => {
    const parts = row.period.split("-");
    if (parts.length === 3) {
      const [year, rowMonth, day] = parts;
      return {
        period: row.period,
        label: `${day}/${rowMonth}`,
        fullLabel: `Ngày ${day}/${rowMonth}/${year}`,
        total: new Decimal(row.total).toNumber(),
      };
    }
    const [year, rowMonth] = parts;
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

  if (!wallets.length) {
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
      className="h-[15rem] w-full md:h-[19rem]"
      aria-label={
        isDaily
          ? `Biểu đồ tổng số dư trong ${balances.length} ngày thuộc khoảng đã chọn`
          : `Biểu đồ tổng số dư trong ${balances.length} tháng thuộc khoảng đã chọn`
      }
    >
      <AreaChart
        data={rows}
        accessibilityLayer
        margin={{
          top: 8,
          right: isMobile ? 12 : 8,
          left: isMobile ? -16 : 0,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
        <XAxis
          dataKey="label"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          interval={isDaily ? (isMobile ? 4 : 2) : "preserveEnd"}
          padding={{ left: isMobile ? 8 : 12, right: isMobile ? 14 : 12 }}
          tickFormatter={(value) => {
            if (
              isMobile &&
              isDaily &&
              typeof value === "string" &&
              value.includes("/")
            ) {
              return value.split("/")[0];
            }
            return value;
          }}
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <YAxis
          width={isMobile ? 36 : 56}
          tickLine={false}
          tickMargin={isMobile ? 2 : 6}
          axisLine={false}
          tickCount={isMobile ? 4 : 5}
          allowDecimals={false}
          tickFormatter={(value) => formatScaledAmount(value, axisScale)}
          tick={{ fontSize: isMobile ? 10 : 12 }}
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
                  <span className="text-muted-foreground">Tổng số dư</span>
                  <strong className="text-foreground tabular-nums">
                    {money(String(value), currency)}
                  </strong>
                </div>
              )}
            />
          }
        />
        <ChartLegend
          verticalAlign="bottom"
          content={
            <ChartLegendContent className="flex-wrap justify-center gap-4 pt-2 text-xs md:justify-start" />
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
  period,
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
  period?: DashboardPeriod;
}) {
  const visibleTypes = getVisibleCashflowTypes(transactionType, categoryType);
  const isDaily = period === "month";
  const cashflow = isDaily
    ? buildDailyCashflow(transactions, {
        endPeriod: month,
        walletId,
        categoryId,
        memberId,
        transactionType,
        categoryType,
        dateRange,
      })
    : buildMonthlyCashflow(transactions, {
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
    const parts = item.period.split("-");
    if (parts.length === 3) {
      const [year, rowMonth, day] = parts;
      return {
        ...item,
        label: `${day}/${rowMonth}`,
        fullLabel: `Ngày ${day}/${rowMonth}/${year}`,
        income: new Decimal(item.income).toNumber(),
        expense: new Decimal(item.expense).toNumber(),
      };
    }
    const [year, rowMonth] = parts;
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
      ? "Biểu đồ thu chi không áp dụng cho giao dịch chuyển khoản."
      : visibleTypes.length === 0
        ? "Loại giao dịch không thuộc danh mục đang chọn."
        : "Chưa có giao dịch đã ghi nhận trong khoảng thời gian này.";

  return (
    <section className="min-w-0" aria-label="Biểu đồ thu nhập và chi tiêu">
      {hasData ? (
        <ChartContainer
          config={monthlyChartConfig}
          className="h-[15rem] w-full md:h-[19rem]"
          aria-label={
            isDaily
              ? `Biểu đồ thu nhập và chi tiêu trong ${cashflow.length} ngày thuộc khoảng đã chọn`
              : `Biểu đồ thu nhập và chi tiêu trong ${cashflow.length} tháng thuộc khoảng đã chọn`
          }
        >
          <ComposedChart
            data={rows}
            accessibilityLayer
            margin={{
              top: 8,
              right: isMobile ? 12 : 8,
              left: isMobile ? -16 : 0,
              bottom: 0,
            }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              opacity={0.35}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              interval={isDaily ? (isMobile ? 4 : 2) : "preserveEnd"}
              padding={{ left: isMobile ? 8 : 12, right: isMobile ? 14 : 12 }}
              tickFormatter={(value) => {
                if (
                  isMobile &&
                  isDaily &&
                  typeof value === "string" &&
                  value.includes("/")
                ) {
                  return value.split("/")[0];
                }
                return value;
              }}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <YAxis
              width={isMobile ? 36 : 56}
              tickLine={false}
              tickMargin={isMobile ? 2 : 6}
              axisLine={false}
              tickCount={isMobile ? 4 : 5}
              allowDecimals={false}
              tickFormatter={(value) => formatScaledAmount(value, axisScale)}
              tick={{ fontSize: isMobile ? 10 : 12 }}
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
                      <strong className="text-foreground tabular-nums">
                        {money(String(value), currency)}
                      </strong>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend
              verticalAlign="bottom"
              wrapperStyle={{
                left: 0,
                right: 0,
                width: "100%",
              }}
              content={
                <ChartLegendContent className="flex-wrap justify-center gap-4 pt-2 text-xs md:justify-start" />
              }
            />
            {visibleTypes.includes("income") &&
              (isDaily ? (
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={isDaily ? (isMobile ? 8 : 16) : 28}
                />
              ) : (
                <Line
                  dataKey="income"
                  type="monotone"
                  stroke="var(--color-income)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            {visibleTypes.includes("expense") && (
              <Bar
                dataKey="expense"
                fill="var(--color-expense)"
                radius={[3, 3, 0, 0]}
                maxBarSize={isDaily ? (isMobile ? 8 : 16) : 28}
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
