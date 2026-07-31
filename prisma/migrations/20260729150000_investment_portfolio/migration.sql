-- Investment assets are valued independently from cash wallets. Cash movements
-- remain recorded in TRANSACTION for a complete financial audit trail.
ALTER TYPE "TRANSACTION_TYPE" ADD VALUE IF NOT EXISTS 'investment_buy';
ALTER TYPE "TRANSACTION_TYPE" ADD VALUE IF NOT EXISTS 'investment_sell';

CREATE TYPE "INVESTMENT_ASSET_TYPE" AS ENUM ('gold', 'currency', 'stock', 'crypto', 'fund', 'other');
CREATE TYPE "INVESTMENT_TRADE_SIDE" AS ENUM ('buy', 'sell');
CREATE TYPE "INVESTMENT_LOT_STATUS" AS ENUM ('open', 'partial', 'closed');

CREATE TABLE "INVESTMENT_ASSET" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "INVESTMENT_ASSET_TYPE" NOT NULL DEFAULT 'other',
    "unit" VARCHAR(40) NOT NULL,
    "quote_currency" VARCHAR(3) NOT NULL,
    "price_symbol" VARCHAR(120),
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "INVESTMENT_ASSET_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "INVESTMENT_TRADE" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "transaction_id" UUID,
    "asset_id" UUID NOT NULL,
    "target_lot_id" UUID,
    "side" "INVESTMENT_TRADE_SIDE" NOT NULL,
    "workflow_status" "WORKFLOW_STATUS" NOT NULL DEFAULT 'pending',
    "quantity" DECIMAL(28,10) NOT NULL,
    "executed_unit_price" DECIMAL(20,4) NOT NULL,
    "fee" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cash_amount" DECIMAL(20,4) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "INVESTMENT_TRADE_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "INVESTMENT_LOT" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "purchase_trade_id" UUID NOT NULL,
    "original_quantity" DECIMAL(28,10) NOT NULL,
    "remaining_quantity" DECIMAL(28,10) NOT NULL,
    "original_cost" DECIMAL(20,4) NOT NULL,
    "remaining_cost" DECIMAL(20,4) NOT NULL,
    "status" "INVESTMENT_LOT_STATUS" NOT NULL DEFAULT 'open',
    "opened_at" DATE NOT NULL,
    "closed_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "INVESTMENT_LOT_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "INVESTMENT_LOT_quantity_check" CHECK ("original_quantity" > 0 AND "remaining_quantity" >= 0 AND "remaining_quantity" <= "original_quantity"),
    CONSTRAINT "INVESTMENT_LOT_cost_check" CHECK ("original_cost" > 0 AND "remaining_cost" >= 0 AND "remaining_cost" <= "original_cost")
);

CREATE TABLE "INVESTMENT_LOT_ALLOCATION" (
    "id" UUID NOT NULL,
    "sell_trade_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "quantity" DECIMAL(28,10) NOT NULL,
    "allocated_cost" DECIMAL(20,4) NOT NULL,
    "gross_proceeds" DECIMAL(20,4) NOT NULL,
    "allocated_fee" DECIMAL(20,4) NOT NULL,
    "net_proceeds" DECIMAL(20,4) NOT NULL,
    "realized_profit" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "INVESTMENT_LOT_ALLOCATION_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "INVESTMENT_LOT_ALLOCATION_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "ASSET_PRICE_SNAPSHOT" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "bid_price" DECIMAL(20,4) NOT NULL,
    "ask_price" DECIMAL(20,4),
    "quote_currency" VARCHAR(3) NOT NULL,
    "provider" VARCHAR(80) NOT NULL DEFAULT 'manual',
    "price_at" TIMESTAMPTZ(6) NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "ASSET_PRICE_SNAPSHOT_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ASSET_PRICE_SNAPSHOT_price_check" CHECK ("bid_price" > 0 AND ("ask_price" IS NULL OR "ask_price" > 0))
);

CREATE UNIQUE INDEX "INVESTMENT_ASSET_workspace_id_code_key" ON "INVESTMENT_ASSET"("workspace_id", "code");
CREATE INDEX "INVESTMENT_ASSET_workspace_id_status_deleted_at_idx" ON "INVESTMENT_ASSET"("workspace_id", "status", "deleted_at");
CREATE UNIQUE INDEX "INVESTMENT_TRADE_transaction_id_key" ON "INVESTMENT_TRADE"("transaction_id");
CREATE INDEX "INVESTMENT_TRADE_workspace_id_workflow_status_date_idx" ON "INVESTMENT_TRADE"("workspace_id", "workflow_status", "date");
CREATE INDEX "INVESTMENT_TRADE_asset_id_side_workflow_status_date_idx" ON "INVESTMENT_TRADE"("asset_id", "side", "workflow_status", "date");
CREATE INDEX "INVESTMENT_TRADE_wallet_id_workflow_status_idx" ON "INVESTMENT_TRADE"("wallet_id", "workflow_status");
CREATE INDEX "INVESTMENT_TRADE_target_lot_id_idx" ON "INVESTMENT_TRADE"("target_lot_id");
CREATE UNIQUE INDEX "INVESTMENT_LOT_purchase_trade_id_key" ON "INVESTMENT_LOT"("purchase_trade_id");
CREATE INDEX "INVESTMENT_LOT_workspace_id_status_opened_at_idx" ON "INVESTMENT_LOT"("workspace_id", "status", "opened_at");
CREATE INDEX "INVESTMENT_LOT_asset_id_status_opened_at_idx" ON "INVESTMENT_LOT"("asset_id", "status", "opened_at");
CREATE UNIQUE INDEX "INVESTMENT_LOT_ALLOCATION_sell_trade_id_lot_id_key" ON "INVESTMENT_LOT_ALLOCATION"("sell_trade_id", "lot_id");
CREATE INDEX "INVESTMENT_LOT_ALLOCATION_lot_id_idx" ON "INVESTMENT_LOT_ALLOCATION"("lot_id");
CREATE INDEX "ASSET_PRICE_SNAPSHOT_asset_id_price_at_idx" ON "ASSET_PRICE_SNAPSHOT"("asset_id", "price_at" DESC);

ALTER TABLE "INVESTMENT_ASSET" ADD CONSTRAINT "INVESTMENT_ASSET_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_TRADE" ADD CONSTRAINT "INVESTMENT_TRADE_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_TRADE" ADD CONSTRAINT "INVESTMENT_TRADE_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_TRADE" ADD CONSTRAINT "INVESTMENT_TRADE_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_TRADE" ADD CONSTRAINT "INVESTMENT_TRADE_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "TRANSACTION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_TRADE" ADD CONSTRAINT "INVESTMENT_TRADE_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "INVESTMENT_ASSET"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_TRADE" ADD CONSTRAINT "INVESTMENT_TRADE_target_lot_id_fkey" FOREIGN KEY ("target_lot_id") REFERENCES "INVESTMENT_LOT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_LOT" ADD CONSTRAINT "INVESTMENT_LOT_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_LOT" ADD CONSTRAINT "INVESTMENT_LOT_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "INVESTMENT_ASSET"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_LOT" ADD CONSTRAINT "INVESTMENT_LOT_purchase_trade_id_fkey" FOREIGN KEY ("purchase_trade_id") REFERENCES "INVESTMENT_TRADE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_LOT_ALLOCATION" ADD CONSTRAINT "INVESTMENT_LOT_ALLOCATION_sell_trade_id_fkey" FOREIGN KEY ("sell_trade_id") REFERENCES "INVESTMENT_TRADE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "INVESTMENT_LOT_ALLOCATION" ADD CONSTRAINT "INVESTMENT_LOT_ALLOCATION_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "INVESTMENT_LOT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ASSET_PRICE_SNAPSHOT" ADD CONSTRAINT "ASSET_PRICE_SNAPSHOT_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "INVESTMENT_ASSET"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
