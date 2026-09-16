import { describe, expect, it } from "vitest";

import { updateCreditCardSchema } from "@/domain/credit-card/schemas";

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
