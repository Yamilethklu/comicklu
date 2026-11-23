import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Identificador estable para Apple Developer / App Store Connect.
  // Verifica su disponibilidad en tu equipo de Apple Developer antes del primer envío.
  appId: "com.klunder.comicklu",
  appName: "ComicKlu",
  webDir: "dist/mobile",
  server: { androidScheme: "https" },
};

export default config;
