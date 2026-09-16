import { describe, expect, it } from "vitest";

import { importCreditCardInstallmentSchema, updateCreditCardSchema } from "@/domain/credit-card/schemas";

const cardId = "d9428888-122b-4a4f-8893-8a6a3f691d22";
const walletId = "9946cb7b-1775-4a04-b1f9-04d85f25b39b";

describe("updateCreditCardSchema", () => {
  it("normalizes and converts a valid card update", () => {
    const value = updateCreditCardSchema.parse({
      cardWalletId: cardId,
      name: "  Visa chính  ",
      description: "Chi tiêu gia đình",
      creditLimit: "50000000",
      defaultFundingWalletId: walletId,
      statementClosingDay: 25,
      paymentDueDay: 10,
    });
    expect(value.name).toBe("Visa chính");
    expect(value.creditLimit.toString()).toBe("50000000");
  });

  it("rejects invalid statement days", () => {
    expect(() => updateCreditCardSchema.parse({
      cardWalletId: cardId,
      name: "Visa",
      creditLimit: "50000000",
      defaultFundingWalletId: walletId,
      statementClosingDay: 32,
      paymentDueDay: 0,
    })).toThrow();
  });
});

describe("importCreditCardInstallmentSchema", () => {
  const valid = {
    cardWalletId: cardId,
    description: "Điện thoại",
    termCount: 12,
    paidTermCount: 4,
    remainingAmount: "8000000",
    firstStatementDate: "2026-10-25",
    balanceMode: "included_opening_debt" as const,
    allocations: [{ walletId, amount: "8000000" }],
  };

  it("accepts an ongoing plan and converts money to Decimal", () => {
    const value = importCreditCardInstallmentSchema.parse(valid);
    expect(value.description).toBe("Điện thoại");
    expect(value.remainingAmount.toString()).toBe("8000000");
    expect(value.allocations[0].amount.toString()).toBe("8000000");
  });

  it("rejects a completed plan and mismatched allocations", () => {
    expect(importCreditCardInstallmentSchema.safeParse({
      ...valid,
      paidTermCount: 12,
    }).success).toBe(false);
    expect(importCreditCardInstallmentSchema.safeParse({
      ...valid,
      allocations: [{ walletId, amount: "7000000" }],
    }).success).toBe(false);
  });

  it("accepts non-standard imported terms while keeping them bounded", () => {
    expect(importCreditCardInstallmentSchema.safeParse({ ...valid, termCount: 10 }).success).toBe(true);
    expect(importCreditCardInstallmentSchema.safeParse({ ...valid, termCount: 61 }).success).toBe(false);
  });
});
