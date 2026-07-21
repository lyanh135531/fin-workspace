import { describe, expect, it } from "vitest";
import { createTransactionSchema } from "@/domain/transaction/schemas";

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
  it("accepts fixed system category identifiers", () => {
    expect(createTransactionSchema.parse({ walletId, categoryId: "00000000-0000-0000-0000-000000000201", type: "expense", amount: "10", date: "2026-07-17" }).categoryId).toBe("00000000-0000-0000-0000-000000000201");
  });

  it("always requires a transaction date", () => {
    expect(() => createTransactionSchema.parse({ walletId, type: "expense", amount: "10" })).toThrow();
  });
});
