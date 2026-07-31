import { describe, expect, it } from "vitest";
import {
  calculateLotMetrics,
  calculateGoldResaleSpreadPercent,
  calculatePurchaseAdjustment,
  calculateTradeCashAmount,
} from "@/domain/investment/metrics";

describe("investment metrics", () => {
  it("uses the market sell price to calculate the purchase adjustment", () => {
    const adjustment = calculatePurchaseAdjustment({
      actualPurchaseUnitPrice: "12000000",
      marketSellUnitPrice: "11000000",
    });

    expect(adjustment.ratio.toString()).toBe("1.0909090909");
    expect(adjustment.percent.toString()).toBe("9.09090909");
  });

  it("applies a proportional adjustment for automatic non-gold assets", () => {
    const metrics = calculateLotMetrics({
      remainingQuantity: "8",
      remainingCost: "88000000",
      currentMarketUnitPrice: "13334423",
      purchaseAdjustmentRatio: "1.05",
    });

    expect(metrics.adjustedUnitPrice?.toString()).toBe("14001144.15");
    expect(metrics.marketValue?.toString()).toBe("112009153.2");
    expect(metrics.unrealizedProfit?.toString()).toBe("24009153.2");
    expect(metrics.unrealizedReturnPercent?.toString()).toBe("27.2831");
  });

  it("uses the manual market buy price directly for manually priced assets", () => {
    const metrics = calculateLotMetrics({
      remainingQuantity: "1",
      remainingCost: "4250000",
      currentMarketUnitPrice: "5000000",
      purchaseAdjustmentRatio: "0.85",
      pricingMode: "manual",
    });

    expect(metrics.adjustedUnitPrice?.toString()).toBe("5000000");
    expect(metrics.marketValue?.toString()).toBe("5000000");
    expect(metrics.unrealizedProfit?.toString()).toBe("750000");
    expect(metrics.unrealizedReturnPercent?.toString()).toBe("17.6471");
  });

  it("derives the gold resale spread from the original purchase deviation", () => {
    const referenceSellPrice = "12932726.5";
    const cases = [
      { purchase: "14080000", spread: "1.30522545225", sell: "13896224.2558" },
      { purchase: "13200000", spread: "2.240836360625", sell: "12904209.6007" },
      { purchase: "9100000", spread: "6.599932643375", sell: "8499406.1289" },
    ];

    for (const item of cases) {
      const ratio = calculatePurchaseAdjustment({
        actualPurchaseUnitPrice: item.purchase,
        marketSellUnitPrice: referenceSellPrice,
      }).ratio;
      expect(calculateGoldResaleSpreadPercent(ratio).toString())
        .toBe(item.spread);
      const metrics = calculateLotMetrics({
        remainingQuantity: "1",
        remainingCost: item.purchase,
        currentMarketUnitPrice: referenceSellPrice,
        purchaseAdjustmentRatio: ratio,
        pricingMode: "gold_dynamic_spread",
      });
      expect(metrics.adjustedUnitPrice?.toString()).toBe(item.sell);
    }
  });

  it("keeps metrics unavailable when a holding has no live price", () => {
    const metrics = calculateLotMetrics({
      remainingQuantity: "3",
      remainingCost: "33000000",
    });

    expect(metrics.marketValue).toBeNull();
    expect(metrics.unrealizedProfit).toBeNull();
    expect(metrics.unrealizedReturnPercent).toBeNull();
  });

  it("calculates trade cash as quantity multiplied by executed price", () => {
    expect(calculateTradeCashAmount({
      quantity: "0.5",
      executedUnitPrice: "10000000",
    }).cashAmount.toString()).toBe("5000000");

    expect(calculateTradeCashAmount({
      quantity: "0.5",
      executedUnitPrice: "11085000",
    }).cashAmount.toString()).toBe("5542500");
  });
});
