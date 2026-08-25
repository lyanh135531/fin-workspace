CREATE TYPE "FINANCIAL_PLAN_STATUS" AS ENUM ('draft', 'active', 'completed', 'cancelled');

CREATE TABLE "FINANCIAL_PLAN" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" DECIMAL(20,4) NOT NULL,
    "existing_goal_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "start_month" DATE,
    "target_month" DATE NOT NULL,
    "status" "FINANCIAL_PLAN_STATUS" NOT NULL DEFAULT 'draft',
    "created_by_member_id" UUID NOT NULL,
    "activation_workspace_balance" DECIMAL(20,4),
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "FINANCIAL_PLAN_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FINANCIAL_PLAN_amount_check" CHECK (
      "target_amount" > 0
      AND "target_amount" = TRUNC("target_amount")
      AND "existing_goal_amount" >= 0
      AND "existing_goal_amount" = TRUNC("existing_goal_amount")
      AND "existing_goal_amount" <= "target_amount"
      AND ("activation_workspace_balance" IS NULL OR "activation_workspace_balance" = TRUNC("activation_workspace_balance"))
    ),
    CONSTRAINT "FINANCIAL_PLAN_month_check" CHECK (
      EXTRACT(DAY FROM "target_month") = 1
      AND ("start_month" IS NULL OR EXTRACT(DAY FROM "start_month") = 1)
      AND ("start_month" IS NULL OR "target_month" >= "start_month")
    ),
    CONSTRAINT "FINANCIAL_PLAN_lifecycle_check" CHECK (
      ("status" = 'draft' AND "start_month" IS NULL AND "activated_at" IS NULL)
      OR ("status" <> 'draft' AND "start_month" IS NOT NULL AND "activated_at" IS NOT NULL)
    )
);

CREATE TABLE "PLAN_JAR_ALLOCATION" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_plan_id" UUID NOT NULL,
    "jar_code" "JAR_CODE" NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "effective_month" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PLAN_JAR_ALLOCATION_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PLAN_JAR_ALLOCATION_percentage_check" CHECK ("percentage" >= 0 AND "percentage" <= 100),
    CONSTRAINT "PLAN_JAR_ALLOCATION_month_check" CHECK (EXTRACT(DAY FROM "effective_month") = 1)
);

CREATE TABLE "FINANCIAL_PLAN_MONTH" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_plan_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "base_required_amount" DECIMAL(20,4) NOT NULL,
    "adjusted_required_amount" DECIMAL(20,4) NOT NULL,
    "raw_gross_budget" DECIMAL(20,4) NOT NULL,
    "allocatable_gross_budget" DECIMAL(20,4) NOT NULL,
    "resource_shortfall" DECIMAL(20,4) NOT NULL,
    "closed_eligible_expense" DECIMAL(20,4) NOT NULL,
    "closed_actual_goal_amount" DECIMAL(20,4) NOT NULL,
    "closed_at" TIMESTAMPTZ(6) NOT NULL,
    "calculator_version" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FINANCIAL_PLAN_MONTH_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FINANCIAL_PLAN_MONTH_month_check" CHECK (EXTRACT(DAY FROM "month") = 1),
    CONSTRAINT "FINANCIAL_PLAN_MONTH_vnd_check" CHECK (
      "base_required_amount" >= 0 AND "base_required_amount" = TRUNC("base_required_amount")
      AND "adjusted_required_amount" >= 0 AND "adjusted_required_amount" = TRUNC("adjusted_required_amount")
      AND "raw_gross_budget" = TRUNC("raw_gross_budget")
      AND "allocatable_gross_budget" >= 0 AND "allocatable_gross_budget" = TRUNC("allocatable_gross_budget")
      AND "resource_shortfall" >= 0 AND "resource_shortfall" = TRUNC("resource_shortfall")
      AND "closed_eligible_expense" >= 0 AND "closed_eligible_expense" = TRUNC("closed_eligible_expense")
      AND "closed_actual_goal_amount" >= 0 AND "closed_actual_goal_amount" = TRUNC("closed_actual_goal_amount")
    )
);

CREATE TABLE "FINANCIAL_PLAN_MONTH_JAR" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_plan_month_id" UUID NOT NULL,
    "jar_code" "JAR_CODE" NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "allocated_amount" DECIMAL(20,4) NOT NULL,
    "closed_actual_amount" DECIMAL(20,4) NOT NULL,
    CONSTRAINT "FINANCIAL_PLAN_MONTH_JAR_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FINANCIAL_PLAN_MONTH_JAR_percentage_check" CHECK ("percentage" >= 0 AND "percentage" <= 100),
    CONSTRAINT "FINANCIAL_PLAN_MONTH_JAR_vnd_check" CHECK (
      "allocated_amount" >= 0 AND "allocated_amount" = TRUNC("allocated_amount")
      AND "closed_actual_amount" >= 0 AND "closed_actual_amount" = TRUNC("closed_actual_amount")
    )
);

CREATE UNIQUE INDEX "FINANCIAL_PLAN_one_active_per_workspace"
ON "FINANCIAL_PLAN"("workspace_id")
WHERE "status" = 'active' AND "deleted_at" IS NULL;

CREATE INDEX "FINANCIAL_PLAN_workspace_id_status_deleted_at_idx" ON "FINANCIAL_PLAN"("workspace_id", "status", "deleted_at");
CREATE INDEX "FINANCIAL_PLAN_target_month_idx" ON "FINANCIAL_PLAN"("target_month");
CREATE UNIQUE INDEX "PLAN_JAR_ALLOCATION_financial_plan_id_effective_month_jar_key" ON "PLAN_JAR_ALLOCATION"("financial_plan_id", "effective_month", "jar_code");
CREATE INDEX "PLAN_JAR_ALLOCATION_financial_plan_id_effective_month_idx" ON "PLAN_JAR_ALLOCATION"("financial_plan_id", "effective_month");
CREATE UNIQUE INDEX "FINANCIAL_PLAN_MONTH_financial_plan_id_month_key" ON "FINANCIAL_PLAN_MONTH"("financial_plan_id", "month");
CREATE INDEX "FINANCIAL_PLAN_MONTH_month_idx" ON "FINANCIAL_PLAN_MONTH"("month");
CREATE UNIQUE INDEX "FINANCIAL_PLAN_MONTH_JAR_financial_plan_month_id_jar_key" ON "FINANCIAL_PLAN_MONTH_JAR"("financial_plan_month_id", "jar_code");
CREATE INDEX "FINANCIAL_PLAN_MONTH_JAR_jar_code_idx" ON "FINANCIAL_PLAN_MONTH_JAR"("jar_code");

ALTER TABLE "FINANCIAL_PLAN" ADD CONSTRAINT "FINANCIAL_PLAN_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_PLAN" ADD CONSTRAINT "FINANCIAL_PLAN_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PLAN_JAR_ALLOCATION" ADD CONSTRAINT "PLAN_JAR_ALLOCATION_financial_plan_id_fkey" FOREIGN KEY ("financial_plan_id") REFERENCES "FINANCIAL_PLAN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_PLAN_MONTH" ADD CONSTRAINT "FINANCIAL_PLAN_MONTH_financial_plan_id_fkey" FOREIGN KEY ("financial_plan_id") REFERENCES "FINANCIAL_PLAN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FINANCIAL_PLAN_MONTH_JAR" ADD CONSTRAINT "FINANCIAL_PLAN_MONTH_JAR_financial_plan_month_id_fkey" FOREIGN KEY ("financial_plan_month_id") REFERENCES "FINANCIAL_PLAN_MONTH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
