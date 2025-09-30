-- RLS hardening for manufacturing_partners and factory_products (idempotent)

-- Ensure RLS enabled
ALTER TABLE IF EXISTS public.manufacturing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.factory_products ENABLE ROW LEVEL SECURITY;

-- manufacturing_partners policies
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='manufacturing_partners' AND policyname='manufacturing_partners_public_view'
  ) THEN
    EXECUTE 'DROP POLICY manufacturing_partners_public_view ON public.manufacturing_partners';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='manufacturing_partners' AND policyname='partners_public_view'
  ) THEN
    EXECUTE 'DROP POLICY partners_public_view ON public.manufacturing_partners';
  END IF;
END $$;

CREATE POLICY manufacturing_partners_public_view ON public.manufacturing_partners
  FOR SELECT USING (
    -- Public may see approved partners. Owners can always see own rows.
    status = 'approved' OR owner_user_id = auth.uid()
  );

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='manufacturing_partners' AND policyname='manufacturing_partners_owner_write'
  ) THEN
    EXECUTE 'DROP POLICY manufacturing_partners_owner_write ON public.manufacturing_partners';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='manufacturing_partners' AND policyname='partners_owner_write'
  ) THEN
    EXECUTE 'DROP POLICY partners_owner_write ON public.manufacturing_partners';
  END IF;
END $$;

CREATE POLICY manufacturing_partners_owner_write ON public.manufacturing_partners
  FOR ALL USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

COMMENT ON POLICY manufacturing_partners_public_view ON public.manufacturing_partners IS 'Public can read approved partners; owners can read own.';
COMMENT ON POLICY manufacturing_partners_owner_write ON public.manufacturing_partners IS 'Only owner may insert/update/delete own partner row.';

-- factory_products policies: restrict public SELECT to active products under approved partners
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='factory_products' AND policyname='factory_products_public_select'
  ) THEN
    EXECUTE 'DROP POLICY factory_products_public_select ON public.factory_products';
  END IF;
END $$;

CREATE POLICY factory_products_public_select_safe ON public.factory_products
  FOR SELECT USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp
      WHERE mp.id = public.factory_products.partner_id AND mp.status = 'approved'
    )
  );

-- Keep owner manage policy if present; otherwise create it
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='factory_products' AND policyname='factory_products_owner_manage'
  ) THEN
    EXECUTE '
      CREATE POLICY factory_products_owner_manage ON public.factory_products
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM public.manufacturing_partners mp
            WHERE mp.id = public.factory_products.partner_id AND mp.owner_user_id = auth.uid()
          )
        ) WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.manufacturing_partners mp
            WHERE mp.id = public.factory_products.partner_id AND mp.owner_user_id = auth.uid()
          )
        );
    ';
  END IF;
END $$;

COMMENT ON POLICY factory_products_public_select_safe ON public.factory_products IS 'Public can read only active products of approved partners.';
