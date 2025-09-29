-- Shipping information storage on manufacturing_partners
-- Idempotent migration to add shipping_info jsonb column

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

