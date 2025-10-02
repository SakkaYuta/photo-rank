-- Harden function search_path for security-sensitive functions (catch-all)
-- Covers any overloads of listed functions and sets search_path to pg_catalog, public

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS fname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_updated_at','is_admin_strict','current_role_is_service_role')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public', r.schema, r.fname, r.args);
  END LOOP;
END $$;

COMMENT ON SCHEMA public IS 'Ensure function search_path hardened for security-sensitive functions';

