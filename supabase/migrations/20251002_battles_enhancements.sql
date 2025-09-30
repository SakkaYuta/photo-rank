-- Enhance battles with optional metadata fields
ALTER TABLE IF EXISTS public.battles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public','private')),
  ADD COLUMN IF NOT EXISTS requested_start_at timestamptz;

