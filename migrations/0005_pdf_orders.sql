CREATE TABLE IF NOT EXISTS "pdf_orders" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "comic_id" integer NOT NULL REFERENCES "comics"("id") ON DELETE CASCADE,
  "stripe_session_id" text NOT NULL UNIQUE,
  "amount_cents" integer NOT NULL,
  "paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pdf_orders_comic_user_idx" ON "pdf_orders" ("comic_id", "user_id");
