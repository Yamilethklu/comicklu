DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'users', 'comics', 'panels', 'assets', 'usage', 'renders', 'stripe_events',
    'password_resets', 'session', 'comic_likes', 'comic_comments', 'user_followers',
    'referrals', 'user_credits', 'credit_transactions', 'push_tokens', 'notifications',
    'promo_codes', 'promo_code_uses', 'pdf_orders', 'site_feedback'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH table_name IN ARRAY app_tables LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH table_name IN ARRAY app_tables LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END LOOP;
  END IF;
END $$;
