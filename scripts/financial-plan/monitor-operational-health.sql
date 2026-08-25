WITH overdue_months AS (
  SELECT plan.id, month_value::date AS month
  FROM "FINANCIAL_PLAN" plan
  JOIN "WORKSPACES" workspace ON workspace.id = plan.workspace_id
  CROSS JOIN LATERAL generate_series(
    plan.start_month,
    LEAST(plan.target_month, (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE workspace.time_zone) - interval '1 month')::date),
    interval '1 month'
  ) month_value
  WHERE plan.status = 'active' AND plan.deleted_at IS NULL AND plan.start_month IS NOT NULL
), health AS (
  SELECT
    (SELECT COUNT(*)::integer FROM "FINANCIAL_PLAN" WHERE status = 'active' AND deleted_at IS NULL) AS active_plans,
    (SELECT COUNT(*)::integer FROM overdue_months due LEFT JOIN "FINANCIAL_PLAN_MONTH" closed
      ON closed.financial_plan_id = due.id AND closed.month = due.month WHERE closed.id IS NULL) AS overdue_month_closures,
    (SELECT COUNT(*)::integer FROM "FINANCIAL_PLAN_MONTH" WHERE calculator_version <> '1.0.0') AS calculator_version_mismatches,
    (SELECT COUNT(*)::integer FROM (
      SELECT financial_plan_id, effective_month FROM "PLAN_JAR_ALLOCATION"
      GROUP BY financial_plan_id, effective_month HAVING COUNT(*) <> 6 OR SUM(percentage) <> 100
    ) invalid) AS invalid_allocation_sets,
    (SELECT COUNT(*)::integer FROM "CATEGORY" WHERE type = 'expense' AND jar_code IS NULL) AS null_expense_category_jars,
    (SELECT COUNT(*)::integer FROM "TRANSACTION" WHERE type = 'expense' AND jar_code IS NULL) AS null_expense_transaction_jars,
    (SELECT MAX(created_at) FROM "AUDIT_LOG" WHERE action = 'financial_plan.month_closed') AS last_month_close_at
)
SELECT json_build_object(
  'generatedAt', CURRENT_TIMESTAMP,
  'activePlans', active_plans,
  'overdueMonthClosures', overdue_month_closures,
  'calculatorVersionMismatches', calculator_version_mismatches,
  'invalidAllocationSets', invalid_allocation_sets,
  'nullExpenseCategoryJars', null_expense_category_jars,
  'nullExpenseTransactionJars', null_expense_transaction_jars,
  'lastMonthCloseAt', last_month_close_at,
  'issueCount', overdue_month_closures + calculator_version_mismatches + invalid_allocation_sets
    + null_expense_category_jars + null_expense_transaction_jars
)
FROM health;
