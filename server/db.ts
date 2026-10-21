import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "@shared/schema";
import { env } from "./env";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export async function runMigrations() {
  await migrate(db, { migrationsFolder: "migrations" });
}
