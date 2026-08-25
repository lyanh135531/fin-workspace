DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "TRANSACTION" t JOIN "CATEGORY" c ON c.id = t.category_id
    WHERE c.user_id IS NOT NULL OR (c.workspace_id IS NULL AND c.user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Contract cleanup blocked: transaction references a template/global category';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "RECURRING_TRANSACTION" r JOIN "CATEGORY" c ON c.id = r.category_id
    WHERE c.user_id IS NOT NULL OR (c.workspace_id IS NULL AND c.user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Contract cleanup blocked: recurring transaction references a template/global category';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "CATEGORY" child JOIN "CATEGORY" parent ON parent.id = child.parent_id
    WHERE (parent.user_id IS NOT NULL AND child.user_id IS DISTINCT FROM parent.user_id)
       OR (parent.workspace_id IS NULL AND parent.user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Contract cleanup blocked: category outside cleanup set references a template/global parent';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "CATEGORY"
    WHERE workspace_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY workspace_id, code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Contract cleanup blocked: duplicate active workspace category code';
  END IF;
END $$;

-- Template and global rows have no consumers after Phase 5 observation and the
-- preconditions above. Their removal is intentionally permanent.
DELETE FROM "CATEGORY" WHERE user_id IS NOT NULL;
DELETE FROM "CATEGORY" WHERE workspace_id IS NULL AND user_id IS NULL;

-- Preserve soft-deleted category rows that may still be referenced by history,
-- but free the active code before changing the uniqueness contract.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY workspace_id, code
    ORDER BY (deleted_at IS NULL) DESC, created_at DESC, id
  ) AS position
  FROM "CATEGORY"
)
UPDATE "CATEGORY" category_row
SET code = category_row.code || '__DELETED__' || REPLACE(category_row.id::text, '-', '')
FROM ranked
WHERE ranked.id = category_row.id AND ranked.position > 1;

DROP INDEX "CATEGORY_workspace_id_user_id_code_key";
DROP INDEX IF EXISTS "CATEGORY_user_id_status_deleted_at_idx";
ALTER TABLE "CATEGORY" DROP CONSTRAINT "CATEGORY_user_id_fkey";
ALTER TABLE "CATEGORY" DROP COLUMN "user_id";
ALTER TABLE "CATEGORY" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "CATEGORY" ADD CONSTRAINT "CATEGORY_workspace_id_code_key" UNIQUE ("workspace_id", "code");
