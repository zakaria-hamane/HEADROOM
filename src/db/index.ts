import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/** Postgres connection string. Vercel's Neon integration sets DATABASE_URL (and POSTGRES_URL on older setups). */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Add a Postgres database (for example Neon from the Vercel Marketplace) " +
        "and redeploy so accounts and saved plans work.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

const globalForDb = globalThis as unknown as { __headroomDb?: Promise<Database> };

async function connectPostgres(url: string): Promise<Database> {
  const [{ Pool }, { drizzle }, { attachDatabasePool }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
    import("@vercel/functions"),
  ]);
  // TLS comes from the connection string (Neon and most hosted providers include sslmode=require).
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // On Vercel Fluid compute, close idle connections before the function instance is suspended.
  attachDatabasePool(pool);
  return drizzle(pool, { schema });
}

/** Local development without DATABASE_URL: an embedded Postgres (PGlite) stored in ./.data, migrated on start. */
async function connectEmbedded(): Promise<Database> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.info(`[db] Using the embedded development database at ${dataDir}`);
  // Same query-builder API as node-postgres; only the driver differs.
  return db as unknown as Database;
}

/** Shared database handle. Created on first use, never at import time, so builds work without a database. */
export function getDb(): Promise<Database> {
  if (!globalForDb.__headroomDb) {
    const url = databaseUrl();
    let pending: Promise<Database>;
    if (url) pending = connectPostgres(url);
    else if (process.env.NODE_ENV === "production") pending = Promise.reject(new DatabaseNotConfiguredError());
    else pending = connectEmbedded();
    globalForDb.__headroomDb = pending.catch((error) => {
      globalForDb.__headroomDb = undefined;
      throw error;
    });
  }
  return globalForDb.__headroomDb;
}

export { schema };
