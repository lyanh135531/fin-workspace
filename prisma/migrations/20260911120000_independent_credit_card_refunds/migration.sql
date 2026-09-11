ALTER TABLE "TRANSACTION" DROP CONSTRAINT IF EXISTS "TRANSACTION_type_category_jar_check";

ALTER TABLE "TRANSACTION"
  ADD CONSTRAINT "TRANSACTION_type_category_jar_check"
  CHECK (
    ("purpose" = 'standard'::"TRANSACTION_PURPOSE" AND "type" = 'expense'::"TRANSACTION_TYPE" AND "category_id" IS NOT NULL AND "jar_code" IS NOT NULL)
    OR ("purpose" = 'standard'::"TRANSACTION_PURPOSE" AND "type" = 'income'::"TRANSACTION_TYPE" AND "jar_code" IS NULL)
    OR ("purpose" = 'standard'::"TRANSACTION_PURPOSE" AND "type" = 'transfer'::"TRANSACTION_TYPE" AND "category_id" IS NULL AND "jar_code" IS NULL)
    OR ("purpose" = 'credit_card_payment'::"TRANSACTION_PURPOSE" AND "type" = 'transfer'::"TRANSACTION_TYPE" AND "category_id" IS NULL AND "jar_code" IS NULL AND "to_wallet_id" IS NULL)
    OR (
      "purpose" = 'credit_card_refund'::"TRANSACTION_PURPOSE"
      AND "type" = 'income'::"TRANSACTION_TYPE"
      AND "to_wallet_id" IS NULL
      AND (
        ("category_id" IS NULL AND "jar_code" IS NULL AND "original_transaction_id" IS NULL)
        OR ("category_id" IS NOT NULL AND "jar_code" IS NOT NULL AND "original_transaction_id" IS NOT NULL)
      )
    )
    OR ("purpose" = 'credit_card_installment_fee'::"TRANSACTION_PURPOSE" AND "type" = 'expense'::"TRANSACTION_TYPE" AND "category_id" IS NOT NULL AND "jar_code" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "TRANSACTION" VALIDATE CONSTRAINT "TRANSACTION_type_category_jar_check";
