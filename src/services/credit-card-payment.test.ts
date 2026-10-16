import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
});

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  requireWorkspaceMember: vi.fn(),
  generateCardStatementsInTransaction: vi.fn(),
  applyBalance: vi.fn(),
  assertCardBalanceReconciled: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: mocks.requireWorkspaceMember,
}));

vi.mock("@/services/credit-card-statement-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/credit-card-statement-service")>("@/services/credit-card-statement-service");
  return {
    ...actual,
    generateCardStatementsInTransaction: mocks.generateCardStatementsInTransaction,
  };
});

vi.mock("@/services/transaction-service", () => ({
  applyBalance: mocks.applyBalance,
}));

vi.mock("@/services/credit-card-ledger", async () => {
  const actual = await vi.importActual<typeof import("@/services/credit-card-ledger")>("@/services/credit-card-ledger");
  return {
    ...actual,
    assertCardBalanceReconciled: mocks.assertCardBalanceReconciled,
  };
});

import { createCreditCardPayment } from "@/services/credit-card-service";

describe("createCreditCardPayment", () => {
  const cardWalletId = "00000000-0000-0000-0000-000000000001";
  const sourceWalletId = "00000000-0000-0000-0000-000000000002";
  const statementId = "00000000-0000-0000-0000-000000000003";

  function setupTx(options: {
    hasStatement?: boolean;
    statementStatus?: "issued" | "paid";
    statementAmount?: string;
    cardBalance?: string;
    obligations?: Array<{ id: string; fundingWalletId: string; amount: Decimal; paid: Decimal; postedDate: Date }>;
  }) {
    const obligations = options.obligations ?? [
      { id: "obl-1", fundingWalletId: sourceWalletId, amount: new Decimal("1000000"), paid: new Decimal("0"), postedDate: new Date("2026-08-01") },
    ];

    const statement = options.hasStatement !== false ? {
      id: statementId,
      workspaceId: "ws-1",
      cardWalletId,
      status: options.statementStatus ?? "issued",
      totalAmount: new Decimal(options.statementAmount ?? "1000000"),
      items: [{
        obligationEntryId: "obl-1",
        fundingWalletId: sourceWalletId,
        amount: new Decimal("1000000"),
      }],
      payments: [],
    } : null;

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue({
          wallet: { currentBalance: new Decimal(options.cardBalance ?? "1000000") },
        }),
        findMany: vi.fn().mockResolvedValue([{ walletId: sourceWalletId }]),
      },
      creditCardStatement: {
        findFirst: vi.fn().mockResolvedValue(statement),
        findUnique: vi.fn().mockResolvedValue(statement),
        update: vi.fn().mockResolvedValue({}),
      },
      creditCardStatementItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      creditCardInstallmentPlan: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: "tx-pay-1",
          ...data,
        })),
      },
      creditCardPaymentAllocation: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      creditCardPaymentReservation: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      creditCardObligationEntry: {
        findMany: vi.fn().mockResolvedValue(
          obligations.map((o) => ({
            id: o.id,
            fundingWalletId: o.fundingWalletId,
            amount: o.amount,
            postedDate: o.postedDate,
            paymentAllocations: o.paid.gt(0) ? [{ amount: o.paid }] : [],
          })),
        ),
      },
      wallet: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          currentBalance: new Decimal(options.cardBalance ?? "1000000"),
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    mocks.transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    return tx;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspaceMember.mockResolvedValue({
      id: "member-1",
      role: { code: "ADMIN" },
      workspace: { timeZone: "Asia/Ho_Chi_Minh" },
    });
  });

  it("pays statement in full and updates statement status to paid", async () => {
    const tx = setupTx({ hasStatement: true });

    const result = await createCreditCardPayment("user-1", "ws-1", {
      cardWalletId,
      statementId,
      target: "statement",
      date: "2026-08-10",
      sources: [{ walletId: sourceWalletId, amount: new Decimal("1000000") }],
    });

    expect(result.workflowStatus).toBe("approved");
    expect(tx.creditCardPaymentAllocation.createMany).toHaveBeenCalled();
    expect(tx.creditCardStatement.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: statementId },
      data: expect.objectContaining({ status: "paid" }),
    }));
    expect(mocks.applyBalance).toHaveBeenCalled();
    expect(mocks.assertCardBalanceReconciled).toHaveBeenCalled();
  });

  it("pays total current debt up to present (statement + unbilled) and marks statement as paid", async () => {
    const unbilledObligation = {
      id: "obl-2",
      fundingWalletId: sourceWalletId,
      amount: new Decimal("500000"),
      paid: new Decimal("0"),
      postedDate: new Date("2026-08-05"),
    };
    const tx = setupTx({
      hasStatement: true,
      cardBalance: "1500000",
      obligations: [
        { id: "obl-1", fundingWalletId: sourceWalletId, amount: new Decimal("1000000"), paid: new Decimal("0"), postedDate: new Date("2026-07-20") },
        unbilledObligation,
      ],
    });

    const result = await createCreditCardPayment("user-1", "ws-1", {
      cardWalletId,
      target: "current_debt",
      date: "2026-08-10",
      sources: [{ walletId: sourceWalletId, amount: new Decimal("1500000") }],
    });

    expect(result.workflowStatus).toBe("approved");
    expect(result.creditCardStatementId).toBe(statementId);
    expect(tx.creditCardPaymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        { paymentTransactionId: "tx-pay-1", obligationEntryId: "obl-1", amount: new Decimal("1000000") },
        { paymentTransactionId: "tx-pay-1", obligationEntryId: "obl-2", amount: new Decimal("500000") },
      ],
    });
    expect(tx.creditCardStatement.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: statementId },
      data: expect.objectContaining({ status: "paid" }),
    }));
  });

  it("pays current debt mid-cycle when no statement has been issued yet", async () => {
    const tx = setupTx({
      hasStatement: false,
      cardBalance: "500000",
      obligations: [
        { id: "obl-1", fundingWalletId: sourceWalletId, amount: new Decimal("500000"), paid: new Decimal("0"), postedDate: new Date("2026-08-02") },
      ],
    });

    const result = await createCreditCardPayment("user-1", "ws-1", {
      cardWalletId,
      target: "current_debt",
      date: "2026-08-10",
      sources: [{ walletId: sourceWalletId, amount: new Decimal("500000") }],
    });

    expect(result.workflowStatus).toBe("approved");
    expect(result.creditCardStatementId).toBeNull();
    expect(tx.creditCardPaymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        { paymentTransactionId: "tx-pay-1", obligationEntryId: "obl-1", amount: new Decimal("500000") },
      ],
    });
    expect(mocks.applyBalance).toHaveBeenCalled();
  });

  it("rejects current debt payment if source amount exceeds wallet obligations", async () => {
    setupTx({
      hasStatement: false,
      cardBalance: "500000",
      obligations: [
        { id: "obl-1", fundingWalletId: sourceWalletId, amount: new Decimal("500000"), paid: new Decimal("0"), postedDate: new Date("2026-08-02") },
      ],
    });

    await expect(createCreditCardPayment("user-1", "ws-1", {
      cardWalletId,
      target: "current_debt",
      date: "2026-08-10",
      sources: [{ walletId: sourceWalletId, amount: new Decimal("600000") }],
    })).rejects.toThrow("Tổng số tiền thanh toán không hợp lệ.");
  });

  it("rejects current debt payment if card has zero debt", async () => {
    setupTx({
      hasStatement: false,
      cardBalance: "0",
      obligations: [],
    });

    await expect(createCreditCardPayment("user-1", "ws-1", {
      cardWalletId,
      target: "current_debt",
      date: "2026-08-10",
      sources: [{ walletId: sourceWalletId, amount: new Decimal("100000") }],
    })).rejects.toThrow("Thẻ không có dư nợ cần thanh toán.");
  });

  it("prioritizes non-installment obligations over unbilled active installment principal when paying current_debt", async () => {
    const tx = setupTx({
      hasStatement: false,
      cardBalance: "1500000",
      obligations: [],
    });
    tx.creditCardObligationEntry.findMany.mockResolvedValue([
      {
        id: "obl-installment-older",
        fundingWalletId: sourceWalletId,
        amount: new Decimal("1000000"),
        postedDate: new Date("2026-08-01"),
        paymentAllocations: [],
        statementItems: [],
        transaction: { installmentPlan: { id: "plan-1", status: "active" }, installmentFeePlan: null },
      },
      {
        id: "obl-regular-newer",
        fundingWalletId: sourceWalletId,
        amount: new Decimal("500000"),
        postedDate: new Date("2026-08-05"),
        paymentAllocations: [],
        statementItems: [],
        transaction: { installmentPlan: null, installmentFeePlan: null },
      },
    ]);

    await createCreditCardPayment("user-1", "ws-1", {
      cardWalletId,
      target: "current_debt",
      date: "2026-08-10",
      sources: [{ walletId: sourceWalletId, amount: new Decimal("700000") }],
    });

    expect(tx.creditCardPaymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        { paymentTransactionId: "tx-pay-1", obligationEntryId: "obl-regular-newer", amount: new Decimal("500000") },
        { paymentTransactionId: "tx-pay-1", obligationEntryId: "obl-installment-older", amount: new Decimal("200000") },
      ],
    });
  });
});
