import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
});

const deleteMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findManyObligations: vi.fn(),
  findManyReservations: vi.fn(),
  requireWorkspaceMember: vi.fn(),
  assertWalletHasNoOpenDependencies: vi.fn(),
  ensureWalletNameAvailable: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: deleteMocks.transaction,
    creditCardObligationEntry: {
      findMany: deleteMocks.findManyObligations,
    },
    creditCardPaymentReservation: {
      findMany: deleteMocks.findManyReservations,
    },
  },
}));
vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: deleteMocks.requireWorkspaceMember,
}));
vi.mock("@/services/wallet-service", () => ({
  assertWalletHasNoOpenDependencies: deleteMocks.assertWalletHasNoOpenDependencies,
  ensureWalletNameAvailable: deleteMocks.ensureWalletNameAvailable,
}));

import {
  allocateLinkedRefundByFundingWallet,
  allocateOldestObligations,
  allocateRefundByFundingWallet,
  normalizeApprovedRefundAllocations,
} from "@/services/credit-card-ledger";
import {
  deleteCreditCard,
  getWorkspaceCreditCardCommitmentDetails,
  getWorkspaceCreditCardCommitments,
  updateCreditCard,
} from "@/services/credit-card-service";
import Decimal from "decimal.js";

describe("credit card obligation ledger", () => {
  it("uses credits then allocates oldest obligations within each funding wallet", () => {
    const allocations = allocateOldestObligations([
      { id: "old", fundingWalletId: "wallet-a", amount: "100", paid: "0", postedDate: new Date("2026-08-01") },
      { id: "refund", fundingWalletId: "wallet-a", amount: "-30", paid: "0", postedDate: new Date("2026-08-02") },
      { id: "new", fundingWalletId: "wallet-a", amount: "100", paid: "0", postedDate: new Date("2026-09-01") },
    ], [{ walletId: "wallet-a", amount: new Decimal(90) }]);
    expect(allocations.map((item) => [item.obligationEntryId, item.amount.toString()])).toEqual([
      ["old", "70"],
      ["new", "20"],
    ]);
  });

  it("rejects a source that pays more than its assigned obligation", () => {
    expect(() => allocateOldestObligations([
      { id: "a", fundingWalletId: "wallet-a", amount: "10", paid: "0", postedDate: new Date("2026-08-01") },
    ], [{ walletId: "wallet-a", amount: new Decimal(11) }])).toThrow("vượt quá nghĩa vụ");
  });

  it("allocates an independent refund to oldest funding obligations", () => {
    const allocations = allocateRefundByFundingWallet([
      { id: "old", fundingWalletId: "wallet-a", amount: "70", paid: "20", postedDate: new Date("2026-08-01") },
      { id: "new", fundingWalletId: "wallet-b", amount: "80", paid: "0", postedDate: new Date("2026-09-01") },
    ], "wallet-b", new Decimal(90));
    expect([...allocations].map(([walletId, amount]) => [walletId, amount.toString()])).toEqual([
      ["wallet-a", "50"],
      ["wallet-b", "40"],
    ]);
  });

  it("puts a refund above current debt into the default funding wallet", () => {
    const allocations = allocateRefundByFundingWallet([
      { id: "debt", fundingWalletId: "wallet-a", amount: "30", paid: "0", postedDate: new Date("2026-08-01") },
    ], "wallet-default", new Decimal(50));
    expect([...allocations].map(([walletId, amount]) => [walletId, amount.toString()])).toEqual([
      ["wallet-a", "30"],
      ["wallet-default", "20"],
    ]);
  });

  it("reverses a linked partial refund proportionally across the original wallets", () => {
    const allocations = allocateLinkedRefundByFundingWallet([
      { walletId: "wallet-a", amount: "60" },
      { walletId: "wallet-b", amount: "40" },
    ], new Decimal(25));
    expect([...allocations].map(([walletId, amount]) => [walletId, amount.toString()])).toEqual([
      ["wallet-a", "15"],
      ["wallet-b", "10"],
    ]);
  });

  it("rejects a linked refund above the remaining original allocation", () => {
    expect(() => allocateLinkedRefundByFundingWallet([
      { walletId: "wallet-a", amount: "10" },
    ], new Decimal(10.0001))).toThrow("vượt quá phần còn có thể hoàn");
  });
});

describe("deleteCreditCard checks", () => {
  const tx = {
    $queryRaw: vi.fn(),
    workspaceWallet: { findFirst: vi.fn() },
    transaction: { count: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    creditCardInstallmentPlan: { count: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    creditCardStatement: { count: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    creditCardStatementItem: { deleteMany: vi.fn() },
    creditCardObligationEntry: { deleteMany: vi.fn() },
    creditCardAllocation: { deleteMany: vi.fn() },
    creditCardPaymentReservation: { updateMany: vi.fn(), deleteMany: vi.fn() },
    creditCardPaymentAllocation: { deleteMany: vi.fn() },
    creditCardPaymentSource: { deleteMany: vi.fn() },
    creditCardInstallment: { deleteMany: vi.fn() },
    recurringTransaction: { count: vi.fn(), updateMany: vi.fn() },
    wallet: { findFirst: vi.fn(), update: vi.fn() },
    creditCardProfile: { update: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deleteMocks.requireWorkspaceMember.mockResolvedValue({});
    deleteMocks.ensureWalletNameAvailable.mockResolvedValue(undefined);
    deleteMocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.transaction.count.mockResolvedValue(1);
    tx.creditCardInstallmentPlan.count.mockResolvedValue(0);
    tx.creditCardStatement.count.mockResolvedValue(0);
    tx.recurringTransaction.count.mockResolvedValue(0);
    tx.transaction.findMany.mockResolvedValue([]);
    tx.creditCardStatement.findMany.mockResolvedValue([]);
    tx.creditCardInstallmentPlan.findMany.mockResolvedValue([]);
    tx.wallet.findFirst.mockResolvedValue({
      id: "asset-wallet",
      currentBalance: new Decimal(1_000_000),
      deletedAt: null,
    });
  });

  it("rejects deletion without resolution when card still has outstanding debt", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(125_000) },
    });

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id"),
    ).rejects.toThrow("Thẻ vẫn còn dư nợ");
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("deletes card and voids transactions when void_transactions resolution is provided", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(125_000) },
    });
    tx.transaction.findMany.mockResolvedValue([
      { id: "tx-1", type: "expense", amount: new Decimal(125_000), workflowStatus: "approved" },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "void_transactions",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-1"] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-id" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
        currentBalance: new Decimal(0),
      },
    });
  });

  it("deletes card and wipes all data when confirmLoss is true even with balance", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(500_000) },
    });
    tx.transaction.findMany.mockResolvedValue([
      { id: "tx-2", type: "expense", amount: new Decimal(500_000), workflowStatus: "approved" },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", undefined, true),
    ).resolves.toEqual({ ok: true });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-2"] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-id" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
        currentBalance: new Decimal(0),
      },
    });
  });

  it("deletes card with paid statements and unlinks statement transactions when confirmLoss is true", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(0) },
    });
    tx.creditCardStatement.findMany.mockResolvedValue([
      { id: "statement-1" },
    ]);
    tx.transaction.findMany.mockResolvedValue([
      { id: "tx-payment-1", type: "expense", creditCardStatementId: "statement-1" },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", undefined, true),
    ).resolves.toEqual({ ok: true });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { creditCardStatementId: { in: ["statement-1"] } },
      data: { creditCardStatementId: null },
    });
    expect(tx.creditCardStatement.deleteMany).toHaveBeenCalledWith({
      where: { cardWalletId: "card-id" },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-id" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
        currentBalance: new Decimal(0),
      },
    });
  });

  it("migrates transactions to destination wallet and deletes card when migrate_transactions is provided", async () => {
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(200_000) },
      })
      .mockResolvedValueOnce({
        wallet: { id: "cash-id", kind: "asset", currentBalance: new Decimal(1_000_000) },
      });
    tx.transaction.findMany.mockResolvedValue([
      { id: "tx-1", walletId: "card-id", type: "expense", amount: new Decimal(200_000), workflowStatus: "approved" },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: { walletId: "cash-id" },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "cash-id" },
      data: { currentBalance: new Decimal(800_000) },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-id" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
        currentBalance: new Decimal(0),
      },
    });
  });

  it("deletes a mistakenly created card with opening debt but no approved transactions", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(125_000) },
    });
    tx.transaction.count.mockResolvedValue(0);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id"),
    ).resolves.toEqual({ ok: true });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "card-id" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
        currentBalance: new Decimal(0),
      },
    });
  });

  it("reverses counterparty asset wallet balances when voiding card payments and transfers", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(150_000) },
    });
    tx.transaction.findMany.mockResolvedValue([
      {
        id: "tx-pay",
        walletId: "card-id",
        toWalletId: null,
        type: "expense",
        purpose: "credit_card_payment",
        amount: new Decimal(100_000),
        workflowStatus: "approved",
        creditCardPaymentSources: [{ sourceWalletId: "cash-id", amount: new Decimal(100_000) }],
      },
      {
        id: "tx-transfer",
        walletId: "card-id",
        toWalletId: "bank-id",
        type: "transfer",
        purpose: "normal",
        amount: new Decimal(50_000),
        workflowStatus: "approved",
        creditCardPaymentSources: [],
      },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "void_transactions",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "cash-id" },
      data: { currentBalance: { increment: new Decimal(100_000) } },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "bank-id" },
      data: { currentBalance: { decrement: new Decimal(50_000) } },
    });
  });

  it("deducts only remaining unpaid card debt (not gross spend) when migrating to an asset wallet", async () => {
    // Card has 500k total spend, 300k already paid from asset wallet, so only 200k unpaid debt remains
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(200_000) },
      })
      .mockResolvedValueOnce({
        wallet: { id: "cash-id", kind: "asset", status: "active", currentBalance: new Decimal(1_000_000) },
      });
    tx.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        walletId: "card-id",
        type: "expense",
        purpose: "standard",
        amount: new Decimal(500_000),
        workflowStatus: "approved",
      },
      {
        id: "pay-1",
        walletId: "card-id",
        type: "expense",
        purpose: "credit_card_payment",
        amount: new Decimal(300_000),
        workflowStatus: "approved",
        creditCardPaymentSources: [
          { sourceWalletId: "cash-id", amount: new Decimal(300_000) },
        ],
      },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).resolves.toEqual({ ok: true });

    // Destination asset wallet balance should be 1,000,000 + 300,000 - 500,000 = 800,000 (not 500,000)
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "cash-id" },
      data: { currentBalance: new Decimal(800_000) },
    });
  });

  it("reverses prior card payment back to its original funding wallet while deducting migrated spend from a different destination asset wallet", async () => {
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(200_000) },
      })
      .mockResolvedValueOnce({
        wallet: { id: "cash-id", kind: "asset", status: "active", currentBalance: new Decimal(1_000_000) },
      });
    tx.transaction.findMany.mockResolvedValue([
      {
        id: "tx-spend",
        walletId: "card-id",
        type: "expense",
        purpose: "standard",
        amount: new Decimal(500_000),
        workflowStatus: "approved",
      },
      {
        id: "pay-bank",
        walletId: "card-id",
        type: "expense",
        purpose: "credit_card_payment",
        amount: new Decimal(300_000),
        workflowStatus: "approved",
        creditCardPaymentSources: [
          { sourceWalletId: "bank-id", amount: new Decimal(300_000) },
        ],
      },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "bank-id" },
      data: { currentBalance: { increment: new Decimal(300_000) } },
    });
    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: "pay-bank" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "cash-id" },
      data: { currentBalance: new Decimal(500_000) },
    });
  });

  it("normalizes migrated credit_card_refund on an asset wallet to standard income with originalTransactionId null", async () => {
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(300_000) },
      })
      .mockResolvedValueOnce({
        wallet: { id: "cash-id", kind: "asset", status: "active", currentBalance: new Decimal(1_000_000) },
      });
    tx.transaction.findMany.mockResolvedValue([
      {
        id: "tx-purchase",
        walletId: "card-id",
        type: "expense",
        purpose: "standard",
        amount: new Decimal(500_000),
        workflowStatus: "approved",
      },
      {
        id: "tx-refund",
        walletId: "card-id",
        type: "income",
        purpose: "credit_card_refund",
        originalTransactionId: "tx-purchase",
        amount: new Decimal(200_000),
        workflowStatus: "approved",
      },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-refund" },
      data: {
        walletId: "cash-id",
        purpose: "standard",
        originalTransactionId: null,
      },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "cash-id" },
      data: { currentBalance: new Decimal(700_000) },
    });
  });

  it("blocks migrate_transactions when card still has active or pending installment plans", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(200_000) },
    });
    tx.creditCardInstallmentPlan.count.mockResolvedValue(1);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).rejects.toThrow("gói trả góp");
  });

  it("cleans up obligations and statements when deleting a zero-balance or no-transaction card", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(0) },
    });
    tx.transaction.count.mockResolvedValue(0);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id"),
    ).resolves.toEqual({ ok: true });

    expect(tx.creditCardObligationEntry.deleteMany).toHaveBeenCalledWith({
      where: { cardWalletId: "card-id" },
    });
    expect(tx.creditCardStatement.deleteMany).toHaveBeenCalledWith({
      where: { cardWalletId: "card-id" },
    });
  });

  it("blocks migrate_transactions when card still has active recurring transactions", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(200_000) },
    });
    tx.recurringTransaction.count.mockResolvedValue(2);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).rejects.toThrow("Thẻ còn 2 giao dịch định kỳ liên kết");
  });

  it("soft-deletes transfer between card and destination asset wallet instead of creating a self-transfer", async () => {
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: { id: "card-id", kind: "credit_card", currentBalance: new Decimal(200_000) },
      })
      .mockResolvedValueOnce({
        wallet: { id: "cash-id", kind: "asset", status: "active", currentBalance: new Decimal(1_000_000) },
      });
    tx.transaction.findMany.mockResolvedValue([
      {
        id: "tx-self-transfer",
        walletId: "card-id",
        toWalletId: "cash-id",
        type: "transfer",
        purpose: "standard",
        amount: new Decimal(200_000),
        workflowStatus: "approved",
      },
    ]);

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "migrate_transactions",
        targetWalletId: "cash-id",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-self-transfer" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("rejects void_transactions when counterparty asset wallet has insufficient balance to reverse a card-to-asset transfer", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(200_000) },
    });
    tx.transaction.findMany.mockResolvedValue([
      {
        id: "tx-transfer-out",
        walletId: "card-id",
        toWalletId: "bank-id",
        type: "transfer",
        purpose: "normal",
        amount: new Decimal(200_000),
        workflowStatus: "approved",
        creditCardPaymentSources: [],
      },
    ]);
    tx.wallet.findFirst.mockResolvedValueOnce({
      id: "bank-id",
      currentBalance: new Decimal(50_000),
      deletedAt: null,
    });

    await expect(
      deleteCreditCard("user-id", "workspace-id", "card-id", {
        action: "void_transactions",
      }),
    ).rejects.toThrow("ví liên kết không còn đủ số dư");
  });

  it("queries only genuinely paid positive-amount statements when checking paidStatements during card deletion", async () => {
    tx.workspaceWallet.findFirst.mockResolvedValue({
      wallet: { currentBalance: new Decimal(0) },
    });
    tx.transaction.count.mockResolvedValue(0);

    await deleteCreditCard("user-id", "workspace-id", "card-id");

    expect(tx.creditCardStatement.count).toHaveBeenCalledWith({
      where: {
        cardWalletId: "card-id",
        status: "paid",
        totalAmount: { gt: 0 },
        paidAt: { not: null },
      },
    });
  });
});

describe("updateCreditCard checks", () => {
  const tx = {
    $queryRaw: vi.fn(),
    workspaceWallet: { findFirst: vi.fn() },
    creditCardInstallmentPlan: { count: vi.fn() },
    wallet: { update: vi.fn() },
    creditCardProfile: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const validInput = {
    cardWalletId: "card-id",
    name: "Visa chính",
    description: "Chi tiêu gia đình",
    creditLimit: new Decimal(50_000_000),
    defaultFundingWalletId: "funding-id",
    statementClosingDay: 25,
    paymentDueDay: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deleteMocks.requireWorkspaceMember.mockResolvedValue({});
    deleteMocks.ensureWalletNameAvailable.mockResolvedValue(undefined);
    deleteMocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.workspaceWallet.findFirst
      .mockResolvedValueOnce({
        wallet: {
          currentBalance: new Decimal(20_000_000),
          creditCardProfile: { statementClosingDay: 25 },
        },
      })
      .mockResolvedValueOnce({ walletId: "funding-id" });
    tx.creditCardInstallmentPlan.count.mockResolvedValue(0);
  });

  it("allows setting a credit limit below current debt (over-limit state)", async () => {
    await expect(updateCreditCard("user-id", "workspace-id", {
      ...validInput,
      creditLimit: new Decimal(10_000_000),
    })).resolves.toEqual({ ok: true });
    expect(tx.creditCardProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { walletId: "card-id" },
      data: expect.objectContaining({
        creditLimit: new Decimal(10_000_000),
      }),
    }));
  });

  it("updates card metadata and future billing configuration", async () => {
    await expect(updateCreditCard("user-id", "workspace-id", validInput)).resolves.toEqual({ ok: true });
    expect(tx.creditCardProfile.update).toHaveBeenCalledWith({
      where: { walletId: "card-id" },
      data: {
        creditLimit: new Decimal(50_000_000),
        defaultFundingWalletId: "funding-id",
        statementClosingDay: 25,
        paymentDueDay: 10,
      },
    });
  });

  it("blocks a closing-day change while installments are active", async () => {
    tx.creditCardInstallmentPlan.count.mockResolvedValue(1);
    await expect(updateCreditCard("user-id", "workspace-id", {
      ...validInput,
      statementClosingDay: 20,
    })).rejects.toThrow("kế hoạch trả góp đang hoạt động");
  });
});

describe("getWorkspaceCreditCardCommitments & getWorkspaceCreditCardCommitmentDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMocks.findManyReservations.mockResolvedValue([]);
  });

  it("leaves 0 items in getWorkspaceCreditCardCommitmentDetails and 0 in getWorkspaceCreditCardCommitments after purchase + refund + full payment", async () => {
    const settledEntries = [
      {
        id: "ob-purchase",
        cardWalletId: "card-1",
        fundingWalletId: "wallet-a",
        kind: "purchase" as const,
        source: "transaction" as const,
        effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
        postedDate: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-08-01T01:00:00.000Z"),
        amount: new Decimal(500_000),
        card: {
          wallet: { name: "Visa", status: "active" as const, deletedAt: null },
        },
        fundingWallet: { name: "Techcombank" },
        paymentAllocations: [{ amount: new Decimal(200_000) }],
        transaction: {
          id: "tx-1",
          description: "Mua hàng",
          type: "expense" as const,
          purpose: "standard" as const,
          category: { name: "Mua sắm" },
        },
        installmentPlan: null,
        statementItems: [],
      },
      {
        id: "ob-refund",
        cardWalletId: "card-1",
        fundingWalletId: "wallet-a",
        kind: "refund" as const,
        source: "transaction" as const,
        effectiveDate: new Date("2026-08-02T00:00:00.000Z"),
        postedDate: new Date("2026-08-02T00:00:00.000Z"),
        createdAt: new Date("2026-08-02T01:00:00.000Z"),
        amount: new Decimal(-300_000),
        card: {
          wallet: { name: "Visa", status: "active" as const, deletedAt: null },
        },
        fundingWallet: { name: "Techcombank" },
        paymentAllocations: [],
        transaction: {
          id: "tx-2",
          description: "Hoàn tiền",
          type: "income" as const,
          purpose: "credit_card_refund" as const,
          category: null,
        },
        installmentPlan: null,
        statementItems: [],
      },
    ];

    deleteMocks.findManyObligations.mockResolvedValue(settledEntries);

    const details = await getWorkspaceCreditCardCommitmentDetails("workspace-id");
    const commitments = await getWorkspaceCreditCardCommitments("workspace-id");

    expect(details).toEqual([]);
    expect(commitments.get("wallet-a") ?? new Decimal(0)).toEqual(new Decimal(0));
  });

  it("nets cross-wallet refunds on the same card without leaking credit across different cards", async () => {
    const entries = [
      {
        id: "card-a-refund",
        cardWalletId: "card-a",
        fundingWalletId: "wallet-1",
        kind: "refund" as const,
        source: "transaction" as const,
        effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
        postedDate: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-08-01T01:00:00.000Z"),
        amount: new Decimal(-100_000),
        card: {
          wallet: { name: "Card A", status: "active" as const, deletedAt: null },
        },
        fundingWallet: { name: "Wallet 1" },
        paymentAllocations: [],
        transaction: null,
        installmentPlan: null,
        statementItems: [],
      },
      {
        id: "card-b-purchase",
        cardWalletId: "card-b",
        fundingWalletId: "wallet-1",
        kind: "purchase" as const,
        source: "transaction" as const,
        effectiveDate: new Date("2026-08-02T00:00:00.000Z"),
        postedDate: new Date("2026-08-02T00:00:00.000Z"),
        createdAt: new Date("2026-08-02T01:00:00.000Z"),
        amount: new Decimal(400_000),
        card: {
          wallet: { name: "Card B", status: "active" as const, deletedAt: null },
        },
        fundingWallet: { name: "Wallet 1" },
        paymentAllocations: [],
        transaction: null,
        installmentPlan: null,
        statementItems: [],
      },
      {
        id: "card-b-cross-refund",
        cardWalletId: "card-b",
        fundingWalletId: "wallet-2",
        kind: "refund" as const,
        source: "transaction" as const,
        effectiveDate: new Date("2026-08-03T00:00:00.000Z"),
        postedDate: new Date("2026-08-03T00:00:00.000Z"),
        createdAt: new Date("2026-08-03T01:00:00.000Z"),
        amount: new Decimal(-150_000),
        card: {
          wallet: { name: "Card B", status: "active" as const, deletedAt: null },
        },
        fundingWallet: { name: "Wallet 2" },
        paymentAllocations: [],
        transaction: null,
        installmentPlan: null,
        statementItems: [],
      },
    ];

    deleteMocks.findManyObligations.mockResolvedValue(entries);

    const details = await getWorkspaceCreditCardCommitmentDetails("workspace-id");
    const commitments = await getWorkspaceCreditCardCommitments("workspace-id");

    expect(details).toHaveLength(1);
    expect(details[0]?.id).toBe("card-b-purchase");
    expect(details[0]?.remainingAmount).toBe("250000");
    expect(details[0]?.paidAmount).toBe("150000");
    expect(commitments.get("wallet-1")?.toString()).toBe("250000");
  });

  it("includes unreleased CreditCardPaymentReservations when pending payment exceeds current card obligation", async () => {
    deleteMocks.findManyObligations.mockResolvedValue([]);
    deleteMocks.findManyReservations.mockResolvedValue([
      {
        id: "res-1",
        sourceWalletId: "wallet-a",
        amount: new Decimal(200_000),
        sourceWallet: { name: "Techcombank" },
        paymentTransaction: {
          id: "pay-pending-1",
          walletId: "card-1",
          description: "Thanh toán sao kê chờ duyệt",
          type: "expense",
          purpose: "credit_card_payment",
          date: new Date("2026-08-10T00:00:00.000Z"),
          postedDate: new Date("2026-08-10T00:00:00.000Z"),
          createdAt: new Date("2026-08-10T01:00:00.000Z"),
          wallet: { name: "Visa", status: "active", deletedAt: null },
          creditCardStatement: null,
        },
      },
    ]);

    const commitments = await getWorkspaceCreditCardCommitments("workspace-id");
    const details = await getWorkspaceCreditCardCommitmentDetails("workspace-id");

    expect(commitments.get("wallet-a")?.toString()).toBe("200000");
    expect(details).toHaveLength(1);
    expect(details[0]).toEqual(
      expect.objectContaining({
        id: "reservation:res-1",
        fundingWalletId: "wallet-a",
        remainingAmount: "200000",
        transactionPurpose: "credit_card_payment",
      }),
    );
  });
});

describe("normalizeApprovedRefundAllocations", () => {
  it("remaps refund allocations away from a deactivated funding wallet to the active defaultFundingWalletId", async () => {
    const createdAllocations: unknown[] = [];
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      transaction: {
        findUnique: vi.fn().mockResolvedValue({
          walletId: "card-1",
          amount: new Decimal(150_000),
          purpose: "credit_card_refund",
          workflowStatus: "approved",
          originalTransactionId: "orig-tx-1",
          member: { workspaceId: "workspace-1" },
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: "orig-tx-1",
          creditCardAllocations: [
            { fundingWalletId: "wallet-deactivated", amount: new Decimal(150_000) },
          ],
          refundTransactions: [],
        }),
      },
      creditCardProfile: {
        findUnique: vi.fn().mockResolvedValue({
          defaultFundingWalletId: "wallet-active-default",
        }),
      },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      workspaceWallet: {
        findMany: vi.fn().mockResolvedValue([
          { walletId: "wallet-active-default" },
        ]),
      },
      creditCardAllocation: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockImplementation(({ data }) => {
          createdAllocations.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
    };

    await normalizeApprovedRefundAllocations(
      tx as unknown as Parameters<typeof normalizeApprovedRefundAllocations>[0],
      "refund-tx-1",
    );

    expect(createdAllocations).toEqual([
      {
        transactionId: "refund-tx-1",
        fundingWalletId: "wallet-active-default",
        amount: new Decimal(150_000),
      },
    ]);
  });
});



