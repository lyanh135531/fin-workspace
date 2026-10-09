import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { createStatementForCycle, shareForImportedInstallment, statementPaymentDetails } from "@/services/credit-card-statement-service";
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
  });
});

