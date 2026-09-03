CREATE TYPE "RECURRING_APPROVAL_STATUS" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "RECURRING_TRANSACTION"
ADD COLUMN "approval_status" "RECURRING_APPROVAL_STATUS" NOT NULL DEFAULT 'pending',
ADD COLUMN "reviewed_by_member_id" UUID,
ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN "approved_at" TIMESTAMPTZ(6);

UPDATE "RECURRING_TRANSACTION"
SET "approval_status" = 'approved',
    "approved_at" = "created_at";

CREATE INDEX "RECURRING_TRANSACTION_workspace_id_approval_status_status_next_execution_date_idx"
ON "RECURRING_TRANSACTION"("workspace_id", "approval_status", "status", "next_execution_date");

ALTER TABLE "RECURRING_TRANSACTION"
ADD CONSTRAINT "RECURRING_TRANSACTION_reviewed_by_member_id_fkey"
FOREIGN KEY ("reviewed_by_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
