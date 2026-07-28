import { describe, expect, it } from "vitest";
import { buildLedgerPeriodSummaries } from "@/app/dashboard/dashboard-summary-data";

describe("ledger financial summaries", () => {
  it("groups approved cash flow and pending transactions by filtered month", () => {
    const summaries = buildLedgerPeriodSummaries([
      { date: "2026-07-10", type: "income", amount: "10000000", workflowStatus: "approved" },
      { date: "2026-07-12", type: "expense", amount: "3250000", workflowStatus: "approved" },
      { date: "2026-07-20", type: "expense", amount: "500000", workflowStatus: "pending" },
      { date: "2026-08-01", type: "income", amount: "2500000", workflowStatus: "approved" },
      { date: "2026-08-02", type: "transfer", amount: "1000000", workflowStatus: "approved" },
    ], "2026-07");

    expect(summaries).toContainEqual({
      period: "2026-07",
      income: "10000000",
      expense: "3250000",
      pending: 1,
    });
    expect(summaries).toContainEqual({
      period: "2026-08",
      income: "2500000",
      expense: "0",
      pending: 0,
    });
    expect(summaries[0]).toEqual({
      period: "all",
      income: "12500000",
      expense: "3250000",
      pending: 1,
    });
  });

  it("includes an empty current month when it has no transactions", () => {
    expect(buildLedgerPeriodSummaries([], "2026-07")).toEqual([
      { period: "all", income: "0", expense: "0", pending: 0 },
      { period: "2026-07", income: "0", expense: "0", pending: 0 },
    ]);
  });
});
