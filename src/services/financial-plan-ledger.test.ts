import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getFinancialPlanMonthLedger, getWorkspaceBalance } from "@/services/financial-plan-ledger";

describe("financial plan ledger projection", () => {
  it("excludes transfers and recurring occurrences already materialized", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { type: "expense", purpose: "regular", workflowStatus: "approved", amount: new Decimal(10), jarCode: "ESSENTIAL", category: null },
            { type: "expense", purpose: "regular", workflowStatus: "scheduled", amount: new Decimal(2), jarCode: "GIVING", category: null },
            { type: "income", purpose: "regular", workflowStatus: "scheduled", amount: new Decimal(30), jarCode: null, category: null },
            { type: "transfer", purpose: "regular", workflowStatus: "approved", amount: new Decimal(999), jarCode: null, category: null },
          ])
          .mockResolvedValueOnce([{ recurringTransactionId: "expense-rule" }]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: "expense-rule", type: "expense", amount: new Decimal(5), dayOfMonth: 15, startDate: new Date("2026-01-01"), endDate: null, nextExecutionDate: new Date("2026-08-15"), category: { jarCode: "ESSENTIAL" } },
          { id: "income-rule", type: "income", amount: new Decimal(4), dayOfMonth: 20, startDate: new Date("2026-01-01"), endDate: null, nextExecutionDate: new Date("2026-08-20"), category: null },
          { id: "transfer-rule", type: "transfer", amount: new Decimal(777), dayOfMonth: 20, startDate: new Date("2026-01-01"), endDate: null, nextExecutionDate: new Date("2026-08-20"), category: null },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", true);
    expect(ledger.approvedExpenseByJar.ESSENTIAL.toFixed(0)).toBe("10");
    expect(ledger.forecastExpenseByJar.ESSENTIAL.toFixed(0)).toBe("0");
    expect(ledger.forecastExpenseByJar.GIVING.toFixed(0)).toBe("2");
    expect(ledger.forecastIncome.toFixed(0)).toBe("34");
  });

  it("subtracts credit_card_refund from jar expense instead of inflating income and skips recurring rules before nextExecutionDate", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { type: "expense", purpose: "regular", workflowStatus: "approved", amount: new Decimal(100), jarCode: "ESSENTIAL", category: null },
            { type: "income", purpose: "credit_card_refund", workflowStatus: "approved", amount: new Decimal(40), jarCode: null, category: { jarCode: "ESSENTIAL" } },
          ])
          .mockResolvedValueOnce([]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: "future-rule", type: "expense", amount: new Decimal(50), dayOfMonth: 10, startDate: new Date("2026-01-01"), endDate: null, nextExecutionDate: new Date("2026-09-10"), category: { jarCode: "ESSENTIAL" } },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", true);
    expect(ledger.approvedIncome.toFixed(0)).toBe("0");
    expect(ledger.approvedExpenseByJar.ESSENTIAL.toFixed(0)).toBe("60");
    expect(ledger.forecastExpenseByJar.ESSENTIAL.toFixed(0)).toBe("0");
  });

  it("includes wallets deleted at or after the snapshot boundary when reversing historical balances", async () => {
    const before = new Date("2026-09-01T00:00:00.000Z");
    const tx = {
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "w-surviving", wallet: { currentBalance: new Decimal(150), kind: "asset" } },
          { walletId: "w-deleted", wallet: { currentBalance: new Decimal(0), kind: "asset" } },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          { type: "transfer", purpose: "regular", walletId: "w-deleted", toWalletId: "w-surviving", amount: new Decimal(50) },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const balance = await getWorkspaceBalance(tx, "workspace", before);
    expect(balance.toFixed(0)).toBe("150");
    expect(tx.workspaceWallet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wallet: expect.objectContaining({
            OR: [{ deletedAt: null }, { deletedAt: { gte: before } }],
          }),
        }),
      }),
    );
  });
});
