-- Consolidated base schema for PhotoRank (idempotent, safe to run on reset)
-- This file unifies core tables and policies commonly required by the app.
-- Notes:
--  - Uses IF NOT EXISTS / DO $$ checks to remain safe when applied multiple times
--  - Keeps precise RLS from per-table legacy migrations out of scope; rely on existing security files for fine-tuning

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- users (base)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_creator BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  phone TEXT,
  notification_settings JSONB,
  privacy_settings JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- works (base)
CREATE TABLE IF NOT EXISTS public.works (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT true,
  factory_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- purchases
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  work_id UUID REFERENCES public.works(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  work_id UUID REFERENCES public.works(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_favorites_user_work ON public.favorites(user_id, work_id);

-- cart_items (minimal)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  work_id UUID REFERENCES public.works(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, work_id)
);

-- manufacturing_partners (minimal for app)
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
  shipping_info jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  avg_rating numeric(3,2) DEFAULT 0.0,
  ratings_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- factory_products (minimal)
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
CREATE INDEX IF NOT EXISTS idx_factory_products_partner_active ON public.factory_products(partner_id, is_active);

-- organizer_leave_requests
CREATE TABLE IF NOT EXISTS public.organizer_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  effective_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at timestamptz DEFAULT now()
);

-- updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_works_updated ON public.works;
CREATE TRIGGER trg_works_updated BEFORE UPDATE ON public.works FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_factory_products_updated ON public.factory_products;
CREATE TRIGGER trg_factory_products_updated BEFORE UPDATE ON public.factory_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_manufacturing_partners_updated ON public.manufacturing_partners;
CREATE TRIGGER trg_manufacturing_partners_updated BEFORE UPDATE ON public.manufacturing_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS enable (base)
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_leave_requests ENABLE ROW LEVEL SECURITY;

-- Minimal policies (detailed/security-hardening policies remain in existing security files)
DROP POLICY IF EXISTS works_public_read ON public.works;
CREATE POLICY works_public_read ON public.works FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS favorites_owner_all ON public.favorites;
CREATE POLICY favorites_owner_all ON public.favorites FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cart_items_owner_all ON public.cart_items;
CREATE POLICY cart_items_owner_all ON public.cart_items FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

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

DROP POLICY IF EXISTS olr_organizer_rw ON public.organizer_leave_requests;
CREATE POLICY olr_organizer_rw ON public.organizer_leave_requests FOR ALL USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

-- End of consolidated base schema
-- ARCHIVED: Deprecated consolidated migration. Do not run for new setups.
-- Use individual active migrations instead. Kept for historical reference.
