/* eslint-disable @typescript-eslint/no-require-imports -- This one-off Node.js importer intentionally uses CommonJS. */
/* One-off, idempotent importer for the approved legacy monthly CSV mapping. */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { Client } = require("pg");

const sourceDir = path.resolve(__dirname, "../.agents/documents");
const monthFiles = [
  ["Báo cáo chi phí - Tháng 10_25.csv", "2025-10"],
  ["Báo cáo chi phí - Tháng 11_25.csv", "2025-11"],
  ["Báo cáo chi phí - Tháng 1_26.csv", "2026-01"],
  ["Báo cáo chi phí - Tháng 2_26.csv", "2026-02"],
];

function parseCsv(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += char; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row); }
  const [header, ...data] = rows; header[0] = header[0].replace(/^\uFEFF/, "");
  return data.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

function amount(value) { return value ? value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".") : "0"; }
function dateForPeriod(value, period) { const day = value?.match(/^(\d{2})\//)?.[1] ?? "01"; return `${period}-${day}`; }
function workspaceName(period) { const [year, month] = period.split("-"); return `Chi tiêu ${month}/${year}`; }
function code(name, type) { return `${type}_${name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase().slice(0, 100); }

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  try {
    await db.query("BEGIN");
    const users = await db.query(`SELECT id, username FROM "USERS" WHERE username IN ('billy', 'joe') AND status = 'active' AND deleted_at IS NULL ORDER BY username`);
    const billy = users.rows.find((item) => item.username === "billy"); const joe = users.rows.find((item) => item.username === "joe");
    if (!billy || !joe) throw new Error("Both active users billy and joe are required for this import.");
    const roles = await db.query(`SELECT id, code FROM "ROLE" WHERE code IN ('ADMIN', 'MEMBER')`);
    const adminRole = roles.rows.find((item) => item.code === "ADMIN"); const memberRole = roles.rows.find((item) => item.code === "MEMBER");
    if (!adminRole || !memberRole) throw new Error("ADMIN and MEMBER roles are required.");

    let imported = 0; let skipped = 0;
    for (const [fileName, period] of monthFiles) {
      const existing = await db.query(`SELECT mw.workspace_id, COUNT(t.id)::int AS transaction_count FROM "MONTHLY_WORKSPACES" mw LEFT JOIN "WORKSPACE_MEMBERS" wm ON wm.workspace_id = mw.workspace_id LEFT JOIN "TRANSACTION" t ON t.member_id = wm.id AND t.deleted_at IS NULL WHERE mw.user_id = $1 AND mw.period = $2 GROUP BY mw.workspace_id`, [billy.id, period]);
      if (existing.rows[0]?.transaction_count > 0) throw new Error(`${period} already has imported transactions; no rows were duplicated.`);
      let workspaceId = existing.rows[0]?.workspace_id;
      if (!workspaceId) {
        workspaceId = randomUUID();
        await db.query(`INSERT INTO "WORKSPACES" (id, name, description, status, updated_at, base_currency, time_zone, approval_required, invite_code) VALUES ($1, $2, $3, 'deactive', CURRENT_TIMESTAMP, 'VND', 'Asia/Ho_Chi_Minh', true, $4)`, [workspaceId, workspaceName(period), `Imported legacy expense data for ${period}`, randomUUID()]);
        await db.query(`INSERT INTO "MONTHLY_WORKSPACES" (user_id, period, workspace_id) VALUES ($1, $2, $3)`, [billy.id, period, workspaceId]);
        await db.query(`INSERT INTO "WORKSPACE_MEMBERS" (id, workspace_id, user_id, role_id, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [randomUUID(), workspaceId, billy.id, adminRole.id]);
      }
      await db.query(`INSERT INTO "WORKSPACE_MEMBERS" (id, workspace_id, user_id, role_id, updated_at) SELECT $1, $2, $3, $4, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM "WORKSPACE_MEMBERS" WHERE workspace_id = $2 AND user_id = $3)`, [randomUUID(), workspaceId, joe.id, memberRole.id]);
      const member = await db.query(`SELECT id FROM "WORKSPACE_MEMBERS" WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' AND deleted_at IS NULL`, [workspaceId, billy.id]);
      const walletId = randomUUID();
      await db.query(`INSERT INTO "WALLETS" (id, name, opening_balance, current_balance, status, description, updated_at) VALUES ($1, 'Tiền mặt', 0, 0, 'active', 'Ví được tạo khi import CSV lịch sử', CURRENT_TIMESTAMP)`, [walletId]);
      await db.query(`INSERT INTO "WORKSPACE_WALLET" (workspace_id, wallet_id) VALUES ($1, $2)`, [workspaceId, walletId]);
      const categoryIds = new Map();
      async function category(name, type) { const key = `${type}:${name}`; if (categoryIds.has(key)) return categoryIds.get(key); const found = await db.query(`SELECT id FROM "CATEGORY" WHERE workspace_id = $1 AND name = $2 AND type = $3 AND deleted_at IS NULL LIMIT 1`, [workspaceId, name, type]); const id = found.rows[0]?.id ?? randomUUID(); if (!found.rows[0]) await db.query(`INSERT INTO "CATEGORY" (id, workspace_id, name, code, color, type, "order", status, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 0, 'active', CURRENT_TIMESTAMP)`, [id, workspaceId, name, code(name, type), type === "income" ? "#168A39" : "#E84335", type]); categoryIds.set(key, id); return id; }
      async function insertTransaction({ description, categoryName, type, value, date, note }) { if (Number(amount(value)) <= 0) return; const categoryId = await category(categoryName, type === "income" ? "income" : "expense"); const id = randomUUID(); await db.query(`INSERT INTO "TRANSACTION" (id, member_id, wallet_id, category_id, type, workflow_status, amount, description, date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id, member.rows[0].id, walletId, categoryId, type, amount(value), description + (note ? ` — ${note}` : ""), date]); await db.query(`UPDATE "WALLETS" SET current_balance = current_balance ${type === "income" ? "+" : "-"} $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [amount(value), walletId]); imported += 1; }
      for (const row of parseCsv(fs.readFileSync(path.join(sourceDir, fileName), "utf8"))) {
        const description = row["Thông tin chi tiết về chi phí"]; const budget = row["Ngân sách"]; const expense = row["Chi phí"]; if (!description) { skipped += 1; continue; }
        if (description.trim().toLowerCase() === "quà 20/10") { skipped += 1; continue; }
        const date = dateForPeriod(row["Ngày giao dịch"], period); const note = row["Ghi chú"];
        if (description.trim().toLowerCase() === "tết 2026") { await insertTransaction({ description, categoryName: "Lộc tết", type: "income", value: budget, date, note }); await insertTransaction({ description, categoryName: "Chi tết", type: "expense", value: expense, date, note }); continue; }
        if (Number(amount(budget)) > 0) await insertTransaction({ description, categoryName: "Lương", type: "income", value: budget, date, note });
        if (Number(amount(expense)) > 0) await insertTransaction({ description, categoryName: row["Danh mục"] || "Khác", type: "expense", value: expense, date, note });
      }
      await db.query(`INSERT INTO "AUDIT_LOG" (id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata, created_at) VALUES ($1, $2, $3, 'workspace.legacy_csv_imported', 'workspace', $2, $4, CURRENT_TIMESTAMP)`, [randomUUID(), workspaceId, billy.id, JSON.stringify({ fileName, period })]);
    }
    await db.query("COMMIT"); console.log(JSON.stringify({ admin: billy.username, member: joe.username, imported, skipped }));
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { await db.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
