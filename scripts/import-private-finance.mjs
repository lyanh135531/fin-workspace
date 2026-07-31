import "dotenv/config";

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import argon2 from "argon2";
import Decimal from "decimal.js";
import pg from "pg";

const { Client } = pg;
const TARGET_DATABASE = process.env.IMPORT_TARGET_DB ?? "finance_managerment_private";
const USERNAME = process.env.IMPORT_USERNAME ?? "oggy";
const PASSWORD = process.env.IMPORT_PASSWORD;

if (!PASSWORD) {
  throw new Error("Set IMPORT_PASSWORD env variable (e.g. IMPORT_PASSWORD=strongpass node scripts/import-private-finance.mjs ...)");
}

function targetConnectionString() {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL is not configured.");

  const url = new URL(source);
  url.pathname = `/${TARGET_DATABASE}`;
  return url.toString();
}

async function rebuildDatabase() {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL is not configured.");

  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [TARGET_DATABASE],
    );
    await client.query(`DROP DATABASE IF EXISTS "${TARGET_DATABASE}"`);
    await client.query(`CREATE DATABASE "${TARGET_DATABASE}"`);
  } finally {
    await client.end();
  }

  console.log(JSON.stringify({ database: TARGET_DATABASE, rebuilt: true }, null, 2));
}

async function migrateDatabase() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: targetConnectionString() },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Migration exited with code ${code}`)));
  });
}

async function importPreparedData(preparedPath) {
  if (!preparedPath) throw new Error("Missing prepared import JSON path.");
  const prepared = JSON.parse(await readFile(preparedPath, "utf8"));
  const client = new Client({ connectionString: targetConnectionString() });
  const passwordHash = await argon2.hash(PASSWORD);
  const now = new Date();

  const userId = randomUUID();
  const workspaceId = randomUUID();
  const memberId = randomUUID();
  const inviteCode = randomUUID();
  const walletId = randomUUID();
  const categoryIds = new Map();

  const openingBalance = new Decimal(prepared.openingBalance);
  let currentBalance = openingBalance;
  for (const transaction of prepared.transactions) {
    const amount = new Decimal(transaction.amount);
    currentBalance = transaction.type === "income"
      ? currentBalance.plus(amount)
      : currentBalance.minus(amount);
  }

  await client.connect();
  try {
    await client.query("BEGIN");

    const adminRole = await client.query('SELECT "id" FROM "ROLE" WHERE "code" = $1', ["ADMIN"]);
    if (adminRole.rowCount !== 1) throw new Error("ADMIN role was not created by migrations.");

    // Replace migration seed categories so the new database exposes exactly the requested common list.
    await client.query('DELETE FROM "CATEGORY" WHERE "workspace_id" IS NULL');

    await client.query(
      'INSERT INTO "USERS" ("id", "username", "password_hash", "status", "created_at", "updated_at") VALUES ($1, $2, $3, \'active\', $4, $4)',
      [userId, USERNAME, passwordHash, now],
    );
    await client.query(
      'INSERT INTO "WALLETS" ("id", "name", "opening_balance", "current_balance", "status", "description", "created_at", "updated_at") VALUES ($1, $2, $3, $4, \'active\', $5, $6, $6)',
      [walletId, "Ví chính", openingBalance.toFixed(4), currentBalance.toFixed(4), "Ví dùng chung cho dữ liệu CSV đã nhập", now],
    );

    await client.query(
      'INSERT INTO "WORKSPACES" ("id", "name", "description", "status", "created_at", "updated_at", "base_currency", "time_zone", "approval_required", "invite_code") VALUES ($1, $2, $3, \'active\', $4, $4, \'VND\', \'Asia/Ho_Chi_Minh\', true, $5)',
      [workspaceId, "Tài chính cá nhân", "Dữ liệu tài chính cá nhân đã nhập", now, inviteCode],
    );
    await client.query(
      'INSERT INTO "WORKSPACE_MEMBERS" ("id", "workspace_id", "user_id", "role_id", "status", "created_at", "updated_at") VALUES ($1, $2, $3, $4, \'active\', $5, $5)',
      [memberId, workspaceId, userId, adminRole.rows[0].id, now],
    );
    await client.query(
      'INSERT INTO "WORKSPACE_WALLET" ("workspace_id", "wallet_id") VALUES ($1, $2)',
      [workspaceId, walletId],
    );

    for (const [index, category] of prepared.categories.entries()) {
      const categoryId = randomUUID();
      categoryIds.set(category.name, categoryId);
      await client.query(
        'INSERT INTO "CATEGORY" ("id", "workspace_id", "name", "code", "color", "type", "order", "status", "created_at", "updated_at") VALUES ($1, NULL, $2, $3, $4, $5, $6, \'active\', $7, $7)',
        [categoryId, category.name, category.code, category.color, category.type, index, now],
      );
    }

    for (const transaction of prepared.transactions) {
      const categoryId = categoryIds.get(transaction.category);
      if (!categoryId) throw new Error(`Unknown category: ${transaction.category}`);
      await client.query(
        'INSERT INTO "TRANSACTION" ("id", "member_id", "wallet_id", "category_id", "type", "workflow_status", "amount", "description", "date", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5, \'approved\', $6, $7, $8, $9, $9)',
        [randomUUID(), memberId, walletId, categoryId, transaction.type, transaction.amount, transaction.description, transaction.date, now],
      );
    }

    await client.query(
      'INSERT INTO "AUDIT_LOG" ("id", "workspace_id", "actor_user_id", "action", "entity_type", "entity_id", "metadata") VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [randomUUID(), workspaceId, userId, "CSV_IMPORT_COMPLETED", "WORKSPACE", workspaceId, JSON.stringify({ sourceFiles: prepared.reports.map((report) => report.file), transactions: prepared.transactions.length })],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(JSON.stringify({
    database: TARGET_DATABASE,
    username: USERNAME,
    workspace: "Tài chính cá nhân",
    categories: prepared.categories.length,
    transactions: prepared.transactions.length,
    openingBalance: openingBalance.toFixed(4),
    currentBalance: currentBalance.toFixed(4),
  }, null, 2));
}

async function grantAdmin() {
  const client = new Client({ connectionString: targetConnectionString() });
  await client.connect();
  try {
    const result = await client.query(`
      UPDATE "WORKSPACE_MEMBERS" wm
      SET "role_id" = role."id", "updated_at" = CURRENT_TIMESTAMP
      FROM "USERS" users, "ROLE" role
      WHERE wm."user_id" = users."id"
        AND users."username" = $1
        AND role."code" = 'ADMIN'
    `, [USERNAME]);
    console.log(JSON.stringify({ database: TARGET_DATABASE, username: USERNAME, adminMemberships: result.rowCount }, null, 2));
  } finally {
    await client.end();
  }
}

async function verifyImport() {
  const client = new Client({ connectionString: targetConnectionString() });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "USERS") AS users,
        (SELECT COUNT(*)::int FROM "WORKSPACES" WHERE "deleted_at" IS NULL) AS workspaces,
        (SELECT COUNT(DISTINCT "wallet_id")::int FROM "WORKSPACE_WALLET") AS wallets,
        (SELECT COUNT(*)::int FROM "WORKSPACE_WALLET") AS wallet_links,
        (SELECT COUNT(*)::int FROM "CATEGORY" WHERE "deleted_at" IS NULL) AS categories,
        (SELECT COUNT(*)::int FROM "TRANSACTION" WHERE "deleted_at" IS NULL) AS transactions,
        (SELECT COALESCE(SUM("amount"), 0)::text FROM "TRANSACTION" WHERE "type" = 'income' AND "workflow_status" = 'approved' AND "deleted_at" IS NULL) AS income,
        (SELECT COALESCE(SUM("amount"), 0)::text FROM "TRANSACTION" WHERE "type" = 'expense' AND "workflow_status" = 'approved' AND "deleted_at" IS NULL) AS expense,
        (SELECT "opening_balance"::text FROM "WALLETS" LIMIT 1) AS opening_balance,
        (SELECT "current_balance"::text FROM "WALLETS" LIMIT 1) AS current_balance,
        (SELECT COUNT(*)::int FROM "WORKSPACE_MEMBERS" wm JOIN "USERS" u ON u."id" = wm."user_id" JOIN "ROLE" r ON r."id" = wm."role_id" WHERE u."username" = $1 AND r."code" = 'ADMIN') AS admin_memberships,
        (SELECT "password_hash" FROM "USERS" WHERE "username" = $1) AS password_hash
    `, [USERNAME]);
    const workspaceResult = await client.query(`
      SELECT ws."name", COUNT(t."id")::int AS transactions
      FROM "WORKSPACES" ws
      JOIN "WORKSPACE_MEMBERS" wm ON wm."workspace_id" = ws."id"
      LEFT JOIN "TRANSACTION" t ON t."member_id" = wm."id" AND t."deleted_at" IS NULL
      WHERE ws."deleted_at" IS NULL
      GROUP BY ws."name"
      ORDER BY ws."name"
    `);
    const row = result.rows[0];
    const passwordValid = row.password_hash ? await argon2.verify(row.password_hash, PASSWORD) : false;
    delete row.password_hash;
    console.log(JSON.stringify({ database: TARGET_DATABASE, ...row, passwordValid, byWorkspace: workspaceResult.rows }, null, 2));
  } finally {
    await client.end();
  }
}

const [command, argument] = process.argv.slice(2);
if (command === "rebuild") await rebuildDatabase();
else if (command === "migrate") await migrateDatabase();
else if (command === "import") await importPreparedData(argument);
else if (command === "grant-admin") await grantAdmin();
else if (command === "verify") await verifyImport();
else throw new Error("Usage: node scripts/import-private-finance.mjs <rebuild|migrate|import|grant-admin|verify> [prepared-json]");
