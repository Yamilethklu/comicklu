const THEME_KEY = "panelforge-theme";

export type Theme = "light" | "dark";

export function getSavedTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  return saved === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}