import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { db } from "../db";
import { comics, panels, assets } from "@shared/schema";
import { requireAuth } from "../auth";
import { effectivePlan, comicCount } from "../usage";
import { PLANS, STYLES } from "@shared/plans";
import { saveBuffer, sniffImage } from "../files";
import { fetchPublicImage, httpError } from "../ssrf";

export const comicsRouter = Router();
comicsRouter.use(requireAuth);

const styleKeys = Object.keys(STYLES) as [string, ...string[]];

const panelIn = z.object({
  imageUrl: z.string().max(2000).nullable().optional(),
  caption: z.string().max(1000).default(""),
  dialogue: z.string().max(1000).default(""),
  prompt: z.string().max(2000).default(""),
  voiceUrl: z.string().max(2000).nullable().optional(),
});

const comicIn = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(120),
  synopsis: z.string().max(2000).default(""),
  story: z.string().max(20000).default(""),
  style: z.enum(styleKeys).default("comic"),
  settings: z.object({
    tone: z.string().max(80).optional(),
    language: z.string().max(40).optional(),
    palette: z.string().max(200).optional(),
    layout: z.enum(["vertical", "horizontal"]).optional(),
  }).default({}),
  coverUrl: z.string().max(2000).nullable().optional(),
  panels: z.array(panelIn).max(200).default([]),
});

// Solo se aceptan archivos propios (/media/...). Los enlaces externos se descargan primero con /api/uploads/from-url.
const safeUrl = (u?: string | null) => (u && /^\/media\/[\w.-]+$/.test(u) ? u : null);

async function loadOwned(userId: string, id: number) {
  const [c] = await db.select().from(comics).where(and(eq(comics.id, id), eq(comics.userId, userId)));
  if (!c) throw httpError(404, "Cómic no encontrado");
  return c;
}

async function withPanels(c: typeof comics.$inferSelect) {
  const ps = await db.select().from(panels).where(eq(panels.comicId, c.id)).orderBy(asc(panels.position));
  return { ...c, panels: ps };
}

comicsRouter.get("/", async (req, res) => {
  const rows = await db.select().from(comics).where(eq(comics.userId, req.user!.id)).orderBy(desc(comics.updatedAt));
  res.json(rows);
});

comicsRouter.post("/", async (req, res) => {
  const plan = PLANS[effectivePlan(req.user!)];
  if ((await comicCount(req.user!.id)) >= plan.limits.comics) {
    return res.status(402).json({ message: `Tu plan ${plan.name} permite ${plan.limits.comics} cómics. Mejora tu plan o elimina alguno.` });
  }
  const body = comicIn.parse({ title: "Cómic sin título", ...req.body });
  const plimit = plan.limits.panelsPerComic;
  if (body.panels.length > plimit) throw httpError(402, `Tu plan permite hasta ${plimit} viñetas por cómic.`);

  const [c] = await db.insert(comics).values({
    userId: req.user!.id, title: body.title, synopsis: body.synopsis, story: body.story,
    style: body.style, settings: body.settings, coverUrl: safeUrl(body.coverUrl),
  }).returning();
  if (body.panels.length) {
    await db.insert(panels).values(body.panels.map((p, i) => ({
      comicId: c.id, position: i, imageUrl: safeUrl(p.imageUrl), caption: p.caption, dialogue: p.dialogue,
      prompt: p.prompt, voiceUrl: safeUrl(p.voiceUrl),
    })));
  }
  res.status(201).json(await withPanels(c));
});

comicsRouter.get("/:id", async (req, res) => {
  res.json(await withPanels(await loadOwned(req.user!.id, Number(req.params.id))));
});

/** Guardado completo (autosave): reemplaza metadatos y viñetas en una transacción. */
comicsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await loadOwned(req.user!.id, id);
  const body = comicIn.parse(req.body);
  const plan = PLANS[effectivePlan(req.user!)];
  if (body.panels.length > plan.limits.panelsPerComic) {
    throw httpError(402, `Tu plan ${plan.name} permite hasta ${plan.limits.panelsPerComic} viñetas por cómic.`);
  }
  await db.transaction(async (tx) => {
    await tx.update(comics).set({
      title: body.title, synopsis: body.synopsis, story: body.story, style: body.style,
      settings: body.settings, coverUrl: safeUrl(body.coverUrl), updatedAt: new Date(),
    }).where(eq(comics.id, id));
    await tx.delete(panels).where(eq(panels.comicId, id));
    if (body.panels.length) {
      await tx.insert(panels).values(body.panels.map((p, i) => ({
        comicId: id, position: i, imageUrl: safeUrl(p.imageUrl), caption: p.caption, dialogue: p.dialogue,
        prompt: p.prompt, voiceUrl: safeUrl(p.voiceUrl),
      })));
    }
  });
  res.json(await withPanels(await loadOwned(req.user!.id, id)));
});

comicsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await loadOwned(req.user!.id, id);
  await db.delete(comics).where(eq(comics.id, id));
  res.status(204).end();
});

/** Exportación de la ficha del proyecto en JSON. */
comicsRouter.get("/:id/export.json", async (req, res) => {
  const c = await withPanels(await loadOwned(req.user!.id, Number(req.params.id)));
  const payload = {
    formato: "comic-studio/1",
    exportadoEn: new Date().toISOString(),
    titulo: c.title, sinopsis: c.synopsis, historia: c.story, estilo: c.style, ajustes: c.settings,
    vinetas: c.panels.map((p) => ({
      orden: p.position + 1, imagen: p.imageUrl, narracion: p.caption, dialogo: p.dialogue, prompt: p.prompt, voz: p.voiceUrl,
    })),
  };
  const safe = c.title.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60) || "comic";
  res.setHeader("Content-Disposition", `attachment; filename="${safe}.json"`);
  res.json(payload);
});

// ---------- Subida de imágenes ----------
export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

uploadsRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) throw httpError(400, "Selecciona una imagen");
  const kind = sniffImage(req.file.buffer);
  if (!kind) throw httpError(400, "Formato no permitido. Usa PNG, JPG, GIF o WEBP (máx. 8 MB)");
  const url = await saveBuffer(req.file.buffer, kind.ext);
  await db.insert(assets).values({ userId: req.user!.id, type: "image", url });
  res.status(201).json({ url });
});

uploadsRouter.post("/from-url", async (req, res) => {
  const { url } = z.object({ url: z.string().url().max(2000) }).parse(req.body);
  const { buf, ext } = await fetchPublicImage(url);
  const saved = await saveBuffer(buf, ext);
  await db.insert(assets).values({ userId: req.user!.id, type: "image", url: saved });
  res.status(201).json({ url: saved });
});

uploadsRouter.get("/", async (req, res) => {
  const rows = await db.select().from(assets).where(and(eq(assets.userId, req.user!.id), eq(assets.type, "image")))
    .orderBy(desc(assets.createdAt)).limit(60);
  res.json(rows);
});
