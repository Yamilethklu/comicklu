/** Refresh the service worker after releases, without storing old HTML or API data. */
export function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = (import.meta.env.BASE_URL ?? "/") + "sw.js";
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())));
    return;
  }
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !reloaded) {
      reloaded = true;
      window.location.reload();
    }
  });
  void navigator.serviceWorker.register(swUrl, { updateViaCache: "none" })
    .then(registration => registration.update())
    .catch(error => console.warn("[PWA] No se pudo actualizar el service worker:", error));
}
