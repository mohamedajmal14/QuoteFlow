import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createDatabasePool } from "../postgres-store";

export const runMigrations = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('quoteflow:migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationDirectory = path.resolve(process.cwd(), "db", "migrations");
    const filenames = (await fs.readdir(migrationDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    for (const filename of filenames) {
      const alreadyApplied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
      if (alreadyApplied.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationDirectory, filename), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.log(`Applied migration ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('quoteflow:migrations'))");
    } finally {
      client.release();
    }
  }
};

const main = async () => {
  const pool = createDatabasePool();
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
