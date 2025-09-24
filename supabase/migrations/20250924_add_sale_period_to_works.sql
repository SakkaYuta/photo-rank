-- Add sale period columns to works (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'works' AND column_name = 'sale_start_at'
  ) THEN
    ALTER TABLE public.works ADD COLUMN sale_start_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'works' AND column_name = 'sale_end_at'
  ) THEN
    ALTER TABLE public.works ADD COLUMN sale_end_at timestamptz;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_works_sale_start_at ON public.works(sale_start_at);
CREATE INDEX IF NOT EXISTS idx_works_sale_end_at ON public.works(sale_end_at);

COMMENT ON COLUMN public.works.sale_start_at IS 'Optional: sales start datetime';
COMMENT ON COLUMN public.works.sale_end_at IS 'Optional: sales end datetime';

