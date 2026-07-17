ALTER TYPE "WORKFLOW_STATUS" ADD VALUE IF NOT EXISTS 'scheduled';

CREATE TYPE "CATEGORY_TYPE" AS ENUM ('income', 'expense');
CREATE TYPE "CHANGE_REQUEST_STATUS" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "WORKSPACES"
  ADD COLUMN "base_currency" varchar(3) NOT NULL DEFAULT 'VND',
  ADD COLUMN "time_zone" text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN "approval_required" boolean NOT NULL DEFAULT true;

ALTER TABLE "CATEGORY"
  ADD COLUMN "type" "CATEGORY_TYPE" NOT NULL DEFAULT 'expense',
  ADD COLUMN "icon" text,
  ADD COLUMN "parent_id" uuid;

UPDATE "CATEGORY" SET "type" = 'income' WHERE "code" LIKE 'INCOME_%';

ALTER TABLE "CATEGORY" ADD CONSTRAINT "CATEGORY_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "CATEGORY"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CATEGORY_parent_id_idx" ON "CATEGORY"("parent_id");

CREATE TABLE "TRANSACTION_CHANGE_REQUEST" (
  "id" uuid PRIMARY KEY,
  "transaction_id" uuid NOT NULL,
  "requester_member_id" uuid NOT NULL,
  "reviewer_member_id" uuid,
  "previous_data" jsonb NOT NULL,
  "proposed_data" jsonb NOT NULL,
  "status" "CHANGE_REQUEST_STATUS" NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" timestamptz
);
ALTER TABLE "TRANSACTION_CHANGE_REQUEST" ADD CONSTRAINT "TRANSACTION_CHANGE_REQUEST_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "TRANSACTION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TRANSACTION_CHANGE_REQUEST" ADD CONSTRAINT "TRANSACTION_CHANGE_REQUEST_requester_member_id_fkey" FOREIGN KEY ("requester_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TRANSACTION_CHANGE_REQUEST" ADD CONSTRAINT "TRANSACTION_CHANGE_REQUEST_reviewer_member_id_fkey" FOREIGN KEY ("reviewer_member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TRANSACTION_CHANGE_REQUEST_transaction_id_status_idx" ON "TRANSACTION_CHANGE_REQUEST"("transaction_id", "status");
CREATE INDEX "TRANSACTION_CHANGE_REQUEST_requester_member_id_status_idx" ON "TRANSACTION_CHANGE_REQUEST"("requester_member_id", "status");

CREATE TABLE "AUDIT_LOG" (
  "id" uuid PRIMARY KEY,
  "workspace_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "AUDIT_LOG" ADD CONSTRAINT "AUDIT_LOG_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AUDIT_LOG" ADD CONSTRAINT "AUDIT_LOG_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "USERS"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AUDIT_LOG_workspace_id_created_at_idx" ON "AUDIT_LOG"("workspace_id", "created_at");
