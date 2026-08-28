CREATE TABLE "LEGAL_ACCEPTANCE" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "privacy_version" VARCHAR(32) NOT NULL,
    "privacy_content_hash" VARCHAR(64) NOT NULL,
    "terms_version" VARCHAR(32) NOT NULL,
    "terms_content_hash" VARCHAR(64) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LEGAL_ACCEPTANCE_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LEGAL_ACCEPTANCE_user_id_privacy_version_terms_version_key"
ON "LEGAL_ACCEPTANCE"("user_id", "privacy_version", "terms_version");

CREATE INDEX "LEGAL_ACCEPTANCE_user_id_accepted_at_idx"
ON "LEGAL_ACCEPTANCE"("user_id", "accepted_at");

ALTER TABLE "LEGAL_ACCEPTANCE"
ADD CONSTRAINT "LEGAL_ACCEPTANCE_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
