import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { App as CapApp } from "@capacitor/app";
import { api } from "./lib/api";
import { isNative } from "./lib/native";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

if (isNative) {
  CapApp.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) return;
    api("POST", "/api/billing/sync").catch(() => {}).finally(() => queryClient.invalidateQueries({ queryKey: ["me"] }));
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
