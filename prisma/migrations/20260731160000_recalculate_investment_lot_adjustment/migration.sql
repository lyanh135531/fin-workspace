-- The purchase adjustment is always measured against the market sell price
-- (ask) captured when the user bought the asset.
UPDATE "INVESTMENT_LOT" lot
SET
  "purchase_adjustment_ratio" = ROUND(
    trade."executed_unit_price" / lot."purchase_market_ask_price",
    10
  ),
  "purchase_adjustment_percent" = ROUND(
    (
      trade."executed_unit_price" / lot."purchase_market_ask_price" - 1
    ) * 100,
    10
  ),
  "updated_at" = CURRENT_TIMESTAMP
FROM "INVESTMENT_TRADE" trade
WHERE trade."id" = lot."purchase_trade_id"
  AND lot."purchase_market_ask_price" > 0;
