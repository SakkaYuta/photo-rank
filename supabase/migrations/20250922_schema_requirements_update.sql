-- Schema updates based on new requirements
-- Safe migrations with backwards compatibility

-- Ensure all tables have updated_at columns and triggers
-- This is idempotent and safe to run multiple times

-- Add missing updated_at columns where needed
DO $$ BEGIN
  -- works table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.works ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- users table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- user_profiles table
  IF to_regclass('public.user_profiles') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- cart_items table
  IF to_regclass('public.cart_items') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cart_items'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.cart_items ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add user_type column to users table if missing (for role management)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'user_type'
  ) THEN
    ALTER TABLE public.users ADD COLUMN user_type text DEFAULT 'general' CHECK (user_type IN ('general', 'creator', 'factory', 'organizer'));
  END IF;
END $$;

-- Add metadata jsonb column for flexible data storage
DO $$ BEGIN
  -- works table metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'works'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.works ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- users table metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.users ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_works_updated_at ON public.works(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_works_metadata ON public.works USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_users_metadata ON public.users USING gin(metadata);

-- Update RLS policies to be more flexible
-- Drop and recreate user policies for works table
DROP POLICY IF EXISTS works_user_policy ON public.works;
CREATE POLICY works_user_policy ON public.works
  FOR ALL
  USING (
    auth.uid() = creator_id OR
    auth.uid() IN (
      SELECT id FROM public.users WHERE user_type IN ('organizer', 'factory')
    )
  )
  WITH CHECK (
    auth.uid() = creator_id OR
    auth.uid() IN (
      SELECT id FROM public.users WHERE user_type IN ('organizer', 'factory')
    )
  );

-- Add comment for tracking schema version
COMMENT ON SCHEMA public IS 'Schema version: 2025-09-22 - Requirements update applied';