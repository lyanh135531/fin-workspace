import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getFinancialPlanMonthLedger } from "@/services/financial-plan-ledger";

describe("financial plan ledger projection", () => {
  it("excludes transfers and recurring occurrences already materialized", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { type: "expense", workflowStatus: "approved", amount: new Decimal(10), jarCode: "ESSENTIAL" },
            { type: "expense", workflowStatus: "scheduled", amount: new Decimal(2), jarCode: "GIVING" },
            { type: "income", workflowStatus: "scheduled", amount: new Decimal(30), jarCode: null },
            { type: "transfer", workflowStatus: "approved", amount: new Decimal(999), jarCode: null },
          ])
          .mockResolvedValueOnce([{ recurringTransactionId: "expense-rule" }]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: "expense-rule", type: "expense", amount: new Decimal(5), dayOfMonth: 15, startDate: new Date("2026-01-01"), endDate: null, category: { jarCode: "ESSENTIAL" } },
          { id: "income-rule", type: "income", amount: new Decimal(4), dayOfMonth: 20, startDate: new Date("2026-01-01"), endDate: null, category: null },
          { id: "transfer-rule", type: "transfer", amount: new Decimal(777), dayOfMonth: 20, startDate: new Date("2026-01-01"), endDate: null, category: null },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", true);
    expect(ledger.approvedExpenseByJar.ESSENTIAL.toFixed(0)).toBe("10");
    expect(ledger.forecastExpenseByJar.ESSENTIAL.toFixed(0)).toBe("0");
    expect(ledger.forecastExpenseByJar.GIVING.toFixed(0)).toBe("2");
    expect(ledger.forecastIncome.toFixed(0)).toBe("34");
  });
});
