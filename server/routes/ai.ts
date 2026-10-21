import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db } from "../db";
import { assets } from "@shared/schema";
import { requireAuth } from "../auth";
import { aiEnabled } from "../env";
import { generateImage, generateJson, generateVoice, type VoiceName } from "../ai";
import { consume } from "../usage";
import { saveBuffer } from "../files";
import { httpError } from "../ssrf";
import { STYLES } from "@shared/plans";

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.use(rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Vas muy rápido. Espera un minuto." } }));

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
  try {
    const system =
      `Eres guionista de cómics. Devuelve SOLO JSON (sin texto extra ni bloques de código) con la forma {"title": string, "synopsis": string, "panels": [{"caption": string, "dialogue": string, "prompt": string}]}. ` +
      `Escribe title, synopsis, caption y dialogue en ${b.language}. "caption" es la narración breve de la viñeta, "dialogue" el diálogo (máx. 2 líneas, formato "Personaje: frase"). ` +
      `"prompt" es una descripción visual en inglés, concreta (personajes, encuadre, acción, ambiente), SIN texto escrito en la imagen. ` +
      `Mantén consistencia de personajes describiéndolos igual en cada prompt. Genera exactamente ${b.panelCount} viñetas. Estilo visual: ${STYLES[b.style].name}.` +
      (b.tone ? ` Tono: ${b.tone}.` : "");
    const out = await generateJson(system, b.idea, (x) => storyOut.parse(x));
    res.json({ ...out, panels: out.panels.slice(0, b.panelCount) });
  } catch (e) {
    await refund();
    console.error("[ai/story]", (e as Error).message);
    throw httpError(502, "No se pudo generar el guion. Intenta de nuevo (no se descontó de tu plan).");
  }
});

// ---------- Imagen ----------
const imageBody = z.object({
  prompt: z.string().trim().min(3, "Describe la escena").max(1500),
  style: z.enum(styleKeys).default("comic"),
  orientation: z.enum(["square", "landscape", "portrait"]).default("landscape"),
  palette: z.string().max(200).optional(),
});

aiRouter.post("/image", async (req, res) => {
  const b = imageBody.parse(req.body);
  requireAi();
  const refund = await consume(req.user!, "image");
  try {
    const prompt = `${STYLES[b.style].prompt}. ${b.prompt}.${b.palette ? ` Color palette: ${b.palette}.` : ""} No text, no captions, no speech bubbles, no watermarks.`;
    const { buf, ext } = await generateImage(prompt, b.orientation);
    const url = await saveBuffer(buf, ext);
    await db.insert(assets).values({ userId: req.user!.id, type: "image", url, prompt: b.prompt });
    res.status(201).json({ url });
  } catch (e) {
    await refund();
    console.error("[ai/image]", (e as Error).message);
    throw httpError(502, "No se pudo generar la imagen. El servicio gratuito puede estar saturado o rechazar el prompt. Intenta de nuevo en un momento (no se descontó de tu plan).");
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
