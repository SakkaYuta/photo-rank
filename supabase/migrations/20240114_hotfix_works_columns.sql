-- Hotfix: ensure works has columns required by later indexes
-- Some environments may already have works without these columns.

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

