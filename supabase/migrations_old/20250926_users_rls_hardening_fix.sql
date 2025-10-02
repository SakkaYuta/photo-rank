-- Fix for function signature conflict: is_admin_strict(uuid)
-- Error: cannot change name of input parameter; drop and recreate with stable signature

DO $$ BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'public.users not found; skipping is_admin_strict fix.';
    RETURN;
  END IF;
END $$;

-- Drop prior version if it exists (by signature)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    EXECUTE 'DROP FUNCTION public.is_admin_strict(uuid)';
  END IF;
END $$;

-- Recreate with stable signature and original parameter name p_user
CREATE OR REPLACE FUNCTION public.is_admin_strict(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user
      AND (
        u.user_type = 'admin'
        OR (u.metadata ->> 'is_admin')::boolean IS TRUE
      )
  )
$$;
COMMENT ON FUNCTION public.is_admin_strict(uuid) IS 'App-level admin check from users.user_type/metadata';

