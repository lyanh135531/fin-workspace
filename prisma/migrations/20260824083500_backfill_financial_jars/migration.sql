-- Data migration only. It does not change amounts, balances or workflow states.

DO $$
DECLARE
  hierarchy_issue_count bigint;
BEGIN
  SELECT count(*)
  INTO hierarchy_issue_count
  FROM "CATEGORY" child
  LEFT JOIN "CATEGORY" parent ON parent.id = child.parent_id
  WHERE child.deleted_at IS NULL
    AND child.parent_id IS NOT NULL
    AND (
      parent.id IS NULL
      OR parent.deleted_at IS NOT NULL
      OR child.workspace_id IS DISTINCT FROM parent.workspace_id
      OR child.user_id IS DISTINCT FROM parent.user_id
      OR child.type IS DISTINCT FROM parent.type
    );

  IF hierarchy_issue_count > 0 THEN
    RAISE EXCEPTION 'Financial jar backfill aborted: % invalid live category hierarchy rows', hierarchy_issue_count;
  END IF;
END $$;

DO $$
DECLARE
  cycle_count bigint;
BEGIN
  WITH RECURSIVE category_walk AS (
    SELECT
      category.id AS start_id,
      category.parent_id,
      ARRAY[category.id]::uuid[] AS path,
      false AS cycle_found
    FROM "CATEGORY" category
    WHERE category.deleted_at IS NULL

    UNION ALL

    SELECT
      walk.start_id,
      parent.parent_id,
      walk.path || parent.id,
      parent.id = ANY(walk.path)
    FROM category_walk walk
    JOIN "CATEGORY" parent ON parent.id = walk.parent_id
    WHERE walk.parent_id IS NOT NULL
      AND NOT walk.cycle_found
  )
  SELECT count(DISTINCT start_id)
  INTO cycle_count
  FROM category_walk
  WHERE cycle_found;

  IF cycle_count > 0 THEN
    RAISE EXCEPTION 'Financial jar backfill aborted: % category hierarchy cycles', cycle_count;
  END IF;
END $$;

UPDATE "CATEGORY"
SET "jar_code" = CASE "code"
  WHEN 'EXPENSE_FOOD' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_BILLS_UTILITIES' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_TRANSPORTATION' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_HEALTH' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_PERSONAL' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_EDUCATION' THEN 'DEVELOPMENT'::"JAR_CODE"
  WHEN 'EXPENSE_SOCIAL_GIFTS' THEN 'GIVING'::"JAR_CODE"
  WHEN 'EXPENSE_ENTERTAINMENT' THEN 'ENJOYMENT'::"JAR_CODE"
  WHEN 'EXPENSE_UNEXPECTED' THEN 'RESPONSIBILITY'::"JAR_CODE"
  WHEN 'EXPENSE_INVESTMENT' THEN 'INVESTMENT'::"JAR_CODE"
  WHEN 'EXPENSE_TAX' THEN 'RESPONSIBILITY'::"JAR_CODE"
  WHEN 'EXPENSE_OPERATIONS' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_UTILITIES' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_OTHER' THEN 'ESSENTIAL'::"JAR_CODE"
  WHEN 'EXPENSE_UNCATEGORIZED' THEN 'ESSENTIAL'::"JAR_CODE"
  ELSE 'ESSENTIAL'::"JAR_CODE"
END
WHERE "type" = 'expense'
  AND "parent_id" IS NULL;

WITH RECURSIVE inherited_jar AS (
  SELECT category.id, category.jar_code
  FROM "CATEGORY" category
  WHERE category.parent_id IS NULL

  UNION ALL

  SELECT child.id, parent.jar_code
  FROM inherited_jar parent
  JOIN "CATEGORY" child ON child.parent_id = parent.id
)
UPDATE "CATEGORY" category
SET "jar_code" = inherited_jar.jar_code
FROM inherited_jar
WHERE category.id = inherited_jar.id
  AND category.type = 'expense';

UPDATE "CATEGORY"
SET "jar_code" = 'ESSENTIAL'::"JAR_CODE"
WHERE "type" = 'expense'
  AND "jar_code" IS NULL;

UPDATE "CATEGORY"
SET "jar_code" = NULL
WHERE "type" = 'income'
  AND "jar_code" IS NOT NULL;

INSERT INTO "CATEGORY" (
  "id",
  "workspace_id",
  "user_id",
  "name",
  "code",
  "color",
  "type",
  "icon",
  "parent_id",
  "jar_code",
  "order",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  affected.workspace_id,
  NULL,
  'Chưa phân loại',
  'EXPENSE_UNCATEGORIZED',
  '#64748B',
  'expense'::"CATEGORY_TYPE",
  'tag',
  NULL,
  'ESSENTIAL'::"JAR_CODE",
  10000,
  'active'::"STATUS",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT recurring.workspace_id
  FROM "RECURRING_TRANSACTION" recurring
  WHERE recurring.deleted_at IS NULL
    AND recurring.type = 'expense'
    AND recurring.category_id IS NULL
) affected
WHERE NOT EXISTS (
  SELECT 1
  FROM "CATEGORY" category
  WHERE category.workspace_id = affected.workspace_id
    AND category.deleted_at IS NULL
    AND category.code = 'EXPENSE_UNCATEGORIZED'
);

UPDATE "RECURRING_TRANSACTION" recurring
SET "category_id" = (
  SELECT category.id
  FROM "CATEGORY" category
  WHERE category.workspace_id = recurring.workspace_id
    AND category.deleted_at IS NULL
    AND category.code = 'EXPENSE_UNCATEGORIZED'
  ORDER BY category.created_at ASC, category.id ASC
  LIMIT 1
)
WHERE recurring.deleted_at IS NULL
  AND recurring.type = 'expense'
  AND recurring.category_id IS NULL;

UPDATE "TRANSACTION" transaction
SET "jar_code" = CASE
  WHEN transaction.category_id IS NULL THEN 'ESSENTIAL'::"JAR_CODE"
  ELSE category.jar_code
END
FROM "CATEGORY" category
WHERE transaction.type = 'expense'
  AND transaction.category_id = category.id;

UPDATE "TRANSACTION"
SET "jar_code" = 'ESSENTIAL'::"JAR_CODE"
WHERE "type" = 'expense'
  AND "category_id" IS NULL;

UPDATE "TRANSACTION"
SET "jar_code" = NULL
WHERE "type" IN ('income', 'transfer')
  AND "jar_code" IS NOT NULL;
