-- Align works RLS policies to app schema (creator_id/is_active vs user_id/is_published)
-- Idempotent and schema-aware

ALTER TABLE IF EXISTS public.works ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  has_creator_id boolean;
  has_user_id boolean;
  has_is_active boolean;
  has_is_published boolean;
  owner_sql text;
  public_sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='works' AND column_name='creator_id'
  ) INTO has_creator_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='works' AND column_name='user_id'
  ) INTO has_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='works' AND column_name='is_active'
  ) INTO has_is_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='works' AND column_name='is_published'
  ) INTO has_is_published;

  -- Build policy predicates depending on existing columns
  owner_sql := CASE
    WHEN has_creator_id THEN 'creator_id = auth.uid()'
    WHEN has_user_id THEN 'user_id = auth.uid()'
    ELSE 'true' -- fallback (should not happen)
  END;

  public_sql := CASE
    WHEN has_is_active THEN 'is_active = true'
    WHEN has_is_published THEN 'is_published = true'
    ELSE 'true'
  END;

  -- Drop existing conflicting policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='works_owner_all') THEN
    EXECUTE 'DROP POLICY "works_owner_all" ON public.works';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='works_public_select') THEN
    EXECUTE 'DROP POLICY "works_public_select" ON public.works';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='service_role_bypass_works') THEN
    EXECUTE 'DROP POLICY "service_role_bypass_works" ON public.works';
  END IF;

  -- Owner policy (ALL)
  EXECUTE format('CREATE POLICY "works_owner_all" ON public.works FOR ALL USING (%s) WITH CHECK (%s);', owner_sql, owner_sql);

  -- Public select policy
  EXECUTE format('CREATE POLICY "works_public_select" ON public.works FOR SELECT USING (%s);', public_sql);

  -- Service role bypass
  EXECUTE 'CREATE POLICY "service_role_bypass_works" ON public.works FOR ALL USING (auth.jwt() ->> ''role'' = ''service_role'')';
END $$;

-- Helpful indexes (conditional)
DO $$ BEGIN
  IF to_regclass('public.works') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='creator_id') THEN
      CREATE INDEX IF NOT EXISTS idx_works_creator_id ON public.works(creator_id);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='user_id') THEN
      CREATE INDEX IF NOT EXISTS idx_works_user_id ON public.works(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='is_active') THEN
      CREATE INDEX IF NOT EXISTS idx_works_is_active_true ON public.works(is_active) WHERE is_active = true;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='is_published') THEN
      CREATE INDEX IF NOT EXISTS idx_works_is_published_true ON public.works(is_published) WHERE is_published = true;
    END IF;
  END IF;
END $$;

COMMENT ON POLICY "works_owner_all" ON public.works IS 'Owner (creator_id/user_id) can manage own works';
COMMENT ON POLICY "works_public_select" ON public.works IS 'Public can view active/published works';
COMMENT ON POLICY "service_role_bypass_works" ON public.works IS 'Service role bypass for admin operations';

