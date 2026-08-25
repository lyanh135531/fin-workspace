WITH checks AS (
  SELECT
    (SELECT COUNT(*)::integer FROM "CATEGORY") AS category_count,
    (SELECT COUNT(*)::integer FROM "CATEGORY" WHERE workspace_id IS NULL) AS categories_without_workspace,
    (SELECT COUNT(*)::integer FROM (
      SELECT workspace_id, code FROM "CATEGORY" GROUP BY workspace_id, code HAVING COUNT(*) > 1
    ) duplicate_groups) AS duplicate_workspace_code_groups,
    (SELECT COUNT(*)::integer FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'CATEGORY' AND column_name = 'user_id') AS legacy_user_id_columns,
    (SELECT COUNT(*)::integer FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'CATEGORY' AND indexname = 'CATEGORY_workspace_id_user_id_code_key') AS legacy_unique_indexes,
    (SELECT COUNT(*)::integer FROM pg_constraint
      WHERE conname = 'CATEGORY_workspace_id_code_key' AND conrelid = '"CATEGORY"'::regclass) AS workspace_unique_constraints,
    (SELECT COUNT(*)::integer FROM "CATEGORY"
      WHERE deleted_at IS NOT NULL AND code LIKE '%\_\_DELETED\_\_%' ESCAPE '\') AS preserved_renamed_deleted_categories,
    (SELECT COUNT(*)::integer FROM "CATEGORY" WHERE type = 'expense' AND jar_code IS NULL) AS expense_categories_without_jar,
    (SELECT COUNT(*)::integer FROM "TRANSACTION" WHERE type = 'expense' AND jar_code IS NULL) AS expense_transactions_without_jar
)
SELECT json_build_object(
  'categoryCount', category_count,
  'categoriesWithoutWorkspace', categories_without_workspace,
  'duplicateWorkspaceCodeGroups', duplicate_workspace_code_groups,
  'legacyUserIdColumns', legacy_user_id_columns,
  'legacyUniqueIndexes', legacy_unique_indexes,
  'workspaceUniqueConstraints', workspace_unique_constraints,
  'preservedRenamedDeletedCategories', preserved_renamed_deleted_categories,
  'expenseCategoriesWithoutJar', expense_categories_without_jar,
  'expenseTransactionsWithoutJar', expense_transactions_without_jar,
  'contractIssueCount',
    categories_without_workspace
    + duplicate_workspace_code_groups
    + legacy_user_id_columns
    + legacy_unique_indexes
    + CASE WHEN workspace_unique_constraints = 1 THEN 0 ELSE 1 END
    + expense_categories_without_jar
    + expense_transactions_without_jar
)
FROM checks;
