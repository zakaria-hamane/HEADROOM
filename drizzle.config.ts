import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env files on its own.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local: fine */
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Without DATABASE_URL, `drizzle-kit studio` opens the embedded development database.
  ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
  strict: true,
  verbose: true,
});
