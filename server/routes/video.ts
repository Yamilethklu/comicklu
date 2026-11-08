import { Router } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { comics, panels, renders, assets } from "@shared/schema";
import { requireAuth } from "../auth";
import { consume } from "../usage";
import { renderComicVideo } from "../video";
import { httpError } from "../ssrf";

export const videoRouter = Router();
videoRouter.use(requireAuth);

let workerRunning = false;

/** Procesa un render individual y lo deja en done/failed. */
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
  }
}

/** Worker persistente: toma un render en cola con SKIP LOCKED, lo procesa y repite. */
async function processQueue() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    while (true) {
      const result = await db.execute(sql`
        SELECT id, comic_id, user_id FROM renders
        WHERE status = 'queued'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const rows = (result as any).rows ?? [];
      const job = rows[0];
      if (!job) break;
      await processRender(job.id, job.comic_id, job.user_id, async () => {
        // Reembolsar crédito de video si el render falló (processRender ya hace refund internamente)
      });
    }
  } catch (e) {
    console.error("[video] worker error:", (e as Error).message);
  } finally {
    workerRunning = false;
  }
}

/** Inicia el worker de render (llamar una sola vez al arrancar el servidor). */
export function startRenderWorker() {
  if (process.env.NODE_ENV === "test") return;
  // Procesar renders pendientes dejados de arranques previos
  void processQueue();
  // Revisar cada 5 segundos si hay nuevos renders en cola
  setInterval(() => void processQueue(), 5_000);
}

videoRouter.post("/comics/:id/video", async (req, res) => {
  const comicId = Number(req.params.id);
  const [c] = await db.select().from(comics).where(and(eq(comics.id, comicId), eq(comics.userId, req.user!.id)));
  if (!c) throw httpError(404, "Cómic no encontrado");
  const ps = await db.select().from(panels).where(eq(panels.comicId, comicId));
  if (!ps.some((p) => p.imageUrl)) throw httpError(400, "Agrega al menos una viñeta con imagen para crear el video.");

  const refund = await consume(req.user!, "video");
  const [r] = await db.insert(renders).values({ userId: req.user!.id, comicId }).returning().catch(async (e) => {
    await refund(); // si no se pudo registrar el render, no se cobra el video
    throw e;
  });
  // El worker persistente se encarga de procesar la cola
  void processQueue();
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
