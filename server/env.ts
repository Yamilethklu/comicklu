import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";
// Render supplies this URL after assigning the public hostname.
const appUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT ?? 5000}`).replace(/\/$/, "");
if (isProd && new URL(appUrl).protocol !== "https:") {
  throw new Error("Configura APP_URL con https o despliega con RENDER_EXTERNAL_URL.");
}

function need(name: string, fallbackDev?: string): string {
  const v = process.env[name] ?? (isProd ? undefined : fallbackDev);
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example`);
  return v;
}

if (Boolean(process.env.SUPABASE_URL) !== Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Configura SUPABASE_URL y SUPABASE_SECRET_KEY juntas.");
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: need("DATABASE_URL", "postgres://comic:comic@localhost:5432/comicdb"),
  sessionSecret: need("SESSION_SECRET", "dev-only-secret-change-me"),
  appUrl,
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "comicklu-media",
  https: appUrl.startsWith("https://"),
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),

  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  prices: {
    pro: { month: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "", year: process.env.STRIPE_PRICE_PRO_YEARLY ?? "" },
    premium: { month: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? "", year: process.env.STRIPE_PRICE_PREMIUM_YEARLY ?? "" },
  },

  // "free" (por defecto: Pollinations sin clave + voz local) | "openai" (de pago) | "off"
  aiProvider: (process.env.AI_PROVIDER ?? "free") as "free" | "openai" | "off",
  aiRetryDelayMs: Number(process.env.AI_RETRY_DELAY_MS ?? 2500),
  pollinations: {
    enabled: process.env.POLLINATIONS_ENABLED !== "false",
    key: process.env.POLLINATIONS_API_KEY ?? "",
    concurrency: Math.max(1, Number(process.env.POLLINATIONS_CONCURRENCY ?? 1)),
    textModel: process.env.POLLINATIONS_TEXT_MODEL ?? "openai",
    imageModel: process.env.POLLINATIONS_IMAGE_MODEL ?? "flux",
    // Con clave gratuita se usa gen.pollinations.ai; sin clave, los endpoints anónimos.
    textUrl: process.env.POLLINATIONS_TEXT_URL ?? (process.env.POLLINATIONS_API_KEY ? "https://gen.pollinations.ai/v1/chat/completions" : "https://text.pollinations.ai/openai"),
    imageUrl: process.env.POLLINATIONS_IMAGE_URL ?? (process.env.POLLINATIONS_API_KEY ? "https://gen.pollinations.ai/image/{prompt}" : "https://image.pollinations.ai/prompt/{prompt}"),
    audioUrl: process.env.POLLINATIONS_AUDIO_URL ?? (process.env.POLLINATIONS_API_KEY ? "https://gen.pollinations.ai/text/{prompt}" : "https://text.pollinations.ai/{prompt}"),
  },
  geminiKey: process.env.GEMINI_API_KEY ?? "", // gratis: https://aistudio.google.com/apikey
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  hfToken: process.env.HF_TOKEN ?? "", // gratis: https://huggingface.co/settings/tokens
  hfImageModel: process.env.HF_IMAGE_MODEL ?? "black-forest-labs/FLUX.1-schnell",
  hfImageUrl: process.env.HF_IMAGE_URL ?? "https://router.huggingface.co/hf-inference/models/{model}",
  espeakPath: process.env.ESPEAK_PATH ?? "espeak-ng",
  espeakLang: process.env.ESPEAK_LANG ?? "es",

  smtpUrl: process.env.SMTP_URL ?? "", // ej. smtps://usuario:clave@smtp.tu-proveedor.com:465
  mailFrom: process.env.MAIL_FROM ?? "Panelforge <no-reply@localhost>",

  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini",
  openaiTtsModel: process.env.OPENAI_TTS_MODEL ?? "tts-1",
  ffmpegPath: process.env.FFMPEG_PATH ?? "",
};

export const stripeEnabled = () => !!env.stripeSecretKey;
export const aiEnabled = () => {
  if (env.aiProvider === "off") return false;
  if (env.aiProvider === "openai") return !!env.openaiKey;
  return env.pollinations.enabled || !!env.geminiKey || !!env.hfToken;
};
export const mailEnabled = () => !!env.smtpUrl || process.env.NODE_ENV === "test";
