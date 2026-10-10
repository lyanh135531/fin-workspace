import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { refreshHistoricalCardStatements } from "@/services/credit-card-statement-service";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ env: { DATABASE_URL: "postgresql://test", APP_TIME_ZONE: "Asia/Ho_Chi_Minh" } }));

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
type Item = {
  id: string; statementId: string; obligationEntryId: string; fundingWalletId: string;
  amount: Decimal; isCarry: boolean; installmentId: string | null;
};
type Payment = {
  workflowStatus: "approved" | "pending"; deletedAt: Date | null;
  creditCardPaymentSources: Array<{ sourceWalletId: string; amount: Decimal }>;
};

function history() {
  let nextId = 0;
  const obligations = [{
    id: "purchase-1", fundingWalletId: "source-1", amount: new Decimal("100"), postedDate: date("2026-07-20"),
  }];
  const statements = ["07", "08", "09"].map((month) => ({
    id: `statement-${month}`, cycleStartDate: date(`2026-${month}-01`),
    cycleEndDate: date(`2026-${month}-${month === "09" ? "30" : "31"}`),
    totalAmount: new Decimal("100"), status: "paid" as "paid" | "issued", paidAt: date("2026-10-01"),
    payments: [] as Payment[],
  }));
  let items: Item[] = [{
    id: "original-item", statementId: "statement-07", obligationEntryId: "purchase-1", fundingWalletId: "source-1",
    amount: new Decimal("100"), isCarry: false, installmentId: null,
  }];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    creditCardProfile: {
      findFirst: vi.fn().mockImplementation(() => ({
        statementClosingDay: 31, paymentDueDay: 15,
        statements: [statements.at(-1)], obligations: [obligations[0]], installmentPlans: [],
      })),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ statementClosingDay: 31, paymentDueDay: 15 }),
    },
    creditCardObligationEntry: {
      findMany: vi.fn().mockImplementation(() => [...obligations].sort((a, b) => a.postedDate.getTime() - b.postedDate.getTime())),
    },
    creditCardStatement: {
      findFirst: vi.fn().mockImplementation(() => statements[0]),
      findMany: vi.fn().mockImplementation(() => statements.map((statement) => ({
        ...statement,
        items: items.filter((item) => item.statementId === statement.id && !item.isCarry),
        payments: statement.payments.filter((payment) => payment.workflowStatus === "approved" && !payment.deletedAt),
      }))),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const statement = statements.find((entry) => entry.id === where.id)!;
        Object.assign(statement, data);
        return statement;
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const statement = { id: `added-${++nextId}`, paidAt: null, payments: [], ...data };
        statements.push(statement);
        statements.sort((a, b) => a.cycleEndDate.getTime() - b.cycleEndDate.getTime());
        return statement;
      }),
    },
    creditCardStatementItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockImplementation(({ where }) => {
        items = items.filter((item) => !item.isCarry && !(where.OR[1].obligationEntryId.in.includes(item.obligationEntryId) && item.installmentId === null));
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const item = { id: `item-${++nextId}`, isCarry: false, installmentId: null, ...data };
        items.push(item);
        return item;
      }),
    },
    creditCardInstallmentPlan: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const refresh = () => refreshHistoricalCardStatements(tx as unknown as Prisma.TransactionClient, "workspace-1", "card-1", "2026-09-30");
  const pay = (amount: string, status: Payment["workflowStatus"] = "approved", deletedAt: Date | null = null) => {
    statements[0].payments.push({
      workflowStatus: status, deletedAt,
      creditCardPaymentSources: [{ sourceWalletId: "source-1", amount: new Decimal(amount) }],
    });
  };
  return { tx, obligations, statements, refresh, pay, items: () => items };
}

describe("historical credit card billing", () => {
  it("puts a backdated purchase into its original cycle and updates carry to every later cycle", async () => {
    const state = history();
    state.obligations.push({ id: "late-entry", fundingWalletId: "source-1", amount: new Decimal("25.0001"), postedDate: date("2026-07-31") });
    await state.refresh();
    expect(state.statements.map((statement) => statement.totalAmount.toString())).toEqual(["125.0001", "125.0001", "125.0001"]);
    expect(state.items().filter((item) => item.obligationEntryId === "late-entry" && !item.isCarry).map((item) => item.statementId)).toEqual(["statement-07"]);
    expect(state.statements.at(-1)?.status).toBe("issued");
  });

  it("adds only the unpaid difference after a historical paid purchase increases", async () => {
    const state = history();
    state.pay("100");
    state.obligations[0].amount = new Decimal("150");
    await state.refresh();
    expect(state.statements.map((statement) => statement.totalAmount.toString())).toEqual(["150", "50", "50"]);
    expect(state.statements[0].payments[0].creditCardPaymentSources[0].amount.toString()).toBe("100");
  });

  it("restores carry across later periods when an earlier payment is deleted", async () => {
    const state = history();
    state.pay("100");
    state.obligations[0].amount = new Decimal("150");
    await state.refresh();
    expect(state.statements.at(-1)?.totalAmount.toString()).toBe("50");
    state.statements[0].payments[0].deletedAt = date("2026-10-01");
    await state.refresh();
    expect(state.statements.map((statement) => statement.totalAmount.toString())).toEqual(["150", "150", "150"]);
  });

  it("retains overpayment as credit after a paid purchase decreases", async () => {
    const state = history();
    state.pay("100");
    state.obligations[0].amount = new Decimal("60");
    state.obligations.push({ id: "august-purchase", fundingWalletId: "source-1", amount: new Decimal("50"), postedDate: date("2026-08-01") });
    await state.refresh();
    expect(state.statements.map((statement) => statement.totalAmount.toString())).toEqual(["60", "10", "10"]);
    expect(state.items().find((item) => item.statementId === "statement-08" && item.isCarry)?.amount.toString()).toBe("-40");
  });

  it("moves the purchase between cycles when its posting date changes", async () => {
    const state = history();
    state.obligations[0].postedDate = date("2026-08-01");
    await state.refresh();
    expect(state.statements.map((statement) => statement.totalAmount.toString())).toEqual(["0", "100", "100"]);
    expect(state.items().find((item) => !item.isCarry)?.statementId).toBe("statement-08");
  });

  it("keeps credits and debt separate for different funding wallets", async () => {
    const state = history();
    state.pay("100");
    state.obligations[0].amount = new Decimal(0);
    state.obligations.push({ id: "replacement", fundingWalletId: "source-2", amount: new Decimal("150"), postedDate: date("2026-07-20") });
    await state.refresh();
    expect(state.statements.at(-1)?.totalAmount.toString()).toBe("150");
    expect(state.items().filter((item) => item.statementId === "statement-09").map((item) => [item.fundingWalletId, item.amount.toString()]))
      .toEqual([["source-1", "-100"], ["source-2", "150"]]);
  });

  it("creates missing cycles when a transaction predates the first statement", async () => {
    const state = history();
    state.obligations[0].postedDate = date("2026-06-10");
    await state.refresh();
    expect(state.statements[0].cycleEndDate).toEqual(date("2026-06-30"));
    expect(state.items().find((item) => !item.isCarry)?.statementId).toBe(state.statements[0].id);
    expect(state.statements.map((statement) => statement.totalAmount.toString())).toEqual(["100", "100", "100", "100"]);
  });

  it("does not include pending or deleted payments in paid totals", async () => {
    const state = history();
    state.pay("100", "pending");
    state.pay("100", "approved", date("2026-10-01"));
    await state.refresh();
    expect(state.statements.at(-1)?.totalAmount.toString()).toBe("100");
    expect(state.statements.at(-1)?.status).toBe("issued");
    expect(state.tx.creditCardStatement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-1", cardWalletId: "card-1" },
    }));
  });

  it("is idempotent and leaves open-cycle purchases outside issued statements", async () => {
    const state = history();
    state.obligations.push({ id: "open-cycle", fundingWalletId: "source-1", amount: new Decimal("30"), postedDate: date("2026-10-01") });
    await state.refresh();
    const snapshot = () => state.items().map((item) => [item.statementId, item.obligationEntryId, item.fundingWalletId, item.amount.toString(), item.isCarry]);
    const original = snapshot();
    await state.refresh();
    expect(snapshot()).toEqual(original);
    expect(state.items().some((item) => item.obligationEntryId === "open-cycle")).toBe(false);
  });
});
