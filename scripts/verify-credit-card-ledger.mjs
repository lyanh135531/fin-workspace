import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = await readFile(new URL("./verify-credit-card-ledger.sql", import.meta.url), "utf8");
  const result = await pool.query(sql);
  if (result.rows.length) {
    console.error(JSON.stringify(result.rows, null, 2));
    process.exitCode = 1;
  } else {
    console.info("Credit-card ledger invariants: OK");
  }
} finally {
  await pool.end();
}

