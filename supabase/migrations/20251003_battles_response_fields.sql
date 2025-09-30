-- opponent response reason and timestamp
ALTER TABLE IF EXISTS public.battles
  ADD COLUMN IF NOT EXISTS opponent_response_reason text,
  ADD COLUMN IF NOT EXISTS opponent_response_at timestamptz;

