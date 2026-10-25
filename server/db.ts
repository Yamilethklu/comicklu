import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "@shared/schema";
import { env } from "./env";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 15000,
  ssl: env.databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export async function runMigrations() {
  await migrate(db, { migrationsFolder: "migrations" });
  if (env.supabaseUrl) {
    // Express owns authentication. Supabase Data API clients must not read these tables.
    await pool.query(`CREATE TABLE IF NOT EXISTS public.session (
      sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL
    ); CREATE INDEX IF NOT EXISTS session_expire_idx ON public.session(expire);`);
    for (const table of ["users", "comics", "panels", "assets", "usage", "renders", "stripe_events", "password_resets", "session"]) {
      await pool.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE public."${table}" FROM anon, authenticated;`);
    }
  }
}
