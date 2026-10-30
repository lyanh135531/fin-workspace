import Decimal from "decimal.js";
import {
  type BalanceWallet,
  buildDailyBalances,
  buildDailyCashflow,
  buildMonthlyBalances,
  buildMonthlyCashflow,
  type ChartTransaction,
  type DashboardPeriod,
  getDashboardPeriodDateRange,
  type MonthlyCashflow,
} from "@/app/dashboard/overview/overview-chart-data";
import type { DateRangeValue } from "@/components/base";
import { prisma } from "@/lib/prisma";
import { availableCategoryWhere } from "@/services/category-visibility";
import { getWorkspaceInvestmentsOverview } from "@/services/investment-service";

export type OverviewStructureItem = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  amount: string;
  count: number;
  percent: number;
};

export type OverviewBalancePoint = {
  period: string;
  total: string;
  hasNegativeBalance: boolean;
};

export type OverviewPeriodAnalytics = {
  revision: string;
  reportPeriod: string;
  period: DashboardPeriod;
  activeTotals: {
    income: string;
    expense: string;
    count: number;
  };
  prevTotals: {
    income: string;
    expense: string;
    count: number;
  };
  expenseByCategory: OverviewStructureItem[];
  incomeByCategory: OverviewStructureItem[];
  memberExpenses: OverviewStructureItem[];
  cashflowSeries: MonthlyCashflow[];
  balanceSeries: OverviewBalancePoint[];
};

const MEMBER_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

function memberSeriesColor(index: number): string {
  return (
    MEMBER_CHART_COLORS[index] ??
    `hsl(${Math.round((index * 137.508) % 360)} 58% 52%)`
  );
}

export function shiftOverviewReportPeriod(
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

function isInDateRange(date: string, range: DateRangeValue): boolean {
  const transactionDate = date.slice(0, 10);
  return transactionDate >= range.from && transactionDate <= range.to;
}

function summarizeTransactionsForRange(
  transactions: ChartTransaction[],
  dateRange: DateRangeValue,
): { income: string; expense: string; count: number } {
  const totals = transactions.reduce(
    (result, item) => {
      if (
        item.status !== "approved" ||
        !isInDateRange(item.date, dateRange) ||
        item.purpose === "investment_contribution" ||
        item.purpose === "investment_settlement" ||
        item.purpose === "balance_reconciliation"
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
    income: totals.income.toString(),
    expense: Decimal.max(new Decimal(0), totals.expense).toString(),
    count: totals.count,
  };
}

function buildCategoryBreakdownForRange(
  transactions: ChartTransaction[],
  categoriesById: Map<
    string,
    { name: string; color: string; icon: string | null }
  >,
  dateRange: DateRangeValue,
  targetType: "expense" | "income",
): OverviewStructureItem[] {
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

  for (const item of transactions) {
    if (
      item.status !== "approved" ||
      item.purpose === "investment_contribution" ||
      item.purpose === "investment_settlement" ||
      item.purpose === "balance_reconciliation" ||
      !isInDateRange(item.date, dateRange) ||
      !(targetType === "income"
        ? item.type === "income" && item.purpose !== "credit_card_refund"
        : item.type === "expense" || item.purpose === "credit_card_refund")
    ) {
      continue;
    }

    const key = item.categoryId ?? "uncategorized";
    const prior = rows.get(key);
    const cat = item.categoryId ? categoriesById.get(item.categoryId) : null;
    const signedAmount =
      item.purpose === "credit_card_refund"
        ? new Decimal(item.amount).negated()
        : new Decimal(item.amount);

    rows.set(key, {
      id: key,
      name: cat?.name ?? "Chưa phân loại",
      color:
        cat?.color ??
        (targetType === "income" ? "var(--income)" : "var(--chart-1)"),
      icon: cat?.icon ?? "tag",
      amount: (prior?.amount ?? new Decimal(0)).plus(signedAmount),
      count: (prior?.count ?? 0) + 1,
    });
  }

  const positiveRows = [...rows.values()]
    .filter((row) => row.amount.gt(0))
    .sort((a, b) => b.amount.comparedTo(a.amount));
  const positiveTotal = positiveRows.reduce(
    (sum, row) => sum.plus(row.amount),
    new Decimal(0),
  );

  return positiveRows.map((row, idx) => ({
    id: row.id,
    name: row.name,
    color: row.color || memberSeriesColor(idx),
    icon: row.icon,
    amount: row.amount.toString(),
    count: row.count,
    percent: positiveTotal.isZero()
      ? 0
      : row.amount.div(positiveTotal).times(100).toNumber(),
  }));
}

function buildMemberExpenseBreakdownForRange(
  transactions: ChartTransaction[],
  members: ReadonlyArray<{ id: string; name: string }>,
  dateRange: DateRangeValue,
): OverviewStructureItem[] {
  const rawMemberExpenses = members
    .map((member, idx) => {
      const matched = transactions.filter(
        (t) =>
          t.memberId === member.id &&
          t.purpose !== "investment_contribution" &&
          t.purpose !== "investment_settlement" &&
          t.purpose !== "balance_reconciliation" &&
          (t.type === "expense" || t.purpose === "credit_card_refund") &&
          t.status === "approved" &&
          isInDateRange(t.date, dateRange),
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
      return {
        id: member.id,
        name: member.name,
        color: memberSeriesColor(idx),
        icon: null as string | null,
        amount: memberSpent,
        count: matched.length,
      };
    })
    .filter((m) => m.amount.gt(0))
    .sort((a, b) => b.amount.comparedTo(a.amount));

  const memberPositiveTotal = rawMemberExpenses.reduce(
    (sum, m) => sum.plus(m.amount),
    new Decimal(0),
  );

  return rawMemberExpenses.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    icon: m.icon,
    amount: m.amount.toString(),
    count: m.count,
    percent: memberPositiveTotal.isZero()
      ? 0
      : m.amount.div(memberPositiveTotal).times(100).toNumber(),
  }));
}

export function computeOverviewPeriodAnalytics({
  revision,
  reportPeriod,
  period,
  wallets,
  members,
  categoriesById,
  transactions,
  investmentMarketValue = "0",
  investmentCostBasis = "0",
}: {
  revision: string;
  reportPeriod: string;
  period: DashboardPeriod;
  wallets: BalanceWallet[];
  members: ReadonlyArray<{ id: string; name: string }>;
  categoriesById: Map<
    string,
    { name: string; color: string; icon: string | null }
  >;
  transactions: ChartTransaction[];
  investmentMarketValue?: string;
  investmentCostBasis?: string;
}): OverviewPeriodAnalytics {
  const activeDateRange = getDashboardPeriodDateRange(reportPeriod, period);
  const prevReportPeriod = shiftOverviewReportPeriod(reportPeriod, -1, period);
  const prevDateRange = getDashboardPeriodDateRange(prevReportPeriod, period);

  const activeTotals = summarizeTransactionsForRange(
    transactions,
    activeDateRange,
  );
  const prevTotals = summarizeTransactionsForRange(transactions, prevDateRange);

  const expenseByCategory = buildCategoryBreakdownForRange(
    transactions,
    categoriesById,
    activeDateRange,
    "expense",
  );
  const incomeByCategory = buildCategoryBreakdownForRange(
    transactions,
    categoriesById,
    activeDateRange,
    "income",
  );
  const memberExpenses = buildMemberExpenseBreakdownForRange(
    transactions,
    members,
    activeDateRange,
  );

  const cashflowSeries =
    period === "month"
      ? buildDailyCashflow(transactions, {
          endPeriod: reportPeriod,
          walletId: "all",
          categoryId: "all",
          memberId: "all",
          transactionType: "all",
          dateRange: activeDateRange,
        })
      : buildMonthlyCashflow(transactions, {
          endPeriod: reportPeriod,
          range: 12,
          walletId: "all",
          categoryId: "all",
          memberId: "all",
          transactionType: "all",
          dateRange: activeDateRange,
        });

  const rawBalances =
    period === "month"
      ? buildDailyBalances(
          wallets,
          transactions,
          {
            walletId: "all",
            dateRange: activeDateRange,
            investmentMarketValue,
            investmentCostBasis,
          },
          investmentMarketValue,
          investmentCostBasis,
        )
      : buildMonthlyBalances(
          wallets,
          transactions,
          {
            endPeriod: reportPeriod,
            range: 12,
            walletId: "all",
            dateRange: activeDateRange,
            investmentMarketValue,
            investmentCostBasis,
          },
          investmentMarketValue,
          investmentCostBasis,
        );

  const balanceSeries: OverviewBalancePoint[] = rawBalances.map((point) => ({
    period: point.period,
    total: point.total,
    hasNegativeBalance: point.hasNegativeBalance,
  }));

  return {
    revision,
    reportPeriod,
    period,
    activeTotals,
    prevTotals,
    expenseByCategory,
    incomeByCategory,
    memberExpenses,
    cashflowSeries,
    balanceSeries,
  };
}

function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export async function queryOverviewPeriodAnalytics({
  userId,
  workspaceId,
  reportPeriod,
  period,
  preloadedWallets,
  preloadedMembers,
  preloadedCategories,
  preloadedInvestmentTotals,
}: {
  userId: string;
  workspaceId: string;
  reportPeriod: string;
  period: DashboardPeriod;
  preloadedWallets?: BalanceWallet[];
  preloadedMembers?: ReadonlyArray<{ id: string; name: string }>;
  preloadedCategories?: ReadonlyArray<{
    id: string;
    name: string;
    color: string;
    icon: string | null;
  }>;
  preloadedInvestmentTotals?: {
    marketValue: string;
    costBasis: string;
  } | null;
}): Promise<OverviewPeriodAnalytics> {
  const prevReportPeriod = shiftOverviewReportPeriod(reportPeriod, -1, period);
  const prevDateRange = getDashboardPeriodDateRange(prevReportPeriod, period);

  const [rows, walletLinks, memberRows, categoryRows, investmentsData] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          deletedAt: null,
          workflowStatus: "approved",
          member: { workspaceId },
          OR: [
            { date: { gte: toDbDate(prevDateRange.from) } },
            {
              purpose: {
                in: ["investment_contribution", "investment_settlement"],
              },
            },
          ],
        },
        select: {
          id: true,
          amount: true,
          type: true,
          purpose: true,
          workflowStatus: true,
          date: true,
          updatedAt: true,
          walletId: true,
          toWalletId: true,
          categoryId: true,
          memberId: true,
          creditCardPaymentSources: {
            select: { sourceWalletId: true, amount: true },
          },
          goldSaleRecord: {
            select: { costBasisAllocatedAmount: true, deletedAt: true },
          },
          savingsDepositSettlement: {
            select: { principalWithdrawnAmount: true },
          },
          category: preloadedCategories
            ? false
            : { select: { id: true, name: true, color: true, icon: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      preloadedWallets
        ? Promise.resolve(null)
        : prisma.workspaceWallet.findMany({
            where: { workspaceId },
            select: {
              wallet: {
                select: {
                  id: true,
                  name: true,
                  kind: true,
                  deletedAt: true,
                  currentBalance: true,
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
          }),
      preloadedMembers
        ? Promise.resolve(null)
        : prisma.workspaceMember.findMany({
            where: { workspaceId, status: "active", deletedAt: null },
            select: { id: true, user: { select: { username: true } } },
            orderBy: { user: { username: "asc" } },
          }),
      preloadedCategories
        ? Promise.resolve(null)
        : prisma.category.findMany({
            where: availableCategoryWhere(workspaceId),
            select: { id: true, name: true, color: true, icon: true },
          }),
      preloadedInvestmentTotals !== undefined
        ? Promise.resolve(null)
        : getWorkspaceInvestmentsOverview(userId, workspaceId, {
            syncQuotesOnlyWhenHoldingGold: true,
          }).catch(() => null),
    ]);

  const wallets: BalanceWallet[] =
    preloadedWallets ??
    (walletLinks ?? []).map(({ wallet }) => ({
      id: wallet.id,
      name: wallet.name,
      kind: wallet.kind,
      balance: wallet.deletedAt ? "0" : wallet.currentBalance.toString(),
    }));

  const members: ReadonlyArray<{ id: string; name: string }> =
    preloadedMembers ??
    (memberRows ?? []).map((m) => ({
      id: m.id,
      name: m.user.username ?? "Người dùng",
    }));

  const categoriesById = new Map<
    string,
    { name: string; color: string; icon: string | null }
  >();
  for (const cat of preloadedCategories ?? categoryRows ?? []) {
    categoriesById.set(cat.id, {
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
    });
  }
  for (const row of rows) {
    if (
      row.categoryId &&
      "category" in row &&
      row.category &&
      !categoriesById.has(row.categoryId)
    ) {
      categoriesById.set(row.categoryId, {
        name: row.category.name,
        color: row.category.color,
        icon: row.category.icon,
      });
    }
  }

  const chartTransactions: ChartTransaction[] = rows.map((row) => {
    const investmentPrincipalDelta =
      row.purpose === "investment_settlement"
        ? row.goldSaleRecord && !row.goldSaleRecord.deletedAt
          ? row.goldSaleRecord.costBasisAllocatedAmount.toString()
          : row.savingsDepositSettlement
            ? row.savingsDepositSettlement.principalWithdrawnAmount.toString()
            : undefined
        : undefined;

    return {
      amount: row.amount.toString(),
      type: row.type,
      purpose: row.purpose,
      status: row.workflowStatus,
      date: row.date.toISOString().slice(0, 10),
      walletId: row.walletId,
      toWalletId: row.toWalletId,
      categoryId: row.categoryId,
      memberId: row.memberId,
      investmentPrincipalDelta,
      paymentSources: row.creditCardPaymentSources.map((src) => ({
        walletId: src.sourceWalletId,
        amount: src.amount.toString(),
      })),
    };
  });

  const latestUpdatedAt = rows.reduce(
    (max, item) => Math.max(max, item.updatedAt.getTime()),
    0,
  );
  const revision = `${rows.length}:${latestUpdatedAt}:${reportPeriod}:${period}`;

  const investmentMarketValue =
    preloadedInvestmentTotals !== undefined
      ? (preloadedInvestmentTotals?.marketValue ?? "0")
      : (investmentsData?.summary.totalPortfolioMarketValue ?? "0");
  const investmentCostBasis =
    preloadedInvestmentTotals !== undefined
      ? (preloadedInvestmentTotals?.costBasis ?? "0")
      : (investmentsData?.summary.totalPortfolioCostBasis ?? "0");

  return computeOverviewPeriodAnalytics({
    revision,
    reportPeriod,
    period,
    wallets,
    members,
    categoriesById,
    transactions: chartTransactions,
    investmentMarketValue,
    investmentCostBasis,
  });
}
