import { describe, expect, it } from "vitest";
import {
  buildMonthlyCashflow,
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
});
