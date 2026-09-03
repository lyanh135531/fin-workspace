import { describe, expect, it } from "vitest";
import {
  buildMemberMonthlyTotals,
  buildMonthlyBalances,
  buildMonthlyCashflow,
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
});
