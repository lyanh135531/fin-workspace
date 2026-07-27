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

export type BalanceWallet = {
  id: string;
  name: string;
  balance: string;
};

export type MonthlyBalance = {
  period: string;
  total: string;
  wallets: Record<string, string>;
  hasNegativeBalance: boolean;
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

export type MemberMonthlyTotal = {
  period: string;
  totals: Record<string, string>;
};

export type MemberTransactionFilters = {
  endPeriod: string;
  range: CashflowRange;
  walletId: string;
  categoryId: string;
  type: CashflowType;
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

export function buildMemberMonthlyTotals(
  members: { id: string; name: string }[],
  transactions: ChartTransaction[],
  filters: MemberTransactionFilters,
): MemberMonthlyTotal[] {
  const periods = recentPeriods(filters.endPeriod, filters.range);
  const periodSet = new Set(periods);
  const totals = new Map(
    periods.map((period) => [
      period,
      new Map(members.map((member) => [member.id, new Decimal(0)])),
    ]),
  );
  const memberIds = new Set(members.map((member) => member.id));

  for (const transaction of transactions) {
    const period = transaction.date.slice(0, 7);
    if (
      transaction.status !== "approved"
      || transaction.type !== filters.type
      || !periodSet.has(period)
      || !memberIds.has(transaction.memberId)
      || (filters.walletId !== "all"
        && transaction.walletId !== filters.walletId
        && transaction.toWalletId !== filters.walletId)
      || (filters.categoryId !== "all" && transaction.categoryId !== filters.categoryId)
    ) {
      continue;
    }

    const periodTotals = totals.get(period);
    if (!periodTotals) continue;
    periodTotals.set(
      transaction.memberId,
      (periodTotals.get(transaction.memberId) ?? new Decimal(0)).plus(transaction.amount),
    );
  }

  return periods.map((period) => ({
    period,
    totals: Object.fromEntries(
      members.map((member) => [
        member.id,
        (totals.get(period)?.get(member.id) ?? new Decimal(0)).toString(),
      ]),
    ),
  }));
}

export function buildMonthlyBalances(
  wallets: BalanceWallet[],
  transactions: ChartTransaction[],
  filters: {
    endPeriod: string;
    range: CashflowRange;
    walletId: string;
  },
): MonthlyBalance[] {
  const periods = recentPeriods(filters.endPeriod, filters.range);
  const visibleWallets = filters.walletId === "all"
    ? wallets
    : wallets.filter((wallet) => wallet.id === filters.walletId);
  const balances = new Map(
    visibleWallets.map((wallet) => [wallet.id, new Decimal(wallet.balance)]),
  );
  const rows = new Map<string, MonthlyBalance>();

  for (let index = periods.length - 1; index >= 0; index -= 1) {
    const period = periods[index];
    const walletBalances = Object.fromEntries(
      visibleWallets.map((wallet) => [
        wallet.id,
        (balances.get(wallet.id) ?? new Decimal(0)).toString(),
      ]),
    );
    const total = visibleWallets.reduce(
      (sum, wallet) => sum.plus(balances.get(wallet.id) ?? 0),
      new Decimal(0),
    );

    rows.set(period, {
      period,
      total: total.toString(),
      wallets: walletBalances,
      hasNegativeBalance: visibleWallets.some((wallet) =>
        (balances.get(wallet.id) ?? new Decimal(0)).isNegative()),
    });

    if (index === 0) continue;

    for (const transaction of transactions) {
      if (
        transaction.status !== "approved"
        || transaction.date.slice(0, 7) !== period
      ) {
        continue;
      }

      const amount = new Decimal(transaction.amount);
      const sourceBalance = balances.get(transaction.walletId);
      if (sourceBalance) {
        if (transaction.type === "income") {
          balances.set(transaction.walletId, sourceBalance.minus(amount));
        } else {
          balances.set(transaction.walletId, sourceBalance.plus(amount));
        }
      }

      if (transaction.type === "transfer" && transaction.toWalletId) {
        const destinationBalance = balances.get(transaction.toWalletId);
        if (destinationBalance) {
          balances.set(transaction.toWalletId, destinationBalance.minus(amount));
        }
      }
    }
  }

  return periods.map((period) => rows.get(period) ?? {
    period,
    total: "0",
    wallets: {},
    hasNegativeBalance: false,
  });
}
