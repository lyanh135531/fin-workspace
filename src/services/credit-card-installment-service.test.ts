import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
});

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  requireWorkspaceMember: vi.fn(),
  assertCardBalanceReconciled: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: mocks.requireWorkspaceMember,
}));
vi.mock("@/lib/date", () => ({
  getBusinessDateInTimeZone: vi.fn(() => "2026-09-16"),
}));
vi.mock("@/services/credit-card-ledger", () => ({
  assertCardBalanceReconciled: mocks.assertCardBalanceReconciled,
  syncCreditCardObligationsForTransaction: vi.fn(),
}));
vi.mock("@/services/credit-card-statement-service", () => ({
  generateCardStatementsInTransaction: vi.fn(),
}));

import {
  deleteImportedCreditCardInstallment,
  importCreditCardInstallment,
} from "@/services/credit-card-installment-service";

function transactionClient() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workspaceWallet: {
      findFirst: vi.fn().mockResolvedValue({
        wallet: {
          currentBalance: new Decimal(100),
          creditCardProfile: {
            creditLimit: new Decimal(1000),
            statementClosingDay: 25,
            paymentDueDay: 10,
            statements: [],
          },
        },
      }),
      findMany: vi.fn().mockResolvedValue([{ walletId: "funding-1" }]),
    },
    creditCardInstallmentPlan: {
      create: vi.fn().mockResolvedValue({ id: "plan-1" }),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    creditCardObligationEntry: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    creditCardInstallment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    wallet: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
}

const baseInput = {
  cardWalletId: "card-1",
  description: "Điện thoại",
  termCount: 12,
  paidTermCount: 4,
  remainingAmount: new Decimal(300),
  firstStatementDate: "2026-09-25",
  balanceMode: "add_to_balance" as const,
  allocations: [{ walletId: "funding-1", amount: new Decimal(300) }],
};

describe("importCreditCardInstallment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspaceMember.mockResolvedValue({
      id: "member-1",
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    mocks.assertCardBalanceReconciled.mockResolvedValue(undefined);
  });

  it("adds an imported balance without creating a transaction", async () => {
    const tx = transactionClient();
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await importCreditCardInstallment("user-1", "workspace-1", baseInput);

    expect(mocks.requireWorkspaceMember).toHaveBeenCalledWith("user-1", "workspace-1", true);
    expect(tx.creditCardInstallmentPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionId: null,
        origin: "imported",
        paidTermCount: 4,
        importBalanceMode: "add_to_balance",
      }),
    });
    expect(tx.creditCardObligationEntry.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        installmentPlanId: "plan-1",
        fundingWalletId: "funding-1",
        amount: new Decimal(300),
      })],
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { currentBalance: { increment: new Decimal(300) } },
    });
    const installmentRows = tx.creditCardInstallment.createMany.mock.calls[0][0].data;
    expect(installmentRows).toHaveLength(8);
    expect(installmentRows[0]).toEqual(expect.objectContaining({ installmentNo: 5 }));
    expect(installmentRows[7]).toEqual(expect.objectContaining({ installmentNo: 12 }));
    expect(mocks.assertCardBalanceReconciled).toHaveBeenCalledWith(tx, "card-1");
  });

  it("reclassifies unstatemented opening debt without changing the card balance", async () => {
    const tx = transactionClient();
    tx.creditCardObligationEntry.findMany.mockResolvedValue([{
      id: "opening-1",
      kind: "opening_debt",
      source: "opening_balance",
      effectiveDate: new Date("2026-09-16T00:00:00.000Z"),
      postedDate: new Date("2026-09-16T00:00:00.000Z"),
      amount: new Decimal(500),
    }]);
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await importCreditCardInstallment("user-1", "workspace-1", {
      ...baseInput,
      balanceMode: "included_opening_debt",
    });

    expect(tx.creditCardObligationEntry.update).toHaveBeenCalledWith({
      where: { id: "opening-1" },
      data: { amount: new Decimal(200) },
    });
    expect(tx.creditCardObligationEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        installmentPlanId: "plan-1",
        amount: new Decimal(300),
        metadata: { importedFromObligationId: "opening-1" },
      }),
    });
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("rejects reclassification when eligible opening debt is insufficient", async () => {
    const tx = transactionClient();
    tx.creditCardObligationEntry.findMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(importCreditCardInstallment("user-1", "workspace-1", {
      ...baseInput,
      balanceMode: "included_opening_debt",
    })).rejects.toThrow("không đủ để phân loại");
  });
});

describe("deleteImportedCreditCardInstallment", () => {
  it("reverses an added balance before any installment reaches a statement", async () => {
    const tx = transactionClient();
    tx.creditCardInstallmentPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      cardWalletId: "card-1",
      importBalanceMode: "add_to_balance",
      importedObligations: [{
        id: "obligation-1",
        amount: new Decimal(300),
        paymentAllocations: [],
        statementItems: [],
      }],
      installments: [{ id: "installment-1", statementItems: [] }],
    });
    mocks.requireWorkspaceMember.mockResolvedValue({});
    mocks.assertCardBalanceReconciled.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await deleteImportedCreditCardInstallment("user-1", "workspace-1", "plan-1");

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { currentBalance: { decrement: new Decimal(300) } },
    });
    expect(tx.creditCardObligationEntry.deleteMany).toHaveBeenCalledWith({ where: { installmentPlanId: "plan-1" } });
    expect(tx.creditCardInstallment.deleteMany).toHaveBeenCalledWith({ where: { planId: "plan-1" } });
    expect(tx.creditCardInstallmentPlan.delete).toHaveBeenCalledWith({ where: { id: "plan-1" } });
  });

  it("blocks deletion after an imported installment reaches a statement", async () => {
    const tx = transactionClient();
    tx.creditCardInstallmentPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      cardWalletId: "card-1",
      importBalanceMode: "included_opening_debt",
      importedObligations: [{
        id: "obligation-1",
        amount: new Decimal(300),
        paymentAllocations: [],
        statementItems: [{ id: "statement-item-1" }],
      }],
      installments: [{ id: "installment-1", statementItems: [{ id: "statement-item-1" }] }],
    });
    mocks.requireWorkspaceMember.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(
      deleteImportedCreditCardInstallment("user-1", "workspace-1", "plan-1"),
    ).rejects.toThrow("đã vào sao kê");
    expect(tx.creditCardInstallmentPlan.delete).not.toHaveBeenCalled();
  });
});
