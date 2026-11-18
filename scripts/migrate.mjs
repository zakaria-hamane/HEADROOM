// Applies the SQL migrations in ./drizzle.
//  - DATABASE_URL (or POSTGRES_URL) set: migrates that Postgres database (runs on every Vercel deploy).
//  - Not set on Vercel / CI: skips with a warning, so the site still deploys (accounts stay off until a database is added).
//  - Not set locally: migrates the embedded development database in ./.data/pglite.
import { mkdirSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const migrationsFolder = path.join(process.cwd(), "drizzle");

async function migratePostgres() {
  const [{ default: pg }, { drizzle }, { migrate }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
    import("drizzle-orm/node-postgres/migrator"),
  ]);
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    console.log("[migrate] Postgres database is up to date.");
  } finally {
    await pool.end();
  }
}

async function migrateEmbedded() {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
  const client = new PGlite(path.join(process.cwd(), ".data", "pglite"));
  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.log("[migrate] Embedded development database is up to date (.data/pglite).");
  } finally {
    await client.close();
  }
}

try {
  if (url) await migratePostgres();
  else if (process.env.VERCEL || process.env.CI) {
    console.warn(
      "[migrate] DATABASE_URL is not set: skipping migrations. The planner works, but sign-up and saved plans " +
        "stay disabled until you connect a Postgres database (Vercel → Storage → Neon) and redeploy.",
    );
  } else await migrateEmbedded();
} catch (error) {
  console.error("[migrate] Migration failed:", error);
  process.exit(1);
}
