/** Registra el service worker de PWA y escucha actualizaciones. */
export function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  const isProd = import.meta.env.PROD;
  const swUrl = `${import.meta.env.BASE_URL ?? "/"}sw.js`;

  const validSW = (sw: ServiceWorkerRegistration) => {
    console.log("[PWA] Service worker instalado:", sw.scope);
    sw.addEventListener("updatefound", () => {
      const installing = sw.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          console.log("[PWA] Nueva versión disponible. Recarga para aplicar.");
          // Opcional: notificar al usuario via useToast si se expone globalmente
        }
      });
    });
  };

  const registerValidSW = (swUrl: string) => {
    navigator.serviceWorker
      .register(swUrl)
      .then(validSW)
      .catch((err) => console.warn("[PWA] Error registrando service worker:", err));
  };

  if (isProd) {
    registerValidSW(swUrl);
  } else {
    // En desarrollo, no registrar SW para evitar problemas de caché con HMR
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  }
}