-- Habilitar cómics públicos y funciones sociales (viralidad)
ALTER TABLE public.comics ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.comics ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS comics_public_idx ON public.comics (is_public, created_at DESC);

-- Likes en cómics públicos
CREATE TABLE IF NOT EXISTS public.comic_likes (
  id SERIAL PRIMARY KEY,
  comic_id INTEGER NOT NULL REFERENCES public.comics(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (comic_id, user_id)
);
CREATE INDEX IF NOT EXISTS comic_likes_comic_idx ON public.comic_likes (comic_id);

-- Comentarios en cómics públicos
CREATE TABLE IF NOT EXISTS public.comic_comments (
  id SERIAL PRIMARY KEY,
  comic_id INTEGER NOT NULL REFERENCES public.comics(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comic_comments_comic_idx ON public.comic_comments (comic_id, created_at DESC);

-- Seguidores entre usuarios
CREATE TABLE IF NOT EXISTS public.user_followers (
  id SERIAL PRIMARY KEY,
  follower_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS user_followers_following_idx ON public.user_followers (following_id);

-- Códigos de referidos
CREATE TABLE IF NOT EXISTS public.referrals (
  id SERIAL PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  owner_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id VARCHAR REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS referrals_owner_idx ON public.referrals (owner_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON public.referrals (code);

-- RLS (si Supabase está activo, Express es dueño de la autenticación)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='comics') THEN
    ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.comic_likes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.comic_comments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_followers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;