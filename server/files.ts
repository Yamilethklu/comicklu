import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env";

export const uploadRoot = path.resolve(env.uploadDir);

export async function ensureUploadDir() {
  await fs.mkdir(uploadRoot, { recursive: true });
}

/** Detecta el tipo real de imagen por firma (no confía en el mime del cliente). */
export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return { ext: "png", mime: "image/png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.toString("ascii", 0, 4) === "GIF8") return { ext: "gif", mime: "image/gif" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function saveBuffer(buf: Buffer, ext: string): Promise<string> {
  await ensureUploadDir();
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(uploadRoot, name), buf);
  return `/media/${name}`;
}

export function localPathFromUrl(url: string): string | null {
  if (!url.startsWith("/media/")) return null;
  const name = path.basename(url);
  return path.join(uploadRoot, name);
}
