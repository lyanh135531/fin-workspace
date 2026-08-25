WITH invariant AS (
  SELECT jsonb_build_object(
    'expenseCategoryWithoutJar', (
      SELECT count(*) FROM "CATEGORY" WHERE type = 'expense' AND jar_code IS NULL
    ),
    'incomeCategoryWithJar', (
      SELECT count(*) FROM "CATEGORY" WHERE type = 'income' AND jar_code IS NOT NULL
    ),
    'expenseTransactionWithoutJar', (
      SELECT count(*) FROM "TRANSACTION" WHERE type = 'expense' AND jar_code IS NULL
    ),
    'nonExpenseTransactionWithJar', (
      SELECT count(*) FROM "TRANSACTION" WHERE type IN ('income', 'transfer') AND jar_code IS NOT NULL
    ),
    'expenseRecurringWithoutCategory', (
      SELECT count(*)
      FROM "RECURRING_TRANSACTION"
      WHERE deleted_at IS NULL AND type = 'expense' AND category_id IS NULL
    ),
    'childJarMismatch', (
      SELECT count(*)
      FROM "CATEGORY" child
      JOIN "CATEGORY" parent ON parent.id = child.parent_id
      WHERE child.type = 'expense' AND child.jar_code IS DISTINCT FROM parent.jar_code
    ),
    'snapshotMismatchAtBackfill', (
      SELECT count(*)
      FROM "TRANSACTION" transaction
      LEFT JOIN "CATEGORY" category ON category.id = transaction.category_id
      WHERE transaction.type = 'expense'
        AND transaction.jar_code IS DISTINCT FROM coalesce(category.jar_code, 'ESSENTIAL'::"JAR_CODE")
    )
  ) AS value
),
signature AS (
  SELECT jsonb_build_object(
    'walletCount', (SELECT count(*) FROM "WALLETS"),
    'walletOpeningBalance', (SELECT coalesce(sum(opening_balance), 0)::text FROM "WALLETS"),
    'walletCurrentBalance', (SELECT coalesce(sum(current_balance), 0)::text FROM "WALLETS"),
    'transactionCount', (SELECT count(*) FROM "TRANSACTION"),
    'transactionAmount', (SELECT coalesce(sum(amount), 0)::text FROM "TRANSACTION"),
    'workflowCounts', (
      SELECT coalesce(jsonb_object_agg(workflow_status, total), '{}'::jsonb)
      FROM (
        SELECT workflow_status::text, count(*) AS total
        FROM "TRANSACTION"
        GROUP BY workflow_status
        ORDER BY workflow_status
      ) grouped_workflow
    )
  ) AS value
),
counts AS (
  SELECT
    (SELECT count(*) FROM "CATEGORY" WHERE type = 'expense' AND jar_code IS NULL)
    + (SELECT count(*) FROM "CATEGORY" WHERE type = 'income' AND jar_code IS NOT NULL)
    + (SELECT count(*) FROM "TRANSACTION" WHERE type = 'expense' AND jar_code IS NULL)
    + (SELECT count(*) FROM "TRANSACTION" WHERE type IN ('income', 'transfer') AND jar_code IS NOT NULL)
    + (SELECT count(*) FROM "RECURRING_TRANSACTION" WHERE deleted_at IS NULL AND type = 'expense' AND category_id IS NULL)
    + (
      SELECT count(*)
      FROM "CATEGORY" child
      JOIN "CATEGORY" parent ON parent.id = child.parent_id
      WHERE child.type = 'expense' AND child.jar_code IS DISTINCT FROM parent.jar_code
    )
    + (
      SELECT count(*)
      FROM "TRANSACTION" transaction
      LEFT JOIN "CATEGORY" category ON category.id = transaction.category_id
      WHERE transaction.type = 'expense'
        AND transaction.jar_code IS DISTINCT FROM coalesce(category.jar_code, 'ESSENTIAL'::"JAR_CODE")
    ) AS invariant_issue_count
)
SELECT jsonb_build_object(
  'generatedAt', clock_timestamp(),
  'invariants', invariant.value,
  'invariantIssueCount', counts.invariant_issue_count,
  'financialSignature', signature.value
)::text
FROM invariant, signature, counts;
