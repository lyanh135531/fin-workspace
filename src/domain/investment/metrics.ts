import Decimal from "decimal.js";

export type LotMetricInput = {
  remainingQuantity: Decimal.Value;
  remainingCost: Decimal.Value;
  currentMarketUnitPrice?: Decimal.Value | null;
  purchaseAdjustmentRatio?: Decimal.Value;
  pricingMode?: "manual" | "proportional" | "gold_dynamic_spread";
};

const GOLD_RESALE_BASE_SPREAD_PERCENT = new Decimal("2.525");
const GOLD_RESALE_SPREAD_SLOPE = new Decimal("0.1375");
const GOLD_RESALE_MIN_SPREAD_PERCENT = new Decimal("0.5");
const GOLD_RESALE_MAX_SPREAD_PERCENT = new Decimal("10");

export function calculatePurchaseAdjustment(input: {
  actualPurchaseUnitPrice: Decimal.Value;
  marketSellUnitPrice: Decimal.Value;
}) {
  const actualPurchaseUnitPrice = new Decimal(
    input.actualPurchaseUnitPrice,
  );
  const marketSellUnitPrice = new Decimal(input.marketSellUnitPrice);
  const ratio = actualPurchaseUnitPrice
    .div(marketSellUnitPrice)
    .toDecimalPlaces(10, Decimal.ROUND_HALF_UP);
  return {
    ratio,
    percent: ratio
      .minus(1)
      .times(100)
      .toDecimalPlaces(10, Decimal.ROUND_HALF_UP),
  };
}

export function calculateGoldResaleSpreadPercent(
  purchaseAdjustmentRatio: Decimal.Value,
) {
  const deviationPercent = new Decimal(purchaseAdjustmentRatio)
    .minus(1)
    .times(100);
  const estimated = GOLD_RESALE_BASE_SPREAD_PERCENT.minus(
    GOLD_RESALE_SPREAD_SLOPE.times(deviationPercent),
  );
  if (estimated.lt(GOLD_RESALE_MIN_SPREAD_PERCENT)) {
    return GOLD_RESALE_MIN_SPREAD_PERCENT;
  }
  if (estimated.gt(GOLD_RESALE_MAX_SPREAD_PERCENT)) {
    return GOLD_RESALE_MAX_SPREAD_PERCENT;
  }
  return estimated;
}

export function calculateLotMetrics(input: LotMetricInput) {
  const quantity = new Decimal(input.remainingQuantity);
  const cost = new Decimal(input.remainingCost);
  const marketPrice = input.currentMarketUnitPrice == null
    ? null
    : new Decimal(input.currentMarketUnitPrice);
  const adjustmentRatio = new Decimal(input.purchaseAdjustmentRatio ?? 1);
  const pricingMode = input.pricingMode ?? "proportional";
  const resaleSpreadPercent = pricingMode === "gold_dynamic_spread"
    ? calculateGoldResaleSpreadPercent(adjustmentRatio)
    : null;
  let adjustedUnitPrice: Decimal | null = null;
  if (marketPrice) {
    if (pricingMode === "manual") {
      adjustedUnitPrice = marketPrice;
    } else if (pricingMode === "gold_dynamic_spread") {
      adjustedUnitPrice = marketPrice
        .times(adjustmentRatio)
        .times(new Decimal(1).minus(resaleSpreadPercent!.div(100)));
    } else {
      adjustedUnitPrice = marketPrice.times(adjustmentRatio);
    }
    adjustedUnitPrice = adjustedUnitPrice.toDecimalPlaces(
      4,
      Decimal.ROUND_HALF_UP,
    );
  }
  const marketValue = adjustedUnitPrice
    ? quantity.times(adjustedUnitPrice).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    : null;
  const unrealizedProfit = marketValue ? marketValue.minus(cost).toDecimalPlaces(4) : null;
  const unrealizedReturnPercent = unrealizedProfit && cost.gt(0)
    ? unrealizedProfit.div(cost).times(100).toDecimalPlaces(4)
    : null;

  return {
    marketValue,
    adjustedUnitPrice,
    resaleSpreadPercent,
    unrealizedProfit,
    unrealizedReturnPercent,
  };
}

export function calculateTradeCashAmount(input: {
  quantity: Decimal.Value;
  executedUnitPrice: Decimal.Value;
}) {
  const cashAmount = new Decimal(input.quantity)
    .times(input.executedUnitPrice)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return {
    gross: cashAmount,
    cashAmount,
  };
}
