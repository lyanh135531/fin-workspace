import Decimal from "decimal.js";

export type LedgerPeriodSummary = {
  period: string;
  income: string;
  expense: string;
  pending: number;
};

type SummaryTransaction = {
  amount: { toString(): string } | string;
  date: Date | string;
  type: "income" | "expense" | "transfer" | "investment_buy" | "investment_sell";
  workflowStatus: "pending" | "scheduled" | "approved" | "rejected";
};

export function buildLedgerPeriodSummaries(
  transactions: SummaryTransaction[],
  currentPeriod: string,
): LedgerPeriodSummary[] {
  const emptySummary = () => ({ income: new Decimal(0), expense: new Decimal(0), pending: 0 });
  const summaryByPeriod = new Map<string, ReturnType<typeof emptySummary>>();
  const allPeriods = emptySummary();
  summaryByPeriod.set(currentPeriod, emptySummary());

  for (const transaction of transactions) {
    const date = transaction.date instanceof Date ? transaction.date.toISOString() : transaction.date;
    const period = date.slice(0, 7);
    const periodSummary = summaryByPeriod.get(period) ?? emptySummary();
    summaryByPeriod.set(period, periodSummary);
    if (transaction.workflowStatus === "approved" && transaction.type === "income") {
      periodSummary.income = periodSummary.income.plus(transaction.amount.toString());
      allPeriods.income = allPeriods.income.plus(transaction.amount.toString());
    }
    if (transaction.workflowStatus === "approved" && transaction.type === "expense") {
      periodSummary.expense = periodSummary.expense.plus(transaction.amount.toString());
      allPeriods.expense = allPeriods.expense.plus(transaction.amount.toString());
    }
    if (transaction.workflowStatus === "pending") {
      periodSummary.pending += 1;
      allPeriods.pending += 1;
    }
  }

  return [
    { period: "all", income: allPeriods.income.toString(), expense: allPeriods.expense.toString(), pending: allPeriods.pending },
    ...[...summaryByPeriod.entries()].map(([period, summary]) => ({
      period,
      income: summary.income.toString(),
      expense: summary.expense.toString(),
      pending: summary.pending,
    })),
  ];
}
