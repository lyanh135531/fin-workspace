WITH RECURSIVE category_walk AS (
  SELECT
    category.id AS start_id,
    category.id AS current_id,
    category.parent_id,
    ARRAY[category.id]::uuid[] AS path,
    false AS cycle_found
  FROM "CATEGORY" category
  WHERE category.deleted_at IS NULL

  UNION ALL

  SELECT
    walk.start_id,
    parent.id,
    parent.parent_id,
    walk.path || parent.id,
    parent.id = ANY(walk.path)
  FROM category_walk walk
  JOIN "CATEGORY" parent ON parent.id = walk.parent_id
  WHERE walk.parent_id IS NOT NULL
    AND NOT walk.cycle_found
),
category_issues AS (
  SELECT
    (
      SELECT count(*)
      FROM "CATEGORY" child
      LEFT JOIN "CATEGORY" parent ON parent.id = child.parent_id
      WHERE child.deleted_at IS NULL
        AND child.parent_id IS NOT NULL
        AND (parent.id IS NULL OR parent.deleted_at IS NOT NULL)
    ) AS orphan_or_deleted_parent,
    (
      SELECT count(*)
      FROM "CATEGORY" child
      JOIN "CATEGORY" parent ON parent.id = child.parent_id
      WHERE child.deleted_at IS NULL
        AND parent.deleted_at IS NULL
        AND (
          child.workspace_id IS DISTINCT FROM parent.workspace_id
          OR child.user_id IS DISTINCT FROM parent.user_id
        )
    ) AS cross_scope_parent,
    (
      SELECT count(*)
      FROM "CATEGORY" child
      JOIN "CATEGORY" parent ON parent.id = child.parent_id
      WHERE child.deleted_at IS NULL
        AND parent.deleted_at IS NULL
        AND child.type IS DISTINCT FROM parent.type
    ) AS parent_type_mismatch,
    (
      SELECT count(DISTINCT start_id)
      FROM category_walk
      WHERE cycle_found
    ) AS hierarchy_cycle
),
transaction_issues AS (
  SELECT
    count(*) FILTER (
      WHERE transaction.category_id IS NOT NULL
        AND category.id IS NULL
    ) AS missing_category,
    count(*) FILTER (
      WHERE transaction.category_id IS NOT NULL
        AND category.id IS NOT NULL
        AND category.workspace_id IS NOT NULL
        AND category.workspace_id IS DISTINCT FROM member.workspace_id
    ) AS category_cross_workspace,
    count(*) FILTER (
      WHERE source_link.wallet_id IS NULL
    ) AS source_wallet_not_linked,
    count(*) FILTER (
      WHERE transaction.to_wallet_id IS NOT NULL
        AND destination_link.wallet_id IS NULL
    ) AS destination_wallet_not_linked
  FROM "TRANSACTION" transaction
  JOIN "WORKSPACE_MEMBERS" member ON member.id = transaction.member_id
  LEFT JOIN "CATEGORY" category ON category.id = transaction.category_id
  LEFT JOIN "WORKSPACE_WALLET" source_link
    ON source_link.workspace_id = member.workspace_id
    AND source_link.wallet_id = transaction.wallet_id
  LEFT JOIN "WORKSPACE_WALLET" destination_link
    ON destination_link.workspace_id = member.workspace_id
    AND destination_link.wallet_id = transaction.to_wallet_id
  WHERE transaction.deleted_at IS NULL
),
recurring_issues AS (
  SELECT
    count(*) FILTER (
      WHERE recurring.category_id IS NOT NULL
        AND category.id IS NOT NULL
        AND category.workspace_id IS NOT NULL
        AND category.workspace_id IS DISTINCT FROM recurring.workspace_id
    ) AS category_cross_workspace,
    count(*) FILTER (
      WHERE source_link.wallet_id IS NULL
    ) AS source_wallet_not_linked,
    count(*) FILTER (
      WHERE recurring.to_wallet_id IS NOT NULL
        AND destination_link.wallet_id IS NULL
    ) AS destination_wallet_not_linked,
    count(*) FILTER (
      WHERE recurring.type = 'expense'
        AND recurring.category_id IS NULL
    ) AS expense_without_category,
    count(*) FILTER (
      WHERE recurring.type = 'expense'
        AND recurring.category_id IS NULL
        AND recurring.status = 'active'
    ) AS active_expense_without_category
  FROM "RECURRING_TRANSACTION" recurring
  LEFT JOIN "CATEGORY" category ON category.id = recurring.category_id
  LEFT JOIN "WORKSPACE_WALLET" source_link
    ON source_link.workspace_id = recurring.workspace_id
    AND source_link.wallet_id = recurring.wallet_id
  LEFT JOIN "WORKSPACE_WALLET" destination_link
    ON destination_link.workspace_id = recurring.workspace_id
    AND destination_link.wallet_id = recurring.to_wallet_id
  WHERE recurring.deleted_at IS NULL
),
financial_signature AS (
  SELECT jsonb_build_object(
    'walletCount', (SELECT count(*) FROM "WALLETS"),
    'walletOpeningBalance', (
      SELECT coalesce(sum(opening_balance), 0)::text FROM "WALLETS"
    ),
    'walletCurrentBalance', (
      SELECT coalesce(sum(current_balance), 0)::text FROM "WALLETS"
    ),
    'walletChecksum', (
      SELECT md5(coalesce(string_agg(
        md5(concat_ws('|', id, opening_balance, current_balance, status, deleted_at)),
        '' ORDER BY id
      ), ''))
      FROM "WALLETS"
    ),
    'transactionCount', (SELECT count(*) FROM "TRANSACTION"),
    'transactionAmount', (
      SELECT coalesce(sum(amount), 0)::text FROM "TRANSACTION"
    ),
    'transactionChecksum', (
      SELECT md5(coalesce(string_agg(
        md5(concat_ws('|', id, member_id, wallet_id, to_wallet_id, category_id, type, workflow_status, amount, date, deleted_at)),
        '' ORDER BY id
      ), ''))
      FROM "TRANSACTION"
    ),
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
inventory AS (
  SELECT jsonb_build_object(
    'workspaceCount', (SELECT count(*) FROM "WORKSPACES" WHERE deleted_at IS NULL),
    'categoryCount', (SELECT count(*) FROM "CATEGORY" WHERE deleted_at IS NULL),
    'workspaceCategoryCount', (
      SELECT count(*) FROM "CATEGORY" WHERE deleted_at IS NULL AND workspace_id IS NOT NULL
    ),
    'templateOrGlobalCategoryCount', (
      SELECT count(*) FROM "CATEGORY" WHERE deleted_at IS NULL AND workspace_id IS NULL
    ),
    'expenseTransactionWithoutCategory', (
      SELECT count(*)
      FROM "TRANSACTION"
      WHERE deleted_at IS NULL AND type = 'expense' AND category_id IS NULL
    )
  ) AS value
),
combined AS (
  SELECT
    category_issues.*,
    transaction_issues.missing_category AS transaction_missing_category,
    transaction_issues.category_cross_workspace AS transaction_category_cross_workspace,
    transaction_issues.source_wallet_not_linked AS transaction_source_wallet_not_linked,
    transaction_issues.destination_wallet_not_linked AS transaction_destination_wallet_not_linked,
    recurring_issues.category_cross_workspace AS recurring_category_cross_workspace,
    recurring_issues.source_wallet_not_linked AS recurring_source_wallet_not_linked,
    recurring_issues.destination_wallet_not_linked AS recurring_destination_wallet_not_linked,
    recurring_issues.expense_without_category AS recurring_expense_without_category,
    recurring_issues.active_expense_without_category AS active_recurring_expense_without_category
  FROM category_issues, transaction_issues, recurring_issues
)
SELECT jsonb_build_object(
  'generatedAt', clock_timestamp(),
  'latestMigration', (
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  'inventory', inventory.value,
  'financialSignature', financial_signature.value,
  'blockingIssues', jsonb_build_object(
    'categoryOrphanOrDeletedParent', combined.orphan_or_deleted_parent,
    'categoryCrossScopeParent', combined.cross_scope_parent,
    'categoryParentTypeMismatch', combined.parent_type_mismatch,
    'categoryHierarchyCycle', combined.hierarchy_cycle,
    'transactionMissingCategoryReference', combined.transaction_missing_category,
    'transactionCategoryCrossWorkspace', combined.transaction_category_cross_workspace,
    'transactionSourceWalletNotLinked', combined.transaction_source_wallet_not_linked,
    'transactionDestinationWalletNotLinked', combined.transaction_destination_wallet_not_linked,
    'recurringCategoryCrossWorkspace', combined.recurring_category_cross_workspace,
    'recurringSourceWalletNotLinked', combined.recurring_source_wallet_not_linked,
    'recurringDestinationWalletNotLinked', combined.recurring_destination_wallet_not_linked
  ),
  'blockingIssueCount',
    combined.orphan_or_deleted_parent
    + combined.cross_scope_parent
    + combined.parent_type_mismatch
    + combined.hierarchy_cycle
    + combined.transaction_missing_category
    + combined.transaction_category_cross_workspace
    + combined.transaction_source_wallet_not_linked
    + combined.transaction_destination_wallet_not_linked
    + combined.recurring_category_cross_workspace
    + combined.recurring_source_wallet_not_linked
    + combined.recurring_destination_wallet_not_linked,
  'migrationRequired', jsonb_build_object(
    'recurringExpenseWithoutCategory', combined.recurring_expense_without_category,
    'activeRecurringExpenseWithoutCategory', combined.active_recurring_expense_without_category
  )
)::text
FROM combined, inventory, financial_signature;
