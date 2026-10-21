import { sql } from "drizzle-orm";
import {
  pgTable, serial, integer, text, boolean, timestamp, jsonb, varchar, uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // user | admin
  plan: text("plan").notNull().default("free"), // free | pro | premium
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, trialing, past_due, canceled...
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const comics = pgTable("comics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  synopsis: text("synopsis").notNull().default(""),
  story: text("story").notNull().default(""),
  style: text("style").notNull().default("comic"),
  settings: jsonb("settings").$type<ComicSettings>().notNull().default({}),
  coverUrl: text("cover_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("comics_user_idx").on(t.userId)]);

export const panels = pgTable("panels", {
  id: serial("id").primaryKey(),
  comicId: integer("comic_id").notNull().references(() => comics.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  imageUrl: text("image_url"),
  caption: text("caption").notNull().default(""),
  dialogue: text("dialogue").notNull().default(""),
  prompt: text("prompt").notNull().default(""),
  voiceUrl: text("voice_url"),
}, (t) => [index("panels_comic_idx").on(t.comicId)]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // image | audio | video
  url: text("url").notNull(),
  prompt: text("prompt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("assets_user_idx").on(t.userId)]);

export const usage = pgTable("usage", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: varchar("month").notNull(), // YYYY-MM (UTC)
  metric: text("metric").notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [uniqueIndex("usage_unique").on(t.userId, t.month, t.metric)]);

export const renders = pgTable("renders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  comicId: integer("comic_id").notNull().references(() => comics.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"), // queued | processing | done | failed
  url: text("url"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Idempotencia de webhooks de Stripe
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

// Tokens de recuperación de contraseña (solo se guarda el hash del token)
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("password_resets_user_idx").on(t.userId)]);

export interface ComicSettings {
  tone?: string;      // ej. "épico", "humor", "oscuro"
  language?: string;  // idioma del cómic
  palette?: string;   // descripción libre de colores
  layout?: "vertical" | "horizontal";
}

export type User = typeof users.$inferSelect;
export type Comic = typeof comics.$inferSelect;
export type Panel = typeof panels.$inferSelect;
