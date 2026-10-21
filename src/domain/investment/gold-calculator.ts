import Decimal from "decimal.js";

const ZERO = new Decimal(0);
const TEN = new Decimal(10);
const HUNDRED = new Decimal(100);

export type GoldWeightUnit = "chi" | "luong";

export type GoldBrandQuoteDefinition = {
  providerCode: string;
  brandName: string;
  productLabel: string;
  shortLabel: string;
  productType: "sjc_bar" | "ring_9999" | "jewelry_24k" | "jewelry_18k" | "other";
  defaultBuyPricePerChi: string;
  defaultSellPricePerChi: string;
};

export const GOLD_BRAND_QUOTES: readonly GoldBrandQuoteDefinition[] = [
  {
    providerCode: "BT9999NTT",
    brandName: "Bảo Tín Minh Châu",
    productLabel: "Nhẫn tròn trơn 9999 (VRTL)",
    shortLabel: "BTMC Nhẫn tròn trơn 9999",
    productType: "ring_9999",
    defaultBuyPricePerChi: "13860000",
    defaultSellPricePerChi: "14260000",
  },
  {
    providerCode: "SJL1L10",
    brandName: "SJC",
    productLabel: "Vàng miếng SJC 9999 (1L - 10L)",
    shortLabel: "Vàng miếng SJC 9999",
    productType: "sjc_bar",
    defaultBuyPricePerChi: "13960000",
    defaultSellPricePerChi: "14260000",
  },
  {
    providerCode: "SJ9999",
    brandName: "SJC",
    productLabel: "Vàng nhẫn SJC 9999 (Ép vỉ)",
    shortLabel: "Vàng nhẫn SJC 9999",
    productType: "ring_9999",
    defaultBuyPricePerChi: "13770000",
    defaultSellPricePerChi: "14120000",
  },
  {
    providerCode: "DOJINHTV",
    brandName: "DOJI",
    productLabel: "Nhẫn tròn 9999 Hưng Thịnh Vượng",
    shortLabel: "DOJI Nhẫn Hưng Thịnh Vượng 9999",
    productType: "ring_9999",
    defaultBuyPricePerChi: "13850000",
    defaultSellPricePerChi: "14250000",
  },
  {
    providerCode: "PQHN24NTT",
    brandName: "PNJ / Phú Quý",
    productLabel: "Nhẫn tròn trơn 24K (9999)",
    shortLabel: "PNJ / Phú Quý Nhẫn 24K 9999",
    productType: "ring_9999",
    defaultBuyPricePerChi: "13900000",
    defaultSellPricePerChi: "14200000",
  },
  {
    providerCode: "BTSJC",
    brandName: "Bảo Tín Minh Châu",
    productLabel: "Vàng miếng SJC tại BTMC",
    shortLabel: "BTMC Vàng miếng SJC",
    productType: "sjc_bar",
    defaultBuyPricePerChi: "13860000",
    defaultSellPricePerChi: "14260000",
  },
  {
    providerCode: "DOHNL",
    brandName: "DOJI Hà Nội",
    productLabel: "Vàng miếng SJC tại DOJI Hà Nội",
    shortLabel: "DOJI HN Vàng miếng SJC",
    productType: "sjc_bar",
    defaultBuyPricePerChi: "13960000",
    defaultSellPricePerChi: "14260000",
  },
  {
    providerCode: "DOHCML",
    brandName: "DOJI TP.HCM",
    productLabel: "Vàng miếng SJC tại DOJI TP.HCM",
    shortLabel: "DOJI HCM Vàng miếng SJC",
    productType: "sjc_bar",
    defaultBuyPricePerChi: "13960000",
    defaultSellPricePerChi: "14260000",
  },
  {
    providerCode: "PQHNVM",
    brandName: "PNJ / Phú Quý",
    productLabel: "Vàng miếng SJC tại PNJ / Phú Quý",
    shortLabel: "PNJ / Phú Quý Vàng miếng SJC",
    productType: "sjc_bar",
    defaultBuyPricePerChi: "13900000",
    defaultSellPricePerChi: "14260000",
  },
  {
    providerCode: "VIETTINMSJC",
    brandName: "VietinBank Gold",
    productLabel: "Vàng miếng SJC VietinBank",
    shortLabel: "VietinBank Vàng miếng SJC",
    productType: "sjc_bar",
    defaultBuyPricePerChi: "13960000",
    defaultSellPricePerChi: "14260000",
  },
] as const;

export const GOLD_PRODUCT_TYPE_LABELS: Record<
  "sjc_bar" | "ring_9999" | "jewelry_24k" | "jewelry_18k" | "other",
  string
> = {
  sjc_bar: "Vàng miếng SJC 9999",
  ring_9999: "Vàng nhẫn tròn trơn 9999",
  jewelry_24k: "Vàng trang sức 24K (999)",
  jewelry_18k: "Vàng trang sức 18K (750)",
  other: "Vàng tích sản khác",
};

export function findGoldBrandQuoteDefinition(providerCode?: string | null) {
  if (!providerCode) return null;
  return (
    GOLD_BRAND_QUOTES.find((item) => item.providerCode === providerCode) ?? null
  );
}

/**
 * Quy đổi khối lượng nhập từ người dùng (`chỉ` hoặc `lượng`) về đơn vị chuẩn `Chỉ`.
 * Quy ước Việt Nam: 1 lượng (cây) = 10 chỉ = 100 phân.
 */
export function convertGoldWeightToChi(
  value: Decimal.Value,
  unit: GoldWeightUnit,
): Decimal {
  const numeric = new Decimal(value || 0);
  if (numeric.lte(0)) return ZERO;
  return unit === "luong" ? numeric.mul(TEN) : numeric;
}

/**
 * Quy đổi đơn giá nhập từ người dùng (`đ/chỉ` hoặc `đ/lượng`) về đơn giá chuẩn `đ/chỉ`.
 */
export function convertGoldPriceToPerChi(
  price: Decimal.Value,
  unit: GoldWeightUnit,
): Decimal {
  const numeric = new Decimal(price || 0);
  if (numeric.lte(0)) return ZERO;
  return unit === "luong" ? numeric.div(TEN) : numeric;
}

/**
 * Định dạng số chỉ vàng theo cách gọi truyền thống tại Việt Nam:
 * VD:
 * - 10 chỉ -> "1 lượng (10 chỉ)"
 * - 15 chỉ -> "1 lượng 5 chỉ (15 chỉ)"
 * - 12.5 chỉ -> "1 lượng 2 chỉ 5 phân (12,5 chỉ)"
 * - 2 chỉ -> "2 chỉ"
 * - 0.5 chỉ -> "5 phân (0,5 chỉ)"
 */
export function formatGoldWeightVi(quantityChiInput: Decimal.Value): {
  primary: string;
  chiText: string;
  luongText: string;
  fullText: string;
} {
  const chi = Decimal.max(new Decimal(quantityChiInput || 0), ZERO);
  const rawChiStr = chi
    .toDecimalPlaces(4)
    .toNumber()
    .toLocaleString("vi-VN", { maximumFractionDigits: 4 });
  const rawLuongStr = chi
    .div(TEN)
    .toDecimalPlaces(4)
    .toNumber()
    .toLocaleString("vi-VN", { maximumFractionDigits: 4 });

  if (chi.isZero()) {
    return {
      primary: "0 chỉ",
      chiText: "0 chỉ",
      luongText: "0 lượng",
      fullText: "0 chỉ",
    };
  }

  const totalPhan = chi.mul(TEN).toDecimalPlaces(2);
  const luongInt = chi.divToInt(TEN);
  const remAfterLuongChi = chi.minus(luongInt.mul(TEN));
  const chiInt = remAfterLuongChi.floor();
  const phanVal = remAfterLuongChi.minus(chiInt).mul(TEN).toDecimalPlaces(2);

  const parts: string[] = [];
  if (luongInt.gt(0)) {
    parts.push(`${luongInt.toFixed(0)} lượng`);
  }
  if (chiInt.gt(0)) {
    parts.push(`${chiInt.toFixed(0)} chỉ`);
  }
  if (phanVal.gt(0)) {
    const phanFormatted = phanVal
      .toNumber()
      .toLocaleString("vi-VN", { maximumFractionDigits: 2 });
    parts.push(`${phanFormatted} phân`);
  }

  const primary =
    parts.length > 0
      ? parts.join(" ")
      : `${totalPhan.toNumber().toLocaleString("vi-VN")} phân`;

  const chiText = `${rawChiStr} chỉ`;
  const luongText = `${rawLuongStr} lượng`;
  const fullText =
    luongInt.gt(0) || phanVal.gt(0) ? `${primary} (${chiText})` : chiText;

  return {
    primary,
    chiText,
    luongText,
    fullText,
  };
}

export type GoldHoldingValuationInput = {
  totalQuantityChi: Decimal.Value;
  totalCostBasisAmount: Decimal.Value;
  realizedProfitAmount: Decimal.Value;
  marketBuybackPricePerChi: Decimal.Value;
  marketSellPricePerChi: Decimal.Value;
};

export type GoldHoldingValuationResult = {
  totalQuantityChi: string;
  totalCostBasisAmount: string;
  averageCostPerChi: string;
  averageCostPerLuong: string;
  breakEvenBuybackPricePerChi: string;
  marketBuybackPricePerChi: string;
  marketSellPricePerChi: string;
  spreadPerChi: string;
  spreadPerLuong: string;
  marketLiquidationValue: string;
  unrealizedProfitAmount: string;
  unrealizedProfitPct: string;
  realizedProfitAmount: string;
  totalProfitAmount: string;
};

export function calculateGoldHoldingValuation(
  input: GoldHoldingValuationInput,
): GoldHoldingValuationResult {
  const quantityChi = Decimal.max(new Decimal(input.totalQuantityChi || 0), ZERO);
  const costBasis = Decimal.max(
    new Decimal(input.totalCostBasisAmount || 0),
    ZERO,
  );
  const realizedProfit = new Decimal(input.realizedProfitAmount || 0);
  const buybackPricePerChi = Decimal.max(
    new Decimal(input.marketBuybackPricePerChi || 0),
    ZERO,
  );
  const sellPricePerChi = Decimal.max(
    new Decimal(input.marketSellPricePerChi || 0),
    buybackPricePerChi,
  );

  const averageCostPerChi = quantityChi.gt(0)
    ? costBasis.div(quantityChi).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    : ZERO;
  const averageCostPerLuong = averageCostPerChi.mul(TEN);

  const marketLiquidationValue = quantityChi
    .mul(buybackPricePerChi)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const unrealizedProfit = quantityChi.gt(0)
    ? marketLiquidationValue.minus(costBasis)
    : ZERO;
  const unrealizedProfitPct =
    quantityChi.gt(0) && costBasis.gt(0)
      ? unrealizedProfit.div(costBasis).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;

  const spreadPerChi = Decimal.max(
    sellPricePerChi.minus(buybackPricePerChi),
    ZERO,
  );
  const totalProfit = realizedProfit.plus(unrealizedProfit);

  return {
    totalQuantityChi: quantityChi.toFixed(4),
    totalCostBasisAmount: costBasis.toFixed(0),
    averageCostPerChi: averageCostPerChi.toFixed(0),
    averageCostPerLuong: averageCostPerLuong.toFixed(0),
    breakEvenBuybackPricePerChi: averageCostPerChi.toFixed(0),
    marketBuybackPricePerChi: buybackPricePerChi.toFixed(0),
    marketSellPricePerChi: sellPricePerChi.toFixed(0),
    spreadPerChi: spreadPerChi.toFixed(0),
    spreadPerLuong: spreadPerChi.mul(TEN).toFixed(0),
    marketLiquidationValue: marketLiquidationValue.toFixed(0),
    unrealizedProfitAmount: unrealizedProfit.toFixed(0),
    unrealizedProfitPct: unrealizedProfitPct.toFixed(2),
    realizedProfitAmount: realizedProfit.toFixed(0),
    totalProfitAmount: totalProfit.toFixed(0),
  };
}

export type GoldLotSlice = {
  id: string;
  remainingQuantityChi: Decimal.Value;
  remainingCostAmount: Decimal.Value;
};

export type GoldSaleAllocationResult = {
  grossProceedsAmount: Decimal;
  netProceedsAmount: Decimal;
  costBasisAllocatedAmount: Decimal;
  realizedProfitAmount: Decimal;
  nextHoldingQuantityChi: Decimal;
  nextHoldingCostBasisAmount: Decimal;
  lotUpdates: Array<{
    lotId: string;
    nextRemainingQuantityChi: Decimal;
    nextRemainingCostAmount: Decimal;
  }>;
};

/**
 * Phân bổ giá vốn khi bán vàng (hỗ trợ cả 2 chế độ:
 * - `average_cost`: Tính theo Giá vốn bình quân gia quyền của toàn bộ vị thế và trừ tồn kho các lô theo FIFO
 * - `specific_lot`: Bán đích danh từ 1 lô cụ thể (`targetLotId`), tính giá vốn theo đúng lô đó
 * )
 */
export function allocateGoldSaleCostBasis(params: {
  costMode: "average_cost" | "specific_lot";
  sellQuantityChi: Decimal.Value;
  sellPricePerChi: Decimal.Value;
  feeOrDeductionAmount?: Decimal.Value;
  holdingQuantityChi: Decimal.Value;
  holdingCostBasisAmount: Decimal.Value;
  openLots: GoldLotSlice[];
  targetLotId?: string | null;
}): GoldSaleAllocationResult {
  const sellQty = new Decimal(params.sellQuantityChi);
  const sellPrice = new Decimal(params.sellPricePerChi);
  const fee = Decimal.max(new Decimal(params.feeOrDeductionAmount || 0), ZERO);
  const holdingQty = new Decimal(params.holdingQuantityChi);
  const holdingCost = new Decimal(params.holdingCostBasisAmount);

  if (sellQty.lte(0)) {
    throw new Error("Khối lượng vàng bán ra phải lớn hơn 0.");
  }
  if (sellQty.gt(holdingQty)) {
    throw new Error("Khối lượng vàng bán ra vượt quá số lượng đang nắm giữ.");
  }

  const grossProceeds = sellQty
    .mul(sellPrice)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const netProceeds = Decimal.max(grossProceeds.minus(fee), ZERO);

  if (params.costMode === "specific_lot") {
    const targetLot = params.openLots.find(
      (lot) => lot.id === params.targetLotId,
    );
    if (!targetLot) {
      throw new Error("Không tìm thấy lô vàng đã chọn để bán.");
    }
    const lotRemQty = new Decimal(targetLot.remainingQuantityChi);
    const lotRemCost = new Decimal(targetLot.remainingCostAmount);
    if (sellQty.gt(lotRemQty)) {
      throw new Error("Số chỉ bán vượt quá số lượng còn lại trong lô đã chọn.");
    }

    const isFullLot = sellQty.eq(lotRemQty);
    const costAllocated = isFullLot
      ? lotRemCost
      : lotRemCost
          .mul(sellQty)
          .div(lotRemQty)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    const nextLotQty = Decimal.max(lotRemQty.minus(sellQty), ZERO);
    const nextLotCost = Decimal.max(lotRemCost.minus(costAllocated), ZERO);
    const nextHoldingQty = Decimal.max(holdingQty.minus(sellQty), ZERO);
    const nextHoldingCost = nextHoldingQty.isZero()
      ? ZERO
      : Decimal.max(holdingCost.minus(costAllocated), ZERO);

    return {
      grossProceedsAmount: grossProceeds,
      netProceedsAmount: netProceeds,
      costBasisAllocatedAmount: costAllocated,
      realizedProfitAmount: netProceeds.minus(costAllocated),
      nextHoldingQuantityChi: nextHoldingQty,
      nextHoldingCostBasisAmount: nextHoldingCost,
      lotUpdates: [
        {
          lotId: targetLot.id,
          nextRemainingQuantityChi: nextLotQty,
          nextRemainingCostAmount: nextLotCost,
        },
      ],
    };
  }

  // Chế độ mặc định: Giá vốn bình quân gia quyền (`average_cost`)
  const isFullHolding = sellQty.eq(holdingQty);
  const costAllocated = isFullHolding
    ? holdingCost
    : holdingCost
        .mul(sellQty)
        .div(holdingQty)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  let remainingToDeductQty = sellQty;
  const lotUpdates: Array<{
    lotId: string;
    nextRemainingQuantityChi: Decimal;
    nextRemainingCostAmount: Decimal;
  }> = [];

  for (const lot of params.openLots) {
    if (remainingToDeductQty.lte(0)) break;
    const lotRemQty = new Decimal(lot.remainingQuantityChi);
    const lotRemCost = new Decimal(lot.remainingCostAmount);
    if (lotRemQty.lte(0)) continue;

    const deductQty = Decimal.min(lotRemQty, remainingToDeductQty);
    const deductCost = deductQty.eq(lotRemQty)
      ? lotRemCost
      : lotRemCost
          .mul(deductQty)
          .div(lotRemQty)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    lotUpdates.push({
      lotId: lot.id,
      nextRemainingQuantityChi: Decimal.max(lotRemQty.minus(deductQty), ZERO),
      nextRemainingCostAmount: Decimal.max(lotRemCost.minus(deductCost), ZERO),
    });
    remainingToDeductQty = remainingToDeductQty.minus(deductQty);
  }

  const nextHoldingQty = Decimal.max(holdingQty.minus(sellQty), ZERO);
  const nextHoldingCost = nextHoldingQty.isZero()
    ? ZERO
    : Decimal.max(holdingCost.minus(costAllocated), ZERO);

  return {
    grossProceedsAmount: grossProceeds,
    netProceedsAmount: netProceeds,
    costBasisAllocatedAmount: costAllocated,
    realizedProfitAmount: netProceeds.minus(costAllocated),
    nextHoldingQuantityChi: nextHoldingQty,
    nextHoldingCostBasisAmount: nextHoldingCost,
    lotUpdates,
  };
}
