import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import signature from "cookie-signature";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { ZodError } from "zod";
import { env } from "./env";
import { pool, runMigrations } from "./db";
import { loadUser } from "./auth";
import { authRouter, configRouter } from "./routes/auth";
import { comicsRouter, uploadsRouter } from "./routes/comics";
import { aiRouter } from "./routes/ai";
import { billingRouter, stripeWebhook } from "./routes/billing";
import { videoRouter, failStaleRenders } from "./routes/video";
import { uploadRoot, ensureUploadDir } from "./files";

export async function createApp() {
  await runMigrations();
  await ensureUploadDir();
  await failStaleRenders();

  const app = express();
  if (env.isProd) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({
    contentSecurityPolicy: env.isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: env.https ? [] : null,
      },
    } : false,
    hsts: env.https,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // la app móvil carga /media desde otro origen
  }));

  // CORS para la app móvil (Capacitor). Usa token Bearer, no cookies, así que no se permiten credenciales.
  const allowedOrigins = new Set([
    "capacitor://localhost", "https://localhost", "http://localhost",
    ...(process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ]);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
      if (req.method === "OPTIONS") return void res.sendStatus(204);
    }
    next();
  });

  // El webhook de Stripe necesita el body crudo: va ANTES de express.json().
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);

  app.use(express.json({ limit: "1mb" }));

  // La app móvil manda `Authorization: Bearer <token>`; el token es el mismo id de sesión firmado de la cookie.
  app.use((req, _res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
    if (m && signature.unsign(m[1], env.sessionSecret) !== false) {
      req.headers.cookie = `comic.sid=${encodeURIComponent("s:" + m[1])}`;
    }
    next();
  });

  // Los archivos se sirven antes de la sesión: así no consultan la base de datos en cada imagen.
  app.use("/media", express.static(uploadRoot, { maxAge: "7d", immutable: true, index: false, dotfiles: "deny" }));

  const PgStore = connectPgSimple(session);
  app.use(session({
    name: "comic.sid",
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: env.https, maxAge: 30 * 24 * 3600 * 1000 },
  }));
  app.use(loadUser);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/config", configRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/comics", comicsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api", videoRouter);
  app.use("/api", (_req, res) => res.status(404).json({ message: "Ruta no encontrada" }));

  const server = http.createServer(app);

  if (env.isProd) {
    const dir = path.resolve("dist/public");
    if (!fs.existsSync(dir)) throw new Error("Falta dist/public. Ejecuta `npm run build` primero.");
    app.use(express.static(dir, { index: false, maxAge: "1h" }));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dir, "index.html")));
  } else if (process.env.NODE_ENV !== "test") {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: err.issues[0]?.message ?? "Datos no válidos" });
    }
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "El archivo supera 8 MB" });
    const status = err?.status ?? err?.statusCode ?? 500;
    if (status === 500) console.error(err);
    res.status(status).json({ message: status >= 500 && status !== 503 && status !== 502 ? "Error interno del servidor" : err.message });
  });

  return { app, server };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("index.ts")) {
  createApp().then(({ server }) => {
    server.listen(env.port, "0.0.0.0", () => console.log(`Comic Studio escuchando en ${env.appUrl} (puerto ${env.port})`));
  }).catch((e) => { console.error(e); process.exit(1); });
}
