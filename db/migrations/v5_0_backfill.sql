-- v5.0 backfill for purchases two-stage fees (idempotent-ish)

-- Ensure nulls are set to zero for safe math
UPDATE public.purchases
SET factory_payment = COALESCE(factory_payment, 0)
WHERE factory_payment IS NULL;

-- Compute fees if missing
UPDATE public.purchases
SET 
  platform_markup = COALESCE(platform_markup, ROUND(factory_payment * 0.10)),
  platform_sales_fee = COALESCE(platform_sales_fee, ROUND(COALESCE(price,0) * 0.30)),
  platform_total_revenue = COALESCE(platform_total_revenue, 
    COALESCE(ROUND(factory_payment * 0.10),0) + COALESCE(ROUND(COALESCE(price,0) * 0.30),0)
  )
WHERE (platform_markup IS NULL OR platform_sales_fee IS NULL OR platform_total_revenue IS NULL);

-- mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_backfill', 'local')
ON CONFLICT (version) DO NOTHING;

