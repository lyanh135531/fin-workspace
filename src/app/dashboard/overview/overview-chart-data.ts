import Decimal from "decimal.js";

export type CashflowType = "income" | "expense";
export type CashflowRange = 3 | 6 | 12;

type ChartTransaction = {
  amount: string;
  type: CashflowType | "transfer";
  status: "pending" | "scheduled" | "approved" | "rejected";
  date: string;
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  memberId: string;
};

export type CashflowFilters = {
  endPeriod: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  memberId: string;
  transactionType: string;
  categoryType?: CashflowType;
};

export type MonthlyCashflow = {
  period: string;
  income: string;
  expense: string;
  warningFrom: string;
  warningTo: string;
  hasWarning: boolean;
};

export function getVisibleCashflowTypes(
  transactionType: string,
  categoryType?: CashflowType,
): CashflowType[] {
  if (transactionType === "transfer") return [];
  if (transactionType === "income" || transactionType === "expense") {
    return !categoryType || categoryType === transactionType ? [transactionType] : [];
  }
  return categoryType ? [categoryType] : ["income", "expense"];
}

function recentPeriods(endPeriod: string, count: CashflowRange) {
  const [year, month] = endPeriod.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

export function buildMonthlyCashflow(
  transactions: ChartTransaction[],
  filters: CashflowFilters,
): MonthlyCashflow[] {
  const periods = recentPeriods(filters.endPeriod, filters.range);
  const periodSet = new Set(periods);
  const totals = new Map(
    periods.map((period) => [
      period,
      { income: new Decimal(0), expense: new Decimal(0) },
    ]),
  );

  for (const transaction of transactions) {
    const period = transaction.date.slice(0, 7);
    if (
      transaction.status !== "approved"
      || transaction.type === "transfer"
      || !periodSet.has(period)
      || (filters.walletId !== "all"
        && transaction.walletId !== filters.walletId
        && transaction.toWalletId !== filters.walletId)
      || (filters.categoryId !== "all" && transaction.categoryId !== filters.categoryId)
      || (filters.memberId !== "all" && transaction.memberId !== filters.memberId)
      || (filters.transactionType !== "all" && transaction.type !== filters.transactionType)
    ) {
      continue;
    }

    const periodTotals = totals.get(period);
    if (!periodTotals) continue;
    periodTotals[transaction.type] = periodTotals[transaction.type].plus(transaction.amount);
  }

  return periods.map((period) => {
    const periodTotals = totals.get(period);
    const income = periodTotals?.income ?? new Decimal(0);
    const expense = periodTotals?.expense ?? new Decimal(0);
    const hasWarning = expense.greaterThan(income);

    return {
      period,
      income: income.toString(),
      expense: expense.toString(),
      warningFrom: (hasWarning ? income : expense).toString(),
      warningTo: expense.toString(),
      hasWarning,
    };
  });
}
