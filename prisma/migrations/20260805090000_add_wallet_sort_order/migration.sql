ALTER TABLE "WORKSPACE_WALLET"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH "ordered_wallets" AS (
  SELECT
    "WORKSPACE_WALLET"."workspace_id",
    "WORKSPACE_WALLET"."wallet_id",
    ROW_NUMBER() OVER (
      PARTITION BY "WORKSPACE_WALLET"."workspace_id"
      ORDER BY "WALLETS"."name" ASC, "WORKSPACE_WALLET"."wallet_id" ASC
    ) - 1 AS "sort_order"
  FROM "WORKSPACE_WALLET"
  INNER JOIN "WALLETS"
    ON "WALLETS"."id" = "WORKSPACE_WALLET"."wallet_id"
)
UPDATE "WORKSPACE_WALLET"
SET "sort_order" = "ordered_wallets"."sort_order"
FROM "ordered_wallets"
WHERE "WORKSPACE_WALLET"."workspace_id" = "ordered_wallets"."workspace_id"
  AND "WORKSPACE_WALLET"."wallet_id" = "ordered_wallets"."wallet_id";

CREATE INDEX "WORKSPACE_WALLET_workspace_id_sort_order_idx"
ON "WORKSPACE_WALLET"("workspace_id", "sort_order");
