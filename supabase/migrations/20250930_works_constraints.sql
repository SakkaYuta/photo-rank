-- Add safety CHECK constraints to works
DO $$ BEGIN
  IF to_regclass('public.works') IS NULL THEN
    RETURN;
  END IF;

  -- price > 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'works_price_positive'
  ) THEN
    ALTER TABLE public.works
      ADD CONSTRAINT works_price_positive CHECK (price > 0);
  END IF;

  -- sale_end_at within 365 days from sale_start_at if both present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'works_sale_period_max_365d'
  ) THEN
    ALTER TABLE public.works
      ADD CONSTRAINT works_sale_period_max_365d CHECK (
        sale_start_at IS NULL OR sale_end_at IS NULL OR sale_end_at <= sale_start_at + interval '365 days'
      );
  END IF;
END $$;

