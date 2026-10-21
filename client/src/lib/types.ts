import type { PlanDef, Metric, StyleId } from "@shared/plans";

export interface PublicUser {
  id: string; email: string; name: string; role: string; plan: string;
  subscriptionStatus: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; hasBilling: boolean;
}
export interface Me {
  user: PublicUser | null;
  effectivePlan?: "free" | "pro" | "premium";
  limits?: PlanDef["limits"];
  usage?: Record<Metric, number>;
  comics?: number;
}
export interface AppConfig {
  plans: Record<"free" | "pro" | "premium", PlanDef>;
  stripe: boolean; ai: boolean; mail: boolean; yearly: { pro: boolean; premium: boolean };
}
export interface PanelData {
  imageUrl: string | null; caption: string; dialogue: string; prompt: string; voiceUrl: string | null;
}
export interface ComicData {
  id: number; title: string; synopsis: string; story: string; style: StyleId;
  settings: { tone?: string; language?: string; palette?: string; layout?: "vertical" | "horizontal" };
  coverUrl: string | null; updatedAt: string; panels: PanelData[];
}
export interface RenderRow { id: number; status: "queued" | "processing" | "done" | "failed"; url: string | null; error: string | null }
