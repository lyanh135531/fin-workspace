import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
});

const deleteMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  requireWorkspaceMember: vi.fn(),
  assertWalletHasNoOpenDependencies: vi.fn(),
  ensureWalletNameAvailable: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: deleteMocks.transaction },
}));
vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: deleteMocks.requireWorkspaceMember,
}));
vi.mock("@/services/wallet-service", () => ({
  assertWalletHasNoOpenDependencies: deleteMocks.assertWalletHasNoOpenDependencies,
  ensureWalletNameAvailable: deleteMocks.ensureWalletNameAvailable,
}));

import { allocateLinkedRefundByFundingWallet, allocateOldestObligations, allocateRefundByFundingWallet } from "@/services/credit-card-ledger";
import { deleteCreditCard, updateCreditCard } from "@/services/credit-card-service";
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
    transaction: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    creditCardInstallmentPlan: { count: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    creditCardStatement: { count: vi.fn(), deleteMany: vi.fn() },
    creditCardStatementItem: { deleteMany: vi.fn() },
    creditCardObligationEntry: { deleteMany: vi.fn() },
    creditCardAllocation: { deleteMany: vi.fn() },
    creditCardPaymentReservation: { updateMany: vi.fn() },
    recurringTransaction: { count: vi.fn() },
    wallet: { update: vi.fn() },
    creditCardProfile: { update: vi.fn() },
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

    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.creditCardPaymentReservation.updateMany).toHaveBeenCalledWith({
      where: { paymentTransactionId: { in: ["tx-1"] }, releasedAt: null },
      data: { releasedAt: expect.any(Date) },
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

  it("rejects a credit limit below current debt", async () => {
    await expect(updateCreditCard("user-id", "workspace-id", {
      ...validInput,
      creditLimit: new Decimal(10_000_000),
    })).rejects.toThrow("thấp hơn dư nợ hiện tại");
    expect(tx.creditCardProfile.update).not.toHaveBeenCalled();
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

