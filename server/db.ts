import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../shared/schema";
import { env } from "./env";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: process.env.VERCEL ? 1 : 5,
  connectionTimeoutMillis: 15000,
  ssl: env.databaseSslMode === "require" ? { rejectUnauthorized: false }
    : env.databaseSslMode === "verify-ca" || env.databaseSslMode === "verify-full" ? { rejectUnauthorized: true }
    : undefined,
});
export const db = drizzle(pool, { schema });

export async function runMigrations() {
  await migrate(db, { migrationsFolder: "migrations" });
  if (env.supabaseUrl) {
    // Express owns authentication. Supabase Data API clients must not read these tables.
    for (const table of ["users", "comics", "panels", "assets", "usage", "renders", "stripe_events", "password_resets", "session"]) {
      await pool.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE public."${table}" FROM anon, authenticated;`);
    }
  }
}
