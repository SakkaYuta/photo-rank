-- Fix users table schema conflicts
-- Ensures all required columns exist before INSERT operations

-- First, ensure the users table exists with proper schema
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  avatar_url text,
  bio text,
  phone text,
  notification_settings jsonb DEFAULT '{}'::jsonb,
  privacy_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns safely (idempotent)
DO $$ BEGIN
  -- Add email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.users ADD COLUMN email text UNIQUE;
  END IF;

  -- Add is_creator column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'is_creator'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_creator boolean DEFAULT false;
  END IF;

  -- Add is_verified column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_verified boolean DEFAULT false;
  END IF;

  -- Add user_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'user_type'
  ) THEN
    ALTER TABLE public.users ADD COLUMN user_type text DEFAULT 'general'
    CHECK (user_type IN ('general', 'creator', 'factory', 'organizer'));
  END IF;

  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.users ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON public.users(is_creator);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_metadata ON public.users USING gin(metadata);

-- Ensure the table has RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Update existing users with default user_type if null
UPDATE public.users SET user_type = 'general' WHERE user_type IS NULL;
UPDATE public.users SET is_creator = COALESCE(is_creator, false) WHERE is_creator IS NULL;
UPDATE public.users SET is_verified = COALESCE(is_verified, false) WHERE is_verified IS NULL;

-- Add comment for tracking
COMMENT ON TABLE public.users IS 'Users table - Schema fixed for email column compatibility';