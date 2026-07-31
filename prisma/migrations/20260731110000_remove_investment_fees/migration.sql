-- Remove investment fees from historical balances and derived values before
-- dropping the fee columns.

-- Both buy fees and sell fees reduced the wallet balance relative to a
-- fee-free trade, so return every approved fee to its wallet.
UPDATE "WALLETS" wallet
SET "current_balance" = wallet."current_balance" + adjustment."total_fee"
FROM (
  SELECT
    "wallet_id",
    SUM("fee") AS "total_fee"
  FROM "INVESTMENT_TRADE"
  WHERE
    "workflow_status" = 'approved'
    AND "deleted_at" IS NULL
    AND "fee" <> 0
  GROUP BY "wallet_id"
) adjustment
WHERE wallet."id" = adjustment."wallet_id";

-- A fee-free trade always moves quantity multiplied by executed unit price.
UPDATE "INVESTMENT_TRADE"
SET "cash_amount" = ROUND("quantity" * "executed_unit_price", 4);

UPDATE "TRANSACTION" ledger
SET "amount" = trade."cash_amount"
FROM "INVESTMENT_TRADE" trade
WHERE ledger."id" = trade."transaction_id";

-- Remove buy fees from lot cost while preserving the remaining-quantity ratio.
UPDATE "INVESTMENT_LOT" lot
SET
  "original_cost" = ROUND(
    purchase."quantity" * purchase."executed_unit_price",
    4
  ),
  "remaining_cost" = CASE
    WHEN lot."remaining_quantity" = 0 THEN 0
    ELSE ROUND(
      purchase."quantity" * purchase."executed_unit_price"
      * lot."remaining_quantity" / NULLIF(lot."original_quantity", 0),
      4
    )
  END
FROM "INVESTMENT_TRADE" purchase
WHERE purchase."id" = lot."purchase_trade_id";

-- A completed sale receives its full gross proceeds and realizes profit
-- against the fee-free allocated purchase cost.
UPDATE "INVESTMENT_LOT_ALLOCATION" allocation
SET
  "allocated_cost" = ROUND(
    lot."original_cost" * allocation."quantity"
    / NULLIF(lot."original_quantity", 0),
    4
  ),
  "net_proceeds" = allocation."gross_proceeds",
  "realized_profit" = ROUND(
    allocation."gross_proceeds"
    - (
      lot."original_cost" * allocation."quantity"
      / NULLIF(lot."original_quantity", 0)
    ),
    4
  )
FROM "INVESTMENT_LOT" lot
WHERE lot."id" = allocation."lot_id";

-- Recalculate historical portfolio cost from lots that were open when each
-- snapshot was captured.
UPDATE "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM" item
SET "cost" = historical."cost"
FROM (
  SELECT
    snapshot."id" AS "snapshot_id",
    lot."asset_id",
    ROUND(SUM(lot."original_cost"), 4) AS "cost"
  FROM "INVESTMENT_PORTFOLIO_SNAPSHOT" snapshot
  JOIN "INVESTMENT_LOT" lot
    ON lot."workspace_id" = snapshot."workspace_id"
  JOIN "INVESTMENT_TRADE" purchase
    ON purchase."id" = lot."purchase_trade_id"
    AND purchase."created_at" <= snapshot."captured_at"
  LEFT JOIN "INVESTMENT_LOT_ALLOCATION" allocation
    ON allocation."lot_id" = lot."id"
  LEFT JOIN "INVESTMENT_TRADE" sale
    ON sale."id" = allocation."sell_trade_id"
  WHERE sale."id" IS NULL OR sale."created_at" > snapshot."captured_at"
  GROUP BY snapshot."id", lot."asset_id"
) historical
WHERE
  item."snapshot_id" = historical."snapshot_id"
  AND item."asset_id" = historical."asset_id";

UPDATE "INVESTMENT_PORTFOLIO_SNAPSHOT" snapshot
SET
  "total_cost" = COALESCE((
    SELECT ROUND(SUM(item."cost"), 4)
    FROM "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM" item
    WHERE item."snapshot_id" = snapshot."id"
  ), 0),
  "realized_profit" = COALESCE((
    SELECT ROUND(SUM(allocation."realized_profit"), 4)
    FROM "INVESTMENT_LOT_ALLOCATION" allocation
    JOIN "INVESTMENT_LOT" lot
      ON lot."id" = allocation."lot_id"
    JOIN "INVESTMENT_TRADE" sale
      ON sale."id" = allocation."sell_trade_id"
    WHERE
      lot."workspace_id" = snapshot."workspace_id"
      AND sale."created_at" <= snapshot."captured_at"
  ), 0);

ALTER TABLE "INVESTMENT_LOT_ALLOCATION"
DROP COLUMN "allocated_fee";

ALTER TABLE "INVESTMENT_TRADE"
DROP COLUMN "fee";
