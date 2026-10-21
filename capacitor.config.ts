import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.panelforge.app",      // CÁMBIALO por el tuyo (no se puede cambiar después de publicar)
  appName: "Panelforge",
  webDir: "dist/mobile",
  server: { androidScheme: "https" },
};

export default config;
