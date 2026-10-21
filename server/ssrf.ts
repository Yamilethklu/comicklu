import dns from "node:dns/promises";
import net from "node:net";
import { sniffImage } from "./files";

const MAX_BYTES = 8 * 1024 * 1024;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

/** Descarga una imagen desde una URL pública bloqueando redes privadas (anti-SSRF). */
export async function fetchPublicImage(rawUrl: string): Promise<{ buf: Buffer; ext: string }> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw httpError(400, "La URL no es válida"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw httpError(400, "Solo se permiten enlaces http o https");
  if (url.port && !["80", "443"].includes(url.port)) throw httpError(400, "Puerto no permitido");

  const addrs = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw httpError(400, "No se pudo resolver el dominio del enlace");
  if (addrs.some((a) => isPrivateIp(a.address))) throw httpError(400, "Ese enlace no está permitido");

  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000), headers: { "user-agent": "ComicStudioBot/1.0" } }).catch(() => {
    throw httpError(400, "No se pudo descargar la imagen (¿redirige o no responde?)");
  });
  if (!res.ok || !res.body) throw httpError(400, `El enlace respondió con error ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw httpError(400, "La imagen supera 8 MB");

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > MAX_BYTES) throw httpError(400, "La imagen supera 8 MB");
    chunks.push(Buffer.from(chunk));
  }
  const buf = Buffer.concat(chunks);
  const kind = sniffImage(buf);
  if (!kind) throw httpError(400, "El enlace no es una imagen PNG, JPG, GIF o WEBP");
  return { buf, ext: kind.ext };
}

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
