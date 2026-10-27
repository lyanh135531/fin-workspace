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
    expect(res.lotUpdates[0]?.nextRemainingCostAmount.toFixed(0)).toBe("0");
    expect(res.lotUpdates[1]?.nextRemainingQuantityChi.toFixed(4)).toBe(
      "2.0000",
    );
    expect(res.lotUpdates[1]?.nextRemainingCostAmount.toFixed(0)).toBe(
      "16800000",
    );
  });

  it("rebalances surviving open lots pro-rata with exact VND remainder on the last open lot", () => {
    const res = allocateGoldSaleCostBasis({
      costMode: "average_cost",
      sellQuantityChi: "1",
      sellPricePerChi: "20000000",
      feeOrDeductionAmount: "0",
      holdingQuantityChi: "3",
      holdingCostBasisAmount: "55000000",
      openLots: [
        { id: "lot-1", remainingQuantityChi: "1", remainingCostAmount: "10000000" },
        { id: "lot-2", remainingQuantityChi: "1", remainingCostAmount: "20000000" },
        { id: "lot-3", remainingQuantityChi: "1", remainingCostAmount: "25000000" },
      ],
    });

    // costAllocated = round(55,000,000 * 1 / 3) = 18,333,333 -> nextHoldingCost = 36,666,667
    expect(res.costBasisAllocatedAmount.toFixed(0)).toBe("18333333");
    expect(res.nextHoldingCostBasisAmount.toFixed(0)).toBe("36666667");
    expect(res.lotUpdates).toHaveLength(3);
    expect(res.lotUpdates[0]?.nextRemainingCostAmount.toFixed(0)).toBe("0");
    expect(res.lotUpdates[1]?.nextRemainingCostAmount.toFixed(0)).toBe("18333334");
    expect(res.lotUpdates[2]?.nextRemainingCostAmount.toFixed(0)).toBe("18333333");
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

  it("clamps specific_lot costAllocated to holdingCost when selling final remaining gold or after prior average_cost sale", () => {
    // Giả sử trước đó mua Lot 1 (1 chỉ @ 10tr) và Lot 2 (1 chỉ @ 20tr) -> tổng vốn 30tr.
    // Đã bán 1 chỉ theo average_cost (vốn phân bổ 15tr, trừ FIFO hết Lot 1).
    // Còn lại 1 chỉ ở Lot 2 (lotRemCost = 20tr) nhưng holdingCostBasisAmount = 15tr.
    const partialRes = allocateGoldSaleCostBasis({
      costMode: "specific_lot",
      targetLotId: "lot-2",
      sellQuantityChi: "0.9",
      sellPricePerChi: "22000000",
      feeOrDeductionAmount: "0",
      holdingQuantityChi: "1",
      holdingCostBasisAmount: "15000000",
      openLots: [
        {
          id: "lot-2",
          remainingQuantityChi: "1",
          remainingCostAmount: "20000000",
        },
      ],
    });

    // rawCostAllocated = 18tr > holdingCost (15tr) -> clamp về 15tr
    expect(partialRes.costBasisAllocatedAmount.toFixed(0)).toBe("15000000");
    expect(partialRes.nextHoldingCostBasisAmount.toFixed(0)).toBe("0");

    // Nếu bán hết 1 chỉ còn lại khi holdingCost (20tr) > lotRemCost (15tr)
    const fullRemainingRes = allocateGoldSaleCostBasis({
      costMode: "specific_lot",
      targetLotId: "lot-2",
      sellQuantityChi: "1",
      sellPricePerChi: "22000000",
      feeOrDeductionAmount: "0",
      holdingQuantityChi: "1",
      holdingCostBasisAmount: "20000000",
      openLots: [
        {
          id: "lot-2",
          remainingQuantityChi: "1",
          remainingCostAmount: "15000000",
        },
      ],
    });

    expect(fullRemainingRes.costBasisAllocatedAmount.toFixed(0)).toBe(
      "20000000",
    );
    expect(fullRemainingRes.nextHoldingQuantityChi.toFixed(4)).toBe("0.0000");
    expect(fullRemainingRes.nextHoldingCostBasisAmount.toFixed(0)).toBe("0");
    expect(
      fullRemainingRes.lotUpdates[0]?.nextRemainingCostAmount.toFixed(0),
    ).toBe("0");
  });
});
