DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conname IN (
      'CATEGORY_type_jar_code_check',
      'TRANSACTION_type_category_jar_check',
      'RECURRING_TRANSACTION_type_category_check'
    )
      AND convalidated
  ) <> 3 THEN
    RAISE EXCEPTION 'Expected all three financial jar constraints to be validated';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE "CATEGORY"
    SET jar_code = NULL
    WHERE id = (SELECT id FROM "CATEGORY" WHERE type = 'expense' LIMIT 1);
    RAISE EXCEPTION 'CATEGORY constraint accepted an invalid expense row';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE "TRANSACTION"
    SET category_id = NULL
    WHERE id = (SELECT id FROM "TRANSACTION" WHERE type = 'expense' LIMIT 1);
    RAISE EXCEPTION 'TRANSACTION constraint accepted an invalid expense row';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE "RECURRING_TRANSACTION"
    SET category_id = NULL
    WHERE id = (SELECT id FROM "RECURRING_TRANSACTION" WHERE type = 'expense' LIMIT 1);
    RAISE EXCEPTION 'RECURRING_TRANSACTION constraint accepted an invalid expense row';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

SELECT 'financial jar constraints enforced' AS result;
