-- Extend battles table for requested start + approval + cancellation tracking (idempotent)
DO $$ BEGIN
  IF to_regclass('public.battles') IS NULL THEN
    RAISE NOTICE 'battles table not found; skipping extension.';
    RETURN;
  END IF;

  -- requested_start_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='requested_start_at'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN requested_start_at timestamptz;
  END IF;

  -- opponent_accepted
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='opponent_accepted'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN opponent_accepted boolean;
  END IF;

  -- opponent_response_reason / opponent_response_at (for audit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='opponent_response_reason'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN opponent_response_reason text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='opponent_response_at'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN opponent_response_at timestamptz;
  END IF;

  -- winner_id for final result
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='winner_id'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN winner_id uuid;
  END IF;

  -- cancellation tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='cancelled_at'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN cancelled_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='battles' AND column_name='cancel_reason'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN cancel_reason text;
  END IF;

END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_battles_status ON public.battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_requested_start ON public.battles(requested_start_at);
CREATE INDEX IF NOT EXISTS idx_battles_start_time ON public.battles(start_time);

