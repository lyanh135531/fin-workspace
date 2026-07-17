CREATE TYPE "STATUS" AS ENUM (
  'active',
  'deactive'
);

CREATE TYPE "TRANSACTION_TYPE" AS ENUM (
  'income',
  'expense',
  'transfer'
);

CREATE TYPE "WORKFLOW_STATUS" AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE "ROLE" (
  "id" uuid PRIMARY KEY,
  "name" text,
  "code" text
);

CREATE TABLE "USERS" (
  "id" uuid PRIMARY KEY,
  "username" text,
  "password_hash" text,
  "status" "Status",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);

CREATE TABLE "WORKSPACES" (
  "id" uuid PRIMARY KEY,
  "name" text,
  "description" text,
  "status" "Status",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);

CREATE TABLE "WORKSPACE_WALLET" (
  "workspace_id" uuid,
  "wallet_id" uuid
);

CREATE TABLE "WORKSPACE_MEMBERS" (
  "id" uuid PRIMARY KEY,
  "workspace_id" uuid,
  "user_id" uuid,
  "role_id" uuid,
  "status" "Status",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);

CREATE TABLE "WALLETS" (
  "id" uuid PRIMARY KEY,
  "name" text,
  "opening_balance" numeric(20,4),
  "current_balance" numeric(20,4),
  "status" "Status",
  "description" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);

CREATE TABLE "CATEGORY" (
  "id" uuid PRIMARY KEY,
  "workspace_id" uuid,
  "name" text,
  "code" text,
  "color" varchar(7),
  "order" integer,
  "status" "Status",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);

CREATE TABLE "TRANSACTION" (
  "id" uuid PRIMARY KEY,
  "member_id" uuid,
  "wallet_id" uuid,
  "to_wallet_id" uuid,
  "category_id" uuid,
  "type" "TRANSACTION_TYPE",
  "workflow_status" "WORKFLOW_STATUS",
  "amount" numeric(20,4),
  "description" text,
  "date" date,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);

ALTER TABLE "WORKSPACE_MEMBERS" ADD FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "WORKSPACE_MEMBERS" ADD FOREIGN KEY ("user_id") REFERENCES "USERS" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "WORKSPACE_MEMBERS" ADD FOREIGN KEY ("role_id") REFERENCES "ROLE" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "WORKSPACE_WALLET" ADD FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "WORKSPACE_WALLET" ADD FOREIGN KEY ("wallet_id") REFERENCES "WALLETS" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSACTION" ADD FOREIGN KEY ("wallet_id") REFERENCES "WALLETS" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSACTION" ADD FOREIGN KEY ("category_id") REFERENCES "CATEGORY" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSACTION" ADD FOREIGN KEY ("member_id") REFERENCES "WORKSPACE_MEMBERS" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CATEGORY" ADD FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSACTION" ADD FOREIGN KEY ("to_wallet_id") REFERENCES "WALLETS" ("id") DEFERRABLE INITIALLY IMMEDIATE;
