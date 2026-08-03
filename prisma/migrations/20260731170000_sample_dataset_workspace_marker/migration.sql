ALTER TABLE "WORKSPACES"
ADD COLUMN "sample_dataset_key" TEXT,
ADD COLUMN "sample_dataset_version" INTEGER;

CREATE INDEX "WORKSPACES_sample_dataset_key_sample_dataset_version_idx"
ON "WORKSPACES"("sample_dataset_key", "sample_dataset_version");
