CREATE TABLE IF NOT EXISTS "site_feedback" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" varchar(1500) NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "admin_reply" varchar(1000),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_feedback_status_idx" ON "site_feedback" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_feedback_user_idx" ON "site_feedback" ("user_id");
--> statement-breakpoint
ALTER TABLE "site_feedback" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "site_feedback" FROM anon, authenticated;
