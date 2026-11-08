/** Logger estructurado sencillo (formato JSON en producción, legible en dev). */
export function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, any>) {
  const entry: Record<string, any> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "panelforge-api",
  };
  if (meta) entry.meta = meta;
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  const reqId = req.headers["x-request-id"] || crypto.randomUUID();
  req.headers["x-request-id"] = reqId;
  res.setHeader("X-Request-Id", reqId);

  const oldSend = res.send.bind(res);
  res.send = (body: any) => {
    const ms = Date.now() - start;
    log("info", `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, {
      reqId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms,
      ip: req.ip,
      userId: req.session?.userId || req.user?.id,
    });
    return oldSend(body);
  };
  next();
}