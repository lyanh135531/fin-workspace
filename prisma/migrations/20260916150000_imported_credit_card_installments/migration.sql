CREATE TYPE "FELIX_INSTALLMENT_ORIGIN" AS ENUM ('transaction', 'imported');
CREATE TYPE "FELIX_INSTALLMENT_IMPORT_BALANCE_MODE" AS ENUM ('included_opening_debt', 'add_to_balance');

ALTER TABLE "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN"
  ALTER COLUMN "transaction_id" DROP NOT NULL,
  ADD COLUMN "origin" "FELIX_INSTALLMENT_ORIGIN" NOT NULL DEFAULT 'transaction',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "paid_term_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "import_balance_mode" "FELIX_INSTALLMENT_IMPORT_BALANCE_MODE";

ALTER TABLE "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN"
  DROP CONSTRAINT "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN_term_count_check",
  ADD CONSTRAINT "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN_term_count_check" CHECK ("term_count" BETWEEN 2 AND 60),
  ADD CONSTRAINT "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN_paid_term_count_check" CHECK ("paid_term_count" >= 0 AND "paid_term_count" < "term_count"),
  ADD CONSTRAINT "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN_origin_check" CHECK (
    ("origin" = 'transaction' AND "transaction_id" IS NOT NULL AND "paid_term_count" = 0 AND "import_balance_mode" IS NULL)
    OR
    ("origin" = 'imported' AND "transaction_id" IS NULL AND "description" IS NOT NULL AND "import_balance_mode" IS NOT NULL AND "fee_amount" = 0)
  );

ALTER TABLE "CREDIT_CARD_OBLIGATION_ENTRY"
  ADD COLUMN "installment_plan_id" UUID;

CREATE INDEX "CREDIT_CARD_OBLIGATION_ENTRY_installment_plan_id_idx"
  ON "CREDIT_CARD_OBLIGATION_ENTRY"("installment_plan_id");

ALTER TABLE "CREDIT_CARD_OBLIGATION_ENTRY"
  ADD CONSTRAINT "CC_OBLIGATION_installment_plan_fkey"
  FOREIGN KEY ("installment_plan_id")
  REFERENCES "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
