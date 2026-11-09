import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, promoCodes, promoCodeUses } from "../../shared/schema";
import { requireAuth } from "../auth";
import { eq, count, and } from "drizzle-orm";
import { httpError } from "../ssrf";

export const promoRouter = Router();
promoRouter.use(requireAuth);

/** Listar códigos promocionales. */
promoRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(promoCodes).where(eq(promoCodes.active, true));
  res.json(rows);
});

/** Validar código. */
promoRouter.post("/validate", async (req, res) => {
  const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
  const [pc] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
  if (!pc) throw httpError(404, "Código no válido");
  if (!pc.active) throw httpError(400, "No activo");
  const [{ count: used }] = await db.select({ count: count() }).from(promoCodeUses).where(and(eq(promoCodeUses.promoCodeId, pc.id), eq(promoCodeUses.userId, req.user!.id)));
  const canUse = (used ?? 0) < (pc.maxUses ?? 1);
  res.json({ valid: canUse });
});

/** Canjear código. */
promoRouter.post("/use", async (req, res) => {
  const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
  const [pc] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
  if (!pc) throw httpError(404, "Código no válido");
  const [{ count: used }] = await db.select({ count: count() }).from(promoCodeUses).where(and(eq(promoCodeUses.promoCodeId, pc.id), eq(promoCodeUses.userId, req.user!.id)));
  if ((used ?? 0) >= (pc.maxUses ?? 1)) throw httpError(400, "Sin usos disponibles");
  await db.insert(promoCodeUses).values({ promoCodeId: pc.id, userId: req.user!.id });
  res.json({ ok: true });
});
