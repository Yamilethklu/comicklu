import { createContext, useContext, useCallback, useState, useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, Zap } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let id = 0;
const nextId = () => `toast-${++id}`;

const TYPE_ICON: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-mint" />,
  error: <AlertCircle className="h-5 w-5 text-pop" />,
  info: <Info className="h-5 w-5 text-zap" />,
  warning: <Zap className="h-5 w-5 text-sun" />,
};

const TYPE_BG: Record<ToastType, string> = {
  success: "bg-mint/10 border-mint/30 text-ink",
  error: "bg-pop/10 border-pop/30 text-ink",
  info: "bg-zap/10 border-zap/30 text-ink",
  warning: "bg-sun/10 border-sun/30 text-ink",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((toast: Omit<Toast, "id">) => {
    const newToast: Toast = { ...toast, id: nextId() };
    setToasts((prev) => [...prev, newToast]);
    if (newToast.duration !== 0) {
      const timer = setTimeout(() => dismiss(newToast.id), newToast.duration ?? 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border-2 border-ink bg-white px-4 py-3 shadow-hard-lg transform transition-all duration-200"
            style={{ animationDelay: `${toasts.indexOf(t) * 80}ms` }}
          >
            <div className="flex-shrink-0 mt-0.5">{TYPE_ICON[t.type]}</div>
            <div className="flex-1 text-sm font-bold leading-tight">{t.title}</div>
            {t.message && (
              <p className="mt-0.5 text-sm text-ink/70 leading-relaxed">{t.message}</p>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-1 hover:bg-ink/10 text-ink/60 transition"
              aria-label="Cerrar notificación"
            >
              <span className="sr-only">Cerrar</span>
              <span className="h-4 w-4">✕</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}