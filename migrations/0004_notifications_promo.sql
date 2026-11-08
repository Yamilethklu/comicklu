-- Notificaciones y tokens de push (móvil)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);

-- Códigos promocionales y tarjetas de regalo
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  used_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (promo_code_id, user_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='push_tokens') THEN
    ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;