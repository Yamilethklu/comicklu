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
  stripe: boolean; ai: boolean; referenceImages: boolean; video: boolean; mail: boolean; yearly: { pro: boolean; premium: boolean };
}
export interface PanelData {
  imageUrl: string | null; caption: string; dialogue: string; prompt: string; voiceUrl: string | null;
}
export interface ComicData {
  id: number; title: string; synopsis: string; story: string; style: StyleId;
  settings: { tone?: string; language?: string; palette?: string; layout?: "vertical" | "horizontal"; characterReferenceUrl?: string; characterName?: string; characterDescription?: string };
  coverUrl: string | null; updatedAt: string; panels: PanelData[];
}
export interface RenderRow { id: number; status: "queued" | "processing" | "done" | "failed"; url: string | null; error: string | null }

export interface PublicComic {
  id: number; title: string; synopsis: string; style: string; coverUrl: string | null;
  author: { id: string; name: string; email?: string };
  likeCount: number; likedByMe: boolean;
  createdAt: string; publishedAt: string | null;
}
export interface CreatorProfile {
  author: { id: string; name: string; email: string };
  comics: PublicComic[];
  followerCount: number; followingCount: number; followingByMe: boolean;
}
export interface ComicComment {
  id: number; content: string; createdAt: string;
  author: { id: string; name: string } | null;
}
export interface ReferralInfo { code: string }
export interface ReferralClaim { valid: boolean; ownerId: string }
export interface CreditPackage { id: string; label: string; credits: number; priceCents: number }
export interface CreditBalance { balance: number }
