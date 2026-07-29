DO $$
DECLARE
  admin_role_id UUID;
  owner_role_id UUID;
BEGIN
  SELECT "id" INTO admin_role_id
  FROM "ROLE"
  WHERE "code" = 'ADMIN';

  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'ADMIN role is required before removing OWNER';
  END IF;

  SELECT "id" INTO owner_role_id
  FROM "ROLE"
  WHERE "code" = 'OWNER';

  IF owner_role_id IS NOT NULL THEN
    UPDATE "WORKSPACE_MEMBERS"
    SET "role_id" = admin_role_id,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "role_id" = owner_role_id;

    UPDATE "WORKSPACE_JOIN_REQUEST"
    SET "role_id" = admin_role_id,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "role_id" = owner_role_id;

    DELETE FROM "ROLE"
    WHERE "id" = owner_role_id;
  END IF;
END
$$;
