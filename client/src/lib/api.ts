import { API_BASE, getToken, isNative, setToken, tokenReady } from "./native";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) { super(message); }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  await tokenReady;
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (isNative) {
    headers["X-Client"] = "native";
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(API_BASE + path, {
    method,
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (isNative) {
    if (data?.token) await setToken(data.token);
    if (path === "/api/auth/logout") await setToken(null);
    if (res.status === 401 && path !== "/api/auth/login") await setToken(null);
  }
  if (!res.ok) throw new ApiError(res.status, data?.message ?? "Algo salió mal. Intenta de nuevo.", data);
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Algo salió mal. Intenta de nuevo.");
