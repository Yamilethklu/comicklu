import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db } from "../db";
import { assets, comics } from "@shared/schema";
import { requireAuth } from "../auth";
import { aiEnabled } from "../env";
import { generateImage, generateImageWithReference, generateJson, generateVoice, type VoiceName } from "../ai";
import { consume, currentMonth, effectivePlan } from "../usage";
import { saveBuffer } from "../files";
import { httpError } from "../ssrf";
import { STYLES } from "@shared/plans";

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.use(rateLimit({
  windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "anon", // por usuario, no por IP (redes compartidas / móviles)
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Vas muy rápido. Espera un minuto." },
}));

function requireAi() {
  if (!aiEnabled()) throw httpError(503, "La IA no está activada en este servidor.");
}

const styleKeys = Object.keys(STYLES) as [keyof typeof STYLES, ...(keyof typeof STYLES)[]];

// ---------- Guion ----------
const storyBody = z.object({
  idea: z.string().trim().min(10, "Cuéntame tu idea con al menos una frase").max(3000),
  style: z.enum(styleKeys).default("comic"),
  tone: z.string().max(80).optional(),
  language: z.string().max(40).default("español"),
  panelCount: z.number().int().min(1).max(24).default(6),
  comicId: z.number().int().positive().optional(),
});

const storyOut = z.object({
  title: z.string(),
  synopsis: z.string(),
  panels: z.array(z.object({
    caption: z.string().default(""),
    dialogue: z.string().default(""),
    prompt: z.string(),
  })).min(1),
});

aiRouter.post("/story", async (req, res) => {
  const b = storyBody.parse(req.body);
  requireAi();
  const refund = await consume(req.user!, "story");
  let characterContext = "";
  if (b.comicId) {
    const [comic] = await db.select({ userId: comics.userId, settings: comics.settings }).from(comics)
      .where(and(eq(comics.id, b.comicId), eq(comics.userId, req.user!.id)));
    if (!comic) { await refund(); throw httpError(404, "Cómic no encontrado."); }
    if (comic.settings.characterReferenceUrl && effectivePlan(req.user!) === "premium") {
      characterContext = ` Protagonista recurrente: ${comic.settings.characterName || "personaje principal"}. ${comic.settings.characterDescription || ""}. Mantén su apariencia visual en todos los prompts.`;
    }
  }
  try {
    const system =
      `Eres guionista de cómics. Devuelve SOLO JSON (sin texto extra ni bloques de código) con la forma {"title": string, "synopsis": string, "panels": [{"caption": string, "dialogue": string, "prompt": string}]}. ` +
      `Escribe title, synopsis, caption y dialogue en ${b.language}. "caption" es la narración breve de la viñeta, "dialogue" el diálogo (máx. 2 líneas, formato "Personaje: frase"). ` +
      `"prompt" es una descripción visual en inglés, concreta (personajes, encuadre, acción, ambiente), SIN texto escrito en la imagen. ` +
      `Mantén consistencia de personajes describiéndolos igual en cada prompt. Genera exactamente ${b.panelCount} viñetas. Estilo visual: ${STYLES[b.style].name}.` +
      (b.tone ? ` Tono: ${b.tone}.` : "") + characterContext;
    const out = await generateJson(system, b.idea, (x) => storyOut.parse(x));
    res.json({ ...out, panels: out.panels.slice(0, b.panelCount) });
  } catch (e) {
    await refund();
    console.error("[ai/story]", (e as Error).message);
    throw httpError(502, "No se pudo generar el guion. Intenta de nuevo (no se descontó de tu plan).");
  }
});


/** Límite independiente para referencias: controla costos de edición de imágenes.
 * Se guarda usando la tabla de uso actual, sin cambiar el esquema PostgreSQL.
 */
async function reserveReference(userId: string): Promise<() => Promise<void>> {
  const month = currentMonth();
  const metric = "character_reference";
  const rows = await db.execute(sql`
    INSERT INTO usage (user_id, month, metric, count)
    VALUES (${userId}, ${month}, ${metric}, 1)
    ON CONFLICT (user_id, month, metric)
    DO UPDATE SET count = usage.count + 1 WHERE usage.count < 20
    RETURNING count
  `);
  if (rows.rows.length === 0) throw httpError(402, "Premium incluye 20 generaciones mensuales con personaje de referencia.");
  return async () => {
    await db.execute(sql`UPDATE usage SET count = GREATEST(count - 1, 0)
      WHERE user_id = ${userId} AND month = ${month} AND metric = ${metric}`);
  };
}

// ---------- Imagen ----------
const imageBody = z.object({
  prompt: z.string().trim().min(3, "Describe la escena").max(1500),
  style: z.enum(styleKeys).default("comic"),
  orientation: z.enum(["square", "landscape", "portrait"]).default("landscape"),
  palette: z.string().max(200).optional(),
  comicId: z.number().int().positive().optional(),
});

aiRouter.post("/image", async (req, res) => {
  const b = imageBody.parse(req.body);
  requireAi();
  let referenceUrl: string | undefined;
  let characterPrompt = "";
  if (b.comicId) {
    const [comic] = await db.select({ settings: comics.settings }).from(comics)
      .where(and(eq(comics.id, b.comicId), eq(comics.userId, req.user!.id)));
    if (!comic) throw httpError(404, "Cómic no encontrado.");
    referenceUrl = comic.settings.characterReferenceUrl;
    if (referenceUrl) {
      if (effectivePlan(req.user!) !== "premium") throw httpError(402, "Las referencias visuales son exclusivas de Premium.");
      const [owned] = await db.select({ id: assets.id }).from(assets).where(and(
        eq(assets.userId, req.user!.id), eq(assets.url, referenceUrl), eq(assets.type, "image")
      ));
      if (!owned) throw httpError(403, "Imagen de referencia no autorizada.");
      characterPrompt = ` Character: ${comic.settings.characterName || "main character"}. ${comic.settings.characterDescription || ""}.`;
    }
  }
  if (referenceUrl && !process.env.OPENAI_API_KEY)
    throw httpError(503, "La generación con referencia no está configurada todavía. No se descontaron imágenes.");
  const refund = await consume(req.user!, "image");
  let refundReference: (() => Promise<void>) | undefined;
  try {
    if (referenceUrl) refundReference = await reserveReference(req.user!.id);
    const prompt = `${STYLES[b.style].prompt}. ${b.prompt}.${b.palette ? ` Color palette: ${b.palette}.` : ""} No text, no captions, no speech bubbles, no watermarks.`;
    const { buf, ext } = referenceUrl
      ? await generateImageWithReference(prompt + characterPrompt, b.orientation, referenceUrl)
      : await generateImage(prompt, b.orientation);
    const url = await saveBuffer(buf, ext);
    await db.insert(assets).values({ userId: req.user!.id, type: "image", url, prompt: b.prompt });
    res.status(201).json({ url });
  } catch (e) {
    await refund();
    if (refundReference) await refundReference();
    console.error("[ai/image]", (e as Error).message);
    throw httpError(502, "No se pudo generar la imagen. Intenta de nuevo; no se descontó de tu plan.");
  }
});

// ---------- Voz ----------
const voiceBody = z.object({
  text: z.string().trim().min(1, "No hay texto para narrar").max(1200),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("nova"),
  language: z.string().max(40).optional(),
});

aiRouter.post("/voice", async (req, res) => {
  const b = voiceBody.parse(req.body);
  requireAi();
  const refund = await consume(req.user!, "voice");
  try {
    const { buf, ext } = await generateVoice(b.text, b.voice as VoiceName, b.language);
    const url = await saveBuffer(buf, ext);
    await db.insert(assets).values({ userId: req.user!.id, type: "audio", url, prompt: b.text.slice(0, 120) });
    res.status(201).json({ url });
  } catch (e) {
    await refund();
    console.error("[ai/voice]", (e as Error).message);
    throw httpError(502, "No se pudo generar la voz. No se descontó de tu plan.");
  }
});
