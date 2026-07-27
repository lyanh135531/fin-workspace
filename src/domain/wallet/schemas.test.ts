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
    });
    expect("openingBalance" in result).toBe(false);
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
