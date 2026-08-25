-- Expand-only migration. Application code and existing rows remain compatible
-- until dual-write and backfill phases are deployed.

CREATE TYPE "JAR_CODE" AS ENUM (
  'ESSENTIAL',
  'RESPONSIBILITY',
  'DEVELOPMENT',
  'ENJOYMENT',
  'INVESTMENT',
  'GIVING'
);

ALTER TABLE "CATEGORY"
  ADD COLUMN "jar_code" "JAR_CODE";

ALTER TABLE "TRANSACTION"
  ADD COLUMN "jar_code" "JAR_CODE";

CREATE INDEX "CATEGORY_workspace_id_type_jar_code_idx"
  ON "CATEGORY"("workspace_id", "type", "jar_code");

CREATE INDEX "TRANSACTION_jar_code_date_idx"
  ON "TRANSACTION"("jar_code", "date");
