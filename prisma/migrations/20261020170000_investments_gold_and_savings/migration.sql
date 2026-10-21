-- AlterEnum
ALTER TYPE "TRANSACTION_PURPOSE" ADD VALUE IF NOT EXISTS 'investment_contribution';
ALTER TYPE "TRANSACTION_PURPOSE" ADD VALUE IF NOT EXISTS 'investment_settlement';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GOLD_PRODUCT_TYPE" AS ENUM ('sjc_bar', 'ring_9999', 'jewelry_24k', 'jewelry_18k', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GOLD_PRICE_SOURCE_MODE" AS ENUM ('auto_brand', 'pegged_brand', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TYPE "GOLD_PRICE_SOURCE_MODE" ADD VALUE IF NOT EXISTS 'pegged_brand';

DO $$ BEGIN
  CREATE TYPE "INVESTMENT_FUNDING_MODE" AS ENUM ('from_wallet', 'existing_asset');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GOLD_SELL_COST_MODE" AS ENUM ('average_cost', 'specific_lot');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SAVINGS_INTEREST_PAYOUT_MODE" AS ENUM ('maturity', 'upfront', 'monthly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SAVINGS_MATURITY_ACTION" AS ENUM ('settle_to_wallet', 'renew_principal', 'renew_principal_and_interest');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SAVINGS_DEPOSIT_STATUS" AS ENUM ('active', 'settled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "GOLD_PRICE_QUOTE" (
    "provider_code" VARCHAR(32) NOT NULL,
    "brand_name" TEXT NOT NULL,
    "product_label" TEXT NOT NULL,
    "product_type" "GOLD_PRODUCT_TYPE" NOT NULL DEFAULT 'ring_9999',
    "buy_price_per_chi" DECIMAL(20,4) NOT NULL,
    "sell_price_per_chi" DECIMAL(20,4) NOT NULL,
    "change_buy_per_chi" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "change_sell_per_chi" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'VND',
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GOLD_PRICE_QUOTE_pkey" PRIMARY KEY ("provider_code")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GOLD_HOLDING" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "product_type" "GOLD_PRODUCT_TYPE" NOT NULL DEFAULT 'ring_9999',
    "price_source_mode" "GOLD_PRICE_SOURCE_MODE" NOT NULL DEFAULT 'auto_brand',
    "quote_provider_code" VARCHAR(32),
    "pegged_buy_offset_per_chi" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "pegged_sell_offset_per_chi" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "manual_buyback_price_per_chi" DECIMAL(20,4),
    "manual_sell_price_per_chi" DECIMAL(20,4),
    "total_quantity_chi" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "total_cost_basis_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "realized_profit_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "storage_location" TEXT,
    "note" TEXT,
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "GOLD_HOLDING_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GOLD_PURCHASE_LOT" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "funding_mode" "INVESTMENT_FUNDING_MODE" NOT NULL DEFAULT 'from_wallet',
    "source_wallet_id" UUID,
    "ledger_transaction_id" UUID,
    "purchase_date" DATE NOT NULL,
    "quantity_chi" DECIMAL(16,4) NOT NULL,
    "remaining_quantity_chi" DECIMAL(16,4) NOT NULL,
    "unit_price_per_chi" DECIMAL(20,4) NOT NULL,
    "crafting_fee_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_cost_amount" DECIMAL(20,4) NOT NULL,
    "remaining_cost_amount" DECIMAL(20,4) NOT NULL,
    "shop_name" TEXT,
    "invoice_or_serial" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "GOLD_PURCHASE_LOT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GOLD_SALE_RECORD" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "purchase_lot_id" UUID,
    "created_by_member_id" UUID NOT NULL,
    "cost_mode" "GOLD_SELL_COST_MODE" NOT NULL DEFAULT 'average_cost',
    "destination_wallet_id" UUID NOT NULL,
    "ledger_transaction_id" UUID,
    "sale_date" DATE NOT NULL,
    "quantity_chi" DECIMAL(16,4) NOT NULL,
    "sell_price_per_chi" DECIMAL(20,4) NOT NULL,
    "fee_or_deduction_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "gross_proceeds_amount" DECIMAL(20,4) NOT NULL,
    "net_proceeds_amount" DECIMAL(20,4) NOT NULL,
    "cost_basis_allocated_amount" DECIMAL(20,4) NOT NULL,
    "realized_profit_amount" DECIMAL(20,4) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "GOLD_SALE_RECORD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SAVINGS_DEPOSIT" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_or_passbook_number" TEXT,
    "funding_mode" "INVESTMENT_FUNDING_MODE" NOT NULL DEFAULT 'from_wallet',
    "source_wallet_id" UUID,
    "open_transaction_id" UUID,
    "principal_amount" DECIMAL(20,4) NOT NULL,
    "current_principal_amount" DECIMAL(20,4) NOT NULL,
    "annual_interest_rate" DECIMAL(8,4) NOT NULL,
    "non_term_interest_rate" DECIMAL(8,4) NOT NULL DEFAULT 0.1,
    "term_months" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "maturity_date" DATE NOT NULL,
    "interest_payout_mode" "SAVINGS_INTEREST_PAYOUT_MODE" NOT NULL DEFAULT 'maturity',
    "maturity_action" "SAVINGS_MATURITY_ACTION" NOT NULL DEFAULT 'settle_to_wallet',
    "expected_maturity_interest" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_interest_received" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" "SAVINGS_DEPOSIT_STATUS" NOT NULL DEFAULT 'active',
    "settled_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "SAVINGS_DEPOSIT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SAVINGS_DEPOSIT_SETTLEMENT" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "deposit_id" UUID NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "destination_wallet_id" UUID,
    "ledger_transaction_id" UUID,
    "settlement_date" DATE NOT NULL,
    "settlement_type" VARCHAR(32) NOT NULL,
    "principal_withdrawn_amount" DECIMAL(20,4) NOT NULL,
    "interest_received_amount" DECIMAL(20,4) NOT NULL,
    "total_received_amount" DECIMAL(20,4) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SAVINGS_DEPOSIT_SETTLEMENT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GOLD_HOLDING_workspace_id_status_deleted_at_idx" ON "GOLD_HOLDING"("workspace_id", "status", "deleted_at");
CREATE INDEX IF NOT EXISTS "GOLD_HOLDING_quote_provider_code_idx" ON "GOLD_HOLDING"("quote_provider_code");

CREATE UNIQUE INDEX IF NOT EXISTS "GOLD_PURCHASE_LOT_ledger_transaction_id_key" ON "GOLD_PURCHASE_LOT"("ledger_transaction_id");
CREATE INDEX IF NOT EXISTS "GOLD_PURCHASE_LOT_holding_id_purchase_date_deleted_at_idx" ON "GOLD_PURCHASE_LOT"("holding_id", "purchase_date", "deleted_at");
CREATE INDEX IF NOT EXISTS "GOLD_PURCHASE_LOT_workspace_id_purchase_date_idx" ON "GOLD_PURCHASE_LOT"("workspace_id", "purchase_date");

CREATE UNIQUE INDEX IF NOT EXISTS "GOLD_SALE_RECORD_ledger_transaction_id_key" ON "GOLD_SALE_RECORD"("ledger_transaction_id");
CREATE INDEX IF NOT EXISTS "GOLD_SALE_RECORD_holding_id_sale_date_deleted_at_idx" ON "GOLD_SALE_RECORD"("holding_id", "sale_date", "deleted_at");
CREATE INDEX IF NOT EXISTS "GOLD_SALE_RECORD_workspace_id_sale_date_idx" ON "GOLD_SALE_RECORD"("workspace_id", "sale_date");

CREATE UNIQUE INDEX IF NOT EXISTS "SAVINGS_DEPOSIT_open_transaction_id_key" ON "SAVINGS_DEPOSIT"("open_transaction_id");
CREATE INDEX IF NOT EXISTS "SAVINGS_DEPOSIT_workspace_id_status_deleted_at_maturity_dat_idx" ON "SAVINGS_DEPOSIT"("workspace_id", "status", "deleted_at", "maturity_date");

CREATE UNIQUE INDEX IF NOT EXISTS "SAVINGS_DEPOSIT_SETTLEMENT_ledger_transaction_id_key" ON "SAVINGS_DEPOSIT_SETTLEMENT"("ledger_transaction_id");
CREATE INDEX IF NOT EXISTS "SAVINGS_DEPOSIT_SETTLEMENT_deposit_id_settlement_date_idx" ON "SAVINGS_DEPOSIT_SETTLEMENT"("deposit_id", "settlement_date");
CREATE INDEX IF NOT EXISTS "SAVINGS_DEPOSIT_SETTLEMENT_workspace_id_settlement_date_idx" ON "SAVINGS_DEPOSIT_SETTLEMENT"("workspace_id", "settlement_date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "GOLD_HOLDING" ADD CONSTRAINT "GOLD_HOLDING_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_HOLDING" ADD CONSTRAINT "GOLD_HOLDING_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GOLD_PURCHASE_LOT" ADD CONSTRAINT "GOLD_PURCHASE_LOT_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_PURCHASE_LOT" ADD CONSTRAINT "GOLD_PURCHASE_LOT_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "GOLD_HOLDING"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_PURCHASE_LOT" ADD CONSTRAINT "GOLD_PURCHASE_LOT_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_PURCHASE_LOT" ADD CONSTRAINT "GOLD_PURCHASE_LOT_source_wallet_id_fkey" FOREIGN KEY ("source_wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_PURCHASE_LOT" ADD CONSTRAINT "GOLD_PURCHASE_LOT_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "TRANSACTION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GOLD_SALE_RECORD" ADD CONSTRAINT "GOLD_SALE_RECORD_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_SALE_RECORD" ADD CONSTRAINT "GOLD_SALE_RECORD_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "GOLD_HOLDING"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_SALE_RECORD" ADD CONSTRAINT "GOLD_SALE_RECORD_purchase_lot_id_fkey" FOREIGN KEY ("purchase_lot_id") REFERENCES "GOLD_PURCHASE_LOT"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_SALE_RECORD" ADD CONSTRAINT "GOLD_SALE_RECORD_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_SALE_RECORD" ADD CONSTRAINT "GOLD_SALE_RECORD_destination_wallet_id_fkey" FOREIGN KEY ("destination_wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "GOLD_SALE_RECORD" ADD CONSTRAINT "GOLD_SALE_RECORD_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "TRANSACTION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT" ADD CONSTRAINT "SAVINGS_DEPOSIT_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT" ADD CONSTRAINT "SAVINGS_DEPOSIT_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT" ADD CONSTRAINT "SAVINGS_DEPOSIT_source_wallet_id_fkey" FOREIGN KEY ("source_wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT" ADD CONSTRAINT "SAVINGS_DEPOSIT_open_transaction_id_fkey" FOREIGN KEY ("open_transaction_id") REFERENCES "TRANSACTION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT_SETTLEMENT" ADD CONSTRAINT "SAVINGS_DEPOSIT_SETTLEMENT_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT_SETTLEMENT" ADD CONSTRAINT "SAVINGS_DEPOSIT_SETTLEMENT_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "SAVINGS_DEPOSIT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT_SETTLEMENT" ADD CONSTRAINT "SAVINGS_DEPOSIT_SETTLEMENT_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT_SETTLEMENT" ADD CONSTRAINT "SAVINGS_DEPOSIT_SETTLEMENT_destination_wallet_id_fkey" FOREIGN KEY ("destination_wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SAVINGS_DEPOSIT_SETTLEMENT" ADD CONSTRAINT "SAVINGS_DEPOSIT_SETTLEMENT_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "TRANSACTION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
