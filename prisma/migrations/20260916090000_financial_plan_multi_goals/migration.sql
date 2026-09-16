CREATE TYPE "FINANCIAL_GOAL_TRACKING_MODE" AS ENUM ('manual', 'linked_wallet');
CREATE TYPE "FINANCIAL_GOAL_FUNDING_STATUS" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "FINANCIAL_GOAL_FUNDING_KIND" AS ENUM ('opening', 'contribution', 'withdrawal', 'adjustment', 'reversal');

CREATE TABLE "FINANCIAL_PLAN_GOAL" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_plan_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" DECIMAL(20,4) NOT NULL,
    "target_month" DATE NOT NULL,
    "tracking_mode" "FINANCIAL_GOAL_TRACKING_MODE" NOT NULL DEFAULT 'manual',
    "linked_wallet_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "FINANCIAL_PLAN_STATUS" NOT NULL DEFAULT 'draft',
    "created_by_member_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "FINANCIAL_PLAN_GOAL_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FINANCIAL_PLAN_GOAL_amount_check" CHECK (
      "target_amount" > 0 AND "target_amount" = TRUNC("target_amount")
    ),
    CONSTRAINT "FINANCIAL_PLAN_GOAL_month_check" CHECK (EXTRACT(DAY FROM "target_month") = 1),
    CONSTRAINT "FINANCIAL_PLAN_GOAL_tracking_check" CHECK (
      ("tracking_mode" = 'manual' AND "linked_wallet_id" IS NULL)
      OR ("tracking_mode" = 'linked_wallet' AND "linked_wallet_id" IS NOT NULL)
    )
);

CREATE TABLE "FINANCIAL_GOAL_FUNDING_ENTRY" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "goal_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "kind" "FINANCIAL_GOAL_FUNDING_KIND" NOT NULL DEFAULT 'contribution',
    "status" "FINANCIAL_GOAL_FUNDING_STATUS" NOT NULL DEFAULT 'pending',
    "effective_date" DATE NOT NULL,
    "note" TEXT,
    "requester_member_id" UUID NOT NULL,
    "reviewer_member_id" UUID,
    "reverses_entry_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_amount_check" CHECK (
      "amount" <> 0 AND "amount" = TRUNC("amount")
    ),
    CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_review_check" CHECK (
      ("status" = 'pending' AND "reviewer_member_id" IS NULL AND "reviewed_at" IS NULL)
      OR ("status" <> 'pending' AND "reviewer_member_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)
    )
);

CREATE TABLE "FINANCIAL_PLAN_GOAL_MONTH" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "goal_id" UUID NOT NULL,
    "financial_plan_month_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "required_amount" DECIMAL(20,4) NOT NULL,
    "projected_contribution" DECIMAL(20,4) NOT NULL,
    "actual_contribution" DECIMAL(20,4) NOT NULL,
    "closing_progress" DECIMAL(20,4) NOT NULL,
    "remaining_amount" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FINANCIAL_PLAN_GOAL_MONTH_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FINANCIAL_PLAN_GOAL_MONTH_vnd_check" CHECK (
      "required_amount" >= 0 AND "required_amount" = TRUNC("required_amount")
      AND "projected_contribution" >= 0 AND "projected_contribution" = TRUNC("projected_contribution")
      AND "actual_contribution" = TRUNC("actual_contribution")
      AND "closing_progress" >= 0 AND "closing_progress" = TRUNC("closing_progress")
      AND "remaining_amount" >= 0 AND "remaining_amount" = TRUNC("remaining_amount")
    )
);

CREATE INDEX "FINANCIAL_PLAN_GOAL_plan_status_deleted_sort_idx"
ON "FINANCIAL_PLAN_GOAL"("financial_plan_id", "status", "deleted_at", "sort_order");
CREATE INDEX "FINANCIAL_PLAN_GOAL_linked_wallet_idx" ON "FINANCIAL_PLAN_GOAL"("linked_wallet_id");
CREATE INDEX "FINANCIAL_PLAN_GOAL_target_month_idx" ON "FINANCIAL_PLAN_GOAL"("target_month");
CREATE UNIQUE INDEX "FINANCIAL_PLAN_GOAL_one_open_goal_per_wallet"
ON "FINANCIAL_PLAN_GOAL"("linked_wallet_id")
WHERE "linked_wallet_id" IS NOT NULL AND "status" IN ('draft', 'active') AND "deleted_at" IS NULL;

CREATE INDEX "FINANCIAL_GOAL_FUNDING_ENTRY_goal_status_date_idx"
ON "FINANCIAL_GOAL_FUNDING_ENTRY"("goal_id", "status", "effective_date");
CREATE INDEX "FINANCIAL_GOAL_FUNDING_ENTRY_requester_status_idx"
ON "FINANCIAL_GOAL_FUNDING_ENTRY"("requester_member_id", "status");
CREATE INDEX "FINANCIAL_GOAL_FUNDING_ENTRY_reviewer_idx"
ON "FINANCIAL_GOAL_FUNDING_ENTRY"("reviewer_member_id");
CREATE UNIQUE INDEX "FINANCIAL_GOAL_FUNDING_ENTRY_reverses_entry_key"
ON "FINANCIAL_GOAL_FUNDING_ENTRY"("reverses_entry_id");

CREATE UNIQUE INDEX "FINANCIAL_PLAN_GOAL_MONTH_goal_month_key"
ON "FINANCIAL_PLAN_GOAL_MONTH"("goal_id", "month");
CREATE INDEX "FINANCIAL_PLAN_GOAL_MONTH_plan_month_idx"
ON "FINANCIAL_PLAN_GOAL_MONTH"("financial_plan_month_id");
CREATE INDEX "FINANCIAL_PLAN_GOAL_MONTH_month_idx" ON "FINANCIAL_PLAN_GOAL_MONTH"("month");

ALTER TABLE "FINANCIAL_PLAN_GOAL" ADD CONSTRAINT "FINANCIAL_PLAN_GOAL_plan_fkey"
FOREIGN KEY ("financial_plan_id") REFERENCES "FINANCIAL_PLAN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_PLAN_GOAL" ADD CONSTRAINT "FINANCIAL_PLAN_GOAL_wallet_fkey"
FOREIGN KEY ("linked_wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_PLAN_GOAL" ADD CONSTRAINT "FINANCIAL_PLAN_GOAL_creator_fkey"
FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FINANCIAL_GOAL_FUNDING_ENTRY" ADD CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_goal_fkey"
FOREIGN KEY ("goal_id") REFERENCES "FINANCIAL_PLAN_GOAL"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_GOAL_FUNDING_ENTRY" ADD CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_requester_fkey"
FOREIGN KEY ("requester_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_GOAL_FUNDING_ENTRY" ADD CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_reviewer_fkey"
FOREIGN KEY ("reviewer_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_GOAL_FUNDING_ENTRY" ADD CONSTRAINT "FINANCIAL_GOAL_FUNDING_ENTRY_reversal_fkey"
FOREIGN KEY ("reverses_entry_id") REFERENCES "FINANCIAL_GOAL_FUNDING_ENTRY"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FINANCIAL_PLAN_GOAL_MONTH" ADD CONSTRAINT "FINANCIAL_PLAN_GOAL_MONTH_goal_fkey"
FOREIGN KEY ("goal_id") REFERENCES "FINANCIAL_PLAN_GOAL"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_PLAN_GOAL_MONTH" ADD CONSTRAINT "FINANCIAL_PLAN_GOAL_MONTH_plan_month_fkey"
FOREIGN KEY ("financial_plan_month_id") REFERENCES "FINANCIAL_PLAN_MONTH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mỗi kế hoạch cũ trở thành một kế hoạch tổng có một mục tiêu thủ công.
INSERT INTO "FINANCIAL_PLAN_GOAL" (
  "financial_plan_id", "name", "target_amount", "target_month", "tracking_mode",
  "sort_order", "status", "created_by_member_id", "completed_at", "cancelled_at",
  "created_at", "updated_at", "deleted_at"
)
SELECT
  "id", "name", "target_amount", "target_month", 'manual', 0, "status",
  "created_by_member_id", "completed_at", "cancelled_at", "created_at", "updated_at", "deleted_at"
FROM "FINANCIAL_PLAN";

-- Chốt tiến độ legacy tại thời điểm cutover. Từ đây tiến độ chỉ đổi qua funding ledger.
INSERT INTO "FINANCIAL_GOAL_FUNDING_ENTRY" (
  "goal_id", "amount", "kind", "status", "effective_date",
  "requester_member_id", "reviewer_member_id", "reviewed_at", "note"
)
SELECT
  goal."id",
  plan."existing_goal_amount" + COALESCE(months."closed_progress", 0),
  'opening', 'approved', COALESCE(plan."start_month", plan."target_month"),
  plan."created_by_member_id", plan."created_by_member_id", CURRENT_TIMESTAMP,
  'Tiến độ được chuyển từ kế hoạch phiên bản trước'
FROM "FINANCIAL_PLAN" plan
JOIN "FINANCIAL_PLAN_GOAL" goal ON goal."financial_plan_id" = plan."id"
LEFT JOIN (
  SELECT "financial_plan_id", SUM("closed_actual_goal_amount") AS "closed_progress"
  FROM "FINANCIAL_PLAN_MONTH"
  GROUP BY "financial_plan_id"
) months ON months."financial_plan_id" = plan."id"
WHERE plan."existing_goal_amount" + COALESCE(months."closed_progress", 0) > 0;

INSERT INTO "FINANCIAL_PLAN_GOAL_MONTH" (
  "goal_id", "financial_plan_month_id", "month", "required_amount",
  "projected_contribution", "actual_contribution", "closing_progress", "remaining_amount"
)
SELECT
  goal."id", month."id", month."month", month."adjusted_required_amount",
  month."adjusted_required_amount", month."closed_actual_goal_amount",
  plan."existing_goal_amount" + SUM(month."closed_actual_goal_amount") OVER (
    PARTITION BY month."financial_plan_id" ORDER BY month."month"
  ),
  GREATEST(
    plan."target_amount" - plan."existing_goal_amount" - SUM(month."closed_actual_goal_amount") OVER (
      PARTITION BY month."financial_plan_id" ORDER BY month."month"
    ),
    0
  )
FROM "FINANCIAL_PLAN_MONTH" month
JOIN "FINANCIAL_PLAN" plan ON plan."id" = month."financial_plan_id"
JOIN "FINANCIAL_PLAN_GOAL" goal ON goal."financial_plan_id" = plan."id";

-- Snapshot tháng là bằng chứng lịch sử: không cho viết lại.
CREATE OR REPLACE FUNCTION "prevent_financial_plan_goal_month_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'FINANCIAL_PLAN_GOAL_MONTH snapshots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FINANCIAL_PLAN_GOAL_MONTH_immutable"
BEFORE UPDATE ON "FINANCIAL_PLAN_GOAL_MONTH"
FOR EACH ROW EXECUTE FUNCTION "prevent_financial_plan_goal_month_mutation"();

-- Pending entry chỉ được chuyển trạng thái một lần. Entry đã duyệt/từ chối không được viết lại.
CREATE OR REPLACE FUNCTION "prevent_reviewed_goal_funding_update"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" <> 'pending' THEN
    RAISE EXCEPTION 'Reviewed financial goal funding entries are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FINANCIAL_GOAL_FUNDING_ENTRY_reviewed_immutable"
BEFORE UPDATE ON "FINANCIAL_GOAL_FUNDING_ENTRY"
FOR EACH ROW EXECUTE FUNCTION "prevent_reviewed_goal_funding_update"();
