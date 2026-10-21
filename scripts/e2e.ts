// Prueba de extremo a extremo del backend (requiere Postgres). Uso: DATABASE_URL=... npm test
process.env.NODE_ENV = "test";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_test_secret";
process.env.STRIPE_PRICE_PRO_MONTHLY ||= "price_test_pro_month";
process.env.STRIPE_PRICE_PREMIUM_MONTHLY ||= "price_test_premium_month";
process.env.UPLOAD_DIR = "/tmp/comic-e2e-uploads";
// IA: se apunta a un servidor simulado (así la prueba no depende de internet ni de servicios externos).
process.env.POLLINATIONS_TEXT_URL = "http://localhost:5056/openai";
process.env.POLLINATIONS_IMAGE_URL = "http://localhost:5056/img/{prompt}";
process.env.POLLINATIONS_AUDIO_URL = "http://localhost:5056/tts/{prompt}";
process.env.AI_RETRY_DELAY_MS = "10";

import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const fakeMp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(4000, 1)]);
let storyCalls = 0;
const mockAi = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url ?? "");
  if (url.includes("FALLA")) { res.statusCode = 500; return void res.end("error"); }
  if (req.method === "POST" && url.startsWith("/openai")) {
    storyCalls++;
    const good = JSON.stringify({ title: "Mi aventura", synopsis: "Una prueba", panels: [1, 2, 3, 4].map((n) => ({ caption: `Narración ${n}`, dialogue: `Ana: hola ${n}`, prompt: `scene ${n}` })) });
    // 1.ª respuesta: texto basura (debe reintentar); después JSON envuelto en un bloque de código.
    const content = storyCalls % 2 === 1 ? "Claro, aquí tienes..." : "```json\n" + good + "\n```";
    res.setHeader("content-type", "application/json");
    return void res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  }
  if (url.startsWith("/img/")) { res.setHeader("content-type", "image/png"); return void res.end(PNG); }
  if (url.startsWith("/tts/")) { res.setHeader("content-type", "audio/mpeg"); return void res.end(fakeMp3); }
  res.statusCode = 404; res.end();
});
await new Promise<void>((r) => mockAi.listen(5056, r));

const { createApp } = await import("../server/index");
const { db, pool } = await import("../server/db");
const { users } = await import("../shared/schema");
const { consume, LimitError } = await import("../server/usage");
const { testOutbox } = await import("../server/mail");

const { server } = await createApp();
await new Promise<void>((r) => server.listen(5055, r));
const base = "http://localhost:5055";
let cookie = "";

async function api(method: string, path: string, body?: unknown, extra: RequestInit = {}) {
  const res = await fetch(base + path, {
    method, redirect: "manual",
    headers: { ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}), cookie, ...(extra.headers as object) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
const ok = (name: string) => console.log("  ✔", name);

const email = `e2e_${Date.now()}@test.dev`;
try {
  // --- auth
  let r = await api("POST", "/api/auth/register", { name: "Tester", email, password: "short" });
  assert.equal(r.status, 400); ok("registro rechaza contraseña corta");
  r = await api("POST", "/api/auth/register", { name: "Tester", email, password: "password123" });
  assert.equal(r.status, 201); ok("registro");
  r = await api("GET", "/api/auth/me");
  assert.equal(r.json.user.email, email); assert.equal(r.json.effectivePlan, "free"); ok("sesión persiste (me)");
  r = await api("POST", "/api/auth/register", { name: "Dup", email, password: "password123" });
  assert.equal(r.status, 409); ok("correo duplicado");

  // --- comics + límites free
  r = await api("POST", "/api/comics", { title: "Mi cómic", style: "manga", panels: [{ caption: "Hola" }] });
  assert.equal(r.status, 201); const id = r.json.id; assert.equal(r.json.panels.length, 1); ok("crear cómic");
  r = await api("POST", "/api/comics", { title: "Dos" }); assert.equal(r.status, 201);
  r = await api("POST", "/api/comics", { title: "Tres" }); assert.equal(r.status, 201);
  r = await api("POST", "/api/comics", { title: "Cuatro" }); assert.equal(r.status, 402); ok("límite de 3 cómics en plan Gratis");
  r = await api("PUT", `/api/comics/${id}`, { title: "X", panels: Array.from({ length: 13 }, () => ({})) });
  assert.equal(r.status, 402); ok("límite de 12 viñetas en plan Gratis");
  r = await api("PUT", `/api/comics/${id}`, { title: "Editado", story: "había una vez", style: "cyberpunk", panels: [{ caption: "a", imageUrl: "https://evil.example/x.png" }, { caption: "b" }] });
  assert.equal(r.status, 200); assert.equal(r.json.panels[0].imageUrl, null); assert.equal(r.json.panels.length, 2); ok("guardar + URL externa descartada");
  r = await api("GET", `/api/comics/${id}/export.json`);
  assert.equal(r.json.formato, "comic-studio/1"); assert.equal(r.json.vinetas.length, 2); ok("exportar JSON");

  // --- subida de imágenes
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  let fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "a.png");
  r = await api("POST", "/api/uploads", fd); assert.equal(r.status, 201); assert.match(r.json.url, /^\/media\/.+\.png$/); ok("subir PNG");
  fd = new FormData(); fd.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png");
  r = await api("POST", "/api/uploads", fd); assert.equal(r.status, 400); ok("rechaza archivo falso/SVG");
  r = await api("POST", "/api/uploads/from-url", { url: "http://127.0.0.1:5055/api/health" });
  assert.equal(r.status, 400); ok("SSRF: bloquea localhost");
  r = await api("POST", "/api/uploads/from-url", { url: "http://169.254.169.254/latest/meta-data" });
  assert.equal(r.status, 400); ok("SSRF: bloquea metadata cloud");
  const media = await fetch(base + (await api("GET", "/api/uploads")).json[0].url); assert.equal(media.status, 200); ok("archivo servido en /media");

  // --- usuario ajeno no accede
  const saved = cookie; cookie = "";
  await api("POST", "/api/auth/register", { name: "Otro", email: `o_${email}`, password: "password123" });
  r = await api("GET", `/api/comics/${id}`); assert.equal(r.status, 404); ok("aislamiento entre usuarios");
  cookie = saved;

  // --- IA gratuita / planes
  r = await api("POST", "/api/ai/story", { idea: "Una detective en una ciudad flotante", panelCount: 4 });
  assert.equal(r.status, 200); assert.equal(r.json.panels.length, 4); assert.equal(r.json.title, "Mi aventura");
  ok("guion gratis: reintenta si la IA responde mal y entiende JSON dentro de ```");
  r = await api("POST", "/api/ai/image", { prompt: "una detective bajo la lluvia", style: "cyberpunk" });
  assert.equal(r.status, 201); assert.match(r.json.url, /^\/media\/.+\.png$/);
  assert.equal((await fetch(base + r.json.url)).status, 200); ok("imagen con IA gratis (se guarda como archivo propio)");
  r = await api("POST", "/api/ai/image", { prompt: "FALLA siempre" }); assert.equal(r.status, 502);
  r = await api("GET", "/api/auth/me"); assert.equal(r.json.usage.image, 1); ok("si la IA falla no se descuenta del plan");
  r = await api("POST", "/api/ai/voice", { text: "hola" }); assert.equal(r.status, 402); ok("Gratis no incluye voz (402)");
  const [me] = await db.select().from(users).where(eq(users.email, email));
  await assert.rejects(() => consume(me, "voice"), LimitError);
  for (let i = 0; i < 4; i++) await consume(me, "image");
  await assert.rejects(() => consume(me, "image"), LimitError); ok("límite mensual de imágenes (5) atómico");

  // --- Stripe: checkout (sin llamar a Stripe real) y webhook firmado
  r = await api("POST", "/api/billing/portal", {}); assert.equal(r.status, 400); ok("portal sin cliente → 400");
  const stripe = new Stripe("sk_test_dummy");
  const sub = (status: string, price: string, cancel = false) => ({
    id: "evt_" + Math.random().toString(36).slice(2), object: "event", type: "customer.subscription.updated",
    data: { object: { id: "sub_123", object: "subscription", customer: "cus_e2e", status, cancel_at_period_end: cancel, metadata: { userId: me.id },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { id: price } }] } } },
  });
  const post = async (evt: object, secret = "whsec_test_secret") => {
    const payload = JSON.stringify(evt);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return fetch(base + "/api/billing/webhook", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
  };
  let evt = sub("active", "price_test_pro_month");
  assert.equal((await post(evt, "whsec_equivocado")).status, 400); ok("webhook con firma falsa → 400");
  assert.equal((await post(evt)).status, 200);
  assert.equal(((await (await post(evt)).json()) as any).duplicate, true); ok("webhook idempotente");
  r = await api("GET", "/api/auth/me");
  assert.equal(r.json.effectivePlan, "pro"); assert.equal(r.json.limits.comics, 25); ok("webhook activa plan Pro");
  r = await api("POST", "/api/comics", { title: "Cuatro" }); assert.equal(r.status, 201); ok("Pro permite más cómics");
  r = await api("POST", "/api/billing/checkout", { plan: "premium" }); assert.equal(r.status, 409); assert.equal(r.json.usePortal, true); ok("checkout con suscripción activa → usar portal");

  // --- voz gratis (Pro): proveedor externo y respaldo local
  r = await api("POST", "/api/ai/voice", { text: "Hola, esta es una prueba", voice: "nova" });
  assert.equal(r.status, 201); assert.match(r.json.url, /\.mp3$/); ok("voz con IA gratis (proveedor externo)");
  let espeak = true; try { execFileSync("espeak-ng", ["--version"], { stdio: "ignore" }); } catch { espeak = false; }
  if (espeak) {
    r = await api("POST", "/api/ai/voice", { text: "FALLA hola mundo", voice: "onyx", language: "español" });
    assert.equal(r.status, 201); const a = await fetch(base + r.json.url); assert.equal(a.status, 200);
    assert.ok((await a.arrayBuffer()).byteLength > 2000); ok("voz: si el proveedor falla, se usa espeak-ng local");
  } else console.log("  - (espeak-ng no instalado: se omite la prueba del respaldo de voz)");

  // --- video real con ffmpeg (Pro)
  const imgPath = "/tmp/e2e_frame.png";
  execFileSync(process.env.FFMPEG_PATH || (await import("ffmpeg-static")).default as string, ["-y", "-f", "lavfi", "-i", "color=c=0xff3d81:s=640x360", "-frames:v", "1", imgPath], { stdio: "ignore" });
  fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(imgPath)]), "f.png");
  const up = await api("POST", "/api/uploads", fd); assert.equal(up.status, 201);
  r = await api("PUT", `/api/comics/${id}`, { title: "Video", panels: [{ imageUrl: up.json.url, caption: "Primera viñeta del cómic" }, { imageUrl: up.json.url, dialogue: "Ana: ¡Funciona!" }] });
  assert.equal(r.status, 200);
  r = await api("POST", `/api/comics/${id}/video`, {}); assert.equal(r.status, 202);
  let status = "queued", url: string | null = null;
  for (let i = 0; i < 60 && !["done", "failed"].includes(status); i++) {
    await new Promise((s) => setTimeout(s, 1000));
    const l = (await api("GET", `/api/comics/${id}/renders`)).json[0]; status = l.status; url = l.url; if (l.error) console.log("   error:", l.error);
  }
  assert.equal(status, "done"); const v = await fetch(base + url!); assert.equal(v.status, 200);
  assert.ok((await v.arrayBuffer()).byteLength > 5000); ok(`video MP4 renderizado (${url})`);

  // --- cuenta: cambiar / recuperar contraseña, borrar cuenta
  r = await api("POST", "/api/auth/password", { current: "mala", password: "otraclave123" }); assert.equal(r.status, 400);
  r = await api("POST", "/api/auth/password", { current: "password123", password: "otraclave123" }); assert.equal(r.status, 200); ok("cambiar contraseña");
  const forgotCookie = cookie; cookie = "";
  r = await api("POST", "/api/auth/login", { email, password: "password123" }); assert.equal(r.status, 401);
  r = await api("POST", "/api/auth/login", { email, password: "otraclave123" }); assert.equal(r.status, 200); ok("la contraseña vieja ya no sirve");
  r = await api("POST", "/api/auth/forgot", { email: `no_existe_${email}` }); assert.equal(r.status, 200);
  assert.equal(testOutbox.length, 0); ok("recuperar: misma respuesta si la cuenta no existe (y no envía correo)");
  r = await api("POST", "/api/auth/forgot", { email }); assert.equal(r.status, 200); assert.equal(testOutbox.length, 1);
  const token = /token=([a-f0-9]+)/.exec(testOutbox[0].text)![1]; ok("recuperar: se envía el enlace por correo");
  r = await api("POST", "/api/auth/reset", { token: "x".repeat(64), password: "nuevaclave123" }); assert.equal(r.status, 400);
  r = await api("POST", "/api/auth/reset", { token, password: "nuevaclave123" }); assert.equal(r.status, 200);
  r = await api("POST", "/api/auth/reset", { token, password: "nuevaclave456" }); assert.equal(r.status, 400); ok("recuperar: el enlace sirve una sola vez");
  r = await api("GET", "/api/auth/me"); assert.equal(r.json.user, null); ok("restablecer cierra las sesiones abiertas");
  r = await api("POST", "/api/auth/login", { email, password: "nuevaclave123" }); assert.equal(r.status, 200);
  void forgotCookie;

  const delEmail = `del_${Date.now()}@test.dev`; const keep = cookie; cookie = "";
  await api("POST", "/api/auth/register", { name: "Borrar", email: delEmail, password: "password123" });
  fd = new FormData(); fd.append("file", new Blob([PNG], { type: "image/png" }), "d.png");
  const delUp = await api("POST", "/api/uploads", fd); assert.equal(delUp.status, 201);
  r = await api("DELETE", "/api/auth/account", { password: "incorrecta" }); assert.equal(r.status, 400);
  r = await api("DELETE", "/api/auth/account", { password: "password123" }); assert.equal(r.status, 200);
  r = await api("GET", "/api/auth/me"); assert.equal(r.json.user, null);
  r = await api("POST", "/api/auth/login", { email: delEmail, password: "password123" }); assert.equal(r.status, 401);
  assert.equal((await fetch(base + delUp.json.url)).status, 404); ok("borrar cuenta: elimina usuario, sesión y archivos");
  cookie = keep;

  // --- cancelación
  evt = { ...sub("canceled", "price_test_pro_month"), type: "customer.subscription.deleted" };
  assert.equal((await post(evt)).status, 200);
  r = await api("GET", "/api/auth/me"); assert.equal(r.json.effectivePlan, "free"); ok("cancelación vuelve a Gratis");
  r = await api("POST", `/api/comics/${id}/video`, {}); assert.equal(r.status, 402); ok("sin plan no hay video");

  console.log("\nTODO OK");
} catch (e) {
  console.error("\nFALLÓ:", e);
  process.exitCode = 1;
} finally {
  await db.delete(users).where(eq(users.email, email)).catch(() => {});
  await db.delete(users).where(eq(users.email, `o_${email}`)).catch(() => {});
  await db.delete(users).where(eq(users.email, `del_${email.slice(4)}`)).catch(() => {});
  mockAi.close(); server.close(); await pool.end();
}
