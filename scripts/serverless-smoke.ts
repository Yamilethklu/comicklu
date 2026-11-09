// Smoke test de la misma entrada de Vercel: sin servicios externos ni secretos reales.
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SECRET_KEY = "ci-test-only";
process.env.SESSION_SECRET = "ci-test-session-secret-not-for-production";

import assert from "node:assert/strict";
import http from "node:http";

// La importación de la función es deliberadamente dinámica para que las
// variables de prueba estén configuradas antes de evaluar server/env.ts.
const { default: handler } = await import("../api/handler");
const server = http.createServer((req, res) => void handler(req, res));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert(address && typeof address !== "string");
  const res = await fetch(`http://127.0.0.1:${address.port}/api/handler?route=health`);
  const json = await res.json() as { ok?: boolean; code?: string; checks?: { database?: { ok: boolean } } };
  assert.equal(res.status, 200, `Serverless API HTTP ${res.status}: ${JSON.stringify(json)}`);
  assert.equal(json.ok, true);
  assert.equal(json.checks?.database?.ok, true);
  console.log("Serverless API handler: bootstrap, rewrite and database health OK");
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  const { pool } = await import("../server/db");
  await pool.end();
}
