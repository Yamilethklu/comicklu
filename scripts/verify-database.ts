/** Solo lectura: verifica que el PostgreSQL seleccionado tiene las tablas de ComicKlu.
 * No aplica migraciones, no crea tablas y no imprime secretos ni datos personales.
 */
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error("Falta DATABASE_URL o POSTGRES_URL."); process.exit(2); }
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 10000,
  ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});
const required = [
  "users", "comics", "panels", "assets", "usage", "stripe_events",
  "pdf_orders", "site_feedback", "user_followers",
  "credit_transactions", "notifications",
];
const rls = ["users", "comics", "panels", "assets", "usage", "stripe_events",
  "pdf_orders", "site_feedback", "user_followers", "credit_transactions", "notifications"];
try {
  await client.connect();
  const result = await client.query<{ tablename: string; rowsecurity: boolean }>(
    "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
    [required],
  );
  const existing = new Map(result.rows.map(row => [row.tablename, row.rowsecurity]));
  const missing = required.filter(t => !existing.has(t));
  const unprotected = rls.filter(t => existing.has(t) && !existing.get(t));
  const cols = await client.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
    [["pdf_orders", "site_feedback"]],
  );
  const columnSet = new Set(cols.rows.map(c => c.table_name + "." + c.column_name));
  const columnsNeeded = [
    "pdf_orders.user_id", "pdf_orders.comic_id", "pdf_orders.stripe_session_id",
    "site_feedback.user_id", "site_feedback.rating", "site_feedback.status",
  ];
  const missingColumns = columnsNeeded.filter(c => !columnSet.has(c));
  const journal = await client.query<{ exists: string | null }>(
    "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS exists",
  );
  console.log("ComicKlu: revisión SQL de solo lectura");
  console.log("Tablas requeridas:", required.length, "| encontradas:", existing.size);
  console.log("Tablas faltantes:", missing.length ? missing.join(", ") : "ninguna");
  console.log("Tablas sin RLS:", unprotected.length ? unprotected.join(", ") : "ninguna");
  console.log("Columnas faltantes:", missingColumns.length ? missingColumns.join(", ") : "ninguna");
  console.log("Registro Drizzle:", journal.rows[0]?.exists ? "presente" : "ausente");
  if (missing.length || missingColumns.length || unprotected.length || !journal.rows[0]?.exists) process.exitCode = 1;
} catch (e) {
  console.error("No se pudo verificar la estructura SQL:", e instanceof Error ? e.message : "Error desconocido");
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
