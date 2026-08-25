WITH category_counts AS (
  SELECT
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE workspace_id IS NOT NULL)::integer AS workspace_categories,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL)::integer AS user_templates,
    COUNT(*) FILTER (WHERE workspace_id IS NULL AND user_id IS NULL)::integer AS global_categories
  FROM "CATEGORY"
), reference_counts AS (
  SELECT
    (SELECT COUNT(*)::integer FROM "TRANSACTION" t JOIN "CATEGORY" c ON c.id = t.category_id WHERE c.user_id IS NOT NULL) AS template_transaction_refs,
    (SELECT COUNT(*)::integer FROM "TRANSACTION" t JOIN "CATEGORY" c ON c.id = t.category_id WHERE c.workspace_id IS NULL AND c.user_id IS NULL) AS global_transaction_refs,
    (SELECT COUNT(*)::integer FROM "RECURRING_TRANSACTION" r JOIN "CATEGORY" c ON c.id = r.category_id WHERE c.user_id IS NOT NULL) AS template_recurring_refs,
    (SELECT COUNT(*)::integer FROM "RECURRING_TRANSACTION" r JOIN "CATEGORY" c ON c.id = r.category_id WHERE c.workspace_id IS NULL AND c.user_id IS NULL) AS global_recurring_refs,
    (SELECT COUNT(*)::integer FROM "CATEGORY" child JOIN "CATEGORY" parent ON parent.id = child.parent_id WHERE parent.user_id IS NOT NULL AND child.user_id IS DISTINCT FROM parent.user_id) AS external_template_child_refs,
    (SELECT COUNT(*)::integer FROM "CATEGORY" child JOIN "CATEGORY" parent ON parent.id = child.parent_id WHERE parent.workspace_id IS NULL AND parent.user_id IS NULL) AS global_child_refs
), duplicates AS (
  SELECT
    COUNT(*)::integer AS duplicate_workspace_code_groups,
    COUNT(*) FILTER (WHERE active_count > 1)::integer AS unsafe_active_duplicate_groups
  FROM (
    SELECT workspace_id, code, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_count
    FROM "CATEGORY"
    WHERE workspace_id IS NOT NULL
    GROUP BY workspace_id, code
    HAVING COUNT(*) > 1
  ) duplicate_groups
), duplicate_details AS (
  SELECT COALESCE(json_agg(json_build_object(
    'workspaceId', workspace_id,
    'code', code,
    'categoryRows', category_rows,
    'deletedCount', deleted_count,
    'deletedBlockingReferences', deleted_blocking_references
  ) ORDER BY workspace_id, code), '[]'::json) AS rows
  FROM (
    SELECT workspace_id, code, json_agg(json_build_object(
        'id', id,
        'deleted', deleted_at IS NOT NULL,
        'references', reference_count
      ) ORDER BY created_at) AS category_rows,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::integer AS deleted_count,
      COALESCE(SUM(reference_count) FILTER (WHERE deleted_at IS NOT NULL), 0)::integer AS deleted_blocking_references
    FROM (
      SELECT category_row.*,
        (SELECT COUNT(*) FROM "TRANSACTION" t WHERE t.category_id = category_row.id)
        + (SELECT COUNT(*) FROM "RECURRING_TRANSACTION" r WHERE r.category_id = category_row.id)
        + (SELECT COUNT(*) FROM "CATEGORY" child WHERE child.parent_id = category_row.id) AS reference_count
      FROM "CATEGORY" category_row
      WHERE workspace_id IS NOT NULL
    ) category_with_references
    GROUP BY workspace_id, code
    HAVING COUNT(*) > 1
  ) details
), global_details AS (
  SELECT COALESCE(json_agg(json_build_object(
    'id', id, 'code', code, 'type', type, 'deleted', deleted_at IS NOT NULL
  ) ORDER BY code), '[]'::json) AS rows
  FROM "CATEGORY"
  WHERE workspace_id IS NULL AND user_id IS NULL
)
SELECT json_build_object(
  'totalCategories', category_counts.total,
  'workspaceCategories', category_counts.workspace_categories,
  'userTemplates', category_counts.user_templates,
  'globalCategories', category_counts.global_categories,
  'templateTransactionRefs', reference_counts.template_transaction_refs,
  'templateRecurringRefs', reference_counts.template_recurring_refs,
  'globalTransactionRefs', reference_counts.global_transaction_refs,
  'globalRecurringRefs', reference_counts.global_recurring_refs,
  'externalTemplateChildRefs', reference_counts.external_template_child_refs,
  'globalChildRefs', reference_counts.global_child_refs,
  'duplicateWorkspaceCodeGroups', duplicates.duplicate_workspace_code_groups,
  'unsafeActiveDuplicateGroups', duplicates.unsafe_active_duplicate_groups,
  'duplicateWorkspaceCodes', duplicate_details.rows,
  'globalCategoryRows', global_details.rows,
  'safeToContract',
    reference_counts.template_transaction_refs = 0
    AND reference_counts.template_recurring_refs = 0
    AND reference_counts.global_transaction_refs = 0
    AND reference_counts.global_recurring_refs = 0
    AND reference_counts.external_template_child_refs = 0
    AND reference_counts.global_child_refs = 0
    AND duplicates.unsafe_active_duplicate_groups = 0
)
FROM category_counts, reference_counts, duplicates, duplicate_details, global_details;
