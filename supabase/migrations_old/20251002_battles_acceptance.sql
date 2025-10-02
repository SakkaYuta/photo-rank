-- Add opponent acceptance flag to battles
ALTER TABLE IF EXISTS public.battles
  ADD COLUMN IF NOT EXISTS opponent_accepted boolean DEFAULT false;

