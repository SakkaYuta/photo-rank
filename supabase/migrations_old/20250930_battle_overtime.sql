-- Add overtime_count to battles for OT tracking (max 2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='battles' AND column_name='overtime_count'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN overtime_count integer DEFAULT 0;
  END IF;
END $$;

