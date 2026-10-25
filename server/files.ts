import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env";
import { cloudStorageEnabled, uploadObject, signedObjectUrl, removeObject } from "./cloud-storage";

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
  if (!/^(png|jpg|gif|webp|mp3|wav|mp4)$/.test(ext)) throw new Error("Extensión inválida");
  if (buf.length > 50 * 1024 * 1024) throw new Error("El archivo supera el límite de 50 MB");
  const name = `${randomUUID()}.${ext}`;
  if (cloudStorageEnabled()) {
    const mime: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4" };
    await uploadObject(name, buf, mime[ext]);
  } else {
    await ensureUploadDir();
    await fs.writeFile(path.join(uploadRoot, name), buf);
  }
  return `/media/${name}`;
}

export function localPathFromUrl(url: string): string | null {
  if (!/^\/media\/[a-f0-9-]{36}\.(png|jpg|gif|webp|mp3|wav|mp4)$/.test(url)) return null;
  const name = path.basename(url);
  return path.join(uploadRoot, name);
}

/** Only temporary render inputs touch the Render filesystem in cloud mode. */
export async function materializeMedia(url: string | null, temporaryDir: string): Promise<string | null> {
  if (!url) return null;
  const local = localPathFromUrl(url);
  if (!local) return null;
  if (!cloudStorageEnabled()) return local;
  const name = path.basename(local);
  const response = await fetch(await signedObjectUrl(name), { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error("No se pudo descargar una entrada del video");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 50 * 1024 * 1024) throw new Error("Entrada de video demasiado grande");
  const file = path.join(temporaryDir, name);
  await fs.writeFile(file, data);
  return file;
}

export async function deleteMedia(url: string): Promise<void> {
  const local = localPathFromUrl(url);
  if (!local) return;
  if (cloudStorageEnabled()) await removeObject(path.basename(local));
  else await fs.rm(local, { force: true });
}
