-- Enforce shipping_info presence before factory product creation/update
-- Requires: public.manufacturing_partners (shipping_info jsonb), public.factory_products

CREATE OR REPLACE FUNCTION public.ensure_partner_shipping_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s jsonb;
  fee_txt text;
BEGIN
  -- Fetch partner's shipping_info
  SELECT shipping_info INTO s
  FROM public.manufacturing_partners
  WHERE id = NEW.partner_id;

  -- Basic presence checks
  IF s IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'shipping_info must be set on manufacturing_partners before registering products.';
  END IF;

  -- Required text fields: method_title, carrier_name
  IF NULLIF(COALESCE(s->>'method_title',''), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.method_title is required.';
  END IF;
  IF NULLIF(COALESCE(s->>'carrier_name',''), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.carrier_name is required.';
  END IF;

  -- Required numeric field: fee_general_jpy (non-negative integer)
  IF NOT (s ? 'fee_general_jpy') THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.fee_general_jpy is required.';
  END IF;
  fee_txt := s->>'fee_general_jpy';
  IF fee_txt IS NULL OR NOT (fee_txt ~ '^[0-9]+$') OR fee_txt::bigint < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.fee_general_jpy must be a non-negative integer.';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present to keep migration idempotent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'factory_products_require_shipping_info'
  ) THEN
    DROP TRIGGER factory_products_require_shipping_info ON public.factory_products;
  END IF;
END $$;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER factory_products_require_shipping_info
BEFORE INSERT OR UPDATE ON public.factory_products
FOR EACH ROW EXECUTE FUNCTION public.ensure_partner_shipping_info();

COMMENT ON FUNCTION public.ensure_partner_shipping_info() IS 'Blocks factory_products insert/update when partner.shipping_info (method_title, carrier_name, fee_general_jpy) is missing or invalid.';

