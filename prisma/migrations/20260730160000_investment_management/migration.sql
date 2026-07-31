ALTER TYPE "CATEGORY_TYPE" ADD VALUE IF NOT EXISTS 'investment';

ALTER TABLE "CATEGORY"
ADD COLUMN "system_key" VARCHAR(40),
ADD COLUMN "is_protected" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "CATEGORY_workspace_id_system_key_key"
ON "CATEGORY"("workspace_id", "system_key");

INSERT INTO "CATEGORY" (
  "id",
  "workspace_id",
  "user_id",
  "name",
  "code",
  "color",
  "type",
  "icon",
  "parent_id",
  "system_key",
  "is_protected",
  "order",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  workspace."id",
  NULL,
  'Đầu tư',
  'INVESTMENT_ROOT',
  '#2563EB',
  'investment',
  'briefcase',
  NULL,
  'INVESTMENT_ROOT',
  true,
  900,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "WORKSPACES" workspace
WHERE workspace."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CATEGORY" category
    WHERE category."workspace_id" = workspace."id"
      AND category."system_key" = 'INVESTMENT_ROOT'
  );

ALTER TABLE "INVESTMENT_ASSET"
ADD COLUMN "category_id" UUID;

INSERT INTO "CATEGORY" (
  "id",
  "workspace_id",
  "user_id",
  "name",
  "code",
  "color",
  "type",
  "icon",
  "parent_id",
  "order",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  asset."workspace_id",
  NULL,
  asset."name",
  'INVESTMENT_ASSET_' || replace(asset."id"::text, '-', ''),
  '#2563EB',
  'investment',
  'briefcase',
  root."id",
  0,
  asset."status",
  asset."created_at",
  CURRENT_TIMESTAMP
FROM "INVESTMENT_ASSET" asset
JOIN "CATEGORY" root
  ON root."workspace_id" = asset."workspace_id"
 AND root."system_key" = 'INVESTMENT_ROOT'
WHERE NOT EXISTS (
  SELECT 1
  FROM "CATEGORY" category
  WHERE category."workspace_id" = asset."workspace_id"
    AND category."code" = 'INVESTMENT_ASSET_' || replace(asset."id"::text, '-', '')
);

UPDATE "INVESTMENT_ASSET" asset
SET "category_id" = category."id"
FROM "CATEGORY" category
WHERE category."workspace_id" = asset."workspace_id"
  AND category."code" = 'INVESTMENT_ASSET_' || replace(asset."id"::text, '-', '');

ALTER TABLE "INVESTMENT_ASSET"
ALTER COLUMN "category_id" SET NOT NULL;

CREATE UNIQUE INDEX "INVESTMENT_ASSET_category_id_key"
ON "INVESTMENT_ASSET"("category_id");

CREATE INDEX "INVESTMENT_ASSET_workspace_id_type_status_deleted_at_idx"
ON "INVESTMENT_ASSET"("workspace_id", "type", "status", "deleted_at");

ALTER TABLE "INVESTMENT_ASSET"
ADD CONSTRAINT "INVESTMENT_ASSET_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "CATEGORY"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "INVESTMENT_TRADE"
ADD COLUMN "market_price_snapshot_id" UUID;

CREATE INDEX "INVESTMENT_TRADE_market_price_snapshot_id_idx"
ON "INVESTMENT_TRADE"("market_price_snapshot_id");

ALTER TABLE "INVESTMENT_TRADE"
ADD CONSTRAINT "INVESTMENT_TRADE_market_price_snapshot_id_fkey"
FOREIGN KEY ("market_price_snapshot_id") REFERENCES "ASSET_PRICE_SNAPSHOT"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "INVESTMENT_LOT"
ADD COLUMN "purchase_market_ask_price" DECIMAL(20,4),
ADD COLUMN "purchase_adjustment_ratio" DECIMAL(18,10),
ADD COLUMN "purchase_adjustment_percent" DECIMAL(18,10);

UPDATE "INVESTMENT_LOT" lot
SET
  "purchase_market_ask_price" = trade."executed_unit_price",
  "purchase_adjustment_ratio" = 1,
  "purchase_adjustment_percent" = 0
FROM "INVESTMENT_TRADE" trade
WHERE trade."id" = lot."purchase_trade_id";

ALTER TABLE "INVESTMENT_LOT"
ALTER COLUMN "purchase_market_ask_price" SET NOT NULL,
ALTER COLUMN "purchase_adjustment_ratio" SET NOT NULL,
ALTER COLUMN "purchase_adjustment_percent" SET NOT NULL;

CREATE TABLE "INVESTMENT_PORTFOLIO_SNAPSHOT" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "event_trade_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "total_cost" DECIMAL(20,4) NOT NULL,
  "market_value" DECIMAL(20,4) NOT NULL,
  "realized_profit" DECIMAL(20,4) NOT NULL,
  CONSTRAINT "INVESTMENT_PORTFOLIO_SNAPSHOT_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM" (
  "id" UUID NOT NULL,
  "snapshot_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "quantity" DECIMAL(28,10) NOT NULL,
  "cost" DECIMAL(20,4) NOT NULL,
  "market_unit_price" DECIMAL(20,4) NOT NULL,
  "market_value" DECIMAL(20,4) NOT NULL,
  CONSTRAINT "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "INVESTMENT_PORTFOLIO_SNAPSHOT_event_trade_id_key"
ON "INVESTMENT_PORTFOLIO_SNAPSHOT"("event_trade_id");

CREATE INDEX "INVESTMENT_PORTFOLIO_SNAPSHOT_workspace_id_date_captured_at_idx"
ON "INVESTMENT_PORTFOLIO_SNAPSHOT"("workspace_id", "date", "captured_at");

CREATE UNIQUE INDEX "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM_snapshot_id_asset_id_key"
ON "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM"("snapshot_id", "asset_id");

CREATE INDEX "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM_asset_id_snapshot_id_idx"
ON "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM"("asset_id", "snapshot_id");

ALTER TABLE "INVESTMENT_PORTFOLIO_SNAPSHOT"
ADD CONSTRAINT "INVESTMENT_PORTFOLIO_SNAPSHOT_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "INVESTMENT_PORTFOLIO_SNAPSHOT"
ADD CONSTRAINT "INVESTMENT_PORTFOLIO_SNAPSHOT_event_trade_id_fkey"
FOREIGN KEY ("event_trade_id") REFERENCES "INVESTMENT_TRADE"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM"
ADD CONSTRAINT "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM_snapshot_id_fkey"
FOREIGN KEY ("snapshot_id") REFERENCES "INVESTMENT_PORTFOLIO_SNAPSHOT"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM"
ADD CONSTRAINT "INVESTMENT_PORTFOLIO_SNAPSHOT_ITEM_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "INVESTMENT_ASSET"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
