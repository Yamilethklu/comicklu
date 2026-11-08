import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, pushTokens, notifications } from "@shared/schema";
import { requireAuth } from "../auth";
import { and, eq, desc, count } from "drizzle-orm";
import { httpError } from "../ssrf";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

/** Registrar token de push (app móvil Capacitor). */
notificationsRouter.post("/register-token", async (req, res) => {
  const { token, platform } = z.object({
    token: z.string().min(10),
    platform: z.enum(["ios", "android", "web"]),
  }).parse(req.body);
  await db.insert(pushTokens).values({
    userId: req.user!.id,
    token,
    platform,
  }).onConflictDoUpdate({ target: pushTokens.token, set: { platform, userId: req.user!.id } });
  res.json({ ok: true });
});

/** Listar notificaciones del usuario (no leídas primero). */
notificationsRouter.get("/", async (req, res) => {
  const rows = await db.select().from(notifications)
    .where(eq(notifications.userId, req.user!.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  res.json(rows);
});

/** Marcar una notificación como leída. */
notificationsRouter.post("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
  res.json({ ok: true });
});

/** Marcar todas como leídas. */
notificationsRouter.post("/read-all", async (req, res) => {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, req.user!.id));
  res.json({ ok: true });
});

/** Contador de no leídas. */
notificationsRouter.get("/unread-count", async (req, res) => {
  const [{ count: unreadCountRaw }] = await db.select({ count: count() }).from(notifications).where(and(eq(notifications.userId, req.user!.id), eq(notifications.read, false)));
  res.json({ unreadCount: Number(unreadCountRaw) });
});

/** Crear notificación (uso interno desde otras rutas). */
export async function createNotification(userId: string, type: string, title: string, body: string, data: Record<string, any> = {}) {
  await db.insert(notifications).values({ userId, type, title, body, data });
  // Enviar push si hay tokens (placeholder: aquí se integraría FCM/APNs en producción)
  const tokens = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, userId));
  for (const t of tokens) {
    try {
      await sendPush(t.token, title, body, data);
    } catch {}
  }
}

/** Envío de push (stub - integrar con Firebase/APNs en producción). */
async function sendPush(token: string, title: string, body: string, data?: Record<string, any>) {
  // En producción: llamar a FCM HTTP v1 o APNs con las credenciales configuradas
  console.log(`[push] ${token.slice(0,12)}... "${title}": ${body}`, data);
}
