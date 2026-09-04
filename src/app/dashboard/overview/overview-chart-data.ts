import Decimal from "decimal.js";
import type { DateRangeValue } from "@/components/base/date-range-picker";

export type CashflowType = "income" | "expense";
export type CashflowRange = 3 | 6 | 12;
export type DashboardPeriod = "month" | "quarter" | "year";

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
  dateRange?: DateRangeValue;
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
  dateRange?: DateRangeValue;
};

export function getDashboardPeriodDateRange(
  reportPeriod: string,
  period: DashboardPeriod,
): DateRangeValue {
  const match = /^(\d{4})-(\d{2})$/.exec(reportPeriod);
  if (!match) {
    throw new RangeError(
      `Invalid report period "${reportPeriod}". Expected yyyy-MM.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new RangeError(
      `Invalid report period "${reportPeriod}". Month must be between 01 and 12.`,
    );
  }
  const startMonth =
    period === "month"
      ? month
      : period === "quarter"
        ? Math.floor((month - 1) / 3) * 3 + 1
        : 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

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

function recentPeriods(endPeriod: string, count: CashflowRange): string[] {
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
  const periods = reportPeriods(filters.endPeriod, filters.range, filters.dateRange);
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
      || (filters.dateRange !== undefined
        && (transaction.date.slice(0, 10) < filters.dateRange.from
          || transaction.date.slice(0, 10) > filters.dateRange.to))
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
  const periods = reportPeriods(filters.endPeriod, filters.range, filters.dateRange);
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
      || (filters.dateRange !== undefined
        && (transaction.date.slice(0, 10) < filters.dateRange.from
          || transaction.date.slice(0, 10) > filters.dateRange.to))
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
    dateRange?: DateRangeValue;
  },
): MonthlyBalance[] {
  const periods = reportPeriods(filters.endPeriod, filters.range, filters.dateRange);
  const visibleWallets = filters.walletId === "all"
    ? wallets
    : wallets.filter((wallet) => wallet.id === filters.walletId);
  const balances = new Map(
    visibleWallets.map((wallet) => [wallet.id, new Decimal(wallet.balance)]),
  );
  const rows = new Map<string, MonthlyBalance>();

  if (filters.dateRange) {
    for (const transaction of transactions) {
      if (
        transaction.status === "approved"
        && transaction.date.slice(0, 10) > filters.dateRange.to
      ) {
        reverseBalanceTransaction(balances, transaction);
      }
    }
  }

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
        || (filters.dateRange !== undefined && transaction.date.slice(0, 10) > filters.dateRange.to)
      ) {
        continue;
      }

      reverseBalanceTransaction(balances, transaction);
    }
  }

  return periods.map((period) => rows.get(period) ?? {
    period,
    total: "0",
    wallets: {},
    hasNegativeBalance: false,
  });
}

export function daysInDateRange(dateRange: DateRangeValue): string[] {
  if (dateRange.from > dateRange.to) {
    throw new RangeError(`Invalid date range "${dateRange.from}"–"${dateRange.to}".`);
  }

  const [fromYear, fromMonth, fromDay] = dateRange.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = dateRange.to.split("-").map(Number);
  const cursor = new Date(Date.UTC(fromYear, fromMonth - 1, fromDay));
  const end = new Date(Date.UTC(toYear, toMonth - 1, toDay));
  const days: string[] = [];

  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function buildDailyCashflow(
  transactions: ChartTransaction[],
  filters: Omit<CashflowFilters, "range"> & { dateRange: DateRangeValue },
): MonthlyCashflow[] {
  const days = daysInDateRange(filters.dateRange);
  const daySet = new Set(days);
  const totals = new Map(
    days.map((day) => [
      day,
      { income: new Decimal(0), expense: new Decimal(0) },
    ]),
  );

  for (const transaction of transactions) {
    const txDay = transaction.date.slice(0, 10);
    if (
      transaction.status !== "approved"
      || transaction.type === "transfer"
      || !daySet.has(txDay)
      || (filters.walletId !== "all"
        && transaction.walletId !== filters.walletId
        && transaction.toWalletId !== filters.walletId)
      || (filters.categoryId !== "all" && transaction.categoryId !== filters.categoryId)
      || (filters.memberId !== "all" && transaction.memberId !== filters.memberId)
      || (filters.transactionType !== "all" && transaction.type !== filters.transactionType)
    ) {
      continue;
    }

    const dayTotals = totals.get(txDay);
    if (!dayTotals) continue;
    dayTotals[transaction.type] = dayTotals[transaction.type].plus(transaction.amount);
  }

  return days.map((day) => {
    const dayTotals = totals.get(day);
    const income = dayTotals?.income ?? new Decimal(0);
    const expense = dayTotals?.expense ?? new Decimal(0);
    const hasWarning = expense.greaterThan(income);

    return {
      period: day,
      income: income.toString(),
      expense: expense.toString(),
      warningFrom: (hasWarning ? income : expense).toString(),
      warningTo: expense.toString(),
      hasWarning,
    };
  });
}

export function buildDailyBalances(
  wallets: BalanceWallet[],
  transactions: ChartTransaction[],
  filters: {
    walletId: string;
    dateRange: DateRangeValue;
  },
): MonthlyBalance[] {
  const days = daysInDateRange(filters.dateRange);
  const visibleWallets = filters.walletId === "all"
    ? wallets
    : wallets.filter((wallet) => wallet.id === filters.walletId);
  const balances = new Map(
    visibleWallets.map((wallet) => [wallet.id, new Decimal(wallet.balance)]),
  );
  const rows = new Map<string, MonthlyBalance>();

  for (const transaction of transactions) {
    if (
      transaction.status === "approved"
      && transaction.date.slice(0, 10) > filters.dateRange.to
    ) {
      reverseBalanceTransaction(balances, transaction);
    }
  }

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
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

    rows.set(day, {
      period: day,
      total: total.toString(),
      wallets: walletBalances,
      hasNegativeBalance: visibleWallets.some((wallet) =>
        (balances.get(wallet.id) ?? new Decimal(0)).isNegative()),
    });

    if (index === 0) continue;

    for (const transaction of transactions) {
      if (
        transaction.status !== "approved"
        || transaction.date.slice(0, 10) !== day
      ) {
        continue;
      }

      reverseBalanceTransaction(balances, transaction);
    }
  }

  return days.map((day) => rows.get(day) ?? {
    period: day,
    total: "0",
    wallets: {},
    hasNegativeBalance: false,
  });
}

function periodsInDateRange(dateRange: DateRangeValue): string[] {
  if (dateRange.from > dateRange.to) {
    throw new RangeError(`Invalid date range "${dateRange.from}"–"${dateRange.to}".`);
  }

  const [fromYear, fromMonth] = dateRange.from.slice(0, 7).split("-").map(Number);
  const [toYear, toMonth] = dateRange.to.slice(0, 7).split("-").map(Number);
  const cursor = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
  const lastMonth = new Date(Date.UTC(toYear, toMonth - 1, 1));
  const periods: string[] = [];

  while (cursor <= lastMonth) {
    periods.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return periods;
}

function reportPeriods(
  endPeriod: string,
  range: CashflowRange,
  dateRange: DateRangeValue | undefined,
): string[] {
  return dateRange ? periodsInDateRange(dateRange) : recentPeriods(endPeriod, range);
}

function reverseBalanceTransaction(
  balances: Map<string, Decimal>,
  transaction: ChartTransaction,
): void {
  const amount = new Decimal(transaction.amount);
  const sourceBalance = balances.get(transaction.walletId);
  if (sourceBalance) {
    balances.set(
      transaction.walletId,
      transaction.type === "income"
        ? sourceBalance.minus(amount)
        : sourceBalance.plus(amount),
    );
  }

  if (transaction.type === "transfer" && transaction.toWalletId) {
    const destinationBalance = balances.get(transaction.toWalletId);
    if (destinationBalance) {
      balances.set(transaction.toWalletId, destinationBalance.minus(amount));
    }
  }
}
