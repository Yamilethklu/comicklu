import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// `vite build`                -> web (dist/public, lo sirve Express)
// `vite build --mode mobile`  -> paquete para la app Android/iOS (dist/mobile), lee .env.mobile
export default defineConfig(({ mode }) => {
  const mobile = mode === "mobile";
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
