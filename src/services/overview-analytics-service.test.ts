import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/services/investment-service", () => ({
  getWorkspaceInvestmentsOverview: vi.fn().mockResolvedValue(null),
}));

import {
  computeOverviewPeriodAnalytics,
  shiftOverviewReportPeriod,
} from "@/services/overview-analytics-service";

describe("overview-analytics-service", () => {
  it("shifts report periods accurately across month, quarter, and year modes", () => {
    expect(shiftOverviewReportPeriod("2026-01", -1, "month")).toBe("2025-12");
    expect(shiftOverviewReportPeriod("2026-05", -1, "quarter")).toBe("2026-03");
    expect(shiftOverviewReportPeriod("2026-02", -1, "quarter")).toBe("2025-12");
    expect(shiftOverviewReportPeriod("2026-10", -1, "year")).toBe("2025-10");
  });

  it("computes totals, category/member breakdowns, and daily series while excluding non-cashflow purposes", () => {
    const categoriesById = new Map([
      ["cat-salary", { name: "Lương", color: "#10b981", icon: "briefcase" }],
      ["cat-food", { name: "Ăn uống", color: "#ef4444", icon: "utensils" }],
      ["cat-shop", { name: "Mua sắm", color: "#3b82f6", icon: "shopping-bag" }],
    ]);

    const analytics = computeOverviewPeriodAnalytics({
      revision: "rev-1",
      reportPeriod: "2026-10",
      period: "month",
      wallets: [{ id: "w-1", name: "VCB", balance: "15000000", kind: "asset" }],
      members: [
        { id: "m-1", name: "Minh" },
        { id: "m-2", name: "Lan" },
      ],
      categoriesById,
      transactions: [
        {
          amount: "20000000",
          type: "income",
          purpose: "standard",
          status: "approved",
          date: "2026-10-05",
          walletId: "w-1",
          toWalletId: null,
          categoryId: "cat-salary",
          memberId: "m-1",
        },
        {
          amount: "3000000",
          type: "expense",
          purpose: "standard",
          status: "approved",
          date: "2026-10-10",
          walletId: "w-1",
          toWalletId: null,
          categoryId: "cat-food",
          memberId: "m-1",
        },
        {
          amount: "2000000",
          type: "expense",
          purpose: "standard",
          status: "approved",
          date: "2026-10-12",
          walletId: "w-1",
          toWalletId: null,
          categoryId: "cat-shop",
          memberId: "m-2",
        },
        {
          amount: "500000",
          type: "income",
          purpose: "credit_card_refund",
          status: "approved",
          date: "2026-10-14",
          walletId: "w-1",
          toWalletId: null,
          categoryId: "cat-shop",
          memberId: "m-2",
        },
        // Non-cashflow purposes that must not inflate income/expense totals:
        {
          amount: "5000000",
          type: "expense",
          purpose: "investment_contribution",
          status: "approved",
          date: "2026-10-15",
          walletId: "w-1",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
        {
          amount: "100000",
          type: "income",
          purpose: "balance_reconciliation",
          status: "approved",
          date: "2026-10-16",
          walletId: "w-1",
          toWalletId: null,
          categoryId: null,
          memberId: "m-1",
        },
        // Previous month (2026-09) baseline:
        {
          amount: "18000000",
          type: "income",
          purpose: "standard",
          status: "approved",
          date: "2026-09-05",
          walletId: "w-1",
          toWalletId: null,
          categoryId: "cat-salary",
          memberId: "m-1",
        },
        {
          amount: "4000000",
          type: "expense",
          purpose: "standard",
          status: "approved",
          date: "2026-09-20",
          walletId: "w-1",
          toWalletId: null,
          categoryId: "cat-food",
          memberId: "m-1",
        },
      ],
      investmentMarketValue: "5500000",
      investmentCostBasis: "5000000",
    });

    expect(analytics.activeTotals).toEqual({
      income: "20000000",
      expense: "4500000", // 3,000,000 + 2,000,000 - 500,000 refund
      count: 4,
    });
    expect(analytics.prevTotals).toEqual({
      income: "18000000",
      expense: "4000000",
      count: 2,
    });

    expect(analytics.expenseByCategory).toHaveLength(2);
    expect(analytics.expenseByCategory[0]).toMatchObject({
      id: "cat-food",
      name: "Ăn uống",
      amount: "3000000",
      count: 1,
    });
    expect(analytics.expenseByCategory[1]).toMatchObject({
      id: "cat-shop",
      name: "Mua sắm",
      amount: "1500000",
      count: 2,
    });
    expect(
      Math.round(
        analytics.expenseByCategory[0].percent +
          analytics.expenseByCategory[1].percent,
      ),
    ).toBe(100);

    expect(analytics.memberExpenses).toEqual([
      expect.objectContaining({
        id: "m-1",
        name: "Minh",
        amount: "3000000",
        count: 1,
      }),
      expect.objectContaining({
        id: "m-2",
        name: "Lan",
        amount: "1500000",
        count: 2,
      }),
    ]);

    // October has 31 daily points; balanceSeries strips per-wallet map for minimal wire size
    expect(analytics.cashflowSeries).toHaveLength(31);
    expect(analytics.balanceSeries).toHaveLength(31);
    expect(Object.keys(analytics.balanceSeries[0])).toEqual([
      "period",
      "total",
      "hasNegativeBalance",
    ]);
  });

  it("switches to monthly series for quarter and year periods", () => {
    const analytics = computeOverviewPeriodAnalytics({
      revision: "rev-q4",
      reportPeriod: "2026-11",
      period: "quarter",
      wallets: [{ id: "w-1", name: "VCB", balance: "10000000", kind: "asset" }],
      members: [{ id: "m-1", name: "Minh" }],
      categoriesById: new Map(),
      transactions: [],
    });

    // Q4 up to November -> 2026-10 and 2026-11
    expect(analytics.cashflowSeries.map((p) => p.period)).toEqual([
      "2026-10",
      "2026-11",
    ]);
    expect(analytics.balanceSeries.map((p) => p.period)).toEqual([
      "2026-10",
      "2026-11",
    ]);
  });
});
