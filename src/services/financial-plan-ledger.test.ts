import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  combinedExpenseByJar,
  getFinancialPlanMonthLedger,
  getWorkspaceBalance,
} from "@/services/financial-plan-ledger";

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

  it("clamps scheduled credit_card_refund to zero when no recurring rules exist", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn().mockResolvedValueOnce([
          { type: "expense", purpose: "credit_card_refund", workflowStatus: "scheduled", amount: new Decimal(80), jarCode: "ESSENTIAL", category: null },
        ]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", true);
    expect(ledger.forecastExpenseByJar.ESSENTIAL.toFixed(0)).toBe("0");
    expect(combinedExpenseByJar(ledger, true).ESSENTIAL.toFixed(0)).toBe("0");
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

  it("reverses credit_card_refund by subtracting amount when reconstructing historical workspace balance", async () => {
    const before = new Date("2026-09-01T00:00:00.000Z");
    const tx = {
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "w-asset", wallet: { currentBalance: new Decimal(1000), kind: "asset" } },
          // After a 40 refund reduced card debt from 300 to 260, current net worth is 1000 - 260 = 740
          { walletId: "w-card", wallet: { currentBalance: new Decimal(260), kind: "credit_card" } },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          { type: "expense", purpose: "credit_card_refund", walletId: "w-card", toWalletId: null, amount: new Decimal(40) },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    // Historical balance before the refund should be 740 - 40 = 700 (i.e. 1000 - 300)
    const balance = await getWorkspaceBalance(tx, "workspace", before);
    expect(balance.toFixed(0)).toBe("700");
  });

  it("includes non-deleted deactive wallets and clamps negative credit card balance in live workspace balance", async () => {
    const tx = {
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "w-active", wallet: { currentBalance: new Decimal(1000), kind: "asset", status: "active" } },
          { walletId: "w-deactive", wallet: { currentBalance: new Decimal(500), kind: "asset", status: "deactive" } },
          { walletId: "w-card-overpaid", wallet: { currentBalance: new Decimal(-50), kind: "credit_card", status: "active" } },
          { walletId: "w-card-debt", wallet: { currentBalance: new Decimal(200), kind: "credit_card", status: "active" } },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const balance = await getWorkspaceBalance(tx, "workspace");
    expect(balance.toFixed(0)).toBe("1300");
  });

  it("skips lump-sum active installment transactions and bills monthly creditCardInstallment instead", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn().mockResolvedValueOnce([
          {
            type: "expense",
            purpose: "standard",
            workflowStatus: "approved",
            amount: new Decimal(1200),
            jarCode: "ENJOYMENT",
            category: null,
            installmentPlan: { id: "plan-1", status: "active" },
            installmentFeePlan: null,
          },
          {
            type: "expense",
            purpose: "credit_card_installment_fee",
            workflowStatus: "approved",
            amount: new Decimal(60),
            jarCode: "RESPONSIBILITY",
            category: null,
            installmentPlan: null,
            installmentFeePlan: { id: "plan-1", status: "active" },
          },
        ]),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValueOnce([
          {
            dueDate: new Date("2026-08-25T00:00:00.000Z"),
            principalAmount: new Decimal(100),
            feeAmount: new Decimal(60),
            statementItems: [],
            plan: {
              status: "active",
              transaction: { jarCode: "ENJOYMENT", category: null },
            },
          },
        ]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", true);
    expect(ledger.approvedExpenseByJar.ENJOYMENT.toFixed(0)).toBe("160");
    expect(ledger.approvedExpenseByJar.RESPONSIBILITY.toFixed(0)).toBe("0");
  });

  it("adds back future unbilled installment principal in live workspace balance", async () => {
    const tx = {
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "w-asset", wallet: { currentBalance: new Decimal(2000), kind: "asset", status: "active" } },
          { walletId: "w-card", wallet: { currentBalance: new Decimal(1200), kind: "credit_card", status: "active" } },
        ]),
      },
      creditCardInstallmentPlan: {
        findMany: vi.fn().mockResolvedValue([
          {
            transaction: {
              date: new Date("2026-08-05T00:00:00.000Z"),
              creditCardObligationEntries: [
                { amount: new Decimal(1200), paymentAllocations: [] },
              ],
            },
            importedObligations: [],
            installments: [
              { dueDate: new Date("2026-08-25T00:00:00.000Z"), principalAmount: new Decimal(400), statementItems: [] },
              { dueDate: new Date("2026-09-25T00:00:00.000Z"), principalAmount: new Decimal(400), statementItems: [] },
              { dueDate: new Date("2026-10-25T00:00:00.000Z"), principalAmount: new Decimal(400), statementItems: [] },
            ],
          },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    // 2000 - 1200 + 800 (future terms #2 & #3) = 1600
    const balance = await getWorkspaceBalance(tx, "workspace");
    expect(balance.toFixed(0)).toBe("1600");
  });

  it("tracks netInvestmentOutflow for approved investment_contribution and investment_settlement without counting them as income or jar expenses", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn().mockResolvedValueOnce([
          {
            type: "expense",
            purpose: "investment_contribution",
            workflowStatus: "approved",
            amount: new Decimal(50_000_000),
            jarCode: "INVESTMENT",
            category: null,
          },
          {
            type: "income",
            purpose: "investment_settlement",
            workflowStatus: "approved",
            amount: new Decimal(20_000_000),
            jarCode: null,
            category: null,
          },
          {
            type: "expense",
            purpose: "investment_contribution",
            workflowStatus: "pending",
            amount: new Decimal(10_000_000),
            jarCode: "INVESTMENT",
            category: null,
          },
          {
            type: "expense",
            purpose: "standard",
            workflowStatus: "approved",
            amount: new Decimal(1_500_000),
            jarCode: "ESSENTIAL",
            category: null,
          },
        ]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", false);
    expect(ledger.netInvestmentOutflow.toFixed(0)).toBe("30000000");
    expect(ledger.approvedIncome.toFixed(0)).toBe("0");
    expect(ledger.approvedExpenseByJar.INVESTMENT.toFixed(0)).toBe("0");
    expect(ledger.approvedExpenseByJar.ESSENTIAL.toFixed(0)).toBe("1500000");
  });

  it("includes deferredPrincipal for active installment plans when reconstructing historical workspace balance with before", async () => {
    const before = new Date("2026-09-01T00:00:00.000Z");
    const tx = {
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "w-asset", wallet: { currentBalance: new Decimal(2000), kind: "asset", status: "active" } },
          { walletId: "w-card", wallet: { currentBalance: new Decimal(1200), kind: "credit_card", status: "active" } },
        ]),
      },
      creditCardInstallmentPlan: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-08-05T00:00:00.000Z"),
            transaction: {
              date: new Date("2026-08-05T00:00:00.000Z"),
              creditCardObligationEntries: [
                { amount: new Decimal(1200), paymentAllocations: [] },
              ],
            },
            importedObligations: [],
            installments: [
              {
                dueDate: new Date("2026-08-25T00:00:00.000Z"),
                principalAmount: new Decimal(400),
                statementItems: [{ id: "stmt-item-1", statement: { cycleEndDate: new Date("2026-08-15T00:00:00.000Z") } }],
              },
              {
                dueDate: new Date("2026-09-25T00:00:00.000Z"),
                principalAmount: new Decimal(400),
                statementItems: [{ id: "stmt-item-2", statement: { cycleEndDate: new Date("2026-09-15T00:00:00.000Z") } }],
              },
              {
                dueDate: new Date("2026-10-25T00:00:00.000Z"),
                principalAmount: new Decimal(400),
                statementItems: [],
              },
            ],
          },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    // 2000 - 1200 + 800 (terms #2 & #3 unbilled as of 2026-09-01) = 1600
    const balance = await getWorkspaceBalance(tx, "workspace", before);
    expect(balance.toFixed(0)).toBe("1600");
  });

  it("credits positive savings interest and gold realized profit to approvedIncome while only subtracting intra-month wallet-funded principal from netInvestmentOutflow", async () => {
    const tx = {
      transaction: {
        findMany: vi.fn().mockResolvedValueOnce([
          // Pre-plan passbook matured in 2026-08: 50M principal + 1.5M interest
          {
            type: "income",
            purpose: "investment_settlement",
            workflowStatus: "approved",
            amount: new Decimal(51_500_000),
            jarCode: "INVESTMENT",
            category: null,
            goldSaleRecord: null,
            savingsDepositSettlement: {
              principalWithdrawnAmount: new Decimal(50_000_000),
              interestReceivedAmount: new Decimal(1_500_000),
              deposit: {
                startDate: new Date("2026-02-10T00:00:00.000Z"),
                fundingMode: "from_wallet",
                openTransaction: {
                  date: new Date("2026-02-10T00:00:00.000Z"),
                  deletedAt: null,
                },
              },
            },
          },
          // Intra-month passbook opened & early-settled in 2026-08: 10M principal + 20k interest
          {
            type: "expense",
            purpose: "investment_contribution",
            workflowStatus: "approved",
            amount: new Decimal(10_000_000),
            jarCode: "INVESTMENT",
            category: null,
            goldSaleRecord: null,
            savingsDepositSettlement: null,
          },
          {
            type: "income",
            purpose: "investment_settlement",
            workflowStatus: "approved",
            amount: new Decimal(10_020_000),
            jarCode: "INVESTMENT",
            category: null,
            goldSaleRecord: null,
            savingsDepositSettlement: {
              principalWithdrawnAmount: new Decimal(10_000_000),
              interestReceivedAmount: new Decimal(20_000),
              deposit: {
                startDate: new Date("2026-08-05T00:00:00.000Z"),
                fundingMode: "from_wallet",
                openTransaction: {
                  date: new Date("2026-08-05T00:00:00.000Z"),
                  deletedAt: null,
                },
              },
            },
          },
          // Pre-plan gold lot sold at +2M profit and another at -500k loss
          {
            type: "income",
            purpose: "investment_settlement",
            workflowStatus: "approved",
            amount: new Decimal(16_000_000),
            jarCode: "INVESTMENT",
            category: null,
            savingsDepositSettlement: null,
            goldSaleRecord: {
              deletedAt: null,
              costMode: "specific_lot",
              costBasisAllocatedAmount: new Decimal(14_000_000),
              realizedProfitAmount: new Decimal(2_000_000),
              saleDate: new Date("2026-08-18T00:00:00.000Z"),
              purchaseLot: {
                purchaseDate: new Date("2026-05-01T00:00:00.000Z"),
                fundingMode: "from_wallet",
              },
              holding: { purchaseLots: [] },
            },
          },
          {
            type: "income",
            purpose: "investment_settlement",
            workflowStatus: "approved",
            amount: new Decimal(13_500_000),
            jarCode: "INVESTMENT",
            category: null,
            savingsDepositSettlement: null,
            goldSaleRecord: {
              deletedAt: null,
              costMode: "specific_lot",
              costBasisAllocatedAmount: new Decimal(14_000_000),
              realizedProfitAmount: new Decimal(-500_000),
              saleDate: new Date("2026-08-19T00:00:00.000Z"),
              purchaseLot: {
                purchaseDate: new Date("2026-05-01T00:00:00.000Z"),
                fundingMode: "existing_asset",
              },
              holding: { purchaseLots: [] },
            },
          },
        ]),
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const ledger = await getFinancialPlanMonthLedger(tx, "workspace", "2026-08", false);
    // Intra-month 10M contribution - 10M intra-month principal = 0; pre-plan 50M + 14M + 14M NOT subtracted!
    expect(ledger.netInvestmentOutflow.toFixed(0)).toBe("0");
    // Approved income = 1,500,000 + 20,000 + 2,000,000 + max(-500,000, 0) = 3,520,000
    expect(ledger.approvedIncome.toFixed(0)).toBe("3520000");
    expect(ledger.approvedExpenseByJar.INVESTMENT.toFixed(0)).toBe("0");
  });
});
