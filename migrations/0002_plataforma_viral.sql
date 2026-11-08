ALTER TABLE "comics" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
ALTER TABLE "comics" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
CREATE INDEX IF NOT EXISTS "comics_public_idx" ON "comics" ("published_at" DESC) WHERE "is_public" = true;
CREATE TABLE IF NOT EXISTS "comic_likes" (
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "comic_id" integer NOT NULL REFERENCES "comics"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "comic_likes_unique" ON "comic_likes"("user_id", "comic_id");
CREATE INDEX IF NOT EXISTS "comic_likes_comic_idx" ON "comic_likes"("comic_id");
CREATE TABLE IF NOT EXISTS "comic_comments" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "comic_id" integer NOT NULL REFERENCES "comics"("id") ON DELETE CASCADE,
  "text" varchar(1000) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "comic_comments_comic_idx" ON "comic_comments"("comic_id");
CREATE TABLE IF NOT EXISTS "follows" (
  "follower_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "following_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "follows_no_self" CHECK ("follower_id" <> "following_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "follows_unique" ON "follows"("follower_id","following_id");
CREATE INDEX IF NOT EXISTS "follows_following_idx" ON "follows"("following_id");
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY,
  "referrer_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referred_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "referrals_no_self" CHECK ("referrer_id" <> "referred_id")
);
CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals"("referrer_id");
