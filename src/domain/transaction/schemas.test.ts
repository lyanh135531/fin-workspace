import { describe, expect, it } from "vitest";
import { createCreditCardRefundSchema, createTransactionSchema } from "@/domain/transaction/schemas";

const walletId = "00000000-0000-4000-8000-000000000001";
const otherWalletId = "00000000-0000-4000-8000-000000000002";

describe("createTransactionSchema", () => {
  it("converts a valid monetary string to Decimal", () => {
    const value = createTransactionSchema.parse({ walletId, type: "income", amount: "10.2500", date: "2026-07-17" });
    expect(value.amount.toFixed(4)).toBe("10.2500");
  });
  it("rejects a transfer without a destination wallet", () => {
    expect(() => createTransactionSchema.parse({ walletId, type: "transfer", amount: "10", date: "2026-07-17" })).toThrow();
  });
  it("rejects a transfer to the same wallet", () => {
    expect(() => createTransactionSchema.parse({ walletId, toWalletId: walletId, type: "transfer", amount: "10", date: "2026-07-17" })).toThrow();
  });
  it("rejects amounts beyond four decimal places", () => {
    expect(() => createTransactionSchema.parse({ walletId: otherWalletId, type: "expense", amount: "1.00001", date: "2026-07-17" })).toThrow();
  });
  it("accepts the largest amount supported by numeric(20,4)", () => {
    const value = createTransactionSchema.parse({ walletId, type: "income", amount: "9999999999999999.9999", date: "2026-07-17" });
    expect(value.amount.toFixed(4)).toBe("9999999999999999.9999");
  });
  it("rejects an amount that would overflow numeric(20,4)", () => {
    const result = createTransactionSchema.safeParse({ walletId, type: "income", amount: "10000000000000000", date: "2026-07-17" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Số tiền không được vượt quá 9.999.999.999.999.999,9999.",
      );
    }
  });
  it("accepts fixed system category identifiers", () => {
    expect(createTransactionSchema.parse({ walletId, categoryId: "00000000-0000-0000-0000-000000000201", type: "expense", amount: "10", date: "2026-07-17" }).categoryId).toBe("00000000-0000-0000-0000-000000000201");
  });

  it("requires a category for an expense", () => {
    const result = createTransactionSchema.safeParse({ walletId, type: "expense", amount: "10", date: "2026-07-17" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["categoryId"] }));
  });

  it("always requires a transaction date", () => {
    expect(() => createTransactionSchema.parse({ walletId, type: "expense", amount: "10" })).toThrow();
  });

  it("accepts wallet allocations for a credit-card expense", () => {
    const value = createTransactionSchema.parse({
      walletId,
      categoryId: "00000000-0000-0000-0000-000000000201",
      type: "expense",
      amount: "1500000",
      date: "2026-07-17",
      allocations: [
        { walletId, amount: "1000000" },
        { walletId: otherWalletId, amount: "500000" },
      ],
    });
    expect(value.allocations?.map((item) => item.amount.toString())).toEqual(["1000000", "500000"]);
  });

  it("rejects allocations on income", () => {
    expect(() => createTransactionSchema.parse({
      walletId,
      type: "income",
      amount: "10",
      date: "2026-07-17",
      allocations: [{ walletId: otherWalletId, amount: "10" }],
    })).toThrow();
  });
});

describe("createCreditCardRefundSchema", () => {
  it("accepts a refund entered directly against a credit card", () => {
    const value = createCreditCardRefundSchema.parse({
      cardWalletId: walletId,
      amount: "250000",
      date: "2026-09-11",
    });
    expect(value.cardWalletId).toBe(walletId);
    expect(value.amount.toString()).toBe("250000");
  });

  it("does not accept an original transaction as the refund target", () => {
    expect(() => createCreditCardRefundSchema.parse({
      originalTransactionId: walletId,
      amount: "250000",
      date: "2026-09-11",
    })).toThrow();
  });
});
