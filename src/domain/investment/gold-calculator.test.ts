import { describe, expect, it } from "vitest";
import {
  allocateGoldSaleCostBasis,
  calculateGoldHoldingValuation,
  convertGoldPriceToPerChi,
  convertGoldWeightToChi,
  formatGoldWeightVi,
} from "@/domain/investment/gold-calculator";

describe("gold-calculator", () => {
  it("converts Vietnamese gold units (Lượng / Chỉ / Phân) accurately", () => {
    expect(convertGoldWeightToChi("1.5", "luong").toFixed(4)).toBe("15.0000");
    expect(convertGoldWeightToChi("2.5", "chi").toFixed(4)).toBe("2.5000");
    expect(convertGoldPriceToPerChi("142600000", "luong").toFixed(0)).toBe(
      "14260000",
    );
    expect(convertGoldPriceToPerChi("14260000", "chi").toFixed(0)).toBe(
      "14260000",
    );
  });

  it("formats Vietnamese gold weights naturally", () => {
    expect(formatGoldWeightVi("15").primary).toBe("1 lượng 5 chỉ");
    expect(formatGoldWeightVi("12.5").primary).toBe("1 lượng 2 chỉ 5 phân");
    expect(formatGoldWeightVi("0.5").primary).toBe("5 phân");
    expect(formatGoldWeightVi("2").primary).toBe("2 chỉ");
  });

  it("calculates valuation and break-even price based on shop buyback price (Bid)", () => {
    // Mua 5 chỉ với tổng vốn 42.000.000đ (BQ 8.400.000đ/chỉ)
    // Giá tiệm mua vào hiện tại: 13.860.000đ/chỉ, bán ra: 14.260.000đ/chỉ
    const val = calculateGoldHoldingValuation({
      totalQuantityChi: "5",
      totalCostBasisAmount: "42000000",
      realizedProfitAmount: "1500000",
      marketBuybackPricePerChi: "13860000",
      marketSellPricePerChi: "14260000",
    });

    expect(val.averageCostPerChi).toBe("8400000");
    expect(val.breakEvenBuybackPricePerChi).toBe("8400000");
    expect(val.marketLiquidationValue).toBe("69300000");
    expect(val.unrealizedProfitAmount).toBe("27300000");
    expect(val.unrealizedProfitPct).toBe("65.00");
    expect(val.spreadPerChi).toBe("400000");
    expect(val.totalProfitAmount).toBe("28800000");
  });

  it("allocates cost basis using Weighted Average Cost (average_cost) and FIFO lot deduction", () => {
    const res = allocateGoldSaleCostBasis({
      costMode: "average_cost",
      sellQuantityChi: "3",
      sellPricePerChi: "13860000",
      feeOrDeductionAmount: "0",
      holdingQuantityChi: "5",
      holdingCostBasisAmount: "42000000",
      openLots: [
        {
          id: "lot-1",
          remainingQuantityChi: "2",
          remainingCostAmount: "16400000",
        },
        {
          id: "lot-2",
          remainingQuantityChi: "3",
          remainingCostAmount: "25600000",
        },
      ],
    });

    // Giá vốn của 3 chỉ bán ra theo BQ (8.4tr/chỉ) = 25.200.000đ
    expect(res.costBasisAllocatedAmount.toFixed(0)).toBe("25200000");
    expect(res.netProceedsAmount.toFixed(0)).toBe("41580000");
    expect(res.realizedProfitAmount.toFixed(0)).toBe("16380000");
    expect(res.nextHoldingQuantityChi.toFixed(4)).toBe("2.0000");
    expect(res.nextHoldingCostBasisAmount.toFixed(0)).toBe("16800000");
    expect(res.lotUpdates).toHaveLength(2);
    expect(res.lotUpdates[0]?.nextRemainingQuantityChi.toFixed(4)).toBe(
      "0.0000",
    );
    expect(res.lotUpdates[1]?.nextRemainingQuantityChi.toFixed(4)).toBe(
      "2.0000",
    );
  });

  it("allocates cost basis using Specific Lot (specific_lot)", () => {
    const res = allocateGoldSaleCostBasis({
      costMode: "specific_lot",
      targetLotId: "lot-2",
      sellQuantityChi: "1.5",
      sellPricePerChi: "14000000",
      feeOrDeductionAmount: "50000",
      holdingQuantityChi: "5",
      holdingCostBasisAmount: "42000000",
      openLots: [
        {
          id: "lot-1",
          remainingQuantityChi: "2",
          remainingCostAmount: "16400000",
        },
        {
          id: "lot-2",
          remainingQuantityChi: "3",
          remainingCostAmount: "25600000",
        },
      ],
    });

    // Bán 1.5 chỉ từ lot-2 (3 chỉ = 25.600.000đ -> 1.5 chỉ = 12.800.000đ)
    expect(res.costBasisAllocatedAmount.toFixed(0)).toBe("12800000");
    // Thu về: 1.5 * 14.000.000 - 50.000 = 20.950.000đ
    expect(res.netProceedsAmount.toFixed(0)).toBe("20950000");
    expect(res.realizedProfitAmount.toFixed(0)).toBe("8150000");
    expect(res.lotUpdates).toHaveLength(1);
    expect(res.lotUpdates[0]?.lotId).toBe("lot-2");
    expect(res.lotUpdates[0]?.nextRemainingQuantityChi.toFixed(4)).toBe(
      "1.5000",
    );
    expect(res.lotUpdates[0]?.nextRemainingCostAmount.toFixed(0)).toBe(
      "12800000",
    );
  });
});
