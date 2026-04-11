import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "../infrastructure/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const migrationsDir = join(__dirname, "../../db/migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const applied = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM schema_migrations WHERE filename = $1`,
      [file],
    );
    if (Number(applied.rows[0]?.c ?? 0) > 0) {
      console.log(`Skip (already applied): ${file}`);
      continue;
    }
    const sqlPath = join(migrationsDir, file);
    const sql = await readFile(sqlPath, "utf8");
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
    console.log(`Applied migration: ${file}`);
  }

  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
