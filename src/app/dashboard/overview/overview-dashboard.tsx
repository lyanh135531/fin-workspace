"use client";

import {
  Button,
  buttonVariants,
  Card,
  CategoryIcon,
  Empty,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  type DashboardPeriod,
  type DateRangeValue,
} from "@/components/base";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Decimal from "decimal.js";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Landmark,
  Layers,
  PiggyBank,
  Plus,
  ReceiptText,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePrivacyMask } from "@/lib/privacy-mask";
import {
  type TransactionCategoryOption,
} from "@/app/dashboard/desktop-transaction-create-draft";
import {
  approveTransactionAction,
  rejectTransactionAction,
} from "@/app/dashboard/actions";
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
import type { FinancialJarCode } from "@/domain/financial-jar/jars";
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
  toWallet?: string | null;
  categoryId: string | null;
  category: { name: string; color: string; icon: string | null } | null;
  memberId: string;
  member: string;
  purpose?:
    | "standard"
    | "credit_card_payment"
    | "credit_card_refund"
    | "credit_card_installment_fee"
    | "investment_contribution"
    | "investment_settlement";
  paymentSources?: { walletId: string; amount: string }[];
};

type UpcomingRecurring = {
  id: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  description: string | null;
  nextExecutionDate: string;
  wallet: string;
  toWallet?: string | null;
  category: { name: string; color: string; icon: string | null } | null;
};

export type OverviewWalletItem = {
  id: string;
  name: string;
  kind: "asset" | "credit_card";
  assetSubtype?: "cash" | "bank" | "e_wallet" | "other";
  balance: string;
  committed: string;
  available: string;
  defaultFundingWalletId?: string | null;
  creditLimit?: string | null;
  statementClosingDay?: number | null;
  paymentDueDay?: number | null;
  issuedStatement?: {
    id: string;
    dueDate: string;
    totalAmount: string;
    remainingAmount: string;
    overdue: boolean;
  } | null;
  updatedAt: string;
};

export type OverviewFinancialPlanSnapshot = {
  id: string;
  name: string;
  status: "active" | "completed" | "cancelled";
  health: string;
  targetAmount: string;
  realizedProgress: string;
  realizedProgressPercentage: string;
  targetMonth: string;
  currentMonth: {
    month: string;
    allocatableGrossBudget: string;
    adjustedRequiredAmount: string;
    availableToSpend: string;
    eligibleExpense: string;
    jars: {
      jarCode: FinancialJarCode;
      label: string;
      percentage: string;
      allocatedAmount: string;
      spentAmount: string;
      remainingAmount: string;
      overspendAmount: string;
    }[];
  } | null;
};

type Props = {
  workspace: { id: string; name: string; currency: string };
  reportPeriod: string;
  wallets: OverviewWalletItem[];
  totalByCurrency: Record<string, string>;
  members: { id: string; name: string }[];
  transactions: Transaction[];
  userRole?: string;
  canApprove?: boolean;
  financialPlanSnapshot?: OverviewFinancialPlanSnapshot | null;
  upcomingRecurring?: UpcomingRecurring[];
  categories?: TransactionCategoryOption[];
  businessDate?: string;
};

type MainChartTab = "cashflow" | "balance" | "structure";
type StructureMode = "expense" | "income" | "member";
type WalletFilterTab = "all" | "asset" | "credit_card";
type ActivityFeedTab = "recent" | "upcoming" | "pending";

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

function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function daysBetweenDates(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
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
): { income: Decimal; expense: Decimal; count: number } {
  const totals = transactions.reduce(
    (result, item) => {
      if (
        item.status !== "approved" ||
        !isInDateRange(item.date, dateRange) ||
        item.purpose === "investment_contribution" ||
        item.purpose === "investment_settlement"
      ) {
        return result;
      }

      if (item.purpose === "credit_card_refund") {
        result.expense = result.expense.minus(item.amount);
        result.count += 1;
        return result;
      }
      if (item.type === "income") {
        result.income = result.income.plus(item.amount);
        result.count += 1;
      }
      if (item.type === "expense") {
        result.expense = result.expense.plus(item.amount);
        result.count += 1;
      }
      return result;
    },
    { income: new Decimal(0), expense: new Decimal(0), count: 0 },
  );
  return {
    ...totals,
    expense: Decimal.max(new Decimal(0), totals.expense),
  };
}

function calculatePeriodProgress(
  periodStr: string,
  period: DashboardPeriod,
  businessDate: string,
): { elapsed: number; total: number } {
  const [year, month] = periodStr.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = businessDate
    .slice(0, 10)
    .split("-")
    .map(Number);
  const now = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));

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
    Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  return { elapsed: Math.min(diffDays, totalDays), total: totalDays };
}

function computeDeltaPercent(current: Decimal, previous: Decimal): number | null {
  if (previous.isZero()) return null;
  return current.minus(previous).div(previous).times(100).toNumber();
}

function walletSubtypeLabel(subtype?: string): string {
  if (subtype === "bank") return "Tài khoản ngân hàng";
  if (subtype === "cash") return "Tiền mặt";
  if (subtype === "e_wallet") return "Ví điện tử";
  return "Ví thanh toán";
}

function planHealthMeta(health: string): {
  label: string;
  toneClass: string;
} {
  if (health === "ahead" || health === "on_track" || health === "completed") {
    return {
      label: health === "completed" ? "Hoàn thành" : "Đúng tiến độ",
      toneClass: "bg-[var(--income)]/12 text-[var(--income)]",
    };
  }
  if (health === "at_risk") {
    return {
      label: "Cần chú ý",
      toneClass:
        "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]",
    };
  }
  return {
    label: "Chậm tiến độ",
    toneClass: "bg-[var(--expense)]/12 text-[var(--expense)]",
  };
}

export function OverviewDashboard({
  workspace,
  reportPeriod,
  wallets,
  members,
  transactions,
  canApprove = false,
  financialPlanSnapshot = null,
  upcomingRecurring = [],
  businessDate,
}: Props) {
  const router = useRouter();
  const { beginNavigation } = useOptimisticNavigation();
  const ledgerHref = workspace.id ? `/workspace/${workspace.id}` : "/dashboard";

  const [isMobile, setIsMobile] = useState(false);
  const privacyMasked = usePrivacyMask();
  const [globalPeriod, setGlobalPeriod] = useState<DashboardPeriod>("month");
  const [activeReportPeriod, setActiveReportPeriod] =
    useState<string>(reportPeriod);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() =>
    Number(reportPeriod.split("-")[0]),
  );
  const [chartTab, setChartTab] = useState<MainChartTab>("cashflow");
  const [structureMode, setStructureMode] = useState<StructureMode>("expense");
  const [walletFilter, setWalletFilter] = useState<WalletFilterTab>("all");
  const [activityTab, setActivityTab] = useState<ActivityFeedTab>("recent");

  const [activeYear, activeMonth] = useMemo(
    () => activeReportPeriod.split("-").map(Number),
    [activeReportPeriod],
  );
  const activeQuarter = Math.floor((activeMonth - 1) / 3) + 1;
  const yearPageStart = Math.floor((pickerYear - 2020) / 12) * 12 + 2020;

  function handlePeriodPickerOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setPickerYear(activeYear);
    }
    setPeriodPickerOpen(nextOpen);
  }

  // Sheet states (always mounted inside Sheet for smooth backdrop blur)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [allCategoriesSheetOpen, setAllCategoriesSheetOpen] = useState(false);
  const [approvalsSheetOpen, setApprovalsSheetOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  const todayStr = businessDate ?? `${reportPeriod}-01`;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (): void => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  function openQuickEntry(entryType: "expense" | "income" | "transfer") {
    window.dispatchEvent(
      new CustomEvent("open-quick-transaction", {
        detail: { type: entryType },
      }),
    );
  }

  function handleReviewTransaction(txId: string, approve: boolean) {
    startTransition(async () => {
      const result = approve
        ? await approveTransactionAction(workspace.id, txId)
        : await rejectTransactionAction(workspace.id, txId);
      if (result.ok) {
        toast.success(
          approve ? "Đã duyệt giao dịch." : "Đã từ chối giao dịch.",
        );
        if (selectedTransaction?.id === txId) {
          setSelectedTransaction(null);
        }
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý giao dịch.");
      }
    });
  }

  // Period calculations
  const activeDateRange = getDashboardPeriodDateRange(
    activeReportPeriod,
    globalPeriod,
  );
  const prevReportPeriod = shiftReportPeriod(
    activeReportPeriod,
    -1,
    globalPeriod,
  );
  const prevDateRange = getDashboardPeriodDateRange(
    prevReportPeriod,
    globalPeriod,
  );

  const activeTotals = summarizeTransactions(transactions, activeDateRange);
  const prevTotals = summarizeTransactions(transactions, prevDateRange);
  const activeNetCashflow = activeTotals.income.minus(activeTotals.expense);

  const incomeDeltaPct = computeDeltaPercent(
    activeTotals.income,
    prevTotals.income,
  );
  const expenseDeltaPct = computeDeltaPercent(
    activeTotals.expense,
    prevTotals.expense,
  );

  const periodProgress = calculatePeriodProgress(
    activeReportPeriod,
    globalPeriod,
    todayStr,
  );
  const dailyBurnRate = activeTotals.expense.div(periodProgress.elapsed);
  const remainingDaysInPeriod = Math.max(
    1,
    periodProgress.total - periodProgress.elapsed + 1,
  );

  // Wealth & Wallets calculations
  const assetWallets = useMemo(
    () => wallets.filter((w) => w.kind === "asset"),
    [wallets],
  );
  const creditCardWallets = useMemo(
    () => wallets.filter((w) => w.kind === "credit_card"),
    [wallets],
  );

  const totalAssetBalanceDecimal = useMemo(
    () =>
      assetWallets.reduce(
        (sum, w) => sum.plus(new Decimal(w.balance)),
        new Decimal(0),
      ),
    [assetWallets],
  );
  const totalAvailableDecimal = useMemo(
    () =>
      assetWallets.reduce(
        (sum, w) => sum.plus(new Decimal(w.available)),
        new Decimal(0),
      ),
    [assetWallets],
  );
  const totalCommittedDecimal = useMemo(
    () =>
      assetWallets.reduce(
        (sum, w) => sum.plus(new Decimal(w.committed)),
        new Decimal(0),
      ),
    [assetWallets],
  );
  const totalCreditDebtDecimal = useMemo(
    () =>
      creditCardWallets.reduce(
        (sum, w) =>
          sum.plus(Decimal.max(new Decimal(w.balance), new Decimal(0))),
        new Decimal(0),
      ),
    [creditCardWallets],
  );
  const netWorthDecimal = totalAssetBalanceDecimal.minus(
    totalCreditDebtDecimal,
  );

  const savingsRate = activeTotals.income.gt(0)
    ? activeNetCashflow.div(activeTotals.income).times(100).toNumber()
    : activeTotals.expense.gt(0)
      ? -100
      : 0;

  const expenseToIncomeRatio = activeTotals.income.gt(0)
    ? Math.min(
        100,
        Math.max(
          0,
          activeTotals.expense.div(activeTotals.income).times(100).toNumber(),
        ),
      )
    : activeTotals.expense.gt(0)
      ? 100
      : 0;

  // Safe-to-spend per day (from active financial plan if available, else from period net cashflow)
  const safeDailyBudget = (() => {
    if (
      financialPlanSnapshot?.currentMonth &&
      new Decimal(financialPlanSnapshot.currentMonth.availableToSpend).gt(0)
    ) {
      return new Decimal(
        financialPlanSnapshot.currentMonth.availableToSpend,
      ).div(remainingDaysInPeriod);
    }
    if (activeNetCashflow.gt(0)) {
      return activeNetCashflow.div(remainingDaysInPeriod);
    }
    return null;
  })();

  const pendingTransactions = useMemo(
    () => transactions.filter((t) => t.status === "pending"),
    [transactions],
  );
  const recentTransactions = useMemo(
    () => transactions.filter((t) => t.status !== "rejected").slice(0, 6),
    [transactions],
  );

  // Due credit card statements
  const dueCreditCardStatements = useMemo(
    () =>
      creditCardWallets
        .filter(
          (card) =>
            card.issuedStatement &&
            new Decimal(card.issuedStatement.remainingAmount).gt(0),
        )
        .map((card) => ({
          cardId: card.id,
          cardName: card.name,
          ...card.issuedStatement!,
          daysUntilDue: daysBetweenDates(
            todayStr,
            card.issuedStatement!.dueDate,
          ),
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [creditCardWallets, todayStr],
  );

  // Combined upcoming obligations (credit card statements + recurring transactions)
  const upcomingObligations = useMemo(() => {
    const items: Array<{
      id: string;
      kind: "statement" | "recurring";
      title: string;
      subtitle: string;
      dateStr: string;
      daysLeft: number;
      amount: string;
      type: "income" | "expense" | "transfer";
      href: string;
    }> = [];

    for (const stmt of dueCreditCardStatements) {
      items.push({
        id: `stmt-${stmt.id}`,
        kind: "statement",
        title: `Sao kê ${stmt.cardName}`,
        subtitle: stmt.overdue
          ? `Quá hạn thanh toán (${formatShortDate(stmt.dueDate)})`
          : `Hạn thanh toán ${formatShortDate(stmt.dueDate)}`,
        dateStr: stmt.dueDate,
        daysLeft: stmt.daysUntilDue,
        amount: stmt.remainingAmount,
        type: "expense",
        href: `/credit-cards/${stmt.cardId}`,
      });
    }

    for (const rec of upcomingRecurring) {
      const dateStr = rec.nextExecutionDate.slice(0, 10);
      items.push({
        id: `rec-${rec.id}`,
        kind: "recurring",
        title:
          rec.description || rec.category?.name || "Giao dịch định kỳ",
        subtitle:
          rec.type === "transfer" && rec.toWallet
            ? `${rec.wallet} → ${rec.toWallet}`
            : `Ví ${rec.wallet}${rec.category ? ` · ${rec.category.name}` : ""}`,
        dateStr,
        daysLeft: daysBetweenDates(todayStr, dateStr),
        amount: rec.amount,
        type: rec.type,
        href: "/recurring-transactions",
      });
    }

    return items.sort((a, b) => a.dateStr.localeCompare(b.dateStr)).slice(0, 6);
  }, [dueCreditCardStatements, upcomingRecurring, todayStr]);

  // Structure breakdowns (Expense Categories, Income Categories, Members)
  const buildCategoryBreakdown = (targetType: "expense" | "income") => {
    const rows = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        icon: string | null;
        amount: Decimal;
        count: number;
      }
    >();
    transactions
      .filter(
        (item) =>
          item.status === "approved" &&
          item.purpose !== "investment_contribution" &&
          item.purpose !== "investment_settlement" &&
          isInDateRange(item.date, activeDateRange) &&
          (targetType === "income"
            ? item.type === "income" && item.purpose !== "credit_card_refund"
            : item.type === "expense" || item.purpose === "credit_card_refund"),
      )
      .forEach((item) => {
        const key = item.categoryId ?? "uncategorized";
        const prior = rows.get(key);
        const signedAmount =
          item.purpose === "credit_card_refund"
            ? new Decimal(item.amount).negated()
            : new Decimal(item.amount);
        rows.set(key, {
          id: key,
          name: item.category?.name ?? "Chưa phân loại",
          color:
            item.category?.color ??
            (targetType === "income" ? "var(--income)" : "var(--chart-1)"),
          icon: item.category?.icon ?? "tag",
          amount: (prior?.amount ?? new Decimal(0)).plus(signedAmount),
          count: (prior?.count ?? 0) + 1,
        });
      });
    const total =
      targetType === "income" ? activeTotals.income : activeTotals.expense;
    return [...rows.values()]
      .filter((row) => row.amount.gt(0))
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((row, idx) => ({
        ...row,
        color: row.color || memberSeriesColor(idx),
        percent: total.isZero()
          ? 0
          : row.amount.div(total).times(100).toNumber(),
      }));
  };

  const expenseByCategory = buildCategoryBreakdown("expense");
  const incomeByCategory = buildCategoryBreakdown("income");

  const memberExpenses = members
    .map((m, idx) => {
      const matched = transactions.filter(
        (t) =>
          t.memberId === m.id &&
          t.purpose !== "investment_contribution" &&
          t.purpose !== "investment_settlement" &&
          (t.type === "expense" || t.purpose === "credit_card_refund") &&
          t.status === "approved" &&
          isInDateRange(t.date, activeDateRange),
      );
      const memberSpent = Decimal.max(
        new Decimal(0),
        matched.reduce(
          (sum, t) =>
            t.purpose === "credit_card_refund"
              ? sum.minus(new Decimal(t.amount))
              : sum.plus(new Decimal(t.amount)),
          new Decimal(0),
        ),
      );
      const percent = activeTotals.expense.isZero()
        ? 0
        : memberSpent.div(activeTotals.expense).times(100).toNumber();
      return {
        id: m.id,
        name: m.name,
        color: memberSeriesColor(idx),
        icon: null as string | null,
        amount: memberSpent,
        count: matched.length,
        percent,
      };
    })
    .filter((m) => m.amount.gt(0))
    .sort((a, b) => b.amount.comparedTo(a.amount));

  const activeStructureItems =
    structureMode === "income"
      ? incomeByCategory
      : structureMode === "member"
        ? memberExpenses
        : expenseByCategory;

  const activeStructureTotal =
    structureMode === "income" ? activeTotals.income : activeTotals.expense;

  const cashflowAxisScale = getAmountScale(
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
  );

  const periodLabel = formatPeriodLabel(activeReportPeriod, globalPeriod);
  const topExpenseCategory = expenseByCategory[0] ?? null;

  const filteredWallets = useMemo(() => {
    if (walletFilter === "asset") return assetWallets;
    if (walletFilter === "credit_card") return creditCardWallets;
    return wallets;
  }, [wallets, assetWallets, creditCardWallets, walletFilter]);

  const walletNameById = useMemo(
    () => new Map(wallets.map((w) => [w.id, w.name])),
    [wallets],
  );

  // Privacy-aware amount renderer
  function displayAmount(
    value: Decimal.Value,
    options?: { prefix?: string; showCurrency?: boolean },
  ) {
    if (privacyMasked) {
      return (
        <span className="tracking-widest select-none">••••••••</span>
      );
    }
    const dec = new Decimal(value);
    const hasCustomPrefix = Boolean(options?.prefix && options.prefix.length > 0);
    const effectivePrefix = hasCustomPrefix
      ? options?.prefix
      : dec.isNegative()
        ? "−"
        : "";
    const formatted = formatAmount(dec.abs());
    return (
      <>
        {effectivePrefix}
        {formatted}
        {options?.showCurrency !== false && (
          <>
            {" "}
            <span className="text-[0.72em] font-medium opacity-75">
              {workspace.currency}
            </span>
          </>
        )}
      </>
    );
  }

  const chartTitle =
    chartTab === "cashflow"
      ? globalPeriod === "month"
        ? "Nhịp thu chi theo ngày"
        : "Xu hướng thu chi theo tháng"
      : chartTab === "balance"
        ? globalPeriod === "month"
          ? "Biến động tài sản theo ngày"
          : "Biến động tài sản theo tháng"
        : structureMode === "income"
          ? "Cơ cấu nguồn thu nhập"
          : structureMode === "member"
            ? "Phân bổ chi tiêu theo thành viên"
            : "Cơ cấu danh mục chi tiêu";

  return (
    <div className="flex w-full flex-col gap-3.5 md:gap-4">
      {/* 1. EXECUTIVE WEALTH HERO & QUICK COMMAND CENTER */}
      <Card
        as="section"
        className="overflow-hidden p-0"
        aria-label="Tổng quan tài sản và dòng tiền"
      >
        {/* Hero Body: Net Worth + Quick Actions + Cashflow Pulse */}
        <div className="p-4 md:p-6">
          {/* Top Row: Label (left) & Sleek Period Capsule (right) */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.7rem] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Tài sản ròng
            </span>

            {/* Minimalist Period Filter Capsule */}
            <div className="flex shrink-0 items-center gap-1">
              <Popover
                open={periodPickerOpen}
                onOpenChange={handlePeriodPickerOpenChange}
              >
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Chọn kỳ báo cáo"
                      title="Chọn kỳ xem dữ liệu"
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums transition-colors active:scale-[0.98]",
                        periodPickerOpen || activeReportPeriod !== reportPeriod
                          ? "border-[var(--primary)]/35 bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]",
                      )}
                    />
                  }
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      activeReportPeriod !== reportPeriod
                        ? "bg-[var(--primary)]"
                        : "bg-[var(--text-muted)]/60",
                    )}
                  />
                  <span>{periodLabel}</span>
                  <ChevronDown
                    className={cn(
                      "size-3 text-[var(--text-muted)] transition-transform duration-150",
                      periodPickerOpen && "rotate-180 text-[var(--primary)]",
                    )}
                    aria-hidden="true"
                  />
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  sideOffset={6}
                  elevation="flat"
                  className="w-68 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl p-0"
                >
                  {/* Top: Segmented Mode Switcher + Year Navigation */}
                  <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--surface-secondary)]/30 p-2.5">
                    <div className="grid grid-cols-3 rounded-lg bg-[var(--surface-secondary)] p-0.5">
                      {(
                        [
                          { id: "month", label: "Tháng" },
                          { id: "quarter", label: "Quý" },
                          { id: "year", label: "Năm" },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setGlobalPeriod(mode.id)}
                          className={cn(
                            "rounded-md py-1 text-xs font-semibold transition-colors",
                            globalPeriod === mode.id
                              ? "bg-[var(--surface)] text-[var(--foreground)]"
                              : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between px-0.5">
                      <button
                        type="button"
                        aria-label={
                          globalPeriod === "year" ? "12 năm trước" : "Năm trước"
                        }
                        onClick={() =>
                          setPickerYear((y) =>
                            globalPeriod === "year" ? y - 12 : y - 1,
                          )
                        }
                        className="grid size-7 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] active:scale-95"
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                      </button>
                      <strong className="text-xs font-semibold tracking-wide text-[var(--foreground)] tabular-nums">
                        {globalPeriod === "year"
                          ? `${yearPageStart} – ${yearPageStart + 11}`
                          : `Năm ${pickerYear}`}
                      </strong>
                      <button
                        type="button"
                        aria-label={
                          globalPeriod === "year" ? "12 năm sau" : "Năm sau"
                        }
                        onClick={() =>
                          setPickerYear((y) =>
                            globalPeriod === "year" ? y + 12 : y + 1,
                          )
                        }
                        className="grid size-7 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] active:scale-95"
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Direct Selection Grid */}
                  {globalPeriod === "month" && (
                    <div
                      className="grid grid-cols-4 gap-1.5 p-2.5"
                      aria-label={`Chọn tháng năm ${pickerYear}`}
                    >
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map(
                        (m) => {
                          const optionPeriod = `${pickerYear}-${String(m).padStart(2, "0")}`;
                          const isSelected =
                            pickerYear === activeYear && m === activeMonth;
                          const isCurrentDefault =
                            optionPeriod === reportPeriod;
                          return (
                            <button
                              key={optionPeriod}
                              type="button"
                              onClick={() => {
                                setActiveReportPeriod(optionPeriod);
                                setPeriodPickerOpen(false);
                              }}
                              className={cn(
                                "flex h-8.5 items-center justify-center rounded-lg text-xs font-medium tabular-nums transition-colors active:scale-95",
                                isSelected
                                  ? "bg-[var(--foreground)] font-semibold text-[var(--background)]"
                                  : isCurrentDefault
                                    ? "border border-[var(--primary)]/40 bg-[var(--primary)]/8 font-semibold text-[var(--primary)]"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]",
                              )}
                            >
                              Thg {m}
                            </button>
                          );
                        },
                      )}
                    </div>
                  )}

                  {globalPeriod === "quarter" && (
                    <div
                      className="grid grid-cols-2 gap-1.5 p-2.5"
                      aria-label={`Chọn quý năm ${pickerYear}`}
                    >
                      {[1, 2, 3, 4].map((q) => {
                        const quarterEndMonth = q * 3;
                        const startMonth = (q - 1) * 3 + 1;
                        const optionPeriod = `${pickerYear}-${String(quarterEndMonth).padStart(2, "0")}`;
                        const isSelected =
                          pickerYear === activeYear && q === activeQuarter;
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              setActiveReportPeriod(optionPeriod);
                              setPeriodPickerOpen(false);
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center rounded-xl py-2.5 text-center transition-colors active:scale-95",
                              isSelected
                                ? "bg-[var(--foreground)] text-[var(--background)]"
                                : "border border-[var(--border)]/70 bg-[var(--surface-secondary)]/30 text-[var(--foreground)] hover:bg-[var(--surface-secondary)]",
                            )}
                          >
                            <span className="text-xs font-semibold tabular-nums">
                              Quý {q}
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 text-[0.65rem] tabular-nums",
                                isSelected
                                  ? "text-[var(--background)]/75"
                                  : "text-[var(--text-muted)]",
                              )}
                            >
                              Thg {startMonth} – Thg {quarterEndMonth}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {globalPeriod === "year" && (
                    <div
                      className="grid grid-cols-3 gap-1.5 p-2.5"
                      aria-label="Chọn năm báo cáo"
                    >
                      {Array.from(
                        { length: 12 },
                        (_, idx) => yearPageStart + idx,
                      ).map((yr) => {
                        const isSelected = yr === activeYear;
                        const defaultYear = Number(reportPeriod.split("-")[0]);
                        const isCurrentDefault = yr === defaultYear;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setActiveReportPeriod(
                                `${yr}-${String(activeMonth).padStart(2, "0")}`,
                              );
                              setPickerYear(yr);
                              setPeriodPickerOpen(false);
                            }}
                            className={cn(
                              "flex h-8.5 items-center justify-center rounded-lg text-xs font-medium tabular-nums transition-colors active:scale-95",
                              isSelected
                                ? "bg-[var(--foreground)] font-semibold text-[var(--background)]"
                                : isCurrentDefault
                                  ? "border border-[var(--primary)]/40 bg-[var(--primary)]/8 font-semibold text-[var(--primary)]"
                                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]",
                            )}
                          >
                            {yr}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer only shown when not on current default period, or subtle range info */}
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-secondary)]/25 px-3 py-2">
                    <span className="text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                      {formatDateRangeLabel(activeDateRange)}
                    </span>
                    {activeReportPeriod !== reportPeriod && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReportPeriod(reportPeriod);
                          setPickerYear(Number(reportPeriod.split("-")[0]));
                          setPeriodPickerOpen(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Hiện tại</span>
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {/* Primary Net Worth & Liquidity Breakdown */}
            <div className="min-w-0 flex-1">
              <strong
                className={cn(
                  "block break-words text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl md:text-4xl",
                  netWorthDecimal.isNegative()
                    ? "text-[var(--expense)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {displayAmount(netWorthDecimal, {
                  prefix: netWorthDecimal.isNegative() ? "−" : "",
                })}
              </strong>

              {/* Liquidity Breakdown Strip */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)] tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--income)]" />
                  <span>Số dư ví:</span>
                  <strong className="font-semibold text-[var(--foreground)]">
                    {displayAmount(totalAssetBalanceDecimal)}
                  </strong>
                </span>

                {totalCommittedDecimal.gt(0) && (
                  <button
                    type="button"
                    onClick={() =>
                      beginNavigation("/wallets?reservedWalletId=all")
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 underline-offset-4 hover:underline"
                    title="Xem chi tiết tiền chờ thanh toán thẻ"
                  >
                    <span className="size-2 rounded-full bg-[var(--warning)]" />
                    <span>Chờ trả thẻ:</span>
                    <strong className="font-semibold text-[var(--warning)]">
                      {displayAmount(totalCommittedDecimal)}
                    </strong>
                  </button>
                )}

                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--primary)]" />
                  <span>Có thể dùng:</span>
                  <strong className="font-semibold text-[var(--foreground)]">
                    {displayAmount(totalAvailableDecimal)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Quick Action Command Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openQuickEntry("expense")}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--foreground)] px-3.5 text-xs font-semibold text-[var(--background)] transition-transform active:scale-[0.98] sm:flex-none"
              >
                <ArrowUpRight className="size-3.5 shrink-0" />
                <span>Chi tiêu</span>
              </button>

              <button
                type="button"
                onClick={() => openQuickEntry("income")}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] active:scale-[0.98] sm:flex-none"
              >
                <ArrowDownLeft className="size-3.5 shrink-0 text-[var(--income)]" />
                <span>Thu nhập</span>
              </button>

              {wallets.length >= 2 && (
                <button
                  type="button"
                  onClick={() => openQuickEntry("transfer")}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] active:scale-[0.98]"
                  aria-label="Chuyển tiền giữa các ví"
                  title="Chuyển tiền giữa các ví"
                >
                  <ArrowLeftRight className="size-3.5 shrink-0 text-[var(--primary)]" />
                  <span className="hidden sm:inline">Chuyển tiền</span>
                </button>
              )}

              {pendingTransactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setApprovalsSheetOpen(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--warning)]/30 bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] px-3 text-xs font-semibold text-[var(--warning)] transition-transform active:scale-[0.98]"
                >
                  <CircleAlert className="size-3.5 shrink-0" />
                  <span>Cần duyệt ({pendingTransactions.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Period Cashflow & Pace Strip (2 cols on mobile, 4 cols on desktop) */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 lg:grid-cols-4 lg:gap-6">
            {/* Metric 1: Thu nhập */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  Thu nhập kỳ này
                </span>
                {incomeDeltaPct !== null && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
                      incomeDeltaPct >= 0
                        ? "bg-[var(--income)]/12 text-[var(--income)]"
                        : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                    )}
                  >
                    {incomeDeltaPct >= 0 ? "+" : ""}
                    {incomeDeltaPct.toFixed(0)}%
                  </span>
                )}
              </div>
              <strong className="mt-1 block break-words text-base font-bold leading-snug text-[var(--income)] tabular-nums md:text-lg">
                {displayAmount(activeTotals.income, {
                  prefix: activeTotals.income.gt(0) ? "+" : "",
                })}
              </strong>
              <span className="mt-0.5 block text-[0.7rem] text-[var(--text-muted)] tabular-nums">
                {prevTotals.income.gt(0)
                  ? `Kỳ trước: ${privacyMasked ? "••••" : formatAmount(prevTotals.income)}`
                  : "Chưa có ở kỳ trước"}
              </span>
            </div>

            {/* Metric 2: Chi tiêu */}
            <div className="min-w-0 border-l border-[var(--border)] pl-3 lg:pl-5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  Chi tiêu kỳ này
                </span>
                {expenseDeltaPct !== null && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
                      expenseDeltaPct <= 0
                        ? "bg-[var(--income)]/12 text-[var(--income)]"
                        : "bg-[var(--expense)]/12 text-[var(--expense)]",
                    )}
                  >
                    {expenseDeltaPct > 0 ? "+" : ""}
                    {expenseDeltaPct.toFixed(0)}%
                  </span>
                )}
              </div>
              <strong className="mt-1 block break-words text-base font-bold leading-snug text-[var(--expense)] tabular-nums md:text-lg">
                {displayAmount(activeTotals.expense, {
                  prefix: activeTotals.expense.gt(0) ? "−" : "",
                })}
              </strong>
              <span className="mt-0.5 block text-[0.7rem] text-[var(--text-muted)] tabular-nums">
                TB ~
                {privacyMasked
                  ? "••••"
                  : formatAmount(dailyBurnRate.round())}{" "}
                {workspace.currency}/ngày
              </span>
            </div>

            {/* Metric 3: Chênh lệch thu chi & Tỷ lệ tích lũy */}
            <div className="col-span-2 min-w-0 border-t border-[var(--border)] pt-3 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  Chênh lệch thu chi
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
                    savingsRate >= 20
                      ? "bg-[var(--income)]/12 text-[var(--income)]"
                      : savingsRate >= 0
                        ? "bg-[var(--primary)]/12 text-[var(--primary)]"
                        : "bg-[var(--expense)]/12 text-[var(--expense)]",
                  )}
                >
                  {savingsRate >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  Tích lũy {savingsRate.toFixed(0)}%
                </span>
              </div>
              <strong
                className={cn(
                  "mt-1 block break-words text-base font-bold leading-snug tabular-nums md:text-lg",
                  activeNetCashflow.isNegative()
                    ? "text-[var(--expense)]"
                    : activeNetCashflow.gt(0)
                      ? "text-[var(--income)]"
                      : "text-[var(--foreground)]",
                )}
              >
                {displayAmount(activeNetCashflow.abs(), {
                  prefix: activeNetCashflow.gt(0)
                    ? "+"
                    : activeNetCashflow.isNegative()
                      ? "−"
                      : "",
                })}
              </strong>
              {/* Visual Expense-to-Income Ratio Bar */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      expenseToIncomeRatio > 90
                        ? "bg-[var(--expense)]"
                        : expenseToIncomeRatio > 70
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--income)]",
                    )}
                    style={{ width: `${expenseToIncomeRatio}%` }}
                  />
                </div>
                <span className="shrink-0 text-[0.65rem] text-[var(--text-muted)] tabular-nums">
                  Chi {expenseToIncomeRatio.toFixed(0)}% thu
                </span>
              </div>
            </div>

            {/* Metric 4: Nhịp chi tiêu & Hạn mức an toàn mỗi ngày */}
            <div className="col-span-2 min-w-0 border-t border-[var(--border)] pt-3 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {safeDailyBudget
                    ? "Mức chi an toàn/ngày"
                    : "Hoạt động trong kỳ"}
                </span>
                <span className="text-[0.65rem] font-medium text-[var(--text-muted)] tabular-nums">
                  Ngày {periodProgress.elapsed}/{periodProgress.total}
                </span>
              </div>
              {safeDailyBudget ? (
                <>
                  <strong className="mt-1 block break-words text-base font-bold leading-snug text-[var(--foreground)] tabular-nums md:text-lg">
                    {displayAmount(safeDailyBudget.round(), { prefix: "~" })}
                  </strong>
                  <span className="mt-0.5 block text-[0.7rem] text-[var(--text-muted)]">
                    Cho {remainingDaysInPeriod} ngày còn lại
                  </span>
                </>
              ) : (
                <>
                  <strong className="mt-1 block break-words text-base font-bold leading-snug text-[var(--foreground)] tabular-nums md:text-lg">
                    {activeTotals.count} giao dịch
                  </strong>
                  <span className="mt-0.5 block text-[0.7rem] text-[var(--text-muted)]">
                    {topExpenseCategory
                      ? `Chi nhiều nhất: ${topExpenseCategory.name} (${topExpenseCategory.percent.toFixed(0)}%)`
                      : "Chưa có chi tiêu trong kỳ"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. CONTEXTUAL CREDIT CARD STATEMENT BANNER (Only shown when an issued statement is unpaid) */}
      {dueCreditCardStatements.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {dueCreditCardStatements.slice(0, 2).map((stmt) => (
            <Link
              key={stmt.id}
              href={`/credit-cards/${stmt.cardId}`}
              onClick={(event) => {
                if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                  event.preventDefault();
                  beginNavigation(`/credit-cards/${stmt.cardId}`);
                }
              }}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors",
                stmt.overdue
                  ? "border-[var(--expense)]/35 bg-[var(--expense)]/8"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]/60",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    stmt.overdue
                      ? "bg-[var(--expense)]/15 text-[var(--expense)]"
                      : "bg-[var(--primary)]/12 text-[var(--primary)]",
                  )}
                >
                  <CreditCard className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      Sao kê {stmt.cardName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.62rem] font-semibold",
                        stmt.overdue
                          ? "bg-[var(--expense)]/15 text-[var(--expense)]"
                          : stmt.daysUntilDue <= 3
                            ? "bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-[var(--warning)]"
                            : "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
                      )}
                    >
                      {stmt.overdue
                        ? "Quá hạn"
                        : stmt.daysUntilDue === 0
                          ? "Hạn hôm nay"
                          : `Còn ${stmt.daysUntilDue} ngày`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.7rem] text-[var(--text-muted)] tabular-nums">
                    Hạn thanh toán: {formatShortDate(stmt.dueDate)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                  {displayAmount(stmt.remainingAmount)}
                </strong>
                <ChevronRight className="size-4 text-[var(--text-muted)]" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 3. MAIN BENTO GRID: INTERACTIVE ANALYTICS (7 cols) & WALLETS PORTFOLIO (5 cols) */}
      <section className="grid grid-cols-1 gap-3.5 md:gap-4 lg:grid-cols-12">
        {/* Left 7 Cols: Interactive Financial Analytics */}
        <Card
          as="section"
          className="flex min-w-0 flex-col gap-0 p-0 lg:col-span-7"
        >
          <header className="flex flex-col gap-2.5 border-b border-[var(--border)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-5 md:py-4">
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                {chartTitle}
              </h2>
              <p className="mt-0.5 break-words text-[0.7rem] leading-snug text-[var(--text-muted)] tabular-nums">
                {formatDateRangeLabel(activeDateRange)}
                {chartTab === "cashflow" && cashflowAxisScale.label
                  ? ` · Đơn vị: ${cashflowAxisScale.label} ${workspace.currency}`
                  : ""}
              </p>
            </div>

            <Tabs
              value={chartTab}
              onValueChange={(val) => setChartTab(val as MainChartTab)}
              className="w-full gap-0 sm:w-auto"
            >
              <TabsList
                variant="navigation"
                className="w-full sm:w-auto"
                aria-label="Chọn chế độ phân tích"
              >
                <TabsTrigger value="cashflow">Thu chi</TabsTrigger>
                <TabsTrigger value="balance">Tài sản</TabsTrigger>
                <TabsTrigger value="structure">Cơ cấu</TabsTrigger>
              </TabsList>
            </Tabs>
          </header>

          <div className="flex-1 p-3.5 md:p-5">
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
                axisScale={cashflowAxisScale}
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

            {chartTab === "structure" && (
              <div className="flex flex-col gap-3.5">
                {/* Sub-switcher: Chi tiêu | Thu nhập | Thành viên */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5">
                    <button
                      type="button"
                      onClick={() => setStructureMode("expense")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        structureMode === "expense"
                          ? "bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                          : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                      )}
                    >
                      Chi tiêu ({expenseByCategory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStructureMode("income")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        structureMode === "income"
                          ? "bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                          : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                      )}
                    >
                      Thu nhập ({incomeByCategory.length})
                    </button>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setStructureMode("member")}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          structureMode === "member"
                            ? "bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                            : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                        )}
                      >
                        Thành viên ({memberExpenses.length})
                      </button>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-[var(--foreground)] tabular-nums">
                    Tổng: {displayAmount(activeStructureTotal)}
                  </span>
                </div>

                {activeStructureItems.length > 0 ? (
                  <>
                    {/* Multi-Segment Proportional Bar */}
                    <div
                      className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)] p-0.5"
                      aria-label="Tỷ trọng phân bổ"
                    >
                      {activeStructureItems.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            width: `${Math.max(item.percent, 2)}%`,
                            backgroundColor: item.color,
                          }}
                          title={`${item.name}: ${item.percent.toFixed(1)}%`}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                        />
                      ))}
                    </div>

                    {/* Top 5 Rows */}
                    <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      {activeStructureItems.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            {structureMode === "member" ? (
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                                style={{ backgroundColor: item.color }}
                              >
                                {item.name.slice(0, 1).toUpperCase()}
                              </span>
                            ) : (
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${item.color} 15%, var(--surface))`,
                                  color: item.color,
                                }}
                              >
                                <CategoryIcon
                                  category={{
                                    color: item.color,
                                    icon: item.icon,
                                  }}
                                  size={14}
                                />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="break-words text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                                  {item.name}
                                </span>
                                <span className="rounded-full bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--text-secondary)] tabular-nums">
                                  {item.percent.toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                                {item.count} giao dịch trong kỳ
                              </p>
                            </div>
                          </div>

                          <strong className="shrink-0 text-right text-xs font-bold text-[var(--foreground)] tabular-nums sm:text-sm">
                            {displayAmount(item.amount)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {activeStructureItems.length > 5 && (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAllCategoriesSheetOpen(true)}
                          className="text-xs"
                        >
                          Xem tất cả {activeStructureItems.length} mục
                          <ChevronRight className="ml-1 size-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <Empty
                    variant="compact"
                    title="Chưa có dữ liệu"
                    description="Chưa có giao dịch nào trong kỳ này."
                  />
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Right 5 Cols: Accounts & Credit Cards Portfolio */}
        <Card
          as="section"
          className="flex min-w-0 flex-col gap-0 p-0 lg:col-span-5"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3.5 md:px-5 md:py-4">
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                Ví & Thẻ ({wallets.length})
              </h2>
              {totalCommittedDecimal.gt(0) ? (
                <button
                  type="button"
                  onClick={() =>
                    beginNavigation("/wallets?reservedWalletId=all")
                  }
                  className="mt-0.5 block cursor-pointer break-words text-left text-[0.7rem] font-medium leading-snug text-[var(--warning)] tabular-nums underline-offset-4 hover:underline"
                  title="Xem chi tiết tiền chờ thanh toán thẻ"
                >
                  {`Chờ trả thẻ: ${privacyMasked ? "••••" : money(totalCommittedDecimal, workspace.currency)}`}
                </button>
              ) : (
                <p className="mt-0.5 break-words text-[0.7rem] leading-snug text-[var(--text-muted)] tabular-nums">
                  Số dư hiện tại và hạn mức thẻ
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {assetWallets.length > 0 && creditCardWallets.length > 0 && (
                <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setWalletFilter("all")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[0.68rem] font-medium transition-colors",
                      walletFilter === "all"
                        ? "bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                        : "text-[var(--text-muted)]",
                    )}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletFilter("asset")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[0.68rem] font-medium transition-colors",
                      walletFilter === "asset"
                        ? "bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                        : "text-[var(--text-muted)]",
                    )}
                  >
                    Ví ({assetWallets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletFilter("credit_card")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[0.68rem] font-medium transition-colors",
                      walletFilter === "credit_card"
                        ? "bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                        : "text-[var(--text-muted)]",
                    )}
                  >
                    Thẻ ({creditCardWallets.length})
                  </button>
                </div>
              )}

              <Link
                href={walletFilter === "credit_card" ? "/credit-cards" : "/wallets"}
                onClick={(event) => {
                  const targetHref =
                    walletFilter === "credit_card"
                      ? "/credit-cards"
                      : "/wallets";
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation(targetHref);
                  }
                }}
                aria-label="Quản lý ví và thẻ"
                title="Quản lý ví và thẻ"
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
            {filteredWallets.length > 0 ? (
              filteredWallets.map((wallet) => {
                const isCard = wallet.kind === "credit_card";
                const balanceDec = new Decimal(wallet.balance);
                const committedDec = new Decimal(wallet.committed);
                const limitDec = wallet.creditLimit
                  ? new Decimal(wallet.creditLimit)
                  : null;
                const utilizationPct =
                  isCard && limitDec && limitDec.gt(0)
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          balanceDec.div(limitDec).times(100).toNumber(),
                        ),
                      )
                    : 0;

                const rowContent = (
                  <div className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--surface-secondary)]/40 md:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl",
                            isCard
                              ? "bg-[var(--primary)]/12 text-[var(--primary)]"
                              : "bg-[var(--surface-secondary)] text-[var(--foreground)]",
                          )}
                        >
                          {isCard ? (
                            <CreditCard className="size-4" />
                          ) : wallet.assetSubtype === "bank" ? (
                            <Landmark className="size-4" />
                          ) : wallet.assetSubtype === "e_wallet" ? (
                            <Building2 className="size-4" />
                          ) : (
                            <Wallet className="size-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                              {wallet.name}
                            </span>
                            {isCard && wallet.issuedStatement && (
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold",
                                  wallet.issuedStatement.overdue
                                    ? "bg-[var(--expense)]/15 text-[var(--expense)]"
                                    : "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]",
                                )}
                              >
                                Chờ thanh toán
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)] tabular-nums">
                            {isCard ? (
                              limitDec ? (
                                `Hạn mức: ${privacyMasked ? "••••" : formatAmount(limitDec)} ${workspace.currency} · Đã dùng ${utilizationPct.toFixed(0)}%`
                              ) : (
                                "Thẻ tín dụng"
                              )
                            ) : committedDec.gt(0) ? (
                              <>
                                {walletSubtypeLabel(wallet.assetSubtype)} ·{" "}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    beginNavigation(
                                      `/wallets?reservedWalletId=${wallet.id}`,
                                    );
                                  }}
                                  className="cursor-pointer font-medium text-[var(--warning)] underline-offset-2 hover:underline"
                                  title="Xem chi tiết tiền chờ thanh toán thẻ"
                                >
                                  Chờ thanh toán thẻ:{" "}
                                  {privacyMasked
                                    ? "••••"
                                    : formatAmount(wallet.committed)}
                                </button>
                              </>
                            ) : (
                              walletSubtypeLabel(wallet.assetSubtype)
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <strong
                          className={cn(
                            "block text-sm font-bold tabular-nums",
                            isCard && balanceDec.gt(0)
                              ? "text-[var(--expense)]"
                              : "text-[var(--foreground)]",
                          )}
                        >
                          {displayAmount(
                            isCard
                              ? Decimal.max(balanceDec, 0)
                              : wallet.balance,
                          )}
                        </strong>
                        <span className="block text-[0.65rem] text-[var(--text-muted)]">
                          {isCard ? "Dư nợ hiện tại" : "Số dư hiện tại"}
                        </span>
                      </div>
                    </div>

                    {/* Credit Card Utilization Bar */}
                    {isCard && limitDec && limitDec.gt(0) && (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            utilizationPct >= 85
                              ? "bg-[var(--expense)]"
                              : utilizationPct >= 60
                                ? "bg-[var(--warning)]"
                                : "bg-[var(--primary)]",
                          )}
                          style={{ width: `${utilizationPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );

                return isCard ? (
                  <Link
                    key={wallet.id}
                    href={`/credit-cards/${wallet.id}`}
                    onClick={(event) => {
                      if (
                        !event.ctrlKey &&
                        !event.metaKey &&
                        event.button === 0
                      ) {
                        event.preventDefault();
                        beginNavigation(`/credit-cards/${wallet.id}`);
                      }
                    }}
                    className="block"
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div key={wallet.id}>{rowContent}</div>
                );
              })
            ) : (
              <div className="p-5">
                <Empty
                  variant="compact"
                  title="Chưa có ví hoặc thẻ"
                  description="Thêm ví hoặc thẻ tín dụng để bắt đầu theo dõi thu chi."
                />
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 4. BOTTOM BENTO GRID: 6 JARS FINANCIAL PLAN SNAPSHOT (6 cols) & UNIFIED ACTIVITY FEED (6 cols) */}
      <section className="grid grid-cols-1 gap-3.5 md:gap-4 lg:grid-cols-12">
        {/* Left 6 Cols: 6 Jars & Active Financial Plan Snapshot */}
        <Card
          as="section"
          className="flex min-w-0 flex-col gap-0 p-0 lg:col-span-6"
        >
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3.5 md:px-5 md:py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {financialPlanSnapshot
                    ? financialPlanSnapshot.name
                    : "Kế hoạch 6 Hũ & Tích lũy"}
                </h2>
                {financialPlanSnapshot && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                      planHealthMeta(financialPlanSnapshot.health).toneClass,
                    )}
                  >
                    {planHealthMeta(financialPlanSnapshot.health).label}
                  </span>
                )}
              </div>
              <p className="mt-0.5 break-words text-[0.7rem] leading-snug text-[var(--text-muted)]">
                {financialPlanSnapshot
                  ? `Mục tiêu đến ${financialPlanSnapshot.targetMonth} · Tiến độ ${financialPlanSnapshot.realizedProgressPercentage}%`
                  : "Chia ngân sách 6 hũ và theo dõi mục tiêu tiết kiệm"}
              </p>
            </div>

            <Link
              href="/financial-plans"
              onClick={(event) => {
                if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                  event.preventDefault();
                  beginNavigation("/financial-plans");
                }
              }}
              aria-label="Mở kế hoạch tài chính"
              title="Mở kế hoạch tài chính"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "shrink-0",
              )}
            >
              <ChevronRight className="size-4" />
            </Link>
          </header>

          {financialPlanSnapshot ? (
            <div className="flex flex-1 flex-col justify-between gap-4 p-4 md:p-5">
              {/* Target Goal Progress Strip */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <Target className="size-3.5 text-[var(--primary)]" />
                    <span>Tiến độ tích lũy</span>
                  </span>
                  <div className="text-right tabular-nums">
                    <strong className="text-sm font-bold text-[var(--foreground)]">
                      {displayAmount(financialPlanSnapshot.realizedProgress)}
                    </strong>
                    <span className="text-xs text-[var(--text-muted)]">
                      {" "}
                      /{" "}
                      {privacyMasked
                        ? "••••"
                        : formatAmount(financialPlanSnapshot.targetAmount)}{" "}
                      {workspace.currency}
                    </span>
                  </div>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(financialPlanSnapshot.realizedProgressPercentage)))}%`,
                    }}
                  />
                </div>
              </div>

              {/* 6 Jars Compact Bento Grid */}
              {financialPlanSnapshot.currentMonth && (
                <div>
                  <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--foreground)]">
                      Ngân sách 6 Hũ ({financialPlanSnapshot.currentMonth.month})
                    </span>
                    <span className="text-[var(--text-muted)] tabular-nums">
                      Còn lại:{" "}
                      <strong className="font-semibold text-[var(--foreground)]">
                        {displayAmount(
                          financialPlanSnapshot.currentMonth.availableToSpend,
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {financialPlanSnapshot.currentMonth.jars.map((jar) => {
                      const allocatedDec = new Decimal(jar.allocatedAmount);
                      const spentDec = new Decimal(jar.spentAmount);
                      const overspentDec = new Decimal(jar.overspendAmount);
                      const remainingDec = new Decimal(jar.remainingAmount);
                      const ratioPct = allocatedDec.gt(0)
                        ? Math.min(
                            100,
                            spentDec.div(allocatedDec).times(100).toNumber(),
                          )
                        : spentDec.gt(0)
                          ? 100
                          : 0;
                      const isOver = overspentDec.gt(0);

                      return (
                        <div
                          key={jar.jarCode}
                          className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="break-words text-xs font-semibold text-[var(--foreground)]">
                              {jar.label}
                            </span>
                            <span className="shrink-0 text-[0.65rem] font-medium text-[var(--text-muted)] tabular-nums">
                              {new Decimal(jar.percentage).toFixed(0)}%
                            </span>
                          </div>

                          <div className="my-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isOver
                                  ? "bg-[var(--expense)]"
                                  : ratioPct >= 85
                                    ? "bg-[var(--warning)]"
                                    : "bg-[var(--income)]",
                              )}
                              style={{ width: `${ratioPct}%` }}
                            />
                          </div>

                          <div className="flex items-baseline justify-between gap-1 text-[0.68rem] tabular-nums">
                            <span className="text-[var(--text-muted)]">
                              {isOver ? "Vượt:" : "Còn:"}
                            </span>
                            <strong
                              className={cn(
                                "font-semibold",
                                isOver
                                  ? "text-[var(--expense)]"
                                  : "text-[var(--foreground)]",
                              )}
                            >
                              {privacyMasked
                                ? "••••"
                                : formatAmount(
                                    isOver ? overspentDec : remainingDec,
                                  )}
                            </strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <Layers className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                Thiết lập Kế hoạch 6 Hũ & Tích lũy
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">
                Tự động chia ngân sách tháng vào 6 hũ và theo dõi mục tiêu tiết kiệm.
              </p>
              <Link
                href="/financial-plans"
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation("/financial-plans");
                  }
                }}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-3.5",
                )}
              >
                <Sparkles className="mr-1.5 size-3.5" />
                Khám phá Kế hoạch 6 Hũ
              </Link>
            </div>
          )}
        </Card>

        {/* Right 6 Cols: Unified Activity & Upcoming Feed */}
        <Card
          as="section"
          className="flex min-w-0 flex-col gap-0 p-0 lg:col-span-6"
        >
          <header className="flex flex-col gap-2.5 border-b border-[var(--border)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-5 md:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                  Hoạt động & Lịch sắp tới
                </h2>
                <p className="mt-0.5 break-words text-[0.7rem] leading-snug text-[var(--text-muted)]">
                  Giao dịch gần đây và lịch sắp đến hạn
                </p>
              </div>
              <Link
                href={
                  activityTab === "upcoming"
                    ? "/recurring-transactions"
                    : ledgerHref
                }
                onClick={(event) => {
                  const target =
                    activityTab === "upcoming"
                      ? "/recurring-transactions"
                      : ledgerHref;
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation(target);
                  }
                }}
                aria-label="Xem toàn bộ"
                title="Xem toàn bộ"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "shrink-0 sm:hidden",
                )}
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="flex items-center gap-1.5">
              <Tabs
                value={activityTab}
                onValueChange={(val) => setActivityTab(val as ActivityFeedTab)}
                className="w-full gap-0 sm:w-auto"
              >
                <TabsList
                  variant="navigation"
                  className="w-full sm:w-auto"
                  aria-label="Chọn danh sách hoạt động"
                >
                  <TabsTrigger value="recent">Gần đây</TabsTrigger>
                  <TabsTrigger value="upcoming">
                    Sắp tới ({upcomingObligations.length})
                  </TabsTrigger>
                  {pendingTransactions.length > 0 && (
                    <TabsTrigger value="pending">
                      Chờ duyệt ({pendingTransactions.length})
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>

              <Link
                href={
                  activityTab === "upcoming"
                    ? "/recurring-transactions"
                    : ledgerHref
                }
                onClick={(event) => {
                  const target =
                    activityTab === "upcoming"
                      ? "/recurring-transactions"
                      : ledgerHref;
                  if (!event.ctrlKey && !event.metaKey && event.button === 0) {
                    event.preventDefault();
                    beginNavigation(target);
                  }
                }}
                aria-label="Mở sổ chi tiết"
                title="Mở sổ chi tiết"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "hidden shrink-0 sm:inline-flex",
                )}
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </header>

          {/* Feed Body */}
          <div className="flex-1 divide-y divide-[var(--border)]">
            {activityTab === "recent" &&
              (recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const isIncome = tx.type === "income";
                  const isExpense = tx.type === "expense";
                  const dateStr = tx.date.slice(0, 10);
                  const [, m, d] = dateStr.split("-");
                  const formattedDate = `${d}/${m}`;

                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => setSelectedTransaction(tx)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-secondary)]/50 active:bg-[var(--surface-secondary)] md:px-5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl",
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                              {tx.description ||
                                tx.category?.name ||
                                (tx.purpose === "credit_card_refund"
                                  ? "Hoàn tiền thẻ"
                                  : tx.purpose === "credit_card_payment"
                                    ? "Thanh toán thẻ tín dụng"
                                    : isIncome
                                      ? "Khoản thu"
                                      : isExpense
                                        ? "Khoản chi"
                                        : "Chuyển khoản")}
                            </p>
                            {tx.status !== "approved" && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.62rem] font-medium",
                                  tx.status === "pending"
                                    ? "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]"
                                    : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                                )}
                              >
                                {tx.status === "pending"
                                  ? "Chờ duyệt"
                                  : "Đã lên lịch"}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                            {tx.purpose === "credit_card_payment"
                              ? tx.paymentSources && tx.paymentSources.length > 0
                                ? `${tx.paymentSources
                                    .map(
                                      (s) =>
                                        walletNameById.get(s.walletId) ??
                                        "Ví thanh toán",
                                    )
                                    .join(", ")} → ${tx.wallet}`
                                : `Thanh toán thẻ ${tx.wallet}`
                              : tx.purpose === "credit_card_refund"
                                ? `Hoàn tiền vào ${tx.wallet}`
                                : tx.type === "transfer" && tx.toWallet
                                  ? `${tx.wallet} → ${tx.toWallet}`
                                  : `Ví ${tx.wallet}`}{" "}
                            · {tx.member} · {formattedDate}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <strong
                          className={cn(
                            "block text-sm font-bold tabular-nums",
                            isIncome && "text-[var(--income)]",
                            isExpense && "text-[var(--expense)]",
                            !isIncome &&
                              !isExpense &&
                              "text-[var(--foreground)]",
                          )}
                        >
                          {displayAmount(tx.amount, {
                            prefix: isIncome ? "+" : isExpense ? "−" : "↔",
                          })}
                        </strong>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center p-6">
                  <Empty
                    variant="compact"
                    title="Chưa có giao dịch"
                    description="Ghi nhận khoản thu chi đầu tiên để bắt đầu theo dõi."
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openQuickEntry("expense")}
                    className="mt-3"
                  >
                    <Plus className="mr-1.5 size-4" />
                    Ghi giao dịch mới
                  </Button>
                </div>
              ))}

            {activityTab === "upcoming" &&
              (upcomingObligations.length > 0 ? (
                upcomingObligations.map((item) => {
                  const [, m, d] = item.dateStr.split("-");
                  const isUrgent = item.daysLeft <= 3;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={(event) => {
                        if (
                          !event.ctrlKey &&
                          !event.metaKey &&
                          event.button === 0
                        ) {
                          event.preventDefault();
                          beginNavigation(item.href);
                        }
                      }}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-secondary)]/50 md:px-5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-9 shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[0.65rem] font-semibold leading-none text-[var(--foreground)] tabular-nums">
                          <span>{d}</span>
                          <span className="mt-0.5 text-[0.58rem] text-[var(--text-muted)]">
                            T{m}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                              {item.title}
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[0.62rem] font-semibold tabular-nums",
                                item.daysLeft < 0
                                  ? "bg-[var(--expense)]/15 text-[var(--expense)]"
                                  : isUrgent
                                    ? "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]"
                                    : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                              )}
                            >
                              {item.daysLeft < 0
                                ? "Quá hạn"
                                : item.daysLeft === 0
                                  ? "Hôm nay"
                                  : item.daysLeft === 1
                                    ? "Ngày mai"
                                    : `Còn ${item.daysLeft} ngày`}
                            </span>
                          </div>
                          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <strong
                          className={cn(
                            "block text-sm font-bold tabular-nums",
                            item.type === "income"
                              ? "text-[var(--income)]"
                              : item.type === "expense"
                                ? "text-[var(--expense)]"
                                : "text-[var(--foreground)]",
                          )}
                        >
                          {displayAmount(item.amount, {
                            prefix:
                              item.type === "income"
                                ? "+"
                                : item.type === "expense"
                                  ? "−"
                                  : "↔",
                          })}
                        </strong>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-6">
                  <Empty
                    variant="compact"
                    icon={CalendarClock}
                    title="Không có lịch sắp tới"
                    description="Chưa có sao kê thẻ hay giao dịch định kỳ nào sắp đến hạn."
                  />
                </div>
              ))}

            {activityTab === "pending" &&
              (pendingTransactions.length > 0 ? (
                pendingTransactions.slice(0, 6).map((tx) => {
                  const isIncome = tx.type === "income";
                  const isExpense = tx.type === "expense";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 md:px-5"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTransaction(tx)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                          {tx.description ||
                            tx.category?.name ||
                            (tx.purpose === "credit_card_refund"
                              ? "Hoàn tiền thẻ"
                              : tx.purpose === "credit_card_payment"
                                ? "Thanh toán thẻ tín dụng"
                                : "Giao dịch chờ duyệt")}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-[var(--text-muted)] tabular-nums">
                          {tx.member} · Ví {tx.wallet} ·{" "}
                          {formatShortDate(tx.date)}
                        </p>
                        <strong
                          className={cn(
                            "mt-0.5 block text-xs font-bold tabular-nums",
                            isIncome
                              ? "text-[var(--income)]"
                              : isExpense
                                ? "text-[var(--expense)]"
                                : "text-[var(--foreground)]",
                          )}
                        >
                          {displayAmount(tx.amount, {
                            prefix: isIncome ? "+" : isExpense ? "−" : "↔",
                          })}
                        </strong>
                      </button>

                      {canApprove && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={busy}
                            onClick={() =>
                              handleReviewTransaction(tx.id, false)
                            }
                            aria-label="Từ chối giao dịch"
                            title="Từ chối giao dịch"
                          >
                            <X className="size-4 text-[var(--expense)]" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            disabled={busy}
                            onClick={() => handleReviewTransaction(tx.id, true)}
                            aria-label="Duyệt giao dịch"
                            title="Duyệt giao dịch"
                          >
                            <Check className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6">
                  <Empty
                    variant="compact"
                    title="Không có giao dịch chờ duyệt"
                    description="Tất cả giao dịch trong nhóm đã được phê duyệt."
                  />
                </div>
              ))}
          </div>
        </Card>
      </section>

      {/* SHEET 1: TRANSACTION QUICK DETAIL & APPROVAL SHEET */}
      <Sheet
        open={Boolean(selectedTransaction)}
        onOpenChange={(open) => {
          if (!open) setSelectedTransaction(null);
        }}
      >
        <SheetContent side={isMobile ? "bottom" : "right"}>
          <SheetHeader
            icon={ReceiptText}
            title="Chi tiết giao dịch"
            description="Thông tin chi tiết giao dịch."
          />

          {selectedTransaction && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
              {/* Amount Banner */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-4 text-center">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {selectedTransaction.purpose === "credit_card_refund"
                    ? "Hoàn tiền thẻ tín dụng"
                    : selectedTransaction.purpose === "credit_card_payment"
                      ? "Thanh toán thẻ tín dụng"
                      : selectedTransaction.type === "income"
                        ? "Thu nhập"
                        : selectedTransaction.type === "expense"
                          ? "Chi tiêu"
                          : "Chuyển tiền"}
                </span>
                <strong
                  className={cn(
                    "mt-1 block text-2xl font-bold tabular-nums",
                    selectedTransaction.type === "income" &&
                      "text-[var(--income)]",
                    selectedTransaction.type === "expense" &&
                      "text-[var(--expense)]",
                    selectedTransaction.type === "transfer" &&
                      "text-[var(--foreground)]",
                  )}
                >
                  {selectedTransaction.type === "income"
                    ? "+"
                    : selectedTransaction.type === "expense"
                      ? "−"
                      : "↔"}
                  {formatAmount(selectedTransaction.amount)}{" "}
                  <span className="text-sm font-semibold opacity-75">
                    {workspace.currency}
                  </span>
                </strong>
                {selectedTransaction.description && (
                  <p className="mt-1.5 break-words text-sm text-[var(--foreground)]">
                    {selectedTransaction.description}
                  </p>
                )}
              </div>

              {/* Detail Rows */}
              <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[var(--text-muted)]">Ngày giao dịch</span>
                  <strong className="font-semibold text-[var(--foreground)] tabular-nums">
                    {formatShortDate(selectedTransaction.date)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[var(--text-muted)]">Ví / Tài khoản</span>
                  <strong className="font-semibold text-[var(--foreground)]">
                    {selectedTransaction.purpose === "credit_card_payment" &&
                    selectedTransaction.paymentSources &&
                    selectedTransaction.paymentSources.length > 0
                      ? `${selectedTransaction.paymentSources
                          .map(
                            (s) =>
                              walletNameById.get(s.walletId) ?? "Ví thanh toán",
                          )
                          .join(", ")} → ${selectedTransaction.wallet}`
                      : selectedTransaction.type === "transfer" &&
                          selectedTransaction.toWallet
                        ? `${selectedTransaction.wallet} → ${selectedTransaction.toWallet}`
                        : selectedTransaction.wallet}
                  </strong>
                </div>
                {selectedTransaction.category && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-[var(--text-muted)]">Danh mục</span>
                    <strong className="font-semibold text-[var(--foreground)]">
                      {selectedTransaction.category.name}
                    </strong>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[var(--text-muted)]">Người tạo</span>
                  <strong className="font-semibold text-[var(--foreground)]">
                    {selectedTransaction.member}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[var(--text-muted)]">Trạng thái</span>
                  <strong className="font-semibold text-[var(--foreground)]">
                    {selectedTransaction.status === "approved"
                      ? "Đã ghi nhận"
                      : selectedTransaction.status === "pending"
                        ? "Đang chờ duyệt"
                        : selectedTransaction.status === "scheduled"
                          ? "Đã lên lịch"
                          : "Đã từ chối"}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <SheetFooter>
            {selectedTransaction?.status === "pending" && canApprove ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    handleReviewTransaction(selectedTransaction.id, false)
                  }
                  className="flex-1 sm:flex-none"
                >
                  <X className="mr-1.5 size-4 text-[var(--expense)]" />
                  Từ chối
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    handleReviewTransaction(selectedTransaction.id, true)
                  }
                  className="flex-1 sm:flex-none"
                >
                  <Check className="mr-1.5 size-4" />
                  Duyệt ngay
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTransaction(null)}
                  className="flex-1 sm:flex-none"
                >
                  Đóng
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedTransaction(null);
                    beginNavigation(ledgerHref);
                  }}
                  className="flex-1 sm:flex-none"
                >
                  Mở sổ giao dịch
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* SHEET 2: FULL CATEGORY / MEMBER STRUCTURE BREAKDOWN */}
      <Sheet
        open={allCategoriesSheetOpen}
        onOpenChange={setAllCategoriesSheetOpen}
      >
        <SheetContent side={isMobile ? "bottom" : "right"}>
          <SheetHeader
            icon={PiggyBank}
            title={
              structureMode === "income"
                ? "Toàn bộ nguồn thu nhập"
                : structureMode === "member"
                  ? "Chi tiêu theo thành viên"
                  : "Toàn bộ danh mục chi tiêu"
            }
            description={`Kỳ ${periodLabel} (${formatDateRangeLabel(activeDateRange)})`}
          />

          <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto px-4 py-2 md:px-6">
            {activeStructureItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {structureMode === "member" ? (
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.name.slice(0, 1).toUpperCase()}
                    </span>
                  ) : (
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${item.color} 15%, var(--surface))`,
                        color: item.color,
                      }}
                    >
                      <CategoryIcon
                        category={{
                          color: item.color,
                          icon: item.icon,
                        }}
                        size={14}
                      />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-[var(--foreground)]">
                      {item.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {item.count} giao dịch · {item.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <strong className="shrink-0 text-sm font-bold text-[var(--foreground)] tabular-nums">
                  {displayAmount(item.amount)}
                </strong>
              </div>
            ))}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAllCategoriesSheetOpen(false)}
              className="flex-1 sm:flex-none"
            >
              Đóng
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAllCategoriesSheetOpen(false);
                beginNavigation(ledgerHref);
              }}
              className="flex-1 sm:flex-none"
            >
              Mở sổ giao dịch
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* SHEET 3: PENDING APPROVALS QUICK SHEET */}
      <Sheet open={approvalsSheetOpen} onOpenChange={setApprovalsSheetOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"}>
          <SheetHeader
            icon={CircleAlert}
            title={`Giao dịch chờ duyệt (${pendingTransactions.length})`}
            description="Kiểm tra và duyệt các giao dịch chờ xác nhận."
          />

          <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto px-4 py-2 md:px-6">
            {pendingTransactions.length > 0 ? (
              pendingTransactions.map((tx) => {
                const isIncome = tx.type === "income";
                const isExpense = tx.type === "expense";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                        {tx.description ||
                          tx.category?.name ||
                          (tx.purpose === "credit_card_refund"
                            ? "Hoàn tiền thẻ"
                            : tx.purpose === "credit_card_payment"
                              ? "Thanh toán thẻ tín dụng"
                              : "Giao dịch chờ duyệt")}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)] tabular-nums">
                        {tx.member} · Ví {tx.wallet} ·{" "}
                        {formatShortDate(tx.date)}
                      </p>
                      <strong
                        className={cn(
                          "mt-0.5 block text-sm font-bold tabular-nums",
                          isIncome
                            ? "text-[var(--income)]"
                            : isExpense
                              ? "text-[var(--expense)]"
                              : "text-[var(--foreground)]",
                        )}
                      >
                        {displayAmount(tx.amount, {
                          prefix: isIncome ? "+" : isExpense ? "−" : "↔",
                        })}
                      </strong>
                    </div>

                    {canApprove && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={busy}
                          onClick={() => handleReviewTransaction(tx.id, false)}
                          aria-label="Từ chối"
                          title="Từ chối"
                        >
                          <X className="size-4 text-[var(--expense)]" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          disabled={busy}
                          onClick={() => handleReviewTransaction(tx.id, true)}
                          aria-label="Duyệt"
                          title="Duyệt"
                        >
                          <Check className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8">
                <Empty
                  variant="compact"
                  title="Đã xử lý hết giao dịch chờ duyệt"
                />
              </div>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApprovalsSheetOpen(false)}
              className="flex-1 sm:flex-none"
            >
              Đóng
            </Button>
            <Button
              type="button"
              onClick={() => {
                setApprovalsSheetOpen(false);
                beginNavigation(`${ledgerHref}?status=pending`);
              }}
              className="flex-1 sm:flex-none"
            >
              Xem trong sổ giao dịch
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
      className="h-[15rem] w-full md:h-[18.5rem]"
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
          right: isMobile ? 10 : 8,
          left: 0,
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
          width={isMobile ? 42 : 56}
          tickLine={false}
          tickMargin={isMobile ? 4 : 6}
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
      ? "Chuyển tiền nội bộ không tính vào thu chi."
      : visibleTypes.length === 0
        ? "Không có dữ liệu khớp bộ lọc."
        : "Chưa có giao dịch trong kỳ này.";

  return (
    <section className="min-w-0" aria-label="Biểu đồ thu nhập và chi tiêu">
      {hasData ? (
        <ChartContainer
          config={monthlyChartConfig}
          className="h-[15rem] w-full md:h-[18.5rem]"
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
              right: isMobile ? 10 : 8,
              left: 0,
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
              width={isMobile ? 42 : 56}
              tickLine={false}
              tickMargin={isMobile ? 4 : 6}
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
