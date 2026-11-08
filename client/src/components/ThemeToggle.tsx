import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { getSavedTheme, applyTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = getSavedTheme();
    applyTheme(saved);
    setTheme(saved);
  }, []);

  const toggle = () => setTheme((t) => toggleTheme(t));

  return (
    <button
      onClick={toggle}
      className="rounded-lg border-2 border-ink bg-white px-3 py-2 transition hover:bg-sun/50"
      aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
      title={theme === "light" ? "Modo oscuro" : "Modo claro"}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 text-ink" aria-hidden />
      ) : (
        <Sun className="h-5 w-5 text-sun" aria-hidden />
      )}
    </button>
  );
}