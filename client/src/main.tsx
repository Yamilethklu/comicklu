import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { App as CapApp } from "@capacitor/app";
import { api } from "./lib/api";
import { isNative } from "./lib/native";
import { registerSW } from "./lib/sw";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
    mutations: { retry: false },
  },
});

if (isNative) {
  CapApp.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) return;
    api("POST", "/api/billing/sync").catch(() => {}).finally(() => queryClient.invalidateQueries({ queryKey: ["me"] }));
  });
}

// Registrar service worker (PWA) solo en producción / web
if (!isNative && typeof window !== "undefined") {
  registerSW();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// Push notifications mobile (capacitor)
import { usePushListener } from "./lib/push";
if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
  usePushListener();
}
