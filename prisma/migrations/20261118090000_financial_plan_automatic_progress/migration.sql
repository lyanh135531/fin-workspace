-- Only financial-plan data changes. Wallets, card debt and transactions are untouched.
BEGIN;

INSERT INTO "AUDIT_LOG" ("id", "workspace_id", "action", "entity_type", "entity_id", "metadata", "created_at")
SELECT gen_random_uuid(), plan."workspace_id", 'financial_plan.progress_automated',
       'financial_plan', plan."id",
       jsonb_build_object('progressSource', 'workspace_net_balance', 'historicalFundingRetained', true),
       CURRENT_TIMESTAMP
FROM "FINANCIAL_PLAN" plan
WHERE plan."status" IN ('draft', 'active') AND plan."deleted_at" IS NULL;

-- Old linked goals no longer reserve a specific wallet or affect wallet lifecycle.
UPDATE "FINANCIAL_PLAN_GOAL" goal
SET "tracking_mode" = 'manual', "linked_wallet_id" = NULL, "updated_at" = CURRENT_TIMESTAMP
FROM "FINANCIAL_PLAN" plan
WHERE goal."financial_plan_id" = plan."id"
  AND plan."status" IN ('draft', 'active') AND plan."deleted_at" IS NULL
  AND goal."deleted_at" IS NULL;

-- Reviewed entries and immutable monthly snapshots remain untouched.
UPDATE "FINANCIAL_GOAL_FUNDING_ENTRY" entry
SET "status" = 'rejected',
    "reviewer_member_id" = plan."created_by_member_id",
    "reviewed_at" = CURRENT_TIMESTAMP
FROM "FINANCIAL_PLAN_GOAL" goal
JOIN "FINANCIAL_PLAN" plan ON plan."id" = goal."financial_plan_id"
WHERE entry."goal_id" = goal."id" AND entry."status" = 'pending';

COMMIT;

