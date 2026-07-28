-- Keep category merges traceable without deleting financial history.
ALTER TABLE "CATEGORY"
ADD COLUMN IF NOT EXISTS "merged_into_id" UUID,
ADD COLUMN IF NOT EXISTS "merged_at" TIMESTAMPTZ(6);

ALTER TABLE "CATEGORY"
ADD CONSTRAINT "CATEGORY_merged_into_id_fkey"
FOREIGN KEY ("merged_into_id") REFERENCES "CATEGORY"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CATEGORY_ALIAS" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "value" TEXT NOT NULL,
  "normalized_value" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CATEGORY_ALIAS_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CATEGORY_ALIAS_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CATEGORY_ALIAS_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "CATEGORY"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CATEGORY_ALIAS_workspace_id_kind_normalized_value_key"
ON "CATEGORY_ALIAS"("workspace_id", "kind", "normalized_value");

CREATE INDEX "CATEGORY_ALIAS_category_id_idx"
ON "CATEGORY_ALIAS"("category_id");

-- PostgreSQL treats NULL values as distinct in the former composite key, so
-- workspace categories need a dedicated partial unique index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CATEGORY"
    WHERE "workspace_id" IS NOT NULL AND "deleted_at" IS NULL
    GROUP BY "workspace_id", UPPER("code")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add workspace category code constraint: duplicate active codes exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "CATEGORY_workspace_code_active_key"
ON "CATEGORY"("workspace_id", UPPER("code"))
WHERE "workspace_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX "CATEGORY_merged_into_id_idx"
ON "CATEGORY"("merged_into_id");
