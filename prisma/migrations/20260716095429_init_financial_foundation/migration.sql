-- CreateEnum
CREATE TYPE "STATUS" AS ENUM ('active', 'deactive');

-- CreateEnum
CREATE TYPE "TRANSACTION_TYPE" AS ENUM ('income', 'expense', 'transfer');

-- CreateEnum
CREATE TYPE "WORKFLOW_STATUS" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "ROLE" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "ROLE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "USERS" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "USERS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WORKSPACES" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "WORKSPACES_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WORKSPACE_WALLET" (
    "workspace_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,

    CONSTRAINT "WORKSPACE_WALLET_pkey" PRIMARY KEY ("workspace_id","wallet_id")
);

-- CreateTable
CREATE TABLE "WORKSPACE_MEMBERS" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "WORKSPACE_MEMBERS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WALLETS" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "opening_balance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "WALLETS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CATEGORY" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "STATUS" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "CATEGORY_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TRANSACTION" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "to_wallet_id" UUID,
    "category_id" UUID,
    "type" "TRANSACTION_TYPE" NOT NULL,
    "workflow_status" "WORKFLOW_STATUS" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(20,4) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "TRANSACTION_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ROLE_code_key" ON "ROLE"("code");

-- CreateIndex
CREATE UNIQUE INDEX "USERS_username_key" ON "USERS"("username");

-- CreateIndex
CREATE INDEX "USERS_status_deleted_at_idx" ON "USERS"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "WORKSPACES_status_deleted_at_idx" ON "WORKSPACES"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "WORKSPACE_WALLET_wallet_id_idx" ON "WORKSPACE_WALLET"("wallet_id");

-- CreateIndex
CREATE INDEX "WORKSPACE_MEMBERS_workspace_id_status_deleted_at_idx" ON "WORKSPACE_MEMBERS"("workspace_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "WORKSPACE_MEMBERS_user_id_status_deleted_at_idx" ON "WORKSPACE_MEMBERS"("user_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "WORKSPACE_MEMBERS_workspace_id_user_id_key" ON "WORKSPACE_MEMBERS"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "WALLETS_status_deleted_at_idx" ON "WALLETS"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "CATEGORY_workspace_id_status_deleted_at_order_idx" ON "CATEGORY"("workspace_id", "status", "deleted_at", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CATEGORY_workspace_id_code_key" ON "CATEGORY"("workspace_id", "code");

-- CreateIndex
CREATE INDEX "TRANSACTION_member_id_date_idx" ON "TRANSACTION"("member_id", "date");

-- CreateIndex
CREATE INDEX "TRANSACTION_wallet_id_workflow_status_date_idx" ON "TRANSACTION"("wallet_id", "workflow_status", "date");

-- CreateIndex
CREATE INDEX "TRANSACTION_to_wallet_id_workflow_status_date_idx" ON "TRANSACTION"("to_wallet_id", "workflow_status", "date");

-- CreateIndex
CREATE INDEX "TRANSACTION_category_id_date_idx" ON "TRANSACTION"("category_id", "date");

-- AddForeignKey
ALTER TABLE "WORKSPACE_WALLET" ADD CONSTRAINT "WORKSPACE_WALLET_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WORKSPACE_WALLET" ADD CONSTRAINT "WORKSPACE_WALLET_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WORKSPACE_MEMBERS" ADD CONSTRAINT "WORKSPACE_MEMBERS_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WORKSPACE_MEMBERS" ADD CONSTRAINT "WORKSPACE_MEMBERS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WORKSPACE_MEMBERS" ADD CONSTRAINT "WORKSPACE_MEMBERS_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "ROLE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CATEGORY" ADD CONSTRAINT "CATEGORY_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "WORKSPACES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRANSACTION" ADD CONSTRAINT "TRANSACTION_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "WORKSPACE_MEMBERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRANSACTION" ADD CONSTRAINT "TRANSACTION_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRANSACTION" ADD CONSTRAINT "TRANSACTION_to_wallet_id_fkey" FOREIGN KEY ("to_wallet_id") REFERENCES "WALLETS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRANSACTION" ADD CONSTRAINT "TRANSACTION_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "CATEGORY"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
