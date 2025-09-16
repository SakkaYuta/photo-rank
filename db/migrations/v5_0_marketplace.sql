-- v5.0 marketplace migration (non-destructive)
-- Adds partner marketplace schema and extends purchases for two-stage fees

-- Manufacturing partners (factories)
CREATE TABLE IF NOT EXISTS public.manufacturing_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  contact_email text NOT NULL,
  contact_phone text,
  address jsonb,
  website_url text,
  description text,
  capabilities jsonb, -- printable sizes, materials, colors, etc.
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  avg_rating numeric(3,2) DEFAULT 0.0,
  ratings_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Factory products with base cost and lead time
CREATE TABLE IF NOT EXISTS public.factory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.manufacturing_partners(id) NOT NULL,
  product_type text NOT NULL,
  base_cost integer NOT NULL, -- 工場原価（税別/JPY）
  lead_time_days integer DEFAULT 7,
  min_order_qty integer DEFAULT 1,
  options jsonb, -- size/color/finish etc.
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_factory_products_partner ON public.factory_products(partner_id, is_active);

-- Manufacturing orders (ensure table exists, then extend if present)
CREATE TABLE IF NOT EXISTS public.manufacturing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  partner_id uuid REFERENCES public.manufacturing_partners(id),
  partner_order_id text,
  request_payload jsonb,
  response_payload jsonb,
  status text DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','in_production','shipped','cancelled','failed')),
  assigned_at timestamptz,
  shipped_at timestamptz,
  tracking_number text,
  creator_user_id uuid REFERENCES public.users(id),
  work_id uuid REFERENCES public.works(id),
  created_at timestamptz DEFAULT now()
);

-- Manufacturing orders (extend existing if present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='partner_id'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN partner_id uuid REFERENCES public.manufacturing_partners(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='status'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN status text DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','in_production','shipped','cancelled','failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='assigned_at'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN assigned_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='shipped_at'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN shipped_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='tracking_number'
  ) THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN tracking_number text;
  END IF;
END $$;

-- Partner notifications
CREATE TABLE IF NOT EXISTS public.partner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.manufacturing_partners(id) NOT NULL,
  type text NOT NULL,
  payload jsonb,
  status text DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Partner reviews
CREATE TABLE IF NOT EXISTS public.partner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.manufacturing_partners(id) NOT NULL,
  author_user_id uuid REFERENCES public.users(id) NOT NULL,
  manufacturing_order_id uuid REFERENCES public.manufacturing_orders(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_reviews_partner ON public.partner_reviews(partner_id);

-- Price history for factory_products
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_product_id uuid REFERENCES public.factory_products(id) NOT NULL,
  old_base_cost integer,
  new_base_cost integer NOT NULL,
  changed_by uuid REFERENCES public.users(id),
  changed_at timestamptz DEFAULT now()
);

-- Extend purchases for two-stage fees and accounting transparency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='purchases' AND column_name='factory_payment'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN factory_payment integer; -- 工場への支払額（原価）
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='purchases' AND column_name='platform_markup'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN platform_markup integer; -- 原価手数料（10%）
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='purchases' AND column_name='platform_sales_fee'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN platform_sales_fee integer; -- 販売手数料（30%）
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='purchases' AND column_name='platform_total_revenue'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN platform_total_revenue integer; -- 上記合算
  END IF;
END $$;

-- Mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_marketplace', 'local')
ON CONFLICT (version) DO NOTHING;
