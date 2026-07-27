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
});
