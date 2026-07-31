ALTER TABLE "INVESTMENT_ASSET"
ADD COLUMN "gold_price_code" VARCHAR(40),
ADD COLUMN "gold_spread_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
ADD COLUMN "auto_price_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "INVESTMENT_ASSET"
ADD CONSTRAINT "INVESTMENT_ASSET_gold_spread_percent_check"
CHECK ("gold_spread_percent" > -100);

CREATE INDEX "INVESTMENT_ASSET_workspace_id_auto_price_enabled_status_idx"
ON "INVESTMENT_ASSET"("workspace_id", "auto_price_enabled", "status");
