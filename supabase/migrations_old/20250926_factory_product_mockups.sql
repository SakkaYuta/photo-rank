-- Factory product mockups: base photos and design geometry per angle

DO $$ BEGIN
  IF to_regclass('public.factory_products') IS NULL THEN
    RAISE NOTICE 'factory_products not found; skipping table creation';
    RETURN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.factory_product_mockups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_product_id uuid NOT NULL REFERENCES public.factory_products(id) ON DELETE CASCADE,
  label text,
  image_url text NOT NULL,
  geometry jsonb NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpm_factory ON public.factory_product_mockups(factory_product_id);
CREATE INDEX IF NOT EXISTS idx_fpm_active ON public.factory_product_mockups(is_active);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS set_updated_at_fpm ON public.factory_product_mockups;
CREATE TRIGGER set_updated_at_fpm BEFORE UPDATE ON public.factory_product_mockups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.factory_product_mockups ENABLE ROW LEVEL SECURITY;

-- Public read access (optional). If you want to restrict, adjust accordingly.
DROP POLICY IF EXISTS fpm_public_select ON public.factory_product_mockups;
CREATE POLICY fpm_public_select ON public.factory_product_mockups
  FOR SELECT USING (true);

-- Partner owner manage own mockups (assumes factory_products has factory_id and partners ownership)
DROP POLICY IF EXISTS fpm_partner_manage ON public.factory_product_mockups;
CREATE POLICY fpm_partner_manage ON public.factory_product_mockups
  USING (
    EXISTS (
      SELECT 1 FROM public.factory_products fp
      JOIN public.manufacturing_partners mp ON mp.id = fp.partner_id
      WHERE fp.id = factory_product_id
        AND (
          (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
          OR (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') = (mp.owner_user_id)::text
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.factory_products fp
      JOIN public.manufacturing_partners mp ON mp.id = fp.partner_id
      WHERE fp.id = factory_product_id
        AND (
          (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
          OR (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') = (mp.owner_user_id)::text
        )
    )
  );

COMMENT ON TABLE public.factory_product_mockups IS 'Factory-supplied base photos with geometry for product mockups';
COMMENT ON COLUMN public.factory_product_mockups.geometry IS 'JSON: {x,y,width,rotation,skewX,skewY,opacity,blendMode,maskUrl}';

