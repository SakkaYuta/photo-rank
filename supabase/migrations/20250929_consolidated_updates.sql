-- Consolidated app updates (idempotent):
-- 1) manufacturing_partners.shipping_info (jsonb)
-- 2) favorites unique index (user_id, work_id) + created_at
-- 3) organizer_leave_requests table + RLS
-- 4) factory_products schema & RLS adjustments

-- 1) Shipping info on manufacturing_partners
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manufacturing_partners'
      AND column_name = 'shipping_info'
  ) THEN
    ALTER TABLE public.manufacturing_partners ADD COLUMN shipping_info jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.manufacturing_partners.shipping_info IS 'JSONB: method_title, per_order_note, carrier_name, fee_general_jpy, fee_okinawa_jpy, eta_text, cautions[], split_title, split_desc, split_cautions[]';

-- 2) Favorites unique index + created_at
DO $$ BEGIN
  IF to_regclass('public.favorites') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_favorites_user_work
      ON public.favorites(user_id, work_id);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='favorites' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.favorites ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
  END IF;
END $$;

-- 3) Organizer leave requests
CREATE TABLE IF NOT EXISTS public.organizer_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  effective_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.organizer_leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS olr_organizer_rw ON public.organizer_leave_requests;
CREATE POLICY olr_organizer_rw ON public.organizer_leave_requests
  FOR ALL USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS olr_admin_all ON public.organizer_leave_requests;
CREATE POLICY olr_admin_all ON public.organizer_leave_requests
  FOR ALL USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

COMMENT ON TABLE public.organizer_leave_requests IS 'Organizer-initiated requests to remove a creator; default effective at month-end.';

-- 4) Factory products schema & RLS
CREATE TABLE IF NOT EXISTS public.manufacturing_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.users(id),
  name text NOT NULL,
  company_name text,
  contact_email text,
  contact_phone text,
  address jsonb,
  website_url text,
  description text,
  capabilities jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  avg_rating numeric(3,2) DEFAULT 0.0,
  ratings_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_partners' AND column_name='owner_user_id'
  ) THEN
    ALTER TABLE public.manufacturing_partners ADD COLUMN owner_user_id uuid REFERENCES public.users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.factory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.manufacturing_partners(id) ON DELETE CASCADE,
  product_type text NOT NULL,
  base_cost integer NOT NULL,
  lead_time_days integer DEFAULT 7,
  minimum_quantity integer DEFAULT 1,
  maximum_quantity integer DEFAULT 1000,
  options jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='factory_products' AND column_name='minimum_quantity') THEN
    ALTER TABLE public.factory_products ADD COLUMN minimum_quantity integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='factory_products' AND column_name='maximum_quantity') THEN
    ALTER TABLE public.factory_products ADD COLUMN maximum_quantity integer DEFAULT 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='factory_products' AND column_name='options') THEN
    ALTER TABLE public.factory_products ADD COLUMN options jsonb;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='factory_products' AND column_name='min_order_qty') THEN
    UPDATE public.factory_products SET minimum_quantity = GREATEST(COALESCE(min_order_qty, 1), 1)
    WHERE (minimum_quantity IS NULL OR minimum_quantity < 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_factory_products_partner_active ON public.factory_products(partner_id, is_active);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_factory_products_updated ON public.factory_products;
CREATE TRIGGER trg_factory_products_updated BEFORE UPDATE ON public.factory_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_manufacturing_partners_updated ON public.manufacturing_partners;
CREATE TRIGGER trg_manufacturing_partners_updated BEFORE UPDATE ON public.manufacturing_partners
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.factory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS factory_products_owner_manage ON public.factory_products;
CREATE POLICY factory_products_owner_manage ON public.factory_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp
      WHERE mp.id = public.factory_products.partner_id
        AND mp.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp
      WHERE mp.id = public.factory_products.partner_id
        AND mp.owner_user_id = auth.uid()
    )
  );

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'factory_products' AND policyname = 'factory_products_public_select'
  ) THEN
    CREATE POLICY factory_products_public_select ON public.factory_products FOR SELECT USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.factory_products IS 'Factory products for partner listings (options jsonb holds merch attributes)';
COMMENT ON COLUMN public.factory_products.options IS 'JSONB: display_name, category, description, image_url, production_time, sizes[], colors[], materials, print_area, features[], is_recommended, discount_rate';

