-- v5.0 RLS and ownership columns (non-destructive)

-- Add ownership/identity columns if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_partners' AND column_name='owner_user_id'
  ) THEN
    ALTER TABLE public.manufacturing_partners ADD COLUMN owner_user_id uuid REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='creator_user_id'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN creator_user_id uuid REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='work_id'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN work_id uuid REFERENCES public.works(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.manufacturing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Helper: admin check
CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid)
RETURNS boolean AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.id = p_user AND u.role = 'admin');
$$ LANGUAGE sql STABLE;

-- manufacturing_partners
DROP POLICY IF EXISTS partners_public_view ON public.manufacturing_partners;
CREATE POLICY partners_public_view ON public.manufacturing_partners
  FOR SELECT USING (
    status = 'approved' OR owner_user_id = auth.uid() OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS partners_owner_write ON public.manufacturing_partners;
CREATE POLICY partners_owner_write ON public.manufacturing_partners
  FOR ALL USING (
    owner_user_id = auth.uid() OR public.is_admin(auth.uid())
  ) WITH CHECK (
    owner_user_id = auth.uid() OR public.is_admin(auth.uid())
  );

-- factory_products
DROP POLICY IF EXISTS factory_products_view ON public.factory_products;
CREATE POLICY factory_products_view ON public.factory_products
  FOR SELECT USING (
    is_active = true OR EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp 
      WHERE mp.id = factory_products.partner_id 
        AND (mp.owner_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS factory_products_write ON public.factory_products;
CREATE POLICY factory_products_write ON public.factory_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp 
      WHERE mp.id = factory_products.partner_id 
        AND (mp.owner_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp 
      WHERE mp.id = factory_products.partner_id 
        AND (mp.owner_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

-- manufacturing_orders
DROP POLICY IF EXISTS morders_view ON public.manufacturing_orders;
CREATE POLICY morders_view ON public.manufacturing_orders
  FOR SELECT USING (
    creator_user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp 
      WHERE mp.id = public.manufacturing_orders.partner_id 
        AND (mp.owner_user_id = auth.uid())
    ) OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS morders_update_partner ON public.manufacturing_orders;
CREATE POLICY morders_update_partner ON public.manufacturing_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp 
      WHERE mp.id = public.manufacturing_orders.partner_id 
        AND (mp.owner_user_id = auth.uid())
    ) OR public.is_admin(auth.uid())
  ) WITH CHECK (true);

-- partner_notifications
DROP POLICY IF EXISTS pnotify_view ON public.partner_notifications;
CREATE POLICY pnotify_view ON public.partner_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp 
      WHERE mp.id = public.partner_notifications.partner_id 
        AND (mp.owner_user_id = auth.uid())
    ) OR public.is_admin(auth.uid())
  );

-- partner_reviews
DROP POLICY IF EXISTS previews_public ON public.partner_reviews;
CREATE POLICY previews_public ON public.partner_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS previews_write ON public.partner_reviews;
CREATE POLICY previews_write ON public.partner_reviews
  FOR INSERT WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS previews_update_own ON public.partner_reviews;
CREATE POLICY previews_update_own ON public.partner_reviews
  FOR UPDATE USING (author_user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (author_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- price_history
DROP POLICY IF EXISTS phistory_view ON public.price_history;
CREATE POLICY phistory_view ON public.price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.factory_products fp 
      JOIN public.manufacturing_partners mp ON mp.id = fp.partner_id
      WHERE fp.id = public.price_history.factory_product_id 
        AND (mp.owner_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS phistory_insert ON public.price_history;
CREATE POLICY phistory_insert ON public.price_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.factory_products fp 
      JOIN public.manufacturing_partners mp ON mp.id = fp.partner_id
      WHERE fp.id = public.price_history.factory_product_id 
        AND (mp.owner_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

-- mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_rls', 'local')
ON CONFLICT (version) DO NOTHING;

