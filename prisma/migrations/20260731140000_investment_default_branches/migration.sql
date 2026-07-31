-- Adopt compatible existing investment groups when possible so workspaces do
-- not receive duplicate Gold, Money, or Fund branches.
WITH candidates AS (
  SELECT
    category."id",
    ROW_NUMBER() OVER (
      PARTITION BY category."workspace_id"
      ORDER BY category."created_at", category."id"
    ) AS position
  FROM "CATEGORY" category
  JOIN "CATEGORY" root
    ON root."id" = category."parent_id"
   AND root."system_key" = 'INVESTMENT_ROOT'
  WHERE
    category."deleted_at" IS NULL
    AND category."system_key" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "INVESTMENT_ASSET" asset
      WHERE asset."category_id" = category."id"
    )
    AND (
      LOWER(category."name") IN ('gold', 'vàng')
      OR UPPER(category."code") IN ('GOLD', 'VANG')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "CATEGORY" existing
      WHERE existing."workspace_id" = category."workspace_id"
        AND existing."system_key" = 'INVESTMENT_GOLD'
    )
)
UPDATE "CATEGORY" category
SET
  "name" = 'Gold',
  "code" = 'INVESTMENT_GOLD',
  "color" = '#D97706',
  "type" = 'investment',
  "icon" = 'coins',
  "system_key" = 'INVESTMENT_GOLD',
  "is_protected" = true,
  "order" = 0,
  "status" = 'active',
  "updated_at" = CURRENT_TIMESTAMP
FROM candidates
WHERE category."id" = candidates."id"
  AND candidates."position" = 1;

WITH candidates AS (
  SELECT
    category."id",
    ROW_NUMBER() OVER (
      PARTITION BY category."workspace_id"
      ORDER BY category."created_at", category."id"
    ) AS position
  FROM "CATEGORY" category
  JOIN "CATEGORY" root
    ON root."id" = category."parent_id"
   AND root."system_key" = 'INVESTMENT_ROOT'
  WHERE
    category."deleted_at" IS NULL
    AND category."system_key" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "INVESTMENT_ASSET" asset
      WHERE asset."category_id" = category."id"
    )
    AND (
      LOWER(category."name") IN ('money', 'dolar', 'dollar', 'ngoại tệ')
      OR UPPER(category."code") IN ('MONEY', 'DOLAR', 'DOLLAR', 'FOREIGN_CURRENCY')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "CATEGORY" existing
      WHERE existing."workspace_id" = category."workspace_id"
        AND existing."system_key" = 'INVESTMENT_MONEY'
    )
)
UPDATE "CATEGORY" category
SET
  "name" = 'Money',
  "code" = 'INVESTMENT_MONEY',
  "color" = '#059669',
  "type" = 'investment',
  "icon" = 'banknote',
  "system_key" = 'INVESTMENT_MONEY',
  "is_protected" = true,
  "order" = 1,
  "status" = 'active',
  "updated_at" = CURRENT_TIMESTAMP
FROM candidates
WHERE category."id" = candidates."id"
  AND candidates."position" = 1;

WITH candidates AS (
  SELECT
    category."id",
    ROW_NUMBER() OVER (
      PARTITION BY category."workspace_id"
      ORDER BY category."created_at", category."id"
    ) AS position
  FROM "CATEGORY" category
  JOIN "CATEGORY" root
    ON root."id" = category."parent_id"
   AND root."system_key" = 'INVESTMENT_ROOT'
  WHERE
    category."deleted_at" IS NULL
    AND category."system_key" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "INVESTMENT_ASSET" asset
      WHERE asset."category_id" = category."id"
    )
    AND (
      LOWER(category."name") IN ('fund', 'quỹ')
      OR UPPER(category."code") IN ('FUND', 'QUY')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "CATEGORY" existing
      WHERE existing."workspace_id" = category."workspace_id"
        AND existing."system_key" = 'INVESTMENT_FUND'
    )
)
UPDATE "CATEGORY" category
SET
  "name" = 'Fund',
  "code" = 'INVESTMENT_FUND',
  "color" = '#7C3AED',
  "type" = 'investment',
  "icon" = 'chart-no-axes-combined',
  "system_key" = 'INVESTMENT_FUND',
  "is_protected" = true,
  "order" = 2,
  "status" = 'active',
  "updated_at" = CURRENT_TIMESTAMP
FROM candidates
WHERE category."id" = candidates."id"
  AND candidates."position" = 1;

INSERT INTO "CATEGORY" (
  "id",
  "workspace_id",
  "name",
  "code",
  "color",
  "type",
  "icon",
  "parent_id",
  "system_key",
  "is_protected",
  "order",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  root."workspace_id",
  definition."name",
  definition."code",
  definition."color",
  'investment',
  definition."icon",
  root."id",
  definition."system_key",
  true,
  definition."sort_order",
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CATEGORY" root
CROSS JOIN (
  VALUES
    ('INVESTMENT_GOLD', 'Gold', 'INVESTMENT_GOLD', '#D97706', 'coins', 0),
    ('INVESTMENT_MONEY', 'Money', 'INVESTMENT_MONEY', '#059669', 'banknote', 1),
    ('INVESTMENT_FUND', 'Fund', 'INVESTMENT_FUND', '#7C3AED', 'chart-no-axes-combined', 2)
) AS definition("system_key", "name", "code", "color", "icon", "sort_order")
WHERE root."system_key" = 'INVESTMENT_ROOT'
  AND root."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CATEGORY" existing
    WHERE existing."workspace_id" = root."workspace_id"
      AND existing."system_key" = definition."system_key"
  );

-- Move existing configured leaf assets under their corresponding protected
-- branch when they previously lived directly under Đầu tư.
UPDATE "CATEGORY" category
SET
  "parent_id" = branch."id",
  "color" = branch."color",
  "updated_at" = CURRENT_TIMESTAMP
FROM "INVESTMENT_ASSET" asset
JOIN "CATEGORY" root
  ON root."workspace_id" = asset."workspace_id"
 AND root."system_key" = 'INVESTMENT_ROOT'
JOIN "CATEGORY" branch
  ON branch."workspace_id" = asset."workspace_id"
 AND branch."system_key" = CASE asset."type"
   WHEN 'gold' THEN 'INVESTMENT_GOLD'
   WHEN 'currency' THEN 'INVESTMENT_MONEY'
   WHEN 'fund' THEN 'INVESTMENT_FUND'
   ELSE NULL
 END
WHERE category."id" = asset."category_id"
  AND category."parent_id" = root."id"
  AND category."is_protected" = false;
