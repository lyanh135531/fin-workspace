-- Plan-only transition: historical activation and closed snapshots stay intact.
BEGIN;

ALTER TABLE "FINANCIAL_PLAN"
  ADD COLUMN IF NOT EXISTS "progress_baseline_balance" numeric(20,4),
  ADD COLUMN IF NOT EXISTS "progress_baseline_at" timestamptz(6);

-- Wallet linkage/history is not versioned. Do not pretend to recover an exact
-- activation balance; record a dated transition from the current net wallet pool.
WITH balances AS (
  SELECT p.id, floor(coalesce(sum(CASE
    WHEN w.kind = 'asset' THEN w.current_balance
    WHEN w.kind = 'credit_card' THEN -greatest(w.current_balance, 0)
    ELSE 0 END), 0)) AS balance
  FROM "FINANCIAL_PLAN" p
  LEFT JOIN "WORKSPACE_WALLET" link ON link.workspace_id = p.workspace_id
  LEFT JOIN "WALLETS" w ON w.id = link.wallet_id AND w.deleted_at IS NULL
  WHERE p.status = 'active' AND p.deleted_at IS NULL AND p.progress_baseline_at IS NULL
  GROUP BY p.id
), transitioned AS (
  UPDATE "FINANCIAL_PLAN" p SET progress_baseline_balance = b.balance,
    progress_baseline_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
  FROM balances b WHERE p.id = b.id
  RETURNING p.*
)
INSERT INTO "AUDIT_LOG" (id, workspace_id, action, entity_type, entity_id, metadata, created_at)
SELECT gen_random_uuid(), workspace_id, 'financial_plan.baseline_transitioned',
  'financial_plan', id, jsonb_build_object(
    'balance', progress_baseline_balance::text, 'effectiveAt', progress_baseline_at,
    'previousActivationBalance', activation_workspace_balance::text,
    'reason', 'Historical wallet membership is not versioned; use explicit transition'),
  CURRENT_TIMESTAMP FROM transitioned;

COMMIT;
