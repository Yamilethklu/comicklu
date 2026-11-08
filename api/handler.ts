import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/index";

// Una sola instancia Express por instancia caliente de Vercel; no abrir puertos.
let appPromise: ReturnType<typeof createApp> | undefined;
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const original = new URL(req.url ?? "/", "http://localhost");
    const route = original.searchParams.get("route");
    const media = original.searchParams.get("media");
    if (route === null && media === null) {
      res.statusCode = 404;
      res.end("Ruta no encontrada");
      return;
    }
    original.searchParams.delete("route");
    original.searchParams.delete("media");
    const path = media !== null ? `/media/${encodeURIComponent(media)}` : `/api/${route}`;
    req.url = path + (original.searchParams.size ? `?${original.searchParams}` : "");
    const { app } = await (appPromise ??= createApp({ serverless: true }));
    app(req, res);
  } catch (error) {
    console.error("[vercel] No se pudo iniciar la API:", error);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "API temporalmente no disponible" }));
  }
}
