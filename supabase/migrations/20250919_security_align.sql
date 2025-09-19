-- Align RLS policies with actual schema and reduce visibility mismatches

-- works: public visibility should follow is_published or is_active flags
-- ensure compatibility: some environments only have is_published
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

-- Drop conflicting/legacy policies if exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='works_visibility') THEN
    DROP POLICY works_visibility ON public.works;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='Works are publicly visible') THEN
    DROP POLICY "Works are publicly visible" ON public.works;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='Creators can manage their works') THEN
    DROP POLICY "Creators can manage their works" ON public.works;
  END IF;
END $$;

-- Public can read published/active works; creators can always read their own
CREATE POLICY works_public_read ON public.works
  FOR SELECT USING (
    COALESCE(is_published, false) = true OR COALESCE(is_active, false) = true OR creator_id = auth.uid()
  );

-- Creators can manage their own works
CREATE POLICY works_creator_manage ON public.works
  FOR ALL USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- purchases: allow buyers to read own purchases, and creators to read purchases for their works
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchases' AND policyname='Users can view their own purchases') THEN
    DROP POLICY "Users can view their own purchases" ON public.purchases;
  END IF;
END $$;

CREATE POLICY purchases_buyer_or_creator_read ON public.purchases
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.works w WHERE w.id = public.purchases.work_id AND w.creator_id = auth.uid()
    )
  );

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security_align_20250919', 'local')
ON CONFLICT (version) DO NOTHING;
