-- Enforce the invariants already established by the application and Phase 3 backfill.
-- NOT VALID keeps constraint creation short; VALIDATE performs the production-like scan
-- before the constraint becomes the final write boundary.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "CATEGORY"
  ADD CONSTRAINT "CATEGORY_type_jar_code_check"
  CHECK (
    ("type" = 'expense'::"CATEGORY_TYPE" AND "jar_code" IS NOT NULL)
    OR
    ("type" = 'income'::"CATEGORY_TYPE" AND "jar_code" IS NULL)
  ) NOT VALID;

ALTER TABLE "TRANSACTION"
  ADD CONSTRAINT "TRANSACTION_type_category_jar_check"
  CHECK (
    ("type" = 'expense'::"TRANSACTION_TYPE" AND "category_id" IS NOT NULL AND "jar_code" IS NOT NULL)
    OR
    ("type" = 'income'::"TRANSACTION_TYPE" AND "jar_code" IS NULL)
    OR
    ("type" = 'transfer'::"TRANSACTION_TYPE" AND "category_id" IS NULL AND "jar_code" IS NULL)
  ) NOT VALID;

ALTER TABLE "RECURRING_TRANSACTION"
  ADD CONSTRAINT "RECURRING_TRANSACTION_type_category_check"
  CHECK (
    ("type" = 'expense'::"TRANSACTION_TYPE" AND "category_id" IS NOT NULL)
    OR
    ("type" = 'income'::"TRANSACTION_TYPE")
    OR
    ("type" = 'transfer'::"TRANSACTION_TYPE" AND "category_id" IS NULL)
  ) NOT VALID;

ALTER TABLE "CATEGORY" VALIDATE CONSTRAINT "CATEGORY_type_jar_code_check";
ALTER TABLE "TRANSACTION" VALIDATE CONSTRAINT "TRANSACTION_type_category_jar_check";
ALTER TABLE "RECURRING_TRANSACTION" VALIDATE CONSTRAINT "RECURRING_TRANSACTION_type_category_check";
