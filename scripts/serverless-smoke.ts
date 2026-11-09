// Smoke test de la entrada de Vercel con PostgreSQL local y Storage simulado.
process.env.NODE_ENV = "test";
process.env.VERCEL = "1";
process.env.DATABASE_URL ||= process.env.POSTGRES_URL || "postgres://comic:comic@localhost:5432/comicdb";
process.env.SUPABASE_SECRET_KEY = "ci-test-only";
process.env.SESSION_SECRET = "ci-test-session-secret-not-for-production";

import assert from "node:assert/strict";
import http from "node:http";

const storage = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("content-type", "application/json");
  if (url.pathname.startsWith("/storage/v1/bucket/")) {
    return void res.end(JSON.stringify({ id: "comicklu-media", name: "comicklu-media", public: false }));
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/")) {
    return void res.end(JSON.stringify({ signedURL: `${process.env.SUPABASE_URL}/signed/media.png` }));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ message: "not found" }));
});
await new Promise<void>((resolve) => storage.listen(0, "127.0.0.1", resolve));
const storageAddress = storage.address();
assert(storageAddress && typeof storageAddress !== "string");
process.env.SUPABASE_URL = `http://127.0.0.1:${storageAddress.port}`;

// La importación de la función es deliberadamente dinámica para que las
// variables de prueba estén configuradas antes de evaluar server/env.ts.
const { default: handler } = await import("../api/handler");
const server = http.createServer((req, res) => void handler(req, res));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert(address && typeof address !== "string");
  const res = await fetch(`http://127.0.0.1:${address.port}/api/handler?route=health`);
  const json = await res.json() as { ok?: boolean; checks?: { database?: { ok: boolean }; supabase?: { ok: boolean } } };
  assert.equal(res.status, 200, `Serverless API HTTP ${res.status}: ${JSON.stringify(json)}`);
  assert.equal(json.ok, true);
  assert.equal(json.checks?.database?.ok, true);
  assert.equal(json.checks?.supabase?.ok, true);
  const media = await fetch(`http://127.0.0.1:${address.port}/api/handler?media=00000000-0000-4000-8000-000000000000.png`, { redirect: "manual" });
  assert.equal(media.status, 302);
  assert.match(media.headers.get("location") ?? "", /\/signed\/media\.png$/);
  console.log("Serverless API handler: database, storage, health and signed media redirect OK");
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await new Promise<void>((resolve, reject) => storage.close((err) => err ? reject(err) : resolve()));
  const { pool } = await import("../server/db");
  await pool.end();
}
