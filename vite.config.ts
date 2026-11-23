import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// `vite build` -> web; `vite build --mode mobile` -> Capacitor iOS/Android.
export default defineConfig(({ mode }) => {
  const mobile = mode === "mobile";
  if (mobile) {
    const { VITE_API_URL } = loadEnv(mode, import.meta.dirname, "VITE_");
    let apiUrl: URL;
    try {
      apiUrl = new URL(VITE_API_URL);
    } catch {
      throw new Error("Configura VITE_API_URL=https://tu-backend en .env.mobile antes de compilar iOS/Android.");
    }
    if (apiUrl.protocol !== "https:" || apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash) {
      throw new Error("VITE_API_URL debe ser el origen HTTPS del backend, sin ruta, parámetros ni fragmento.");
    }
  }
  return {
    root: path.resolve(import.meta.dirname, "client"),
    envDir: import.meta.dirname,
    base: mobile ? "./" : "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client/src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
      },
    },
    build: { outDir: path.resolve(import.meta.dirname, mobile ? "dist/mobile" : "dist/public"), emptyOutDir: true },
  };
});
