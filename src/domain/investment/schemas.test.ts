import { describe, expect, it } from "vitest";
import {
  createInvestmentTradeSchema,
  recordAssetPriceSchema,
  saveInvestmentLeafSchema,
} from "@/domain/investment/schemas";

const assetId = "11111111-1111-1111-1111-111111111111";
const walletId = "22222222-2222-2222-2222-222222222222";
const categoryId = "33333333-3333-3333-3333-333333333333";

describe("investment schemas", () => {
  it("accepts category-based purchases and converts financial inputs", () => {
    const parsed = createInvestmentTradeSchema.parse({
      categoryId,
      walletId,
      side: "buy",
      quantity: "0.5",
      executedUnitPrice: "10000000",
      marketUnitPrice: "9800000",
      date: "2026-07-29",
    });
    expect(parsed.quantity.toString()).toBe("0.5");
    expect(parsed.executedUnitPrice.toString()).toBe("10000000");
    expect(parsed.marketUnitPrice?.toString()).toBe("9800000");
  });

  it("rejects a purchase without an investment category", () => {
    const result = createInvestmentTradeSchema.safeParse({
      walletId,
      side: "buy",
      quantity: "10",
      executedUnitPrice: "15000",
      date: "2026-07-29",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes a configured investment leaf code", () => {
    const parsed = saveInvestmentLeafSchema.parse({
      parentId: categoryId,
      name: " 24K ",
      code: " gold_24k ",
      unit: "chỉ",
      status: "active",
    });

    expect(parsed.name).toBe("24K");
    expect(parsed.code).toBe("GOLD_24K");
    expect(parsed.unit).toBe("chỉ");
  });

  it("requires the asset and target lot when selling", () => {
    const result = createInvestmentTradeSchema.safeParse({
      assetId,
      walletId,
      side: "sell",
      quantity: "10",
      executedUnitPrice: "15000",
      date: "2026-07-29",
    });
    expect(result.success).toBe(false);
  });

  it("rejects ask prices below bid prices", () => {
    const result = recordAssetPriceSchema.safeParse({
      assetId,
      bidPrice: "13000000",
      askPrice: "12900000",
      priceAt: "2026-07-29T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
