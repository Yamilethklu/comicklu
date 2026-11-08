import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "./env";
import { materializeMedia, saveBuffer } from "./files";
import type { Panel } from "@shared/schema";

// Video 1080p para planes Pro/Premium
const W = 1920;
const H = 1080;
const FPS = 30;
const MAX_SECONDS_PER_PANEL = 20;
const TRANSITION_SEC = 0.5; // fade entre viñetas

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/Library/Fonts/Arial.ttf",
  "C:/Windows/Fonts/arial.ttf",
];
const fontFile = () => FONT_CANDIDATES.find((f) => fs.existsSync(f));

let ffmpegBin: string | null = null;
async function ffmpeg(): Promise<string> {
  if (ffmpegBin) return ffmpegBin;
  if (env.ffmpegPath) return (ffmpegBin = env.ffmpegPath);
  const mod = (await import("ffmpeg-static")) as { default: string | null };
  if (!mod.default) throw new Error("No se encontró ffmpeg. Define FFMPEG_PATH o instala ffmpeg-static.");
  return (ffmpegBin = mod.default);
}

export function runFfmpeg(args: string[], timeoutMs = 8 * 60 * 1000): Promise<{ stderr: string }> {
  return new Promise(async (resolve, reject) => {
    const bin = await ffmpeg().catch((e) => { reject(e); return null; });
    if (!bin) return;
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) return reject(new Error(`ffmpeg falló: ${stderr.split("\n").filter(Boolean).slice(-3).join(" | ") || err.message}`));
      resolve({ stderr });
    });
  });
}

async function audioSeconds(file: string): Promise<number> {
  const bin = await ffmpeg();
  const stderr = await new Promise<string>((resolve) => {
    execFile(bin, ["-i", file], { timeout: 30_000 }, (_e, _o, se) => resolve(se));
  });
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

function wrap(text: string, width = 64): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = "";
    for (const word of raw.split(/\s+/).filter(Boolean)) {
      if ((line + " " + word).trim().length > width) { if (line) out.push(line); line = word; }
      else line = (line + " " + word).trim();
    }
    if (line) out.push(line);
  }
  return out.slice(0, 8);
}

/** Divide texto en frases para subtítulos animados (aparecen una tras otra). */
function splitPhrases(text: string): string[] {
  return text
    .split(/[.!?…]|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function renderSegment(
  p: Panel,
  dir: string,
  index: number,

  durationSec: number,
): Promise<string> {
  const image = await materializeMedia(p.imageUrl, dir);
  const imageOk = image && fs.existsSync(image) ? image : null;
  const voice = await materializeMedia(p.voiceUrl, dir);
  const voiceOk = voice && fs.existsSync(voice) ? voice : null;

  const text = [p.caption, p.dialogue].map((s) => s.trim()).filter(Boolean).join(" ");
  const phrases = text ? splitPhrases(text) : [];
  const narration = voiceOk ? await audioSeconds(voiceOk as string) : 0;
  const seconds = Math.min(MAX_SECONDS_PER_PANEL, Math.max(3, 2.5 + text.length / 14, narration));
  const frames = Math.round(seconds * FPS);
  const out = path.join(dir, `seg${String(index).padStart(3, "0")}.mp4`);

  const zoom = `zoompan=z='min(zoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`;
  const base = `scale=${W * 3 / 2}:${H * 3 / 2}:force_original_aspect_ratio=decrease,pad=${W * 3 / 2}:${H * 3 / 2}:(ow-iw)/2:(oh-ih)/2:color=0x16161d,setsar=1,${zoom}`;

  const font = fontFile();

  // Fade in/out para transición suave entre viñetas
  const fade = `fade=t=in:st=0:d=${TRANSITION_SEC},fade=t=out:st=${Math.max(0, seconds - TRANSITION_SEC)}:d=${TRANSITION_SEC}`;

  // Subtítulos animados: cada frase aparece en su tramo de tiempo
  let draw = "";
  if (font && phrases.length) {
    const phraseDuration = Math.max(1, seconds / Math.max(1, phrases.length));
    const drawParts: string[] = [];
    phrases.forEach((phrase, i) => {
      const start = i * phraseDuration;
      const end = Math.min(start + phraseDuration, seconds);
      const escaped = phrase.replace(/'/g, "\\'").replace(/:/g, "\\:");
      const textFile = path.join(dir, `t${index}_${i}.txt`);
      fsp.writeFile(textFile, wrap(escaped).join("\\n"), "utf8").catch(() => {});
      drawParts.push(
        `drawtext=fontfile=${font}:textfile=${textFile}:fontcolor=white:fontsize=42:line_spacing=10:box=1:boxcolor=black@0.7:boxborderw=20:x=(w-text_w)/2:y=h-text_h-90:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
      );
    });
    draw = drawParts.join(",");
  }

  const vf = base + "," + fade + (draw ? "," + draw : "");

  const build = () => {
    const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
    if (imageOk) args.push("-loop", "1", "-framerate", String(FPS), "-i", imageOk);
    else args.push("-f", "lavfi", "-i", `color=c=0x16161d:s=${W * 3 / 2}x${H * 3 / 2}:r=${FPS}`);
    if (voiceOk) args.push("-i", voiceOk as string);
    else args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
    args.push(
      "-vf", vf,
      "-af", "aresample=44100,apad",
      "-ac", "2", "-t", seconds.toFixed(2),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k",
      out,
    );
    return args;
  };

  try {
    await runFfmpeg(build());
  } catch (e) {
    // Reintentar sin subtítulos animados si falla drawtext
    const simpleVf = base + "," + fade;
    const args2: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
    if (imageOk) args2.push("-loop", "1", "-framerate", String(FPS), "-i", imageOk);
    else args2.push("-f", "lavfi", "-i", `color=c=0x16161d:s=${W * 3 / 2}x${H * 3 / 2}:r=${FPS}`);
    if (voiceOk) args2.push("-i", voiceOk as string);
    else args2.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
    args2.push(
      "-vf", simpleVf,
      "-af", "aresample=44100,apad",
      "-ac", "2", "-t", seconds.toFixed(2),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k",
      out,
    );
    await runFfmpeg(args2);
  }
  return out;
}

/** Une las viñetas con fade cruzado entre ellas y subtítulos animados. Devuelve URL /media/... */
export async function renderComicVideo(panels: Panel[]): Promise<string> {
  const usable = panels.filter((p) => p.imageUrl || p.caption.trim() || p.dialogue.trim());
  if (!usable.some((p) => p.imageUrl)) throw new Error("No hay viñetas con imagen para el video.");

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "comic-render-"));
  try {
    // Calcular duración de cada segmento y offsets de tiempo globales
    const segInfos: { index: number; seconds: number; start: number }[] = [];
    let t = 0;
    for (let i = 0; i < usable.length; i++) {
      const p = usable[i];
      const text = [p.caption, p.dialogue].map((s) => s.trim()).filter(Boolean).join(" ");
      const narration = p.voiceUrl ? 3 : 0; // estimación rápida para offsets
      const seconds = Math.min(MAX_SECONDS_PER_PANEL, Math.max(3, 2.5 + text.length / 14, narration));
      segInfos.push({ index: i, seconds, start: t });
      t += seconds;
    }

    const segments: string[] = [];
    for (const info of segInfos) {
      const p = usable[info.index];
      const voiceOk = p.voiceUrl ? await materializeMedia(p.voiceUrl, dir) : null;
      const narration = voiceOk ? await audioSeconds(voiceOk as string) : 0;
      const seconds = Math.min(MAX_SECONDS_PER_PANEL, Math.max(3, 2.5 + ([p.caption, p.dialogue].map((s) => s.trim()).filter(Boolean).join(" ").length / 14), narration));
      const seg = await renderSegment(p, dir, info.index, seconds);
      segments.push(seg);
    }

    // Crear archivo de lista para concat con transiciones (fade ya está renderizado en cada segmento)
    const list = path.join(dir, "list.txt");
    await fsp.writeFile(list, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n"));
    const merged = path.join(dir, "final.mp4");
    await runFfmpeg(["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", merged]);

    const maxSize = 100 * 1024 * 1024; // 100 MB para 1080p
    if ((await fsp.stat(merged)).size > maxSize) throw new Error("El video supera el límite de almacenamiento de 100 MB");
    return await saveBuffer(await fsp.readFile(merged), "mp4");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
