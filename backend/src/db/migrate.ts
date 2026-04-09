import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "../infrastructure/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const sqlPath = join(__dirname, "../../db/migrations/001_initial.sql");
  const sql = await readFile(sqlPath, "utf8");
  const pool = getPool();
  await pool.query(sql);
  console.log("Migration 001_initial.sql applied.");
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
