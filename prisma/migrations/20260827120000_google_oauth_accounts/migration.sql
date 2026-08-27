CREATE TYPE "OAUTH_INTENT_KIND" AS ENUM ('link', 'replace', 'set_password', 'complete_profile');

ALTER TABLE "USERS"
  ALTER COLUMN "username" DROP NOT NULL,
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "profile_completed_at" TIMESTAMPTZ(6);

UPDATE "USERS"
SET "profile_completed_at" = COALESCE("updated_at", "created_at", NOW());

ALTER TABLE "USERS" ALTER COLUMN "profile_completed_at" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "OAUTH_ACCOUNTS" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "OAUTH_ACCOUNTS_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAUTH_LINK_INTENTS" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "kind" "OAUTH_INTENT_KIND" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "verified_at" TIMESTAMPTZ(6),
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAUTH_LINK_INTENTS_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAUTH_ACCOUNTS_provider_provider_account_id_key" ON "OAUTH_ACCOUNTS"("provider", "provider_account_id");
CREATE UNIQUE INDEX "OAUTH_ACCOUNTS_user_id_provider_key" ON "OAUTH_ACCOUNTS"("user_id", "provider");
CREATE INDEX "OAUTH_ACCOUNTS_user_id_idx" ON "OAUTH_ACCOUNTS"("user_id");
CREATE UNIQUE INDEX "OAUTH_LINK_INTENTS_token_hash_key" ON "OAUTH_LINK_INTENTS"("token_hash");
CREATE INDEX "OAUTH_LINK_INTENTS_user_id_kind_expires_at_idx" ON "OAUTH_LINK_INTENTS"("user_id", "kind", "expires_at");

ALTER TABLE "OAUTH_ACCOUNTS" ADD CONSTRAINT "OAUTH_ACCOUNTS_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAUTH_LINK_INTENTS" ADD CONSTRAINT "OAUTH_LINK_INTENTS_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
