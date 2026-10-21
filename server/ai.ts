import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { env } from "./env";
import { sniffImage } from "./files";
import { runFfmpeg } from "./video";

/**
 * Capa de IA con proveedores intercambiables y respaldo automático.
 *  - AI_PROVIDER=free (por defecto, sin costo):
 *      texto : Gemini (si pones GEMINI_API_KEY gratis) → Pollinations (sin clave)
 *      imagen: Hugging Face (si pones HF_TOKEN gratis) → Pollinations (sin clave)
 *      voz   : Pollinations (sin clave) → espeak-ng local (siempre disponible en el Docker)
 *  - AI_PROVIDER=openai: usa solo OpenAI (de pago).
 */

export type Orientation = "square" | "landscape" | "portrait";
const SIZES: Record<Orientation, [number, number]> = { square: [1024, 1024], landscape: [1280, 720], portrait: [720, 1280] };

// ---------- utilidades ----------
type Step<T> = [name: string, run: () => Promise<T>];

async function firstOk<T>(kind: string, steps: Step<T>[]): Promise<T> {
  const errors: string[] = [];
  for (const [name, run] of steps) {
    try {
      return await run();
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(`${name}: ${msg}`);
      console.warn(`[ai/${kind}] ${name} falló: ${msg}`);
    }
  }
  throw new Error(errors.join(" | ") || "No hay proveedores de IA configurados");
}

/** Cola con concurrencia limitada: los servicios gratuitos suelen permitir una petición a la vez por IP. */
function makeLimiter(concurrency: number, maxQueue: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      if (queue.length >= maxQueue) throw new Error("la IA gratuita está saturada");
      await new Promise<void>((resolve) => queue.push(resolve)); // el turno se hereda: active no cambia
    } else {
      active++;
    }
    try {
      return await fn();
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  };
}
const pollinationsQueue = makeLimiter(env.pollinations.concurrency, 25);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch con tiempo límite y un reintento si hay error de red, 429 o 5xx. */
async function fetchOk(url: string, init: RequestInit, timeoutMs: number, queue?: ReturnType<typeof makeLimiter>): Promise<Response> {
  let last: Error = new Error("sin respuesta");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const go = () => fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const res = await (queue ? queue(go) : go());
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) break; // error del cliente: reintentar no sirve
    } catch (e) {
      const err = e as Error;
      last = err.name === "TimeoutError" ? new Error("tiempo de espera agotado") : err;
    }
    if (attempt === 0) await sleep(env.aiRetryDelayMs);
  }
  throw last;
}

export function extractJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("la respuesta no es JSON");
  }
}

// ---------- texto ----------
type TextCall = (system: string, user: string, temperature: number) => Promise<string>;

const pollinationsText: TextCall = async (system, user, temperature) => {
  const p = env.pollinations;
  const res = await fetchOk(p.textUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...(p.key ? { authorization: `Bearer ${p.key}` } : {}) },
    body: JSON.stringify({
      model: p.textModel, temperature, seed: randomInt(1, 1_000_000),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  }, 90_000, pollinationsQueue);
  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("respuesta vacía");
  return content;
};

const geminiText: TextCall = async (system, user, temperature) => {
  const res = await fetchOk(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature, responseMimeType: "application/json" },
    }),
  }, 60_000);
  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
  if (!text) throw new Error("respuesta vacía");
  return text;
};

let openaiClient: OpenAI | null = null;
const openai = () => (openaiClient ??= new OpenAI({ apiKey: env.openaiKey }));

const openaiText: TextCall = async (system, user, temperature) => {
  const c = await openai().chat.completions.create({
    model: env.openaiTextModel, response_format: { type: "json_object" }, temperature,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return c.choices[0]?.message?.content ?? "";
};

function textSteps(): [string, TextCall][] {
  if (env.aiProvider === "openai") return [["openai", openaiText]];
  const steps: [string, TextCall][] = [];
  if (env.geminiKey) steps.push(["gemini", geminiText]);
  if (env.pollinations.enabled) steps.push(["pollinations", pollinationsText]);
  return steps;
}

/** Pide JSON a la IA y lo valida; si el formato sale mal, reintenta y luego pasa al siguiente proveedor. */
export async function generateJson<T>(system: string, user: string, validate: (x: unknown) => T, temperature = 0.9): Promise<T> {
  return firstOk("texto", textSteps().map(([name, call]): Step<T> => [name, async () => {
    let last = "sin respuesta";
    for (let i = 0; i < 2; i++) {
      const raw = await call(system, user, temperature);
      try {
        return validate(extractJson(raw));
      } catch (e) {
        last = (e as Error).message;
      }
    }
    throw new Error(`formato inesperado (${last})`);
  }]));
}

// ---------- imagen ----------
export interface ImageResult { buf: Buffer; ext: string }

function asImage(buf: Buffer): ImageResult {
  const kind = sniffImage(buf);
  if (!kind) throw new Error("la respuesta no es una imagen válida");
  return { buf, ext: kind.ext };
}

async function pollinationsImage(prompt: string, o: Orientation): Promise<ImageResult> {
  const p = env.pollinations;
  const [w, h] = SIZES[o];
  const url = new URL(p.imageUrl.replace("{prompt}", encodeURIComponent(prompt.slice(0, 1000))));
  url.searchParams.set("width", String(w));
  url.searchParams.set("height", String(h));
  url.searchParams.set("model", p.imageModel);
  url.searchParams.set("seed", String(randomInt(1, 1_000_000)));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  const res = await fetchOk(url.toString(), { headers: p.key ? { authorization: `Bearer ${p.key}` } : {} }, 120_000, pollinationsQueue);
  return asImage(Buffer.from(await res.arrayBuffer()));
}

async function huggingFaceImage(prompt: string, o: Orientation): Promise<ImageResult> {
  const [w, h] = SIZES[o];
  const res = await fetchOk(env.hfImageUrl.replace("{model}", env.hfImageModel), {
    method: "POST",
    headers: { authorization: `Bearer ${env.hfToken}`, "content-type": "application/json", accept: "image/png" },
    body: JSON.stringify({ inputs: prompt, parameters: { width: w, height: h } }),
  }, 120_000);
  return asImage(Buffer.from(await res.arrayBuffer()));
}

async function openaiImage(prompt: string, o: Orientation): Promise<ImageResult> {
  const dalle3 = env.openaiImageModel.startsWith("dall-e-3");
  const size = o === "square" ? "1024x1024" : o === "landscape" ? (dalle3 ? "1792x1024" : "1536x1024") : dalle3 ? "1024x1792" : "1024x1536";
  const r = await openai().images.generate({
    model: env.openaiImageModel, prompt, n: 1, size: size as "1024x1024",
    ...(env.openaiImageModel.startsWith("dall-e") ? { response_format: "b64_json" as const } : {}),
  });
  const item = r.data?.[0];
  if (item?.b64_json) return asImage(Buffer.from(item.b64_json, "base64"));
  if (item?.url) return asImage(Buffer.from(await (await fetchOk(item.url, {}, 60_000)).arrayBuffer()));
  throw new Error("respuesta de imagen vacía");
}

export async function generateImage(prompt: string, orientation: Orientation): Promise<ImageResult> {
  const steps: Step<ImageResult>[] = [];
  if (env.aiProvider === "openai") steps.push(["openai", () => openaiImage(prompt, orientation)]);
  else {
    if (env.hfToken) steps.push(["huggingface", () => huggingFaceImage(prompt, orientation)]);
    if (env.pollinations.enabled) steps.push(["pollinations", () => pollinationsImage(prompt, orientation)]);
  }
  return firstOk("imagen", steps);
}

// ---------- voz ----------
export type VoiceName = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export interface AudioResult { buf: Buffer; ext: string }

function sniffAudio(buf: Buffer): string | null {
  if (buf.length < 1000) return null;
  if (buf.toString("ascii", 0, 3) === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "mp3";
  if (buf.toString("ascii", 0, 4) === "RIFF") return "wav";
  if (buf.toString("ascii", 0, 4) === "OggS") return "ogg";
  return null;
}

async function pollinationsVoice(text: string, voice: VoiceName): Promise<AudioResult> {
  if (text.length > 900) throw new Error("texto demasiado largo para este proveedor");
  const p = env.pollinations;
  const url = new URL(p.audioUrl.replace("{prompt}", encodeURIComponent(text)));
  url.searchParams.set("model", "openai-audio");
  url.searchParams.set("voice", voice);
  const res = await fetchOk(url.toString(), { headers: p.key ? { authorization: `Bearer ${p.key}` } : {} }, 90_000, pollinationsQueue);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = sniffAudio(buf);
  if (!ext) throw new Error("la respuesta no es audio");
  return { buf, ext };
}

/** Nombre de idioma (como lo escribe el usuario) → código de espeak-ng. */
export function langCode(language?: string | null): string {
  const l = (language ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (!l) return env.espeakLang;
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(l)) return l;
  const table: [RegExp, string][] = [
    [/^(espa|span|cast)/, "es"], [/^(ingl|engl)/, "en"], [/^fran|^french/, "fr"], [/^port/, "pt"], [/^ital/, "it"],
    [/^(alem|germ|deut)/, "de"], [/^(japon|japan)/, "ja"], [/^(chin|mandar)/, "zh"], [/^(corean|korea)/, "ko"],
    [/^(ruso|russ)/, "ru"], [/^(catal)/, "ca"], [/^(neerl|holand|dutch)/, "nl"],
  ];
  return table.find(([re]) => re.test(l))?.[1] ?? env.espeakLang;
}

const ESPEAK_VARIANT: Record<VoiceName, string> = { nova: "f3", shimmer: "f2", alloy: "f4", echo: "m3", fable: "m2", onyx: "m1" };

/** Voz local y gratuita (robótica pero siempre disponible). Requiere `espeak-ng` instalado. */
async function espeakVoice(text: string, voice: VoiceName, language?: string | null): Promise<AudioResult> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "tts-"));
  try {
    const wav = path.join(dir, "voz.wav");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(env.espeakPath, ["--stdin", "-v", `${langCode(language)}+${ESPEAK_VARIANT[voice]}`, "-s", "150", "-w", wav]);
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => reject(new Error(`espeak-ng no está instalado (${e.message})`)));
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`espeak-ng terminó con código ${code}: ${err.slice(0, 200)}`))));
      child.stdin.end(text);
    });
    try {
      const mp3 = path.join(dir, "voz.mp3");
      await runFfmpeg(["-y", "-hide_banner", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "96k", mp3], 60_000);
      return { buf: await fsp.readFile(mp3), ext: "mp3" };
    } catch {
      return { buf: await fsp.readFile(wav), ext: "wav" };
    }
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function openaiVoice(text: string, voice: VoiceName): Promise<AudioResult> {
  const r = await openai().audio.speech.create({ model: env.openaiTtsModel, voice, input: text, response_format: "mp3" });
  return { buf: Buffer.from(await r.arrayBuffer()), ext: "mp3" };
}

export async function generateVoice(text: string, voice: VoiceName, language?: string | null): Promise<AudioResult> {
  const steps: Step<AudioResult>[] = [];
  if (env.aiProvider === "openai") steps.push(["openai", () => openaiVoice(text, voice)]);
  else {
    if (env.pollinations.enabled) steps.push(["pollinations", () => pollinationsVoice(text, voice)]);
    steps.push(["espeak", () => espeakVoice(text, voice, language)]);
  }
  return firstOk("voz", steps);
}
