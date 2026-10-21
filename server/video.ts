import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "./env";
import { localPathFromUrl, uploadRoot, ensureUploadDir } from "./files";
import type { Panel } from "@shared/schema";

const W = 1280;
const H = 720;
const FPS = 25;
const MAX_SECONDS_PER_PANEL = 20;

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

export function runFfmpeg(args: string[], timeoutMs = 5 * 60 * 1000): Promise<{ stderr: string }> {
  return new Promise(async (resolve, reject) => {
    const bin = await ffmpeg().catch((e) => { reject(e); return null; });
    if (!bin) return;
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) return reject(new Error(`ffmpeg falló: ${stderr.split("\n").filter(Boolean).slice(-3).join(" | ") || err.message}`));
      resolve({ stderr });
    });
  });
}

/** Duración de un audio leyendo la salida de `ffmpeg -i` (ffmpeg-static no trae ffprobe). */
async function audioSeconds(file: string): Promise<number> {
  const bin = await ffmpeg();
  const stderr = await new Promise<string>((resolve) => {
    execFile(bin, ["-i", file], { timeout: 30_000 }, (_e, _o, se) => resolve(se));
  });
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

function wrap(text: string, width = 48): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = "";
    for (const word of raw.split(/\s+/).filter(Boolean)) {
      if ((line + " " + word).trim().length > width) { if (line) out.push(line); line = word; }
      else line = (line + " " + word).trim();
    }
    if (line) out.push(line);
  }
  return out.slice(0, 6);
}

async function renderSegment(p: Panel, dir: string, index: number): Promise<string> {
  const image = p.imageUrl ? localPathFromUrl(p.imageUrl) : null;
  const imageOk = image && fs.existsSync(image) ? image : null;
  const voice = p.voiceUrl ? localPathFromUrl(p.voiceUrl) : null;
  const voiceOk = voice && fs.existsSync(voice) ? voice : null;

  const text = [p.caption, p.dialogue].map((s) => s.trim()).filter(Boolean).join("\n");
  const textSeconds = 2.5 + text.length / 14;
  const narration = voiceOk ? (await audioSeconds(voiceOk)) + 0.6 : 0;
  const seconds = Math.min(MAX_SECONDS_PER_PANEL, Math.max(3, textSeconds, narration));
  const frames = Math.round(seconds * FPS);
  const out = path.join(dir, `seg${String(index).padStart(3, "0")}.mp4`);

  const zoom = `zoompan=z='min(zoom+0.0007,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`;
  const base = `scale=${W * 3 / 2}:${H * 3 / 2}:force_original_aspect_ratio=decrease,pad=${W * 3 / 2}:${H * 3 / 2}:(ow-iw)/2:(oh-ih)/2:color=0x16161d,setsar=1,${zoom}`;

  const font = fontFile();
  let draw = "";
  if (text && font) {
    const textFile = path.join(dir, `t${index}.txt`);
    await fsp.writeFile(textFile, wrap(text).join("\n"), "utf8");
    draw = `,drawtext=fontfile=${font}:textfile=${textFile}:fontcolor=white:fontsize=34:line_spacing=8:box=1:boxcolor=black@0.62:boxborderw=16:x=(w-text_w)/2:y=h-text_h-44`;
  }

  const build = (withText: boolean) => {
    const args = ["-y", "-hide_banner", "-loglevel", "error"];
    if (imageOk) args.push("-loop", "1", "-framerate", String(FPS), "-i", imageOk);
    else args.push("-f", "lavfi", "-i", `color=c=0x16161d:s=${W * 3 / 2}x${H * 3 / 2}:r=${FPS}`);
    if (voiceOk) args.push("-i", voiceOk);
    else args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
    args.push(
      "-vf", base + (withText ? draw : ""),
      "-af", "aresample=44100,apad",
      "-ac", "2", "-t", seconds.toFixed(2),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k",
      out,
    );
    return args;
  };

  try {
    await runFfmpeg(build(true));
  } catch (e) {
    if (!draw) throw e;
    console.warn("[video] drawtext falló, se reintenta sin subtítulos:", (e as Error).message);
    await runFfmpeg(build(false));
  }
  return out;
}

/** Une las viñetas (en orden) en un MP4 y lo guarda en el almacenamiento. Devuelve la URL `/media/...`. */
export async function renderComicVideo(panels: Panel[]): Promise<string> {
  const usable = panels.filter((p) => p.imageUrl || p.caption.trim() || p.dialogue.trim());
  if (!usable.some((p) => p.imageUrl)) throw new Error("No hay viñetas con imagen para el video.");

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "comic-render-"));
  try {
    const segments: string[] = [];
    for (let i = 0; i < usable.length; i++) segments.push(await renderSegment(usable[i], dir, i));

    const list = path.join(dir, "list.txt");
    await fsp.writeFile(list, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n"));
    const merged = path.join(dir, "final.mp4");
    await runFfmpeg(["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", merged]);

    await ensureUploadDir();
    const name = `${randomUUID()}.mp4`;
    await fsp.copyFile(merged, path.join(uploadRoot, name));
    return `/media/${name}`;
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
