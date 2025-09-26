-- Add optional image gallery (up to 10 URLs) for works/products
-- Safe to run multiple times

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'works' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE public.works
      ADD COLUMN image_urls jsonb NULL;
  END IF;
END $$;

-- Enforce array type and max length 10 if present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'works_image_urls_max10'
  ) THEN
    ALTER TABLE public.works
      ADD CONSTRAINT works_image_urls_max10
      CHECK (
        image_urls IS NULL OR (
          jsonb_typeof(image_urls) = 'array' AND jsonb_array_length(image_urls) <= 10
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.works.image_urls IS 'Optional gallery of additional image URLs (max 10). Order is respected.';

