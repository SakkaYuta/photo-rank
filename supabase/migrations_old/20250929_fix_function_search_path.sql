-- Fix: Set stable search_path for security-sensitive helper functions
-- Linter: function_search_path_mutable

-- set_updated_at() without args
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public';
  END IF;
END$$;

-- is_admin_strict(uuid)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin_strict'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_admin_strict(uuid) SET search_path = pg_catalog, public';
  END IF;
END$$;

-- current_role_is_service_role()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'current_role_is_service_role'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.current_role_is_service_role() SET search_path = pg_catalog, public';
  END IF;
END$$;

-- Optional: Ensure future creations follow best practices (documentation note)
-- Recommendation: define functions with schema-qualified names and set search_path explicitly
-- e.g., CREATE FUNCTION ... LANGUAGE sql SET search_path = pg_catalog, public AS $$ ... $$;
-- ARCHIVED: superseded by 20250930_fix_function_search_path_any.sql and 20251005_fix_function_search_path_security.sql
-- Do not run in new setups.
