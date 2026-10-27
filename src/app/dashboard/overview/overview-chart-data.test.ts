import { describe, expect, it } from "vitest";
import {
  buildDailyBalances,
  buildDailyCashflow,
  buildMemberMonthlyTotals,
  buildMonthlyBalances,
  buildMonthlyCashflow,
  daysInDateRange,
  getDashboardPeriodDateRange,
  getVisibleCashflowTypes,
  type CashflowFilters,
} from "@/app/dashboard/overview/overview-chart-data";

const filters: CashflowFilters = {
  endPeriod: "2026-07",
  range: 3,
  walletId: "all",
  categoryId: "all",
  memberId: "all",
  transactionType: "all",
};

const transactions = [
  {
    amount: "1250.25",
    type: "income" as const,
    status: "approved" as const,
    date: "2026-07-03T00:00:00.000Z",
    walletId: "wallet-a",
    toWalletId: null,
    categoryId: "income-category",
    memberId: "member-a",
  },
  {
    amount: "1500.50",
    type: "expense" as const,
    status: "approved" as const,
    date: "2026-07-14T00:00:00.000Z",
    walletId: "wallet-a",
    toWalletId: null,
    categoryId: "expense-category",
    memberId: "member-a",
  },
  {
    amount: "700",
    type: "expense" as const,
    status: "pending" as const,
    date: "2026-07-18T00:00:00.000Z",
    walletId: "wallet-a",
    toWalletId: null,
    categoryId: "expense-category",
    memberId: "member-a",
  },
  {
    amount: "400",
    type: "expense" as const,
    status: "approved" as const,
    date: "2026-06-12T00:00:00.000Z",
    walletId: "wallet-b",
    toWalletId: null,
    categoryId: "expense-category",
    memberId: "member-b",
  },
];

describe("overview monthly cashflow", () => {
  it("builds month, quarter-to-date, and year-to-date ranges", () => {
    expect(getDashboardPeriodDateRange("2026-08", "month")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(getDashboardPeriodDateRange("2026-08", "quarter")).toEqual({
      from: "2026-07-01",
      to: "2026-08-31",
    });
    expect(getDashboardPeriodDateRange("2026-08", "year")).toEqual({
      from: "2026-01-01",
      to: "2026-08-31",
    });
  });

  it("aggregates approved income and expense with Decimal precision", () => {
    const rows = buildMonthlyCashflow(transactions, filters);
    expect(rows.map((row) => row.period)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(rows[2]).toEqual({
      period: "2026-07",
      income: "1250.25",
      expense: "1500.5",
      warningFrom: "1250.25",
      warningTo: "1500.5",
      hasWarning: true,
    });
  });

  it("applies wallet, category, member, and transaction type filters", () => {
    const rows = buildMonthlyCashflow(transactions, {
      ...filters,
      walletId: "wallet-b",
      categoryId: "expense-category",
      memberId: "member-b",
      transactionType: "expense",
    });
    expect(rows[1].expense).toBe("400");
    expect(rows[2].expense).toBe("0");
    expect(rows.every((row) => row.income === "0")).toBe(true);
  });

  it("only exposes the area owned by a selected category", () => {
    expect(getVisibleCashflowTypes("all", "expense")).toEqual(["expense"]);
    expect(getVisibleCashflowTypes("all", "income")).toEqual(["income"]);
    expect(getVisibleCashflowTypes("expense", "income")).toEqual([]);
    expect(getVisibleCashflowTypes("transfer")).toEqual([]);
  });

  it("groups every workspace member's expenses by month", () => {
    const rows = buildMemberMonthlyTotals(
      [
        { id: "member-a", name: "An" },
        { id: "member-b", name: "Bình" },
        { id: "member-c", name: "Chi" },
      ],
      transactions,
      {
        endPeriod: "2026-07",
        range: 3,
        walletId: "all",
        categoryId: "all",
        type: "expense",
      },
    );

    expect(rows).toEqual([
      { period: "2026-05", totals: { "member-a": "0", "member-b": "0", "member-c": "0" } },
      { period: "2026-06", totals: { "member-a": "0", "member-b": "400", "member-c": "0" } },
      { period: "2026-07", totals: { "member-a": "1500.5", "member-b": "0", "member-c": "0" } },
    ]);
  });

  it("switches the monthly groups to income and applies report filters", () => {
    const rows = buildMemberMonthlyTotals(
      [
        { id: "member-a", name: "An" },
        { id: "member-b", name: "Bình" },
      ],
      transactions,
      {
        endPeriod: "2026-07",
        range: 3,
        walletId: "wallet-a",
        categoryId: "income-category",
        type: "income",
      },
    );

    expect(rows).toEqual([
      { period: "2026-05", totals: { "member-a": "0", "member-b": "0" } },
      { period: "2026-06", totals: { "member-a": "0", "member-b": "0" } },
      { period: "2026-07", totals: { "member-a": "1250.25", "member-b": "0" } },
    ]);
  });

  it("reconstructs each wallet's closing balance by reversing approved transactions", () => {
    const rows = buildMonthlyBalances(
      [
        { id: "wallet-a", name: "Ví chính", balance: "1000" },
        { id: "wallet-b", name: "Tiền mặt", balance: "600" },
      ],
      [
        ...transactions,
        {
          amount: "500",
          type: "income" as const,
          status: "approved" as const,
          date: "2026-07-05T00:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: "income-category",
          memberId: "member-a",
        },
        {
          amount: "100",
          type: "transfer" as const,
          status: "approved" as const,
          date: "2026-07-08T00:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: "wallet-b",
          categoryId: null,
          memberId: "member-a",
        },
      ],
      { endPeriod: "2026-07", range: 3, walletId: "all" },
    );

    expect(rows).toEqual([
      {
        period: "2026-05",
        total: "1750.25",
        wallets: { "wallet-a": "850.25", "wallet-b": "900" },
        hasNegativeBalance: false,
      },
      {
        period: "2026-06",
        total: "1350.25",
        wallets: { "wallet-a": "850.25", "wallet-b": "500" },
        hasNegativeBalance: false,
      },
      {
        period: "2026-07",
        total: "1600",
        wallets: { "wallet-a": "1000", "wallet-b": "600" },
        hasNegativeBalance: false,
      },
    ]);
  });

  it("limits balance history to the selected wallet and flags negative balances", () => {
    const rows = buildMonthlyBalances(
      [
        { id: "wallet-a", name: "Ví chính", balance: "-50" },
        { id: "wallet-b", name: "Tiền mặt", balance: "900" },
      ],
      transactions,
      { endPeriod: "2026-07", range: 3, walletId: "wallet-a" },
    );

    expect(rows[2]).toEqual({
      period: "2026-07",
      total: "-50",
      wallets: { "wallet-a": "-50" },
      hasNegativeBalance: true,
    });
    expect(Object.keys(rows[0].wallets)).toEqual(["wallet-a"]);
  });

  it("generates continuous list of days in date range", () => {
    const days = daysInDateRange({
      from: "2026-07-01",
      to: "2026-07-05",
    });
    expect(days).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("builds daily cashflow across a month with approved transactions", () => {
    const dailyRows = buildDailyCashflow(transactions, {
      ...filters,
      dateRange: {
        from: "2026-07-01",
        to: "2026-07-05",
      },
    });

    expect(dailyRows).toHaveLength(5);
    expect(dailyRows.map((r) => r.period)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);

    // 2026-07-03 had approved income of 1250.25
    expect(dailyRows[2]).toEqual({
      period: "2026-07-03",
      income: "1250.25",
      expense: "0",
      warningFrom: "0",
      warningTo: "0",
      hasWarning: false,
    });

    // 2026-07-01 had 0
    expect(dailyRows[0].income).toBe("0");
    expect(dailyRows[0].expense).toBe("0");
  });

  it("builds daily balances across a date range by rolling back daily transactions", () => {
    const dailyRows = buildDailyBalances(
      [
        { id: "wallet-a", name: "Ví chính", balance: "1000" },
      ],
      [
        {
          amount: "200",
          type: "income",
          status: "approved",
          date: "2026-07-03T10:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: "cat-1",
          memberId: "m-1",
        },
        {
          amount: "50",
          type: "expense",
          status: "approved",
          date: "2026-07-02T10:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: "cat-2",
          memberId: "m-1",
        },
      ],
      {
        walletId: "all",
        dateRange: {
          from: "2026-07-01",
          to: "2026-07-03",
        },
      },
    );

    // Current balance at end of 07-03 is 1000.
    // Day 07-03 closing: 1000
    // Reversing 07-03 income of 200 -> Day 07-02 closing: 800
    // Reversing 07-02 expense of 50 -> Day 07-01 closing: 850
    expect(dailyRows).toEqual([
      {
        period: "2026-07-01",
        total: "850",
        wallets: { "wallet-a": "850" },
        hasNegativeBalance: false,
      },
      {
        period: "2026-07-02",
        total: "800",
        wallets: { "wallet-a": "800" },
        hasNegativeBalance: false,
      },
      {
        period: "2026-07-03",
        total: "1000",
        wallets: { "wallet-a": "1000" },
        hasNegativeBalance: false,
      },
    ]);
  });

  it("keeps net worth neutral across wallet-funded investment contributions and settlements without cost basis param", () => {
    const dailyRows = buildDailyBalances(
      [{ id: "wallet-a", name: "Ví chính", balance: "50000000" }],
      [
        {
          amount: "20000000",
          type: "expense",
          purpose: "investment_contribution",
          status: "approved",
          date: "2026-03-14T10:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
        {
          amount: "10000000",
          type: "income",
          purpose: "investment_settlement",
          status: "approved",
          date: "2026-03-15T10:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
      ],
      {
        walletId: "all",
        dateRange: {
          from: "2026-03-13",
          to: "2026-03-15",
        },
        investmentMarketValue: "50000000",
      },
    );

    expect(dailyRows.map((row) => ({ period: row.period, total: row.total }))).toEqual([
      { period: "2026-03-13", total: "100000000" },
      { period: "2026-03-14", total: "100000000" },
      { period: "2026-03-15", total: "100000000" },
    ]);
  });

  it("does not leak settled investment profit into historical dates before the investment was opened", () => {
    // Day 0 (2026-03-10): Wallet had 100M, 0 investments -> Net worth = 100M
    // Day 1 (2026-03-11): Contributed 100M to savings -> Wallet = 0, Investment = 100M -> Net worth = 100M
    // Day 2 (2026-03-12): Settled 105M (100M principal + 5M interest) -> Wallet = 105M, Investment = 0 -> Net worth = 105M
    const dailyRows = buildDailyBalances(
      [{ id: "wallet-a", name: "Ví chính", balance: "105000000" }],
      [
        {
          amount: "100000000",
          type: "expense",
          purpose: "investment_contribution",
          status: "approved",
          date: "2026-03-11T09:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
        {
          amount: "105000000",
          type: "income",
          purpose: "investment_settlement",
          status: "approved",
          date: "2026-03-12T09:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
      ],
      {
        walletId: "all",
        dateRange: {
          from: "2026-03-10",
          to: "2026-03-12",
        },
        investmentMarketValue: "0",
        investmentCostBasis: "0",
      },
      "0",
      "0",
    );

    expect(dailyRows.map((row) => ({ period: row.period, total: row.total }))).toEqual([
      { period: "2026-03-10", total: "100000000" },
      { period: "2026-03-11", total: "100000000" },
      { period: "2026-03-12", total: "105000000" },
    ]);
  });

  it("does not leak unrealized gold gain into dates before the gold was purchased", () => {
    // Day 0 (2026-03-10): Wallet had 100M, 0 gold -> Net worth = 100M
    // Day 1 (2026-03-11): Purchased 80M gold from wallet, current market value = 85M -> Wallet = 20M, Investment = 85M -> Net worth = 105M
    const dailyRows = buildDailyBalances(
      [{ id: "wallet-a", name: "Ví chính", balance: "20000000" }],
      [
        {
          amount: "80000000",
          type: "expense",
          purpose: "investment_contribution",
          status: "approved",
          date: "2026-03-11T09:00:00.000Z",
          walletId: "wallet-a",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
      ],
      {
        walletId: "all",
        dateRange: {
          from: "2026-03-10",
          to: "2026-03-11",
        },
        investmentMarketValue: "85000000",
        investmentCostBasis: "80000000",
      },
      "85000000",
      "80000000",
    );

    expect(dailyRows.map((row) => ({ period: row.period, total: row.total }))).toEqual([
      { period: "2026-03-10", total: "100000000" },
      { period: "2026-03-11", total: "105000000" },
    ]);
  });
});
