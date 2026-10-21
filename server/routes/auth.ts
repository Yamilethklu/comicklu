import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import signature from "cookie-signature";
import { db, pool } from "../db";
import { users, assets, passwordResets } from "@shared/schema";
import { hashPassword, verifyPassword, publicUser, requireAuth } from "../auth";
import { env, stripeEnabled, aiEnabled, mailEnabled } from "../env";
import { sendMail } from "../mail";
import { getStripe } from "../stripe";
import { localPathFromUrl } from "../files";
import fs from "node:fs/promises";
import { PLANS } from "@shared/plans";
import { effectivePlan, getUsage, comicCount } from "../usage";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: "Demasiados intentos. Espera unos minutos." } });

const registerBody = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Correo no válido")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
});
const passwordRule = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200);
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const loginBody = z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) });

function startSession(req: Express.Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

/** Solo la app móvil (X-Client: native) recibe el token; la web sigue usando la cookie httpOnly. */
const tokenFor = (req: Express.Request & { sessionID: string; get(h: string): string | undefined }) =>
  req.get("x-client") === "native" ? { token: signature.sign(req.sessionID, env.sessionSecret) } : {};

authRouter.post("/register", limiter, async (req, res) => {
  const body = registerBody.parse(req.body);
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
  if (exists) return res.status(409).json({ message: "Ya existe una cuenta con ese correo" });
  const [user] = await db.insert(users).values({
    email: body.email,
    name: body.name,
    passwordHash: await hashPassword(body.password),
    role: env.adminEmails.includes(body.email) ? "admin" : "user",
  }).returning();
  await startSession(req, user.id);
  res.status(201).json({ user: publicUser(user), ...tokenFor(req) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const body = loginBody.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, body.email));
  // Misma respuesta para correo inexistente o contraseña errónea.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return res.status(401).json({ message: "Correo o contraseña incorrectos" });
  }
  await startSession(req, user.id);
  res.json({ user: publicUser(user), ...tokenFor(req) });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("comic.sid");
    res.json({ ok: true });
  });
});

authRouter.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const plan = effectivePlan(req.user);
  res.json({
    user: publicUser(req.user),
    effectivePlan: plan,
    limits: PLANS[plan].limits,
    usage: await getUsage(req.user.id),
    comics: await comicCount(req.user.id),
  });
});

/** Cierra todas las sesiones de un usuario (opcionalmente conservando una). */
async function dropSessions(userId: string, keepSid?: string) {
  try {
    await pool.query(`DELETE FROM session WHERE sess->>'userId' = $1 AND ($2::text IS NULL OR sid <> $2)`, [userId, keepSid ?? null]);
  } catch (e) {
    console.warn("[auth] no se pudieron limpiar sesiones:", (e as Error).message);
  }
}

// ---------- Recuperar contraseña (requiere SMTP) ----------
authRouter.post("/forgot", limiter, async (req, res) => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Correo no válido")) }).parse(req.body);
  if (!mailEnabled()) return res.status(503).json({ message: "La recuperación por correo no está configurada en este servidor." });
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (user) {
    const token = randomBytes(32).toString("hex");
    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
    await db.insert(passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    try {
      await sendMail(user.email, "Restablece tu contraseña de Panelforge",
        `Hola ${user.name.split(" ")[0]},\n\nPara elegir una contraseña nueva abre este enlace (vale 1 hora):\n${env.appUrl}/restablecer?token=${token}\n\nSi no lo pediste tú, ignora este mensaje.`);
    } catch (e) {
      console.error("[auth] no se pudo enviar el correo:", (e as Error).message);
    }
  }
  // Misma respuesta exista o no la cuenta, para no revelar quién está registrado.
  res.json({ ok: true });
});

authRouter.post("/reset", limiter, async (req, res) => {
  const body = z.object({ token: z.string().min(20).max(200), password: passwordRule }).parse(req.body);
  const [row] = await db.select().from(passwordResets).where(and(
    eq(passwordResets.tokenHash, sha256(body.token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date()),
  ));
  if (!row) return res.status(400).json({ message: "El enlace no es válido o ya venció. Pide uno nuevo." });
  await db.update(users).set({ passwordHash: await hashPassword(body.password) }).where(eq(users.id, row.userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, row.userId));
  await dropSessions(row.userId);
  res.json({ ok: true });
});

// ---------- Cuenta ----------
authRouter.post("/password", requireAuth, limiter, async (req, res) => {
  const body = z.object({ current: z.string().min(1), password: passwordRule }).parse(req.body);
  if (!(await verifyPassword(body.current, req.user!.passwordHash))) return res.status(400).json({ message: "La contraseña actual no es correcta" });
  await db.update(users).set({ passwordHash: await hashPassword(body.password) }).where(eq(users.id, req.user!.id));
  await dropSessions(req.user!.id, req.sessionID);
  res.json({ ok: true });
});

/** Borrado de cuenta (obligatorio en App Store): cancela la suscripción, borra datos y archivos. */
authRouter.delete("/account", requireAuth, limiter, async (req, res) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
  const user = req.user!;
  if (!(await verifyPassword(password, user.passwordHash))) return res.status(400).json({ message: "La contraseña no es correcta" });

  const live = user.subscriptionStatus && ["active", "trialing", "past_due"].includes(user.subscriptionStatus);
  if (live && user.stripeSubscriptionId && stripeEnabled()) {
    try {
      await getStripe().subscriptions.cancel(user.stripeSubscriptionId);
    } catch (e) {
      console.error("[auth] no se pudo cancelar la suscripción:", (e as Error).message);
      return res.status(502).json({ message: "No pudimos cancelar tu suscripción en Stripe, así que no se borró la cuenta (para que no te sigan cobrando). Cancélala desde «Administrar suscripción» e inténtalo de nuevo." });
    }
  }

  const files = await db.select({ url: assets.url }).from(assets).where(eq(assets.userId, user.id));
  await db.delete(users).where(eq(users.id, user.id)); // borra en cascada cómics, viñetas, uso, renders y assets
  await Promise.all(files.map(async (f) => {
    const p = localPathFromUrl(f.url);
    if (p) await fs.unlink(p).catch(() => {});
  }));
  await dropSessions(user.id);
  req.session.destroy(() => {
    res.clearCookie("comic.sid");
    res.json({ ok: true });
  });
});

export const configRouter = Router();
configRouter.get("/", (_req, res) => {
  res.json({
    plans: PLANS,
    stripe: stripeEnabled(),
    ai: aiEnabled(),
    mail: mailEnabled(),
    yearly: {
      pro: !!env.prices.pro.year,
      premium: !!env.prices.premium.year,
    },
  });
});

export { requireAuth };
