-- Preserve financial history by converting generated monthly workspaces into
-- regular active workspaces before removing the monthly-workspace association.
UPDATE "WORKSPACES"
SET
  "status" = 'active',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "workspace_id" FROM "MONTHLY_WORKSPACES")
  AND "deleted_at" IS NULL;

DROP TABLE "MONTHLY_WORKSPACES";
