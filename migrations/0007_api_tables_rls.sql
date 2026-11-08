-- Las tablas del backend no deben exponerse por Supabase Data API.
-- Los roles de la API carecen de políticas RLS; solo Express con sesión accede.
ALTER TABLE "comic_likes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comic_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_credits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "promo_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "promo_code_uses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pdf_orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "site_feedback" ENABLE ROW LEVEL SECURITY;
