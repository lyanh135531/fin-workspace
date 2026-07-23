-- AlterTable: Add userId column to CATEGORY for per-user templates
ALTER TABLE "CATEGORY" ADD COLUMN IF NOT EXISTS "user_id" UUID;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CATEGORY_user_id_fkey') THEN
        ALTER TABLE "CATEGORY" ADD CONSTRAINT "CATEGORY_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- DropIndex: old unique index
DROP INDEX IF EXISTS "CATEGORY_workspace_id_code_key";

-- Convert global categories referenced by transactions into workspace categories
UPDATE "CATEGORY" c
SET workspace_id = sub.workspace_id
FROM (
  SELECT DISTINCT t.category_id, m.workspace_id
  FROM "TRANSACTION" t
  JOIN "WORKSPACE_MEMBERS" m ON t.member_id = m.id
) sub
WHERE c.id = sub.category_id AND c.workspace_id IS NULL;

-- Assign remaining unattached global categories to the first user as personal templates
UPDATE "CATEGORY"
SET user_id = (SELECT id FROM "USERS" ORDER BY created_at ASC LIMIT 1)
WHERE workspace_id IS NULL AND user_id IS NULL;

-- CreateIndex: new composite unique
CREATE UNIQUE INDEX IF NOT EXISTS "CATEGORY_workspace_id_user_id_code_key" ON "CATEGORY"("workspace_id", "user_id", "code");

-- CreateIndex: user template lookup index
CREATE INDEX IF NOT EXISTS "CATEGORY_user_id_status_deleted_at_idx" ON "CATEGORY"("user_id", "status", "deleted_at");
