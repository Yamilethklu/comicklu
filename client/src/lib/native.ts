import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Preferences } from "@capacitor/preferences";

/** true dentro de la app de Android/iOS (Capacitor); false en el navegador. */
export const isNative = Capacitor.isNativePlatform();

/** URL del servidor. Vacía en la web (mismo origen); en la app se fija al compilar (.env.mobile). */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

/**
 * Cobro en la app. Por defecto la app NO muestra botones de compra (las tiendas tienen reglas propias
 * para suscripciones digitales). Pon VITE_NATIVE_EXTERNAL_CHECKOUT=true solo si confirmaste que tu
 * país/tienda permite abrir Stripe en el navegador desde la app.
 */
export const allowNativeCheckout = !isNative || import.meta.env.VITE_NATIVE_EXTERNAL_CHECKOUT === "true";

/** Los archivos subidos se guardan como /media/...; en la app hay que apuntar al servidor. */
export function mediaUrl<T extends string | null | undefined>(u: T): T {
  if (!u || !API_BASE || !u.startsWith("/media/")) return u;
  return (API_BASE + u) as T;
}

export async function openExternal(url: string) {
  if (isNative) await Browser.open({ url });
  else window.location.href = url;
}

const TOKEN_KEY = "panelforge.token";
let token: string | null = null;
/** Se resuelve cuando ya se leyó el token guardado (solo importa en la app). */
export const tokenReady: Promise<void> = isNative
  ? Preferences.get({ key: TOKEN_KEY }).then((r) => { token = r.value; }).catch(() => {})
  : Promise.resolve();
export const getToken = () => token;
export async function setToken(t: string | null) {
  token = t;
  if (!isNative) return;
  if (t) await Preferences.set({ key: TOKEN_KEY, value: t });
  else await Preferences.remove({ key: TOKEN_KEY });
}
