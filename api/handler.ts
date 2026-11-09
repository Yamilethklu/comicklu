import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "../server/index";

// Importación estática: Vercel debe incluir el grafo completo del servidor en la función.
// La importación dinámica anterior podía quedar sin empaquetar y causar ERR_MODULE_NOT_FOUND.
let appPromise: Promise<Express> | undefined;
async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = createApp({ serverless: true })
      .then(({ app }) => app)
      .catch((error) => {
        appPromise = undefined; // permitir recuperación después de fallos transitorios
        throw error;
      });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const original = new URL(req.url ?? "/", "http://localhost");
    const route = original.searchParams.get("route");
    const media = original.searchParams.get("media");
    if (route === null && media === null) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "Ruta no encontrada" }));
      return;
    }
    original.searchParams.delete("route");
    original.searchParams.delete("media");
    const routePath = media !== null ? `/media/${encodeURIComponent(media)}` : `/api/${route}`;
    req.url = routePath + (original.searchParams.size ? `?${original.searchParams}` : "");
    const app = await getApp();
    app(req, res);
  } catch (error) {
    console.error("[comicklu] API bootstrap failed:", error);
    if (res.headersSent) return;
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const err = error as NodeJS.ErrnoException;
    // Exponer solo categoría y código, nunca stack, rutas internas ni secretos.
    const reason = typeof err?.code === "string" && /^[A-Z_]{3,40}$/.test(err.code)
      ? err.code
      : err instanceof TypeError ? "TYPE_ERROR"
      : err instanceof SyntaxError ? "SYNTAX_ERROR"
      : "INITIALIZATION_ERROR";
    res.end(JSON.stringify({
      ok: false, code: "API_BOOTSTRAP_FAILED", reason,
      message: "El servidor no pudo iniciar. Consulta Runtime Logs de Vercel.",
    }));
  }
}
