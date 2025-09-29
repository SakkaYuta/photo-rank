-- Ensure factory tables exist and align with app expectations
-- Safe, idempotent migration for factory_products schema + RLS write policies

-- 1) Create manufacturing_partners if not exists (with owner_user_id)
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

-- Ensure owner_user_id column exists if table was created elsewhere
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_partners' AND column_name='owner_user_id'
  ) THEN
    ALTER TABLE public.manufacturing_partners ADD COLUMN owner_user_id uuid REFERENCES public.users(id);
  END IF;
END $$;

-- 2) Create factory_products if not exists with required columns
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

-- 3) Evolve older schemas to new columns
DO $$ BEGIN
  -- Add columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='factory_products' AND column_name='minimum_quantity'
  ) THEN
    ALTER TABLE public.factory_products ADD COLUMN minimum_quantity integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='factory_products' AND column_name='maximum_quantity'
  ) THEN
    ALTER TABLE public.factory_products ADD COLUMN maximum_quantity integer DEFAULT 1000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='factory_products' AND column_name='options'
  ) THEN
    ALTER TABLE public.factory_products ADD COLUMN options jsonb;
  END IF;

  -- Backfill from legacy min_order_qty if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='factory_products' AND column_name='min_order_qty'
  ) THEN
    UPDATE public.factory_products
    SET minimum_quantity = GREATEST(COALESCE(min_order_qty, 1), 1)
    WHERE (minimum_quantity IS NULL OR minimum_quantity < 1);
  END IF;
END $$;

-- 4) Useful indexes
CREATE INDEX IF NOT EXISTS idx_factory_products_partner_active ON public.factory_products(partner_id, is_active);

-- 5) updated_at trigger (shared function may already exist; ensure presence)
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

-- 6) RLS: enable and add owner write policies (read policies defined elsewhere remain)
ALTER TABLE public.factory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_partners ENABLE ROW LEVEL SECURITY;

-- Allow partner owners to manage their own products
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

-- Optional: keep a permissive public SELECT (adjust in security hardening phase)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'factory_products' AND policyname = 'factory_products_public_select'
  ) THEN
    CREATE POLICY factory_products_public_select ON public.factory_products FOR SELECT USING (true);
  END IF;
END $$;

-- Mark
COMMENT ON TABLE public.factory_products IS 'Factory products for partner listings (options jsonb holds merch attributes)';
COMMENT ON COLUMN public.factory_products.options IS 'JSONB: display_name, category, description, image_url, production_time, sizes[], colors[], materials, print_area, features[], is_recommended, discount_rate';

