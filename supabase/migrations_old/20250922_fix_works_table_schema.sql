-- Fix works table schema conflicts
-- Ensures all required columns exist before INSERT operations

-- First, ensure the works table exists with proper schema
CREATE TABLE IF NOT EXISTS public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  creator_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  price integer NOT NULL,
  image_url text NOT NULL,
  category text,
  tags text[],
  is_active boolean DEFAULT true,
  factory_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns safely (idempotent)
DO $$ BEGIN
  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.works ADD COLUMN description text;
  END IF;

  -- Add title column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'title'
  ) THEN
    ALTER TABLE public.works ADD COLUMN title text NOT NULL DEFAULT 'Untitled';
  END IF;

  -- Add creator_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE public.works ADD COLUMN creator_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- Add price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'price'
  ) THEN
    ALTER TABLE public.works ADD COLUMN price integer NOT NULL DEFAULT 0;
  END IF;

  -- Add image_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.works ADD COLUMN image_url text NOT NULL DEFAULT '';
  END IF;

  -- Add category column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.works ADD COLUMN category text;
  END IF;

  -- Add tags column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.works ADD COLUMN tags text[];
  END IF;

  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.works ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  -- Add factory_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'factory_id'
  ) THEN
    ALTER TABLE public.works ADD COLUMN factory_id text;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.works ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.works ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Add metadata column for flexible storage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.works ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_works_creator_id ON public.works(creator_id);
CREATE INDEX IF NOT EXISTS idx_works_category ON public.works(category);
CREATE INDEX IF NOT EXISTS idx_works_is_active ON public.works(is_active);
CREATE INDEX IF NOT EXISTS idx_works_created_at ON public.works(created_at);
CREATE INDEX IF NOT EXISTS idx_works_price ON public.works(price);
CREATE INDEX IF NOT EXISTS idx_works_tags ON public.works USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_works_metadata ON public.works USING gin(metadata);

-- Ensure the table has RLS enabled
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

-- Update any NULL values to defaults
UPDATE public.works SET
  title = COALESCE(title, 'Untitled'),
  price = COALESCE(price, 0),
  image_url = COALESCE(image_url, ''),
  is_active = COALESCE(is_active, true)
WHERE title IS NULL OR price IS NULL OR image_url IS NULL OR is_active IS NULL;

-- Add comment for tracking
COMMENT ON TABLE public.works IS 'Works table - Schema fixed for description and other columns compatibility';