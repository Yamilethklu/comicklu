import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { comics, panels, renders, assets } from "@shared/schema";
import { requireAuth } from "../auth";
import { consume } from "../usage";
import { renderComicVideo } from "../video";
import { httpError } from "../ssrf";

export const videoRouter = Router();
videoRouter.use(requireAuth);

// Cola simple en memoria: un render a la vez para no saturar CPU.
let chain: Promise<unknown> = Promise.resolve();
const pending = new Set<number>();

async function processRender(renderId: number, comicId: number, userId: string, refund: () => Promise<void>) {
  try {
    await db.update(renders).set({ status: "processing" }).where(eq(renders.id, renderId));
    const ps = await db.select().from(panels).where(eq(panels.comicId, comicId)).orderBy(asc(panels.position));
    const url = await renderComicVideo(ps);
    await db.insert(assets).values({ userId, type: "video", url });
    await db.update(renders).set({ status: "done", url }).where(eq(renders.id, renderId));
  } catch (e) {
    await refund().catch(() => {});
    console.error("[video] render", renderId, (e as Error).message);
    await db.update(renders).set({ status: "failed", error: (e as Error).message.slice(0, 300) }).where(eq(renders.id, renderId));
  } finally {
    pending.delete(renderId);
  }
}

videoRouter.post("/comics/:id/video", async (req, res) => {
  const comicId = Number(req.params.id);
  const [c] = await db.select().from(comics).where(and(eq(comics.id, comicId), eq(comics.userId, req.user!.id)));
  if (!c) throw httpError(404, "Cómic no encontrado");
  const ps = await db.select().from(panels).where(eq(panels.comicId, comicId));
  if (!ps.some((p) => p.imageUrl)) throw httpError(400, "Agrega al menos una viñeta con imagen para crear el video.");

  const refund = await consume(req.user!, "video");
  const [r] = await db.insert(renders).values({ userId: req.user!.id, comicId }).returning();
  pending.add(r.id);
  chain = chain.then(() => processRender(r.id, comicId, req.user!.id, refund));
  res.status(202).json(r);
});

videoRouter.get("/comics/:id/renders", async (req, res) => {
  const rows = await db.select().from(renders)
    .where(and(eq(renders.comicId, Number(req.params.id)), eq(renders.userId, req.user!.id)))
    .orderBy(desc(renders.createdAt)).limit(10);
  res.json(rows);
});

/** Al arrancar, los renders que quedaron a medias se marcan como fallidos. */
export async function failStaleRenders() {
  await db.update(renders).set({ status: "failed", error: "El servidor se reinició durante el render" })
    .where(eq(renders.status, "processing"));
  await db.update(renders).set({ status: "failed", error: "El servidor se reinició antes de procesar" })
    .where(eq(renders.status, "queued"));
}
