import { describe, expect, it } from "vitest";
import { createWalletSchema } from "@/domain/wallet/schemas";

describe("wallet schemas", () => {
  it("does not accept an opening balance from wallet creation input", () => {
    const result = createWalletSchema.parse({
      name: "  Tiền mặt  ",
      description: "Chi tiêu hằng ngày",
      openingBalance: "1000000",
    });

    expect(result).toEqual({
      name: "Tiền mặt",
      description: "Chi tiêu hằng ngày",
      kind: "asset",
      assetSubtype: "other",
    });
    expect("openingBalance" in result).toBe(false);
  });

  it("accepts a credit card and requires opening debt allocation to balance", () => {
    const fundingWalletId = "00000000-0000-4000-8000-000000000010";
    const result = createWalletSchema.parse({
      name: "Thẻ gia đình",
      kind: "credit_card",
      creditCard: {
        creditLimit: "50000000",
        defaultFundingWalletId: fundingWalletId,
        openingDebt: "1200000",
        openingAllocations: [{ walletId: fundingWalletId, amount: "1200000" }],
      },
    });
    expect(result.kind).toBe("credit_card");
    expect(result.creditCard?.openingDebt.toString()).toBe("1200000");
  });

  it("rejects an unbalanced opening debt allocation", () => {
    const fundingWalletId = "00000000-0000-4000-8000-000000000010";
    expect(() => createWalletSchema.parse({
      name: "Thẻ gia đình",
      kind: "credit_card",
      creditCard: {
        creditLimit: "50000000",
        defaultFundingWalletId: fundingWalletId,
        openingDebt: "1200000",
        openingAllocations: [{ walletId: fundingWalletId, amount: "1000000" }],
      },
    })).toThrow();
  });

  it("allows opening debt to use the default funding wallet implicitly", () => {
    const result = createWalletSchema.parse({
      name: "Thẻ cá nhân",
      kind: "credit_card",
      creditCard: {
        creditLimit: "50000000",
        defaultFundingWalletId: "00000000-0000-4000-8000-000000000010",
        openingDebt: "1200000",
      },
    });
    expect(result.creditCard?.openingAllocations).toEqual([]);
  });

  it("accepts zero for the default income flow", () => {
    const result = createWalletSchema.parse({
      name: "Ví mới",
      funding: { type: "income", amount: "0" },
    });

    expect(result.funding?.type).toBe("income");
    expect(result.funding?.amount.toString()).toBe("0");
  });

  it("requires a positive amount for transfer funding", () => {
    expect(() => createWalletSchema.parse({
      name: "Ví mới",
      funding: {
        type: "transfer",
        amount: "0",
        sourceWalletId: "11111111-1111-1111-1111-111111111111",
      },
    })).toThrow();
  });
});
