import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import {
  completeFullyPaidInstallmentPlansForCard,
  createStatementForCycle,
  recalculateUnpaidStatementTotal,
  refreshHistoricalCardStatements,
  reopenUnpaidInstallmentPlansForCard,
  shareForImportedInstallment,
  statementPaymentDetails,
} from "@/services/credit-card-statement-service";
import type { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/env", () => ({ env: { DATABASE_URL: "postgresql://test", APP_TIME_ZONE: "Asia/Ho_Chi_Minh" } }));

describe("credit card statement payments", () => {
  it("allocates only the remaining imported terms and keeps the final rounding remainder", () => {
    expect(shareForImportedInstallment("100", 12, 8, 9).toFixed(4)).toBe("25.0000");
    expect(shareForImportedInstallment("100.0001", 12, 8, 12).toFixed(4)).toBe("25.0001");
  });

  it("nets credits per funding wallet and allocates only the statement amount", async () => {
    const tx = {
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "statement-1",
          items: [
            { obligationEntryId: "purchase-1", fundingWalletId: "wallet-1", amount: new Decimal("100"), createdAt: new Date("2026-09-01") },
            { obligationEntryId: "refund-1", fundingWalletId: "wallet-1", amount: new Decimal("-25"), createdAt: new Date("2026-09-02") },
            { obligationEntryId: "purchase-2", fundingWalletId: "wallet-2", amount: new Decimal("50"), createdAt: new Date("2026-09-03") },
          ],
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await statementPaymentDetails(tx, "statement-1");
    expect(result.dueByWallet.get("wallet-1")?.toString()).toBe("75");
    expect(result.dueByWallet.get("wallet-2")?.toString()).toBe("50");
    expect(result.allocations.get("purchase-1")?.toString()).toBe("75");
    expect(result.allocations.get("purchase-2")?.toString()).toBe("50");
    expect(result.allocations.has("refund-1")).toBe(false);
  });

  it("deducts prior approved payments and calculates remaining due per wallet", async () => {
    const tx = {
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "statement-1",
          items: [
            { obligationEntryId: "purchase-1", fundingWalletId: "wallet-1", amount: new Decimal("100"), createdAt: new Date("2026-09-01") },
            { obligationEntryId: "purchase-2", fundingWalletId: "wallet-2", amount: new Decimal("50"), createdAt: new Date("2026-09-02") },
          ],
          payments: [
            {
              creditCardPaymentSources: [{ sourceWalletId: "wallet-1", amount: new Decimal("40") }],
              creditCardPaymentAllocations: [{ obligationEntryId: "purchase-1", amount: new Decimal("40") }],
            },
          ],
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await statementPaymentDetails(tx, "statement-1");
    expect(result.dueByWallet.get("wallet-1")?.toString()).toBe("60"); // 100 - 40 = 60
    expect(result.dueByWallet.get("wallet-2")?.toString()).toBe("50");
    expect(result.totalRemaining.toString()).toBe("110");
    expect(result.paidByWallet.get("wallet-1")?.toString()).toBe("40");
    expect(result.allocations.get("purchase-1")?.toString()).toBe("60");
  });

  it("allocates a partial payment amount correctly across obligation items", async () => {
    const tx = {
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "statement-1",
          items: [
            { obligationEntryId: "item-1", fundingWalletId: "wallet-1", amount: new Decimal("60"), createdAt: new Date("2026-09-01") },
            { obligationEntryId: "item-2", fundingWalletId: "wallet-1", amount: new Decimal("40"), createdAt: new Date("2026-09-02") },
          ],
          payments: [],
        }),
      },
    } as unknown as Prisma.TransactionClient;

    // Paying 70 out of 100: item-1 gets 60, item-2 gets 10
    const result = await statementPaymentDetails(tx, "statement-1", [
      { walletId: "wallet-1", amount: new Decimal("70") },
    ]);
    expect(result.allocations.get("item-1")?.toString()).toBe("60");
    expect(result.allocations.get("item-2")?.toString()).toBe("10");
  });

  it("carries over unpaid balance from prior statement and closes rolled over statements", async () => {
    const createdItems: Array<{ obligationEntryId: string; fundingWalletId: string; amount: Decimal; isCarry?: boolean }> = [];
    const tx = {
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: "entry-1" }),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([
          { fundingWalletId: "wallet-1", amount: new Decimal("100") },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          // Paid 40, so 60 remains unpaid
          { creditCardPaymentSources: [{ sourceWalletId: "wallet-1", amount: new Decimal("40") }] },
        ]),
      },
      creditCardStatement: {
        create: vi.fn().mockImplementation(({ data }) => {
          if (data.items?.create) createdItems.push(...data.items.create);
          return Promise.resolve({ id: "statement-new", ...data });
        }),
        findMany: vi.fn().mockResolvedValue([{ id: "statement-old" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    const statement = await createStatementForCycle(
      tx,
      "workspace-1",
      "card-wallet-1",
      "2026-09-01",
      "2026-09-30",
      15,
    );

    expect(createdItems).toEqual([
      expect.objectContaining({
        obligationEntryId: "entry-1",
        fundingWalletId: "wallet-1",
        amount: new Decimal("60"),
        isCarry: true,
      }),
    ]);
    expect(statement.totalAmount.toString()).toBe("60");
    expect(tx.creditCardStatement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["statement-old"] } },
        data: expect.objectContaining({ status: "paid" }),
      }),
    );
  });

  it("carries over independent remaining balances for multiple funding wallets", async () => {
    const createdItems: Array<{ obligationEntryId: string; fundingWalletId: string; amount: Decimal; isCarry?: boolean }> = [];
    const tx = {
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve({ id: `entry-for-${where.fundingWalletId}` });
        }),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([
          // Wallet 1 owed 600, Wallet 2 owed 400
          { fundingWalletId: "wallet-1", amount: new Decimal("600") },
          { fundingWalletId: "wallet-2", amount: new Decimal("400") },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          // Custom partial payment: Wallet 1 paid 400 (remaining 200), Wallet 2 paid 100 (remaining 300)
          {
            creditCardPaymentSources: [
              { sourceWalletId: "wallet-1", amount: new Decimal("400") },
              { sourceWalletId: "wallet-2", amount: new Decimal("100") },
            ],
          },
        ]),
      },
      creditCardStatement: {
        create: vi.fn().mockImplementation(({ data }) => {
          if (data.items?.create) createdItems.push(...data.items.create);
          return Promise.resolve({ id: "statement-next", ...data });
        }),
        findMany: vi.fn().mockResolvedValue([{ id: "statement-prev" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    const statement = await createStatementForCycle(
      tx,
      "workspace-1",
      "card-wallet-1",
      "2026-10-01",
      "2026-10-31",
      15,
    );

    expect(createdItems).toEqual([
      expect.objectContaining({
        obligationEntryId: "entry-for-wallet-1",
        fundingWalletId: "wallet-1",
        amount: new Decimal("200"),
        isCarry: true,
      }),
      expect.objectContaining({
        obligationEntryId: "entry-for-wallet-2",
        fundingWalletId: "wallet-2",
        amount: new Decimal("300"),
        isCarry: true,
      }),
    ]);
    expect(statement.totalAmount.toString()).toBe("500");
    expect(tx.creditCardStatement.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["statement-prev"] } },
      data: { status: "paid", paidAt: null },
    });
  });

  it("caps installment statement items at remaining unbilled/unpaid obligation balance after early principal payment", async () => {
    const createdItems: Array<{ obligationEntryId: string; fundingWalletId: string; amount: Decimal; installmentId?: string }> = [];
    const tx = {
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "inst-2",
            installmentNo: 2,
            amount: new Decimal("500"),
            plan: {
              termCount: 2,
              completedInstallmentsAtImport: 0,
              transaction: {
                id: "tx-inst",
                deletedAt: null,
                workflowStatus: "approved",
                amount: new Decimal("1000"),
                creditCardAllocations: [
                  { fundingWalletId: "wallet-1", amount: new Decimal("1000") },
                ],
                creditCardObligationEntries: [
                  {
                    id: "obl-inst",
                    fundingWalletId: "wallet-1",
                    amount: new Decimal("1000"),
                    // Term 1 (500) already billed in statement 1
                    statementItems: [{ amount: new Decimal("500") }],
                    // Paid 500 for statement 1 + 300 early principal payment = 800 total paid
                    paymentAllocations: [{ amount: new Decimal("800") }],
                  },
                ],
              },
            },
          },
        ]),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatement: {
        create: vi.fn().mockImplementation(({ data }) => {
          if (data.items?.create) createdItems.push(...data.items.create);
          return Promise.resolve({ id: "statement-2", ...data });
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const statement = await createStatementForCycle(
      tx,
      "workspace-1",
      "card-wallet-1",
      "2026-10-01",
      "2026-10-31",
      15,
    );

    // Remaining obligation is 1000 - 500 (billed) - 300 (early paid) = 200
    expect(createdItems).toEqual([
      expect.objectContaining({
        obligationEntryId: "obl-inst",
        fundingWalletId: "wallet-1",
        installmentId: "inst-2",
        amount: new Decimal("200"),
      }),
    ]);
    expect(statement.totalAmount.toString()).toBe("200");
  });

  it("excludes installmentFeePlan obligations from regular billing in refreshHistoricalCardStatements", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      creditCardProfile: {
        findFirst: vi.fn().mockResolvedValue({
          walletId: "card-wallet-1",
          statementClosingDay: 20,
          paymentDueDay: 5,
          statements: [{ cycleEndDate: new Date("2026-09-20T00:00:00.000Z") }],
          obligations: [{ postedDate: new Date("2026-09-10T00:00:00.000Z") }],
          installmentPlans: [],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          walletId: "card-wallet-1",
          statementClosingDay: 20,
          paymentDueDay: 5,
        }),
      },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatement: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    await refreshHistoricalCardStatements(tx, "workspace-1", "card-wallet-1", "2026-09-20");

    expect(tx.creditCardObligationEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          installmentPlanId: null,
          OR: [
            { transactionId: null },
            { transaction: { installmentPlan: null, installmentFeePlan: null } },
          ],
        }),
      }),
    );
  });

  it("marks active installment plans as completed when all principal and fee obligations are paid off early", async () => {
    const tx = {
      creditCardInstallmentPlan: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "plan-early-paid",
            origin: "transaction",
            transactionId: "tx-1",
            transaction: {
              creditCardObligationEntries: [
                {
                  amount: new Decimal("1000"),
                  paymentAllocations: [{ amount: new Decimal("1000") }],
                },
              ],
            },
            importedObligations: [],
            feeTransaction: null,
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    await completeFullyPaidInstallmentPlansForCard(tx, "card-wallet-1");

    expect(tx.creditCardInstallmentPlan.updateMany).toHaveBeenCalledWith({
      where: { id: "plan-early-paid", status: "active" },
      data: { status: "completed", completedAt: expect.any(Date) },
    });
  });

  it("counts only approved payments when recalculating unpaid statement total", async () => {
    const tx = {
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "stmt-1",
          status: "issued",
          items: [{ fundingWalletId: "wallet-1", amount: new Decimal("500") }],
          payments: [],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;

    await recalculateUnpaidStatementTotal(tx, "stmt-1");

    expect(tx.creditCardStatement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          payments: expect.objectContaining({
            where: { deletedAt: null, workflowStatus: "approved" },
          }),
        }),
      }),
    );
  });

  it("reopens completed installment plans when early payment allocations are deleted", async () => {
    const tx = {
      creditCardInstallmentPlan: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "plan-early-paid",
            origin: "transaction",
            transactionId: "tx-1",
            transaction: {
              creditCardObligationEntries: [
                {
                  amount: new Decimal("1000"),
                  paymentAllocations: [],
                },
              ],
            },
            importedObligations: [],
            feeTransaction: null,
            installments: [
              { id: "inst-1", statementItems: [] },
              { id: "inst-2", statementItems: [] },
            ],
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    await reopenUnpaidInstallmentPlansForCard(tx, "card-wallet-1");

    expect(tx.creditCardInstallmentPlan.updateMany).toHaveBeenCalledWith({
      where: { id: "plan-early-paid", status: "completed" },
      data: { status: "active", completedAt: null },
    });
  });

  it("normalizes negative items against positive items and leaves paidAt null for 0 VND statements", async () => {
    const tx = {
      creditCardStatement: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "stmt-zero", ...data })),
      },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "obl-pos",
            fundingWalletId: "wallet-a",
            amount: new Decimal("500"),
            paymentAllocations: [],
          },
          {
            id: "obl-neg",
            fundingWalletId: "wallet-a",
            amount: new Decimal("-200"),
            paymentAllocations: [],
          },
        ]),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const stmt = await createStatementForCycle(
      tx,
      "workspace-1",
      "card-wallet-1",
      "2026-10-01",
      "2026-10-31",
      15,
    );

    expect(stmt.totalAmount.toString()).toBe("300");

    // Also verify statementPaymentDetails normalizes cross-wallet negative items against positive items
    const txDetails = {
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "stmt-cross",
          status: "issued",
          totalAmount: new Decimal("300"),
          items: [
            { obligationEntryId: "obl-pos", fundingWalletId: "wallet-a", amount: new Decimal("500") },
            { obligationEntryId: "obl-neg", fundingWalletId: "wallet-b", amount: new Decimal("-200") },
          ],
          payments: [],
        }),
      },
    } as unknown as Prisma.TransactionClient;
    const details = await statementPaymentDetails(txDetails, "stmt-cross");
    expect(Object.fromEntries([...details.dueByWallet.entries()].map(([k, v]) => [k, v.toString()]))).toEqual({
      "wallet-a": "300",
    });

    // Now test 0 VND statement has paidAt: null
    (tx.creditCardObligationEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const zeroStmt = await createStatementForCycle(
      tx,
      "workspace-1",
      "card-wallet-1",
      "2026-11-01",
      "2026-11-30",
      15,
    );
    expect(zeroStmt.status).toBe("paid");
    expect(zeroStmt.paidAt).toBeNull();
  });

  it("attaches historical installment terms to unpaid statements in refreshHistoricalCardStatements", async () => {
    const createdItems: unknown[] = [];
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      creditCardProfile: {
        findFirst: vi.fn().mockResolvedValue({
          walletId: "card-wallet-1",
          statementClosingDay: 20,
          paymentDueDay: 5,
          statements: [{ cycleEndDate: new Date("2026-09-20T00:00:00.000Z") }],
          obligations: [],
          installmentPlans: [
            {
              installments: [
                { statementMonth: new Date("2026-09-01T00:00:00.000Z") },
              ],
            },
          ],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          walletId: "card-wallet-1",
          statementClosingDay: 20,
          paymentDueDay: 5,
        }),
      },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "inst-1",
            installmentNo: 1,
            statementDate: new Date("2026-09-20T00:00:00.000Z"),
            dueDate: new Date("2026-10-05T00:00:00.000Z"),
            amount: new Decimal("1000"),
            plan: {
              id: "plan-1",
              origin: "imported",
              termCount: 3,
              paidTermCount: 0,
              transaction: null,
              importedObligations: [
                {
                  id: "obl-imp-1",
                  fundingWalletId: "wallet-1",
                  amount: new Decimal("3000"),
                  paymentAllocations: [],
                  statementItems: [],
                },
              ],
              feeTransaction: null,
            },
          },
        ]),
      },
      creditCardStatement: {
        findFirst: vi.fn().mockResolvedValue({ id: "stmt-sep" }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "stmt-sep",
            status: "issued",
            cycleStartDate: new Date("2026-08-21T00:00:00.000Z"),
            cycleEndDate: new Date("2026-09-20T00:00:00.000Z"),
            items: [],
            payments: [],
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockImplementation(({ data }) => {
          createdItems.push(data);
          return Promise.resolve({ id: "item-1", ...data });
        }),
      },
      creditCardInstallmentPlan: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    await refreshHistoricalCardStatements(tx, "workspace-1", "card-wallet-1", "2026-09-20");

    expect(createdItems).toEqual([
      expect.objectContaining({
        statementId: "stmt-sep",
        obligationEntryId: "obl-imp-1",
        fundingWalletId: "wallet-1",
        installmentId: "inst-1",
        amount: new Decimal("1000"),
      }),
    ]);
  });

  it("produces identical Statement 2 totals in createStatementForCycle and refreshHistoricalCardStatements when a statement-linked current_debt payment spills into Cycle 2", async () => {
    // Cycle 1 statement had 1,000,000 debt; user paid 1,300,000 via current_debt (linked to stmt-1),
    // spilling 300,000 onto Cycle 2's 500,000 obligation. Statement 2 due should be 200,000 (not 0).
    const createTx = {
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "obl-cycle-2",
            fundingWalletId: "wallet-1",
            amount: new Decimal("500000"),
            postedDate: new Date("2026-09-25T00:00:00.000Z"),
            paymentAllocations: [
              {
                amount: new Decimal("300000"),
                paymentTransaction: {
                  workflowStatus: "approved",
                  deletedAt: null,
                  creditCardStatementId: "stmt-1",
                },
              },
            ],
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ id: "obl-cycle-2" }),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([
          { fundingWalletId: "wallet-1", amount: new Decimal("1000000") },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            creditCardPaymentSources: [
              { sourceWalletId: "wallet-1", amount: new Decimal("1300000") },
            ],
          },
        ]),
      },
      creditCardStatement: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "stmt-2", ...data }),
        ),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as Prisma.TransactionClient;

    const createdCycle2 = await createStatementForCycle(
      createTx,
      "workspace-1",
      "card-wallet-1",
      "2026-09-21",
      "2026-10-20",
      5,
    );
    expect(createdCycle2.totalAmount.toString()).toBe("200000");

    // Verify refreshHistoricalCardStatements computes the exact same 200,000 total for Statement 2
    const updatedStatements = new Map<string, Decimal>();
    const refreshTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      creditCardProfile: {
        findFirst: vi.fn().mockResolvedValue({
          walletId: "card-wallet-1",
          statementClosingDay: 20,
          paymentDueDay: 5,
          statements: [{ cycleEndDate: new Date("2026-10-20T00:00:00.000Z") }],
          obligations: [{ postedDate: new Date("2026-09-10T00:00:00.000Z") }],
          installmentPlans: [],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          walletId: "card-wallet-1",
          statementClosingDay: 20,
          paymentDueDay: 5,
        }),
      },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "obl-cycle-1",
            fundingWalletId: "wallet-1",
            amount: new Decimal("1000000"),
            postedDate: new Date("2026-09-10T00:00:00.000Z"),
            paymentAllocations: [],
          },
          {
            id: "obl-cycle-2",
            fundingWalletId: "wallet-1",
            amount: new Decimal("500000"),
            postedDate: new Date("2026-09-25T00:00:00.000Z"),
            paymentAllocations: [
              {
                amount: new Decimal("300000"),
                paymentTransaction: {
                  workflowStatus: "approved",
                  deletedAt: null,
                  creditCardStatementId: "stmt-1",
                },
              },
            ],
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ id: "obl-cycle-1" }),
      },
      creditCardInstallment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardStatement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "stmt-1",
          cycleStartDate: new Date("2026-08-21T00:00:00.000Z"),
          cycleEndDate: new Date("2026-09-20T00:00:00.000Z"),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "stmt-1",
            status: "paid",
            paidAt: new Date("2026-09-26T00:00:00.000Z"),
            cycleStartDate: new Date("2026-08-21T00:00:00.000Z"),
            cycleEndDate: new Date("2026-09-20T00:00:00.000Z"),
            items: [{ obligationEntryId: "obl-cycle-1", fundingWalletId: "wallet-1", amount: new Decimal("1000000"), isCarry: false }],
            payments: [
              {
                creditCardPaymentSources: [
                  { sourceWalletId: "wallet-1", amount: new Decimal("1300000") },
                ],
              },
            ],
          },
          {
            id: "stmt-2",
            status: "issued",
            paidAt: null,
            cycleStartDate: new Date("2026-09-21T00:00:00.000Z"),
            cycleEndDate: new Date("2026-10-20T00:00:00.000Z"),
            items: [],
            payments: [],
          },
        ]),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { totalAmount: Decimal } }) => {
          updatedStatements.set(where.id, data.totalAmount);
          return Promise.resolve({});
        }),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "item-new", ...data })),
      },
      creditCardInstallmentPlan: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as Prisma.TransactionClient;

    await refreshHistoricalCardStatements(refreshTx, "workspace-1", "card-wallet-1", "2026-10-20");

    expect(updatedStatements.get("stmt-2")?.toString()).toBe("200000");
  });
});



