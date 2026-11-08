export type PlanId = "free" | "pro" | "premium";
export type Metric = "image" | "story" | "voice" | "video";
export type Interval = "month" | "year";

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonth: number; // solo informativo; el cobro real lo define el Price de Stripe
  priceYear: number;
  limits: {
    comics: number;
    panelsPerComic: number;
    monthly: Record<Metric, number>;
  };
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Gratis",
    tagline: "Para probar el estudio",
    priceMonth: 0,
    priceYear: 0,
    limits: { comics: 3, panelsPerComic: 12, monthly: { image: 5, story: 5, voice: 0, video: 0 } },
    features: [
      "3 cómics guardados en la nube",
      "Hasta 12 viñetas por cómic",
      "5 imágenes con IA al mes",
      "5 guiones con IA al mes",
      "Exportación JSON",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Para creadores constantes",
    priceMonth: 9.99,
    priceYear: 99,
    limits: { comics: 25, panelsPerComic: 60, monthly: { image: 100, story: 100, voice: 40, video: 5 } },
    features: [
      "25 cómics guardados",
      "Hasta 60 viñetas por cómic",
      "100 imágenes con IA al mes",
      "100 guiones con IA al mes",
      "40 voces con IA al mes",
      "5 videos animados al mes",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "Para estudios y proyectos grandes",
    priceMonth: 24.99,
    priceYear: 249,
    limits: { comics: 200, panelsPerComic: 200, monthly: { image: 500, story: 1000, voice: 300, video: 40 } },
    features: [
      "200 cómics guardados",
      "Hasta 200 viñetas por cómic",
      "500 imágenes con IA al mes",
      "1000 guiones con IA al mes",
      "300 voces con IA al mes",
      "40 videos animados al mes",
    ],
  },
};

export const STYLES = {
  comic: { name: "Cómic americano", prompt: "classic American comic book art, bold black ink outlines, halftone dots, dynamic composition, vivid flat colors" },
  manga: { name: "Manga", prompt: "black and white manga illustration, screentone shading, expressive linework, dramatic panel composition" },
  anime: { name: "Anime", prompt: "anime key visual, cel shading, vibrant colors, clean linework, cinematic lighting" },
  cyberpunk: { name: "Cyberpunk", prompt: "cyberpunk comic art, neon magenta and cyan lighting, rain-soaked futuristic city, high contrast, gritty ink lines" },
} as const;
export type StyleId = keyof typeof STYLES;

export const METRIC_LABEL: Record<Metric, string> = {
  image: "imágenes con IA",
  story: "guiones con IA",
  voice: "voces con IA",
  video: "videos",
};
