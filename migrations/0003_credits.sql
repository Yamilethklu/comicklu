-- Créditos IA sueltos (pay-as-you-go)
CREATE TABLE IF NOT EXISTS public.user_credits (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS user_credits_user_idx ON public.user_credits (user_id);

-- Historial de movimientos de crédito
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- purchase | refund | usage
  amount INTEGER NOT NULL,
  reference TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON public.credit_transactions (user_id);
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_credits') THEN
    ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;